import os
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict
from pathlib import Path
from app.core.schemas import Report

logger = logging.getLogger(__name__)


class BaseReportStorage(ABC):
    """Abstract repository for persisting and retrieving scan reports."""

    @abstractmethod
    def save_report(self, report: Report) -> Report:
        """Persist a report."""
        pass

    @abstractmethod
    def get_report(self, report_id: str) -> Optional[Report]:
        """Retrieve a report by ID."""
        pass

    @abstractmethod
    def list_reports(self, limit: int = 50) -> List[Report]:
        """List recently saved reports."""
        pass


class LocalStorageRepository(BaseReportStorage):
    """MVP file-based JSON storage implementation."""

    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = Path(storage_dir or os.getenv("STORAGE_DIR", "./data/reports"))
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._index_file = self.storage_dir / "index.json"
        self._ensure_index()

    def _ensure_index(self):
        if not self._index_file.exists():
            try:
                with open(self._index_file, "w", encoding="utf-8") as f:
                    json.dump([], f)
            except Exception as e:
                logger.error(f"Failed to create index file: {e}")

    def save_report(self, report: Report) -> Report:
        file_path = self.storage_dir / f"{report.id}.json"
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(report.model_dump_json(indent=2))

            # Update index
            self._update_index(report)
            return report
        except Exception as e:
            logger.error(f"Error saving report {report.id}: {e}")
            raise

    def _update_index(self, report: Report):
        try:
            index_data = []
            if self._index_file.exists():
                with open(self._index_file, "r", encoding="utf-8") as f:
                    index_data = json.load(f)

            # Filter out existing with same ID
            index_data = [item for item in index_data if item.get("id") != report.id]
            index_data.insert(0, {
                "id": report.id,
                "product": report.product,
                "title": report.title,
                "created_at": report.created_at,
                "risk_score": report.summary.risk_score,
                "readiness_status": report.summary.readiness_status,
                "total_findings": report.summary.total_findings
            })

            # Keep index under 200 items
            index_data = index_data[:200]

            with open(self._index_file, "w", encoding="utf-8") as f:
                json.dump(index_data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not update index: {e}")

    def get_report(self, report_id: str) -> Optional[Report]:
        file_path = self.storage_dir / f"{report_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Report.model_validate(data)
        except Exception as e:
            logger.error(f"Error loading report {report_id}: {e}")
            return None

    def list_reports(self, limit: int = 50) -> List[Report]:
        reports = []
        if self._index_file.exists():
            try:
                with open(self._index_file, "r", encoding="utf-8") as f:
                    index_data = json.load(f)
                    for item in index_data[:limit]:
                        rep = self.get_report(item["id"])
                        if rep:
                            reports.append(rep)
            except Exception as e:
                logger.error(f"Error reading index file: {e}")
        return reports


_storage_instance: Optional[BaseReportStorage] = None


def get_storage() -> BaseReportStorage:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = LocalStorageRepository()
    return _storage_instance
