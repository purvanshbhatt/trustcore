"""Database engine and table definitions shared by report storage and billing.

Production uses Postgres (Supabase) via ``DATABASE_URL``; local development and
the test suite run the same SQL on SQLite.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    event,
    inspect,
)
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import URL, Connection, Engine, make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import StaticPool

from app.core.config import LOCAL_DEV_HINT, env_flag, is_development

logger = logging.getLogger(__name__)

DEFAULT_DEV_DATABASE_URL = "sqlite+pysqlite:///./data/trustcore.db"

metadata = MetaData()

reports_table = Table(
    "reports",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(255), nullable=False),
    Column("product", String(32), nullable=False),
    Column("title", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("payload", JSON().with_variant(JSONB(), "postgresql"), nullable=False),
)
Index("ix_reports_user_created", reports_table.c.user_id, reports_table.c.created_at.desc())

# One row per account. Signed-out visitors get a row keyed by a hash of their IP
# so the single free preview cannot be repeated.
entitlements_table = Table(
    "entitlements",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("tier", String(32), nullable=False, server_default="free"),
    Column("credits_remaining", Integer, nullable=False, server_default="0"),
    Column("free_scans_used", Integer, nullable=False, server_default="0"),
    Column("stripe_customer_id", String(255), nullable=True),
    Column("stripe_subscription_id", String(255), nullable=True),
    Column("updated_at", DateTime(timezone=True), nullable=True),
)
Index("ix_entitlements_subscription", entitlements_table.c.stripe_subscription_id)

# Processed Stripe event ids: makes webhook handling idempotent across retries.
stripe_events_table = Table(
    "stripe_events",
    metadata,
    Column("event_id", String(255), primary_key=True),
    Column("event_type", String(64), nullable=False),
    Column("processed_at", DateTime(timezone=True), nullable=False),
)


class StorageError(RuntimeError):
    """Raised when the database is unavailable or a query fails."""


def normalize_database_url(database_url: str) -> str:
    """Map generic Postgres URLs (as issued by Supabase) onto the psycopg 3 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url[len(prefix):]
    return database_url


def build_engine(database_url: str) -> Engine:
    """Create an engine. ``hide_parameters`` keeps bound values out of logs and errors."""
    url: URL = make_url(normalize_database_url(database_url))
    if url.get_backend_name() == "sqlite":
        connect_args: Dict[str, Any] = {"check_same_thread": False}
        if url.database in (None, "", ":memory:"):
            # One shared connection so every thread sees the same in-memory database.
            return create_engine(url, connect_args=connect_args, poolclass=StaticPool, hide_parameters=True)
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(url, connect_args=connect_args, hide_parameters=True)

        @event.listens_for(engine, "connect")
        def _use_write_ahead_log(dbapi_connection: Any, _record: Any) -> None:
            # WAL lets concurrent requests read while one writes and makes commits
            # cheap, which keeps tail latency down on the local SQLite backend.
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        return engine

    connect_args = {}
    if url.get_driver_name() == "psycopg":
        # Supabase's transaction pooler (PgBouncer) does not support prepared statements.
        connect_args["prepare_threshold"] = None
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
        connect_args=connect_args,
        hide_parameters=True,
    )


def prepare_tables(engine: Engine, *tables: Table, auto_create: Optional[bool] = None) -> None:
    """Create ``tables`` (SQLite, or when asked) or verify that they exist.

    On Supabase tables must come from ``services/api/migrations/*.sql`` so Row
    Level Security is enabled before they are reachable through PostgREST.

    Raises:
        StorageError: if the database is unreachable or a table is missing.
    """
    should_create = engine.dialect.name == "sqlite" if auto_create is None else auto_create
    try:
        if should_create:
            metadata.create_all(engine, tables=list(tables))
            return
        inspector = inspect(engine)
        missing = [table.name for table in tables if not inspector.has_table(table.name)]
    except SQLAlchemyError as exc:
        raise StorageError(f"Could not initialise database tables ({type(exc).__name__})") from exc
    if missing:
        raise StorageError(
            f"Missing table(s): {', '.join(missing)}. Apply services/api/migrations/*.sql "
            "(or set DB_AUTO_CREATE=true)."
        )


def insert_if_absent(connection: Connection, table: Table, values: Dict[str, Any]) -> bool:
    """``INSERT ... ON CONFLICT DO NOTHING``; returns ``True`` when a row was inserted.

    Unlike catching an integrity error, this never aborts the surrounding transaction.
    """
    dialect = postgresql if connection.dialect.name == "postgresql" else sqlite
    statement = dialect.insert(table).values(**values).on_conflict_do_nothing()
    return connection.execute(statement).rowcount > 0


def resolve_database_url() -> str:
    """Return ``DATABASE_URL``, falling back to a local SQLite file in development only."""
    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if database_url:
        return database_url
    if is_development():
        logger.warning("DATABASE_URL is not set; using local SQLite storage (development only)")
        return DEFAULT_DEV_DATABASE_URL
    raise RuntimeError(
        f"DATABASE_URL must be set (Postgres/Supabase connection string). {LOCAL_DEV_HINT}"
    )


def auto_create_requested() -> Optional[bool]:
    """``True`` when ``DB_AUTO_CREATE`` asks for tables to be created; ``None`` for the default."""
    return env_flag("DB_AUTO_CREATE", default=False) or None


_engine: Optional[Engine] = None


def get_engine() -> Engine:
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        _engine = build_engine(resolve_database_url())
    return _engine
