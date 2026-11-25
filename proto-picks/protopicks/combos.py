"""조합 구성: 조합 1개당 7경기(7폴더) × 안전 2개 + 모험 2개.

- 경기마다 '고확률 선택지'와 '가치 선택지'를 하나씩 뽑아 순위표를 만든다.
- 🛡 안전 A: 고확률 상위 7경기
- 🛡 안전 B: 안전 A의 상위 4경기 + 그다음 고확률 3경기 (일부를 바꿔 위험 분산)
- 🎯 모험 A: 고확률 5경기 + 가치(고배당·기대값) 2경기
- 🎯 모험 B: 고확률 4경기 + 모험 A와 다른 가치 3경기
한 경기는 모든 조합에서 같은 선택지로만 쓰인다(조합끼리 서로 반대 베팅 방지).
"""
from __future__ import annotations

from collections import Counter

from .config import settings
from .models import Candidate, Combo


def safe_score(c: Candidate) -> float:
    # 7폴더는 한 경기만 틀려도 실패 → 적중 확률을 최우선, 기대값은 작은 가산점
    return c.p_final + 0.25 * max(-0.10, min(c.edge, 0.05)) + 0.03 * c.confidence


def value_score(c: Candidate) -> float:
    return c.edge + 0.15 * c.p_final + 0.05 * c.confidence


def _is_safe_shape(c: Candidate) -> bool:
    return settings.min_leg_odds <= c.odds <= 2.3 and c.p_final >= 0.50


def _is_value_shape(c: Candidate) -> bool:
    return 1.6 <= c.odds <= 4.5 and c.p_final >= 0.28


def rank_pools(cands: list[Candidate]) -> tuple[list[Candidate], list[Candidate]]:
    """(고확률 순위, 가치 순위). 두 목록은 서로 다른 경기로만 구성된다."""
    by_fixture: dict[str, list[Candidate]] = {}
    for c in cands:
        if c.odds >= settings.min_leg_odds:
            by_fixture.setdefault(c.fixture.key, []).append(c)
    safe_rank, value_rank = [], []
    for cs in by_fixture.values():
        s = max((c for c in cs if _is_safe_shape(c)), key=safe_score, default=None)
        v = max((c for c in cs if _is_value_shape(c)), key=value_score, default=None)
        if s:
            safe_rank.append(s)
        if v:
            value_rank.append(v)
    safe_rank.sort(key=safe_score, reverse=True)
    value_rank.sort(key=value_score, reverse=True)
    # 고확률 상위권에 쓰일 경기는 가치 목록에서 뺀다
    reserved = {c.fixture.key for c in safe_rank[: settings.legs_per_combo + 3]}
    value_rank = [c for c in value_rank if c.fixture.key not in reserved]
    return safe_rank, value_rank


def _fill(base: list[Candidate], k: int, sources: list[list[Candidate]],
          avoid: set[str] = frozenset()) -> list[Candidate]:
    """base 에 sources 순서대로 k개가 될 때까지 추가(경기 중복·리그 편중 제한). avoid 경기는 최후에만 사용."""
    legs = list(base)
    used = {c.fixture.key for c in legs}
    leagues = Counter(c.fixture.league for c in legs)
    for strict in (True, False):
        for src in sources:
            for c in src:
                if len(legs) >= k:
                    return legs
                if c.fixture.key in used or (strict and c.fixture.key in avoid):
                    continue
                if strict and leagues[c.fixture.league] >= settings.max_per_league:
                    continue
                legs.append(c)
                used.add(c.fixture.key)
                leagues[c.fixture.league] += 1
    return legs


def build_combos(cands: list[Candidate]) -> list[Combo]:
    n = settings.legs_per_combo
    safe_rank, value_rank = rank_pools(cands)
    every = safe_rank + value_rank
    if len({c.fixture.key for c in every}) < 2:
        return []

    safe_a = _fill([], n, [safe_rank, value_rank])
    shared = safe_a[: min(settings.safe_b_shared, len(safe_a))]
    safe_b = _fill(shared, n, [safe_rank, value_rank], avoid={c.fixture.key for c in safe_a})

    ra, rb = settings.risky_a_value, settings.risky_b_value
    risky_a = _fill(safe_a[: max(0, n - ra)], n, [value_rank, safe_rank])
    used_value_a = {c.fixture.key for c in risky_a} - {c.fixture.key for c in safe_a}
    risky_b = _fill(safe_a[: max(0, n - rb)], n, [value_rank, safe_rank], avoid=used_value_a)

    combos, seen = [], []
    for name, kind, legs in (("안전 A", "safe", safe_a), ("안전 B", "safe", safe_b),
                             ("모험 A", "risky", risky_a), ("모험 B", "risky", risky_b)):
        key = frozenset(id(c) for c in legs)
        if len(legs) < 2 or key in seen:
            continue
        seen.append(key)
        combos.append(Combo(name=name, kind=kind, legs=sorted(legs, key=lambda c: c.fixture.kickoff)))
    return combos


def unique_legs(combos: list[Combo]) -> list[Candidate]:
    """조합에 쓰인 경기 목록(중복 제거, 시간순)."""
    seen: dict[int, Candidate] = {}
    for combo in combos:
        for c in combo.legs:
            seen.setdefault(id(c), c)
    return sorted(seen.values(), key=lambda c: c.fixture.kickoff)
