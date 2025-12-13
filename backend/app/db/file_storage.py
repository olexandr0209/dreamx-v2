import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional

_DB_FILE = Path(__file__).resolve().parent / "data.json"


def _utcnow_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _ensure_file() -> None:
    if not _DB_FILE.exists():
        _DB_FILE.write_text(
            json.dumps(
                {"meta": {"next_tournament_id": 1}, "tournaments": []},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def load_data() -> Dict[str, Any]:
    _ensure_file()
    raw = _DB_FILE.read_text(encoding="utf-8").strip()
    if not raw:
        return {"meta": {"next_tournament_id": 1}, "tournaments": []}

    data = json.loads(raw)
    if "meta" not in data:
        data["meta"] = {"next_tournament_id": 1}
    if "next_tournament_id" not in data["meta"]:
        data["meta"]["next_tournament_id"] = 1
    if "tournaments" not in data or not isinstance(data["tournaments"], list):
        data["tournaments"] = []
    return data


def save_data(data: Dict[str, Any]) -> None:
    """
    Атомарний запис: пишемо у тимчасовий файл, потім rename.
    Це зменшує шанс зіпсувати JSON при перериванні процесу.
    """
    _ensure_file()
    tmp = _DB_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(_DB_FILE)


def list_tournaments() -> List[Dict[str, Any]]:
    data = load_data()
    # найновіші зверху
    return sorted(data["tournaments"], key=lambda x: x.get("id", 0), reverse=True)


def get_tournament(tournament_id: int) -> Optional[Dict[str, Any]]:
    data = load_data()
    for t in data["tournaments"]:
        if int(t.get("id")) == int(tournament_id):
            return t
    return None


def create_tournament(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Мінімальний контракт турніру v2:
    - title (обовʼязково)
    - start_at (опціонально, ISO string)
    - description (опціонально)
    - status (draft|active|finished) — за замовчуванням draft
    """
    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")

    data = load_data()
    new_id = int(data["meta"]["next_tournament_id"])

    tournament = {
        "id": new_id,
        "title": title,
        "start_at": payload.get("start_at"),          # може бути None
        "description": payload.get("description", ""),
        "status": payload.get("status", "draft"),
        "created_at": _utcnow_iso(),
        "updated_at": _utcnow_iso(),
    }

    data["tournaments"].append(tournament)
    data["meta"]["next_tournament_id"] = new_id + 1
    save_data(data)
    return tournament

