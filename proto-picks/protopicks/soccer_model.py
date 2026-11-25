"""축구 득점 모델: 홈/원정 분리 공격·수비력 → 포아송(Dixon-Coles 보정) 스코어 분포 → 마켓별 확률."""
from __future__ import annotations

import math

from .models import Market

PRIOR_GAMES = 8.0     # 경기 수가 적을 때 리그 평균으로 당기는 강도
STRENGTH_EXP = 0.85   # 공격·수비 배율을 1 쪽으로 눌러 과신 방지
DC_RHO = -0.06        # 저득점(0-0, 1-1 등) 상관 보정
MAX_GOALS = 10


def _rate(goals: float, games: float, league_avg: float) -> float:
    """리그 평균 대비 비율(베이지안 축소)."""
    if league_avg <= 0:
        return 1.0
    return ((goals + PRIOR_GAMES * league_avg) / (games + PRIOR_GAMES)) / league_avg


def expected_goals(table: list[dict], home_id: int, away_id: int) -> tuple[float, float, float] | None:
    """(홈 기대득점, 원정 기대득점, 데이터 품질 0~1). 두 팀이 같은 표에 없으면 None."""
    by_id = {r["id"]: r for r in table}
    h, a = by_id.get(int(home_id)), by_id.get(int(away_id))
    if not h or not a:
        return None
    hp = sum(r["home_played"] for r in table)
    ap = sum(r["away_played"] for r in table)
    if hp < 4 or ap < 4:
        return None
    avg_home = sum(r["home_gf"] for r in table) / hp   # 홈팀 경기당 평균 득점
    avg_away = sum(r["away_gf"] for r in table) / ap   # 원정팀 경기당 평균 득점

    h_att = _rate(h["home_gf"], h["home_played"], avg_home)
    h_def = _rate(h["home_ga"], h["home_played"], avg_away)
    a_att = _rate(a["away_gf"], a["away_played"], avg_away)
    a_def = _rate(a["away_ga"], a["away_played"], avg_home)

    # 전체 시즌 지표도 일부 반영(홈/원정 표본이 작을 때 안정화)
    tot_avg = (avg_home + avg_away) / 2
    h_att = 0.7 * h_att + 0.3 * _rate(h["gf"], h["played"], tot_avg)
    h_def = 0.7 * h_def + 0.3 * _rate(h["ga"], h["played"], tot_avg)
    a_att = 0.7 * a_att + 0.3 * _rate(a["gf"], a["played"], tot_avg)
    a_def = 0.7 * a_def + 0.3 * _rate(a["ga"], a["played"], tot_avg)

    lam_h = avg_home * (h_att * a_def) ** STRENGTH_EXP
    lam_a = avg_away * (a_att * h_def) ** STRENGTH_EXP
    quality = min(1.0, min(h["played"], a["played"]) / 10)
    return lam_h, lam_a, quality


def adjust_lambdas(lam_h: float, lam_a: float, feats: dict) -> tuple[float, float, list[str]]:
    """최근 폼·결장자 반영."""
    notes = []
    # 폼: 최근 5경기 경기당 승점(평균 1.4) 차이 → 최대 ±8%
    for side in ("home", "away"):
        ppg = feats.get(f"{side}_form_ppg")
        if ppg is None:
            continue
        f = max(-0.08, min(0.08, (ppg - 1.4) * 0.05))
        if side == "home":
            lam_h *= 1 + f
        else:
            lam_a *= 1 + f
    # 결장자: 결장 시장가치 비중 → 공격 감소, 상대 득점 증가 (최대 12% / 6%)
    mh, ma = feats.get("home_missing_ratio", 0) or 0, feats.get("away_missing_ratio", 0) or 0
    if mh > 0.05:
        lam_h *= 1 - min(0.12, mh * 0.5)
        lam_a *= 1 + min(0.06, mh * 0.25)
        notes.append(f"홈 결장자 비중 {mh:.0%}")
    if ma > 0.05:
        lam_a *= 1 - min(0.12, ma * 0.5)
        lam_h *= 1 + min(0.06, ma * 0.25)
        notes.append(f"원정 결장자 비중 {ma:.0%}")
    return max(0.15, lam_h), max(0.1, lam_a), notes


def _pois(k: int, lam: float) -> float:
    return math.exp(-lam) * lam ** k / math.factorial(k)


def score_matrix(lam_h: float, lam_a: float, rho: float = DC_RHO) -> list[list[float]]:
    m = [[_pois(i, lam_h) * _pois(j, lam_a) for j in range(MAX_GOALS + 1)] for i in range(MAX_GOALS + 1)]
    # Dixon-Coles 저득점 보정
    m[0][0] *= max(0.0, 1 - lam_h * lam_a * rho)
    m[0][1] *= max(0.0, 1 + lam_h * rho)
    m[1][0] *= max(0.0, 1 + lam_a * rho)
    m[1][1] *= max(0.0, 1 - rho)
    total = sum(map(sum, m))
    return [[v / total for v in row] for row in m]


def market_probs(matrix: list[list[float]], market: Market) -> dict[str, float]:
    """마켓 결과별 확률. 적특(기준점과 정확히 같은 경우 등)은 제외하고 정규화."""
    out: dict[str, float] = {k: 0.0 for k in market.odds}
    line = market.line or 0.0
    for i, row in enumerate(matrix):
        for j, p in enumerate(row):
            if market.market in ("1X2", "HANDICAP"):
                diff = i - j + (line if market.market == "HANDICAP" else 0.0)
                key = "W" if diff > 1e-9 else ("L" if diff < -1e-9 else "D")
            elif market.market == "OU":
                tot = i + j
                key = "O" if tot > line + 1e-9 else ("U" if tot < line - 1e-9 else None)
            else:
                key = None
            if key in out:
                out[key] += p
    s = sum(out.values())
    return {k: v / s for k, v in out.items()} if s > 0 else out
