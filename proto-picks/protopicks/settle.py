"""추천 결과 정산. 축구는 FotMob 최종 스코어로 자동 판정, 그 외 종목은 수동 입력."""
from __future__ import annotations

from .config import settings
from .db import Store
from .fotmob import FotMob


def judge(market: str, line: float | None, outcome: str, hs: int, as_: int) -> str:
    if market in ("1X2", "HANDICAP"):
        diff = hs - as_ + ((line or 0.0) if market == "HANDICAP" else 0.0)
        actual = "W" if diff > 0 else ("L" if diff < 0 else "D")
    elif market == "OU":
        tot = hs + as_
        if line is not None and tot == line:
            return "void"
        actual = "O" if tot > (line or 0) else "U"
    else:
        return "void"
    return "win" if actual == outcome else "lose"


def settle_soccer(store: Store) -> int:
    fm = FotMob(settings.data_dir / "cache", ttl_minutes=0)
    n = 0
    for row in store.unsettled_picks():
        if row["sport"] != "soccer" or not row["fotmob_match_id"]:
            continue
        d = fm.match_details(row["fotmob_match_id"])
        if not d:
            continue
        status = (d.get("header") or {}).get("status") or {}
        if not status.get("finished"):
            continue
        if status.get("cancelled"):
            store.set_result(row["run_date"], row["combo"], row["leg_idx"], "void")
            n += 1
            continue
        teams = (d.get("header") or {}).get("teams") or []
        try:
            hs, as_ = int(teams[0]["score"]), int(teams[1]["score"])
        except (IndexError, KeyError, TypeError, ValueError):
            score = str(status.get("scoreStr", ""))
            try:
                hs, as_ = (int(x) for x in score.replace(" ", "").split("-"))
            except ValueError:
                continue
        # 프로토 축구는 정규시간(90분+추가시간) 결과 기준. FotMob 헤더 스코어가 연장 포함일 수 있으니 컵대회는 확인 필요.
        result = judge(row["market"], row["line"], row["outcome"], hs, as_)
        store.set_result(row["run_date"], row["combo"], row["leg_idx"], result)
        n += 1
    return n
