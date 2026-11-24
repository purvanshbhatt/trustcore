"""Per-user entitlements: tier, scan credits, and the single free preview.

All state lives in the ``entitlements`` table. Every change that spends or
grants something is a single conditional ``UPDATE`` (or runs in one
transaction), so concurrent requests cannot double-spend a credit and a
re-delivered Stripe event cannot grant twice.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, FrozenSet, Optional

from sqlalchemy import select, update
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import SQLAlchemyError

from app.core.db import (
    StorageError,
    build_engine,
    entitlements_table,
    insert_if_absent,
    prepare_tables,
    stripe_events_table,
)

FREE_PREVIEW_SCANS = 1


class Tier(str, Enum):
    FREE = "free"
    PER_SCAN = "per_scan"
    PRO_MONTHLY = "pro_monthly"
    ENTERPRISE = "enterprise"


SUBSCRIPTION_TIERS: FrozenSet[Tier] = frozenset({Tier.PRO_MONTHLY, Tier.ENTERPRISE})


class ScanAccess(str, Enum):
    FULL = "full"
    PREVIEW = "preview"


class PaymentRequired(Exception):
    """The caller has used their free preview and has no credits or subscription."""


@dataclass(frozen=True)
class Entitlement:
    """What an account is entitled to."""

    user_id: str
    tier: Tier = Tier.FREE
    credits_remaining: int = 0
    free_scans_used: int = 0
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None

    @property
    def subscription_active(self) -> bool:
        return self.tier in SUBSCRIPTION_TIERS

    @property
    def free_preview_available(self) -> bool:
        return self.free_scans_used < FREE_PREVIEW_SCANS

    @property
    def can_run_full_scan(self) -> bool:
        return self.subscription_active or self.credits_remaining > 0


@dataclass(frozen=True)
class ScanGrant:
    """Permission to run one scan, and what was spent to obtain it (for refunds)."""

    user_id: str
    access: ScanAccess
    spent: Optional[str] = None  # "credit", "free_preview", or None (subscription / mock)


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _parse_tier(value: Any) -> Tier:
    try:
        return Tier(value)
    except ValueError:
        return Tier.FREE


class EntitlementRepository:
    """SQL store for entitlements and processed Stripe events."""

    def __init__(
        self,
        database_url: Optional[str] = None,
        *,
        engine: Optional[Engine] = None,
        auto_create: Optional[bool] = None,
    ) -> None:
        """Use ``engine`` when given (the application shares one), else connect to ``database_url``."""
        if engine is None:
            if not database_url:
                raise ValueError("database_url or engine is required")
            engine = build_engine(database_url)
        self._engine = engine
        prepare_tables(engine, entitlements_table, stripe_events_table, auto_create=auto_create)

    # --- reads ---------------------------------------------------------------

    def get(self, user_id: str) -> Entitlement:
        """Return the account's entitlement; unknown accounts are free with an unused preview."""
        try:
            with self._engine.connect() as connection:
                row = connection.execute(
                    select(entitlements_table).where(entitlements_table.c.user_id == user_id)
                ).mappings().first()
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not load entitlement ({type(exc).__name__})") from exc
        if row is None:
            return Entitlement(user_id=user_id)
        return Entitlement(
            user_id=user_id,
            tier=_parse_tier(row["tier"]),
            credits_remaining=row["credits_remaining"],
            free_scans_used=row["free_scans_used"],
            stripe_customer_id=row["stripe_customer_id"],
            stripe_subscription_id=row["stripe_subscription_id"],
        )

    # --- spending ------------------------------------------------------------

    def authorize_scan(self, user_id: str) -> ScanGrant:
        """Decide what one scan request gets, spending a credit or the free preview.

        Order: active subscription (nothing spent) > one scan credit > the free preview.

        Raises:
            PaymentRequired: when none of those is available.
        """
        table = entitlements_table
        try:
            with self._engine.begin() as connection:
                insert_if_absent(connection, table, {"user_id": user_id, "updated_at": _now()})
                tier = connection.execute(select(table.c.tier).where(table.c.user_id == user_id)).scalar_one()
                if _parse_tier(tier) in SUBSCRIPTION_TIERS:
                    return ScanGrant(user_id, ScanAccess.FULL)

                # Conditional updates: the WHERE clause makes each spend atomic.
                spent_credit = connection.execute(
                    update(table)
                    .where(table.c.user_id == user_id, table.c.credits_remaining > 0)
                    .values(credits_remaining=table.c.credits_remaining - 1, updated_at=_now())
                ).rowcount
                if spent_credit:
                    return ScanGrant(user_id, ScanAccess.FULL, spent="credit")

                used_preview = connection.execute(
                    update(table)
                    .where(table.c.user_id == user_id, table.c.free_scans_used < FREE_PREVIEW_SCANS)
                    .values(free_scans_used=table.c.free_scans_used + 1, updated_at=_now())
                ).rowcount
                if used_preview:
                    return ScanGrant(user_id, ScanAccess.PREVIEW, spent="free_preview")
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not authorise scan ({type(exc).__name__})") from exc
        raise PaymentRequired()

    def refund(self, grant: ScanGrant) -> None:
        """Give back what a grant spent, for a scan that failed before producing a report."""
        table = entitlements_table
        if grant.spent == "credit":
            values: Dict[str, Any] = {"credits_remaining": table.c.credits_remaining + 1}
            condition = table.c.user_id == grant.user_id
        elif grant.spent == "free_preview":
            values = {"free_scans_used": table.c.free_scans_used - 1}
            condition = (table.c.user_id == grant.user_id) & (table.c.free_scans_used > 0)
        else:
            return
        try:
            with self._engine.begin() as connection:
                connection.execute(update(table).where(condition).values(updated_at=_now(), **values))
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not refund scan ({type(exc).__name__})") from exc

    # --- Stripe events -------------------------------------------------------

    @staticmethod
    def _record_event(connection: Connection, event_id: str, event_type: str) -> bool:
        """Claim a Stripe event id; ``False`` means it was already processed."""
        return insert_if_absent(
            connection,
            stripe_events_table,
            {"event_id": event_id, "event_type": event_type[:64], "processed_at": _now()},
        )

    def grant_checkout(
        self,
        event_id: str,
        event_type: str,
        user_id: str,
        tier: Tier,
        *,
        credits: int,
        customer_id: Optional[str],
        subscription_id: Optional[str] = None,
    ) -> bool:
        """Apply a paid checkout: add scan credits or activate a subscription.

        The event id and the entitlement change commit together, so a retried
        delivery of the same event is a no-op. Returns ``False`` for a duplicate.
        """
        table = entitlements_table
        try:
            with self._engine.begin() as connection:
                if not self._record_event(connection, event_id, event_type):
                    return False
                insert_if_absent(connection, table, {"user_id": user_id, "updated_at": _now()})
                values: Dict[str, Any] = {"updated_at": _now()}
                if customer_id:
                    values["stripe_customer_id"] = customer_id
                if tier in SUBSCRIPTION_TIERS:
                    values["tier"] = tier.value
                    values["stripe_subscription_id"] = subscription_id
                    connection.execute(update(table).where(table.c.user_id == user_id).values(**values))
                else:
                    values["credits_remaining"] = table.c.credits_remaining + max(0, credits)
                    connection.execute(update(table).where(table.c.user_id == user_id).values(**values))
                    # A credit purchase never downgrades an active subscription.
                    connection.execute(
                        update(table)
                        .where(table.c.user_id == user_id, table.c.tier == Tier.FREE.value)
                        .values(tier=Tier.PER_SCAN.value)
                    )
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not apply checkout ({type(exc).__name__})") from exc
        return True

    def cancel_subscription(self, event_id: str, event_type: str, *, subscription_id: str) -> bool:
        """End the subscription with this id, keeping any purchased scan credits.

        Only the account whose *current* subscription matches is downgraded, so the
        late cancellation of a replaced subscription changes nothing.
        """
        table = entitlements_table
        try:
            with self._engine.begin() as connection:
                if not self._record_event(connection, event_id, event_type):
                    return False
                matches = table.c.stripe_subscription_id == subscription_id
                connection.execute(
                    update(table)
                    .where(matches, table.c.credits_remaining > 0)
                    .values(tier=Tier.PER_SCAN.value, stripe_subscription_id=None, updated_at=_now())
                )
                connection.execute(
                    update(table)
                    .where(matches)
                    .values(tier=Tier.FREE.value, stripe_subscription_id=None, updated_at=_now())
                )
        except SQLAlchemyError as exc:
            raise StorageError(f"Could not cancel subscription ({type(exc).__name__})") from exc
        return True
