"""도메인 데이터 구조."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

SPORT_LABEL = {"soccer": "축구", "basketball": "농구", "baseball": "야구", "volleyball": "배구", "other": "기타"}

# 마켓 종류: 1X2(일반), HANDICAP(핸디캡), OU(언더오버)
MARKET_LABEL = {"1X2": "일반", "HANDICAP": "핸디캡", "OU": "언더오버"}
OUTCOME_LABEL = {"W": "승", "D": "무", "L": "패", "U": "언더", "O": "오버"}


@dataclass
class Market:
    """베트맨 프로토 한 줄(경기번호 하나)."""

    match_no: str          # 베트맨 경기번호 (구매 시 체크하는 번호)
    market: str            # "1X2" | "HANDICAP" | "OU"
    line: float | None     # 핸디캡(홈 기준) 또는 언더오버 기준점
    odds: dict[str, float]  # {"W":1.8,"D":3.2,"L":3.9} / {"U":1.7,"O":1.9}

    def describe(self, outcome: str) -> str:
        label = OUTCOME_LABEL.get(outcome, outcome)
        if self.market == "1X2":
            return f"일반 {label}"
        if self.market == "HANDICAP":
            return f"핸디 {self.line:+g} {label}"
        if self.market == "OU":
            return f"{label} {self.line:g}"
        return f"{self.market} {label}"


@dataclass
class Fixture:
    """같은 경기의 여러 마켓을 묶은 단위."""

    round_id: str
    sport: str             # soccer / basketball / baseball / volleyball / other
    league: str
    home: str
    away: str
    kickoff: datetime      # KST aware
    markets: list[Market] = field(default_factory=list)
    # 분석 단계에서 채워짐
    fotmob_match_id: int | None = None
    fotmob_names: tuple[str, str] | None = None

    @property
    def key(self) -> str:
        return f"{self.sport}|{self.home}|{self.away}|{self.kickoff:%Y%m%d%H%M}"

    @property
    def title(self) -> str:
        return f"{self.home} vs {self.away}"


@dataclass
class Candidate:
    """한 마켓의 한 결과(베팅 선택지)에 대한 분석 결과."""

    fixture: Fixture
    market: Market
    outcome: str
    odds: float
    p_market: float          # 배당 역산(마진 제거) 확률
    p_model: float | None    # 통계 모델 / 리서치 확률
    p_final: float           # 혼합 + 배당 변동 보정 후 확률
    open_odds: float | None = None
    confidence: float = 0.5  # 데이터 품질 0~1
    reasons: list[str] = field(default_factory=list)

    @property
    def edge(self) -> float:
        """기대값 - 1. 0보다 크면 이론상 이득."""
        return self.p_final * self.odds - 1.0

    @property
    def movement(self) -> float | None:
        """첫 관측 대비 배당 하락률. +면 배당 하락(이 결과로 돈/정보 유입)."""
        if not self.open_odds or self.open_odds <= 0:
            return None
        return (self.open_odds - self.odds) / self.open_odds

    @property
    def pick_label(self) -> str:
        return self.market.describe(self.outcome)


@dataclass
class Combo:
    name: str
    kind: str                # "safe" | "risky"
    legs: list[Candidate]

    @property
    def total_odds(self) -> float:
        total = 1.0
        for leg in self.legs:
            total *= leg.odds
        return total

    @property
    def hit_prob(self) -> float:
        p = 1.0
        for leg in self.legs:
            p *= leg.p_final
        return p

    @property
    def ev(self) -> float:
        return self.hit_prob * self.total_odds - 1.0
