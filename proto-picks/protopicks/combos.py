"""오늘의 추천 경기(기본 7) 선정과 조합(안전 2 + 모험 2) 구성."""
from __future__ import annotations

import itertools
import math
import os
from collections import Counter

from .config import settings
from .models import Candidate, Combo

SAFE_MIN_ODDS = float(os.environ.get("SAFE_MIN_ODDS", 2.0))     # 안전 조합 최소 총배당
RISKY_MIN_ODDS = float(os.environ.get("RISKY_MIN_ODDS", 5.0))   # 모험 조합 최소 총배당
MIN_LEG_ODDS = 1.15


def safe_score(c: Candidate) -> float:
    return c.p_final + 0.5 * min(c.edge, 0.10) + 0.05 * c.confidence


def value_score(c: Candidate) -> float:
    return c.edge + 0.15 * c.p_final + 0.05 * c.confidence


def _is_safe_shape(c: Candidate) -> bool:
    return MIN_LEG_ODDS <= c.odds <= 2.3 and c.p_final >= 0.50


def _is_value_shape(c: Candidate) -> bool:
    return 1.6 <= c.odds <= 4.5 and c.p_final >= 0.28


def select_picks(cands: list[Candidate], n: int | None = None) -> list[Candidate]:
    """경기당 1개 선택지만, 리그 편중 제한. 대략 4:3 비율로 '고확률형'과 '가치형'을 섞는다."""
    n = n or settings.picks_count
    by_fixture: dict[str, list[Candidate]] = {}
    for c in cands:
        if c.odds >= MIN_LEG_ODDS:
            by_fixture.setdefault(c.fixture.key, []).append(c)

    safe_pool = sorted((max((c for c in cs if _is_safe_shape(c)), key=safe_score, default=None)
                        for cs in by_fixture.values()), key=lambda c: -safe_score(c) if c else 0)
    value_pool = sorted((max((c for c in cs if _is_value_shape(c)), key=value_score, default=None)
                         for cs in by_fixture.values()), key=lambda c: -value_score(c) if c else 0)
    safe_pool = [c for c in safe_pool if c]
    value_pool = [c for c in value_pool if c]

    picks: list[Candidate] = []
    used: set[str] = set()
    leagues: Counter = Counter()

    def take(pool: list[Candidate], quota: int) -> None:
        for c in pool:
            if len(picks) >= n or quota <= 0:
                return
            if c.fixture.key in used or leagues[c.fixture.league] >= settings.max_per_league:
                continue
            picks.append(c)
            used.add(c.fixture.key)
            leagues[c.fixture.league] += 1
            quota -= 1

    n_safe = math.ceil(n * 4 / 7)
    take(safe_pool, n_safe)
    take(value_pool, n - len(picks))
    take(safe_pool, n - len(picks))  # 가치형이 부족하면 고확률형으로 채움
    return picks


def _overlap(a: tuple, b: tuple) -> int:
    return len(set(id(x) for x in a) & set(id(x) for x in b))


def _prob(legs) -> float:
    return math.prod(c.p_final for c in legs)


def _odds(legs) -> float:
    return math.prod(c.odds for c in legs)


def build_combos(picks: list[Candidate]) -> list[Combo]:
    combos: list[Combo] = []
    if len(picks) < 2:
        return combos
    k_safe = min(settings.safe_legs, len(picks))
    k_risky = min(settings.risky_legs, len(picks))

    # 안전 조합: 적중확률 최대 (총배당 하한 충족), 두 번째는 첫 번째와 최소 1경기는 다르게
    safe_all = [s for s in itertools.combinations(picks, k_safe) if _odds(s) >= SAFE_MIN_ODDS] or \
        list(itertools.combinations(picks, k_safe))
    safe_all.sort(key=lambda s: -_prob(s))
    chosen_safe: list[tuple] = []
    for s in safe_all:
        if all(_overlap(s, t) <= k_safe - 1 for t in chosen_safe):
            chosen_safe.append(s)
        if len(chosen_safe) == 2:
            break
    if len(chosen_safe) < 2:
        for s in safe_all:
            if s not in chosen_safe:
                chosen_safe.append(s)
                break

    # 모험 조합: 기대값(적중확률×총배당) 최대, 총배당 하한·적중확률 하한
    risky_all = [r for r in itertools.combinations(picks, k_risky)
                 if _odds(r) >= RISKY_MIN_ODDS and _prob(r) >= 0.06] or \
        list(itertools.combinations(picks, k_risky))
    risky_all.sort(key=lambda r: -(_prob(r) * _odds(r)))
    chosen_risky: list[tuple] = []
    for r in risky_all:
        if r in chosen_safe:
            continue
        if all(_overlap(r, t) <= k_risky - 2 for t in chosen_risky):
            chosen_risky.append(r)
        if len(chosen_risky) == 2:
            break

    for i, s in enumerate(chosen_safe[:2]):
        combos.append(Combo(name=f"안전 {'AB'[i]}", kind="safe", legs=sorted(s, key=lambda c: c.fixture.kickoff)))
    for i, r in enumerate(chosen_risky[:2]):
        combos.append(Combo(name=f"모험 {'AB'[i]}", kind="risky", legs=sorted(r, key=lambda c: c.fixture.kickoff)))
    return combos
