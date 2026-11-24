"""Repository-level guarantees: every read, write, and delete is scoped to user_id."""
from pathlib import Path

import pytest

from app.core import db, storage
from app.core.schemas import ProductType, Report, ReportSummary
from app.core.storage import (
    PostgresReportRepository,
    ReportOwnershipError,
    normalize_database_url,
)

ALICE = "alice-user-id"
BOB = "bob-user-id"


def _report(report_id: str, created_at: str = "2026-11-23T10:00:00+00:00") -> Report:
    return Report(
        id=report_id,
        product=ProductType.LAUNCHGATE,
        title=f"Report {report_id}",
        created_at=created_at,
        summary=ReportSummary(),
        executive_summary="summary",
    )


@pytest.fixture
def repo() -> PostgresReportRepository:
    return PostgresReportRepository("sqlite+pysqlite:///:memory:")


def test_get_is_scoped_to_owner(repo: PostgresReportRepository) -> None:
    repo.save_report(_report("rpt_1"), ALICE)
    assert repo.get_report("rpt_1", ALICE) is not None
    assert repo.get_report("rpt_1", BOB) is None
    assert repo.get_report("missing", ALICE) is None


def test_list_is_scoped_ordered_and_limited(repo: PostgresReportRepository) -> None:
    repo.save_report(_report("old", "2026-11-01T00:00:00+00:00"), ALICE)
    repo.save_report(_report("new", "2026-11-20T00:00:00+00:00"), ALICE)
    repo.save_report(_report("mid", "2026-11-10T00:00:00+00:00"), ALICE)
    repo.save_report(_report("bobs", "2026-11-22T00:00:00+00:00"), BOB)

    assert [r.id for r in repo.list_reports(ALICE)] == ["new", "mid", "old"]
    assert [r.id for r in repo.list_reports(ALICE, limit=2)] == ["new", "mid"]
    assert [r.id for r in repo.list_reports(BOB)] == ["bobs"]
    assert repo.list_reports("nobody") == []


def test_delete_is_scoped_to_owner(repo: PostgresReportRepository) -> None:
    repo.save_report(_report("rpt_1"), ALICE)
    assert repo.delete_report("rpt_1", BOB) is False
    assert repo.get_report("rpt_1", ALICE) is not None
    assert repo.delete_report("rpt_1", ALICE) is True
    assert repo.get_report("rpt_1", ALICE) is None
    assert repo.delete_report("rpt_1", ALICE) is False


def test_another_user_cannot_overwrite_a_report_id(repo: PostgresReportRepository) -> None:
    repo.save_report(_report("rpt_1"), ALICE)
    hijack = _report("rpt_1")
    hijack.title = "hijacked"
    with pytest.raises(ReportOwnershipError):
        repo.save_report(hijack, BOB)
    stored = repo.get_report("rpt_1", ALICE)
    assert stored is not None and stored.title == "Report rpt_1"
    assert repo.get_report("rpt_1", BOB) is None


def test_owner_can_resave_their_report(repo: PostgresReportRepository) -> None:
    repo.save_report(_report("rpt_1"), ALICE)
    updated = _report("rpt_1")
    updated.title = "updated"
    repo.save_report(updated, ALICE)
    stored = repo.get_report("rpt_1", ALICE)
    assert stored is not None and stored.title == "updated"
    assert len(repo.list_reports(ALICE)) == 1


def test_user_id_is_required(repo: PostgresReportRepository) -> None:
    with pytest.raises(ValueError):
        repo.save_report(_report("rpt_1"), "")


def test_file_database_persists_across_instances(tmp_path: Path) -> None:
    url = f"sqlite+pysqlite:///{(tmp_path / 'nested' / 'trustcore.db').as_posix()}"
    PostgresReportRepository(url).save_report(_report("rpt_1"), ALICE)
    assert PostgresReportRepository(url).get_report("rpt_1", ALICE) is not None


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite+pysqlite:///:memory:", "sqlite+pysqlite:///:memory:"),
    ],
)
def test_database_url_normalization(raw: str, expected: str) -> None:
    assert normalize_database_url(raw) == expected


def test_production_requires_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(storage, "_storage_instance", None)
    monkeypatch.setattr(db, "_engine", None)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError):
        storage.get_storage()
