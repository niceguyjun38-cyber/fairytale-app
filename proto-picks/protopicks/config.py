"""설정 로딩. proto-picks/.env 파일(없으면 환경변수)에서 읽는다."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(ROOT / ".env")


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _i(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("DATA_DIR", ROOT / "data")))
    report_dir: Path = field(default_factory=lambda: Path(os.environ.get("REPORT_DIR", ROOT / "reports")))

    # Claude (축구 외 종목 웹 리서치 + 팀명 매칭 보조). 키가 없으면 해당 기능만 건너뛴다.
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    claude_model: str = field(default_factory=lambda: os.environ.get("CLAUDE_MODEL", "claude-opus-5-5"))
    claude_effort: str = field(default_factory=lambda: os.environ.get("CLAUDE_EFFORT", "medium"))
    max_research_fixtures: int = field(default_factory=lambda: _i("MAX_RESEARCH_FIXTURES", 24))
    research_batch_size: int = field(default_factory=lambda: _i("RESEARCH_BATCH_SIZE", 6))

    # 텔레그램 알림(선택)
    telegram_bot_token: str = field(default_factory=lambda: os.environ.get("TELEGRAM_BOT_TOKEN", ""))
    telegram_chat_id: str = field(default_factory=lambda: os.environ.get("TELEGRAM_CHAT_ID", ""))

    # 추천 규칙
    picks_count: int = field(default_factory=lambda: _i("PICKS_COUNT", 7))
    safe_legs: int = field(default_factory=lambda: _i("SAFE_LEGS", 3))
    risky_legs: int = field(default_factory=lambda: _i("RISKY_LEGS", 4))
    lookahead_hours: int = field(default_factory=lambda: _i("LOOKAHEAD_HOURS", 36))
    max_per_league: int = field(default_factory=lambda: _i("MAX_PER_LEAGUE", 3))

    # 확률 혼합 가중치: 최종확률 = w * 모델 + (1-w) * 배당(시장) 확률
    model_weight_soccer: float = field(default_factory=lambda: _f("MODEL_WEIGHT_SOCCER", 0.40))
    model_weight_other: float = field(default_factory=lambda: _f("MODEL_WEIGHT_OTHER", 0.35))
    # 배당 하락 1% 당 확률 가산 비율 (0.6 → 배당 10% 하락 시 확률 +6% 상대 가산)
    movement_factor: float = field(default_factory=lambda: _f("MOVEMENT_FACTOR", 0.6))

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "cache").mkdir(parents=True, exist_ok=True)

    @property
    def db_path(self) -> Path:
        return self.data_dir / "protopicks.db"

    @property
    def has_claude(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()
