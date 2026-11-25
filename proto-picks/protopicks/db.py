"""SQLite 저장소: 배당 스냅샷(배당 변동 추적), 팀명 매핑 캐시, 추천 기록(적중률 집계)."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from .config import KST
from .models import Combo, Fixture

SCHEMA = """
CREATE TABLE IF NOT EXISTS odds_snapshots (
    round_id TEXT, match_no TEXT, fixture_key TEXT, market TEXT, line REAL,
    outcome TEXT, odds REAL, seen_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_snap ON odds_snapshots(round_id, match_no, outcome, seen_at);

CREATE TABLE IF NOT EXISTS name_map (
    sport TEXT, betman_home TEXT, betman_away TEXT, kickoff TEXT,
    fotmob_match_id INTEGER, fotmob_home TEXT, fotmob_away TEXT,
    PRIMARY KEY (sport, betman_home, betman_away, kickoff)
);

CREATE TABLE IF NOT EXISTS picks (
    run_date TEXT, combo TEXT, kind TEXT, leg_idx INTEGER,
    round_id TEXT, match_no TEXT, sport TEXT, league TEXT, home TEXT, away TEXT,
    kickoff TEXT, market TEXT, line REAL, outcome TEXT, odds REAL, p_final REAL,
    fotmob_match_id INTEGER, result TEXT DEFAULT NULL,
    PRIMARY KEY (run_date, combo, leg_idx)
);
"""


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)

    # ---------- 배당 스냅샷 ----------
    def save_snapshot(self, fixtures: list[Fixture], seen_at: datetime | None = None) -> int:
        ts = (seen_at or datetime.now(KST)).isoformat(timespec="seconds")
        rows = []
        for fx in fixtures:
            for m in fx.markets:
                for outcome, odds in m.odds.items():
                    rows.append((fx.round_id, m.match_no, fx.key, m.market, m.line, outcome, odds, ts))
        self.conn.executemany("INSERT INTO odds_snapshots VALUES (?,?,?,?,?,?,?,?)", rows)
        self.conn.commit()
        return len(rows)

    def opening_odds(self, round_id: str, match_no: str, outcome: str, line: float | None) -> float | None:
        """같은 경기번호·같은 기준점으로 처음 관측된 배당."""
        cur = self.conn.execute(
            "SELECT odds FROM odds_snapshots WHERE round_id=? AND match_no=? AND outcome=? "
            "AND (line IS ? OR line=?) ORDER BY seen_at ASC LIMIT 1",
            (round_id, match_no, outcome, line, line),
        )
        row = cur.fetchone()
        return row[0] if row else None

    def line_history(self, round_id: str, match_no: str) -> list[float]:
        cur = self.conn.execute(
            "SELECT DISTINCT line FROM odds_snapshots WHERE round_id=? AND match_no=? ORDER BY seen_at",
            (round_id, match_no),
        )
        return [r[0] for r in cur.fetchall() if r[0] is not None]

    # ---------- 팀명 매핑 ----------
    def get_mapping(self, fx: Fixture) -> tuple[int | None, str, str] | None:
        cur = self.conn.execute(
            "SELECT fotmob_match_id, fotmob_home, fotmob_away FROM name_map "
            "WHERE sport=? AND betman_home=? AND betman_away=? AND kickoff=?",
            (fx.sport, fx.home, fx.away, fx.kickoff.strftime("%Y%m%d%H%M")),
        )
        return cur.fetchone()

    def put_mapping(self, fx: Fixture, match_id: int | None, home: str = "", away: str = "") -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO name_map VALUES (?,?,?,?,?,?,?)",
            (fx.sport, fx.home, fx.away, fx.kickoff.strftime("%Y%m%d%H%M"), match_id, home, away),
        )
        self.conn.commit()

    # ---------- 추천 기록 ----------
    def save_picks(self, run_date: str, combos: list[Combo]) -> None:
        self.conn.execute("DELETE FROM picks WHERE run_date=?", (run_date,))
        for combo in combos:
            for i, c in enumerate(combo.legs):
                fx = c.fixture
                self.conn.execute(
                    "INSERT INTO picks (run_date, combo, kind, leg_idx, round_id, match_no, sport, league, home, "
                    "away, kickoff, market, line, outcome, odds, p_final, fotmob_match_id) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (run_date, combo.name, combo.kind, i, fx.round_id, c.market.match_no, fx.sport, fx.league,
                     fx.home, fx.away, fx.kickoff.isoformat(), c.market.market, c.market.line, c.outcome,
                     c.odds, c.p_final, fx.fotmob_match_id),
                )
        self.conn.commit()

    def unsettled_picks(self) -> list[sqlite3.Row]:
        self.conn.row_factory = sqlite3.Row
        cur = self.conn.execute("SELECT * FROM picks WHERE result IS NULL")
        rows = cur.fetchall()
        self.conn.row_factory = None
        return rows

    def set_result(self, run_date: str, combo: str, leg_idx: int, result: str) -> None:
        self.conn.execute(
            "UPDATE picks SET result=? WHERE run_date=? AND combo=? AND leg_idx=?",
            (result, run_date, combo, leg_idx),
        )
        self.conn.commit()

    def set_result_by_match(self, round_id: str, match_no: str, result: str) -> int:
        cur = self.conn.execute(
            "UPDATE picks SET result=? WHERE round_id=? AND match_no=? AND result IS NULL",
            (result, round_id, match_no),
        )
        self.conn.commit()
        return cur.rowcount

    def record_summary(self) -> dict:
        """조합별·종류별 누적 성적. result: win / lose / void(적중특례·취소 → 배당 1.0 처리)."""
        cur = self.conn.execute(
            "SELECT kind, GROUP_CONCAT(COALESCE(result,'?')) FROM picks GROUP BY run_date, combo"
        )
        out = {"safe": {"hit": 0, "miss": 0, "pending": 0}, "risky": {"hit": 0, "miss": 0, "pending": 0},
               "legs": {"hit": 0, "miss": 0}}
        for kind, results in cur.fetchall():
            rs = results.split(",")
            bucket = out.setdefault(kind, {"hit": 0, "miss": 0, "pending": 0})
            if "lose" in rs:
                bucket["miss"] += 1
            elif "?" in rs:
                bucket["pending"] += 1
            else:
                bucket["hit"] += 1
        cur = self.conn.execute(
            "SELECT result, COUNT(*) FROM (SELECT DISTINCT run_date, round_id, match_no, outcome, result FROM picks) "
            "WHERE result IN ('win','lose') GROUP BY result"
        )
        for result, n in cur.fetchall():
            out["legs"]["hit" if result == "win" else "miss"] += n
        return out
