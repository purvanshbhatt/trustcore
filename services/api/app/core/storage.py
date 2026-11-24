"""Report persistence. Every read, write, and delete is scoped to the owning ``user_id``.

Production stores reports in Postgres (Supabase) via ``DATABASE_URL``. The same
repository runs on SQLite for local development and the test suite, so the
ownership filters exercised by tests are the ones that run in production.
"""
from __future__ import annotations

import datetime
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.db import (  # noqa: F401  (StorageError and normalize_database_url are re-exported)
    StorageError,
    auto_create_requested,
    build_engine,
    get_engine,
    normalize_database_url,
    prepare_tables,
    reports_table,
)
from app.core.schemas import Report

logger = logging.getLogger(__name__)


class ReportOwnershipError(StorageError):
    """Raised when a write targets a report id owned by a different user."""


class BaseReportStorage(ABC):
    """Abstract repository for persisting and retrieving scan reports per user."""

    @abstractmethod
    def save_report(self, report: Report, user_id: str) -> Report:
        """Persist a report owned by ``user_id``."""

    @abstractmethod
    def get_report(self, report_id: str, user_id: str) -> Optional[Report]:
        """Retrieve a report by ID, or ``None`` if it is missing or not owned by ``user_id``."""

    @abstractmethod
    def list_reports(self, user_id: str, limit: int = 50) -> List[Report]:
        """List the most recent reports owned by ``user_id``."""

    @abstractmethod
    def delete_report(self, report_id: str, user_id: str) -> bool:
        """Delete a report owned by ``user_id``. Returns ``False`` if nothing was deleted."""


def _parse_timestamp(value: str) -> datetime.datetime:
    """Parse a report's ISO-8601 ``created_at``; naive values are treated as UTC."""
    try:
        parsed = datetime.datetime.fromisoformat(value)
    except ValueError:
        logger.warning("Report has an unparseable created_at; using current time")
        return datetime.datetime.now(datetime.timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=datetime.timezone.utc)
    return parsed


def _require_user(user_id: str) -> None:
    if not user_id:
        raise ValueError("user_id is required for every storage operation")


class PostgresReportRepository(BaseReportStorage):
    """SQL report repository (Postgres/Supabase in production, SQLite for dev and tests).

    Ownership is enforced in every statement: lookups and deletes filter on both
    ``id`` and ``user_id``, so a caller can never read or remove another user's
    report, and cannot learn whether a foreign report id exists.
    """

    def __init__(
        self,
        database_url: Optional[str] = None,
        *,
        engine: Optional[Engine] = None,
        auto_create: Optional[bool] = None,
    ) -> None:
        """Connect to the database.

        Args:
            database_url: SQLAlchemy URL; ``postgres://`` and ``postgresql://`` are accepted.
            engine: An existing engine to share (the application uses one for all tables).
            auto_create: Create the table if missing. Defaults to SQLite only: on
                Supabase the table must come from ``migrations/001_reports.sql`` so
                Row Level Security is enabled before it is exposed through PostgREST.

        Raises:
            StorageError: if the database is unreachable or the table is missing.
        """
        if engine is None:
            if not database_url:
                raise ValueError("database_url or engine is required")
            engine = build_engine(database_url)
        self._engine = engine
        prepare_tables(engine, reports_table, auto_create=auto_create)

    def save_report(self, report: Report, user_id: str) -> Report:
        _require_user(user_id)
        values = {
            "user_id": user_id,
            "product": report.product.value,
            "title": report.title,
            "created_at": _parse_timestamp(report.created_at),
            "payload": report.model_dump(mode="json"),
        }
        try:
            # Common path: a new report is a single INSERT (one round trip).
            with self._engine.begin() as connection:
                connection.execute(insert(reports_table).values(id=report.id, **values))
            return report
        except IntegrityError:
            pass  # The id already exists: fall through to the owner-only update.
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not save report ({type(exc).__name__})") from exc

        try:
            # The WHERE clause only matches the caller's own row, so an id owned by
            # another user is never overwritten.
            with self._engine.begin() as connection:
                result = connection.execute(
                    update(reports_table)
                    .where(reports_table.c.id == report.id, reports_table.c.user_id == user_id)
                    .values(**values)
                )
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not save report ({type(exc).__name__})") from exc
        if result.rowcount == 0:
            raise ReportOwnershipError("Report id is already in use.")
        return report

    def get_report(self, report_id: str, user_id: str) -> Optional[Report]:
        _require_user(user_id)
        try:
            with self._engine.connect() as connection:
                payload = connection.execute(
                    select(reports_table.c.payload).where(
                        reports_table.c.id == report_id,
                        reports_table.c.user_id == user_id,
                    )
                ).scalar_one_or_none()
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not load report ({type(exc).__name__})") from exc
        return Report.model_validate(payload) if payload is not None else None

    def list_reports(self, user_id: str, limit: int = 50) -> List[Report]:
        _require_user(user_id)
        try:
            with self._engine.connect() as connection:
                payloads = connection.execute(
                    select(reports_table.c.payload)
                    .where(reports_table.c.user_id == user_id)
                    .order_by(reports_table.c.created_at.desc(), reports_table.c.id)
                    .limit(max(1, limit))
                ).scalars().all()
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not list reports ({type(exc).__name__})") from exc
        return [Report.model_validate(payload) for payload in payloads]

    def delete_report(self, report_id: str, user_id: str) -> bool:
        _require_user(user_id)
        try:
            with self._engine.begin() as connection:
                result = connection.execute(
                    delete(reports_table).where(
                        reports_table.c.id == report_id,
                        reports_table.c.user_id == user_id,
                    )
                )
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not delete report ({type(exc).__name__})") from exc
        return result.rowcount > 0


_storage_instance: Optional[BaseReportStorage] = None


def get_storage() -> BaseReportStorage:
    """Return the process-wide report repository, creating it on first use."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = PostgresReportRepository(engine=get_engine(), auto_create=auto_create_requested())
    return _storage_instance
