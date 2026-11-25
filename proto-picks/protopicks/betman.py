"""베트맨 프로토(승부식) 경기·배당 수집.

주의: 베트맨(www.betman.co.kr)은 해외 IP 접속을 차단하는 것으로 보인다(개발 환경에서 연결 리셋).
반드시 한국 IP(사용자 PC)에서 실행해야 한다. 베트맨 내부 JSON 엔드포인트는 공개 문서가 없어
필드명을 여러 후보로 유연하게 읽도록 작성했다. 구조가 달라 실패하면
`python -m protopicks betman-dump` 로 원본 응답을 저장해 확인하고, 그동안은 CSV 입력(load_csv)을 쓴다.
"""
from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import requests

from .config import KST
from .models import Fixture, Market

BASE = "https://www.betman.co.kr"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
PROTO_GM_ID = "G101"  # 프로토 승부식
SBM = {"_sbmInfo": {"debugMode": "false"}}

SPORT_CODES = {
    "SC": "soccer", "축구": "soccer",
    "BK": "basketball", "농구": "basketball",
    "BS": "baseball", "야구": "baseball",
    "VL": "volleyball", "배구": "volleyball",
}

# 필드명 후보 (베트맨 응답 구조가 바뀌어도 최대한 읽히도록)
F_SPORT = ("itemCode", "mchSportType", "sportsType", "itemCd", "sportType", "종목")
F_LEAGUE = ("leagueName", "leagNm", "leagueNm", "league", "리그")
F_HOME = ("homeName", "hmTeamNm", "homeTeamName", "homeNm", "home", "홈팀")
F_AWAY = ("awayName", "awTeamNm", "awayTeamName", "awayNm", "away", "원정팀")
F_TIME = ("gameDate", "mchDtm", "gmDt", "matchDate", "startDate", "경기시간")
F_NO = ("matchSeq", "gmSeq", "mchSeq", "gameSeq", "matchNo", "경기번호")
F_TYPE = ("mchType", "mchTypeNm", "mchTpNm", "gameType", "gameTypeNm", "gmTypeNm", "gmTpNm", "matchType",
          "matchTypeNm", "betType", "betTypeNm", "betTypNm", "typeNm", "유형")
F_HANDI = ("handi", "handicap", "handiCap", "hndcp", "기준점")
F_W = ("winAllot", "winRate", "homeAllot", "allot1", "승")
F_D = ("drawAllot", "drawRate", "allotX", "무")
F_L = ("loseAllot", "loseRate", "awayAllot", "allot2", "패")
F_STATUS = ("protoStatus", "saleStatus", "status", "mchStatus")


class BetmanError(RuntimeError):
    pass


def _first(row: dict, names: Iterable[str]) -> Any:
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return None


def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(str(v).replace(",", "").strip())
    except ValueError:
        return None
    return f


def _parse_time(v: Any) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit() and len(v) >= 12):
        n = int(v)
        if n > 10**11:  # epoch ms
            return datetime.fromtimestamp(n / 1000, KST)
        if len(str(n)) == 12:  # YYYYMMDDHHMM
            return datetime.strptime(str(n), "%Y%m%d%H%M").replace(tzinfo=KST)
        return datetime.fromtimestamp(n, KST)
    s = str(v).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y.%m.%d %H:%M", "%Y%m%d%H%M%S", "%Y/%m/%d %H:%M",
                "%y.%m.%d %H:%M"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=KST)
        except ValueError:
            continue
    return None


# 분석하지 않는 특수 게임(운에 가까운 홀짝, 전/후반·이닝·쿼터 단위, 1점차 승부 등)
EXCLUDED_TYPE_WORDS = ("SUM", "홀", "짝", "ODD", "EVEN", "O/E", "승1패", "1점", "5P", "전반", "후반", "하프",
                       "HALF", "이닝", "INN", "쿼터", "1Q", "세트", "SET", "첫", "FIRST", "득점자", "스코어", "정확")


def _market_type(raw_type: Any, handi: float | None, has_draw: bool) -> str | None:
    """일반 → "1X2", 핸디캡 → "HANDICAP", 언더오버 → "OU", 그 외(홀짝 등)·알 수 없음 → None(제외)."""
    t = str(raw_type or "").strip().upper()
    if not t:
        # 유형 표기가 없는 경우에만 추정
        return "HANDICAP" if handi not in (None, 0.0) else "1X2"
    if any(k in t for k in EXCLUDED_TYPE_WORDS):
        return None
    if any(k in t for k in ("U/O", "언더", "오버", "UNDER", "OVER")) or t in ("UO", "U", "OU"):
        return "OU"
    if "핸디" in t or "HANDI" in t or t in ("H", "HC", "HDC"):
        return "HANDICAP"
    if "일반" in t or "승무패" in t or t in ("N", "NORMAL", "1X2", "WDL", "승패"):
        return "1X2"
    return None  # 모르는 유형은 잘못 분석하지 않도록 제외


TYPE_HINTS = ("SUM", "홀짝", "홀/짝", "핸디", "언더", "오버", "U/O", "일반", "승1패", "전반", "이닝")


def _row_type(row: dict) -> Any:
    """유형 필드를 못 찾으면 짧은 문자열 값들 중 유형 단어가 들어간 것을 사용."""
    t = _first(row, F_TYPE)
    if t not in (None, ""):
        return t
    for v in row.values():
        if isinstance(v, str) and len(v) <= 12 and any(h in v.upper() for h in TYPE_HINTS):
            return v
    return None


def rows_to_fixtures(rows: list[dict], round_id: str, stats: dict | None = None) -> list[Fixture]:
    """베트맨 한 줄(dict) 목록 → Fixture 목록(같은 경기 마켓 묶음).
    stats 를 넘기면 유형별 포함/제외 건수를 기록한다."""
    fixtures: dict[str, Fixture] = {}
    stats = stats if stats is not None else {}
    for row in rows:
        sport_raw = str(_first(row, F_SPORT) or "")
        sport = SPORT_CODES.get(sport_raw.upper(), SPORT_CODES.get(sport_raw, "other"))
        home, away = _first(row, F_HOME), _first(row, F_AWAY)
        kickoff = _parse_time(_first(row, F_TIME))
        match_no = _first(row, F_NO)
        if not (home and away and kickoff and match_no is not None):
            continue
        status = str(_first(row, F_STATUS) or "")
        if status and any(k in status for k in ("마감", "CLOSE", "취소", "CANCEL", "발매중지")):
            continue
        handi = _num(_first(row, F_HANDI))
        w, d, l = (_num(_first(row, F_W)), _num(_first(row, F_D)), _num(_first(row, F_L)))
        row_type = _row_type(row)
        raw_type = str(row_type or "").strip() or "(표기없음)"
        mtype = _market_type(row_type, handi, bool(d and d > 1))
        if mtype == "OU":
            # 베트맨 화면 기준: 언더는 '승' 칸, 오버는 '패' 칸에 표시된다. (betman-dump 로 확인 권장)
            odds = {k: v for k, v in (("U", w), ("O", l)) if v and v > 1}
        elif mtype:
            odds = {k: v for k, v in (("W", w), ("D", d), ("L", l)) if v and v > 1}
        else:
            odds = {}
        # 축구 일반/핸디캡은 반드시 무승부 배당이 있다. 없으면 다른 게임이 섞인 것이므로 제외
        if sport == "soccer" and mtype in ("1X2", "HANDICAP") and "D" not in odds:
            mtype = None
        key = f"{raw_type}"
        bucket = stats.setdefault(key, {"included": 0, "excluded": 0, "as": mtype or "-"})
        if not mtype or len(odds) < 2:
            bucket["excluded"] += 1
            continue
        bucket["included"] += 1
        mk = Market(match_no=str(match_no), market=mtype, line=handi if mtype != "1X2" else None, odds=odds)
        fx = Fixture(round_id=round_id, sport=sport, league=str(_first(row, F_LEAGUE) or ""),
                     home=str(home).strip(), away=str(away).strip(), kickoff=kickoff)
        fixtures.setdefault(fx.key, fx).markets.append(mk)
    return list(fixtures.values())


def format_type_stats(stats: dict) -> str:
    parts = []
    for raw, b in sorted(stats.items(), key=lambda kv: -(kv[1]["included"] + kv[1]["excluded"])):
        if b["included"]:
            parts.append(f"{raw}→{b['as']} {b['included']}건")
        if b["excluded"]:
            parts.append(f"{raw} 제외 {b['excluded']}건")
    return ", ".join(parts)


def _table_to_rows(obj: Any) -> list[dict]:
    """{"keys":[...], "datas":[[...],...]} 형태 또는 dict 리스트를 찾아 dict 리스트로 만든다."""
    found: list[dict] = []

    def walk(o: Any) -> None:
        if isinstance(o, dict):
            keys, datas = o.get("keys"), o.get("datas")
            if isinstance(keys, list) and isinstance(datas, list) and datas and isinstance(datas[0], list):
                found.extend(dict(zip(keys, r)) for r in datas)
                return
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            if o and all(isinstance(x, dict) for x in o) and any(_first(x, F_HOME) for x in o[:5]):
                found.extend(o)
                return
            for v in o:
                walk(v)

    walk(obj)
    return found


class BetmanClient:
    def __init__(self, timeout: int = 20):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": UA,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": BASE,
            "Referer": f"{BASE}/main/mainPage/gamebuy/buyableGameList.do",
        })
        self.timeout = timeout

    def _post(self, path: str, payload: dict) -> Any:
        try:
            r = self.s.post(BASE + path, data=json.dumps(payload), timeout=self.timeout)
        except requests.RequestException as e:
            raise BetmanError(
                f"베트맨 접속 실패: {e}\n  → 베트맨은 해외 IP를 차단합니다. 한국 인터넷(PC)에서 실행하거나 --csv 입력을 사용하세요."
            ) from e
        if r.status_code != 200:
            raise BetmanError(f"베트맨 응답 오류 HTTP {r.status_code} ({path})")
        try:
            return r.json()
        except ValueError as e:
            raise BetmanError(f"베트맨 응답이 JSON이 아닙니다 ({path}). 사이트 구조가 바뀌었을 수 있습니다.") from e

    def open_proto_rounds(self) -> list[str]:
        """현재 발매중인 프로토 승부식 회차(gmTs) 목록."""
        data = self._post("/buyPsblGame/inqCacheBuyAbleGameInfoList.do", {"_sbmInfo": SBM})
        rounds: list[str] = []

        def walk(o: Any) -> None:
            if isinstance(o, dict):
                if str(o.get("gmId")) == PROTO_GM_ID and o.get("gmTs"):
                    rounds.append(str(o["gmTs"]))
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)

        walk(data)
        return sorted(set(rounds))

    def round_raw(self, gm_ts: str) -> Any:
        return self._post("/buyPsblGame/gameInfoInq.do",
                          {"gmId": PROTO_GM_ID, "gmTs": gm_ts, "gameYear": "", "_sbmInfo": SBM})

    def fetch_fixtures(self) -> list[Fixture]:
        rounds = self.open_proto_rounds()
        if not rounds:
            raise BetmanError("발매중인 프로토 승부식 회차를 찾지 못했습니다. betman-dump 로 응답을 확인하세요.")
        fixtures: list[Fixture] = []
        self.type_stats: dict = {}
        for gm_ts in rounds:
            rows = _table_to_rows(self.round_raw(gm_ts))
            fixtures.extend(rows_to_fixtures(rows, gm_ts, self.type_stats))
        if not fixtures:
            raise BetmanError("경기 목록 파싱 결과가 비었습니다. betman-dump 로 응답 구조를 확인하세요.")
        return fixtures

    def dump(self, out_dir: Path) -> list[Path]:
        out_dir.mkdir(parents=True, exist_ok=True)
        paths = []
        lst = self._post("/buyPsblGame/inqCacheBuyAbleGameInfoList.do", {"_sbmInfo": SBM})
        p = out_dir / "betman_buyable.json"
        p.write_text(json.dumps(lst, ensure_ascii=False, indent=1), encoding="utf-8")
        paths.append(p)
        for gm_ts in self.open_proto_rounds():
            p = out_dir / f"betman_round_{gm_ts}.json"
            p.write_text(json.dumps(self.round_raw(gm_ts), ensure_ascii=False, indent=1), encoding="utf-8")
            paths.append(p)
        return paths


# ---------------- CSV 입력 (자동 수집이 안 될 때의 대안) ----------------
CSV_COLUMNS = ["round", "match_no", "sport", "league", "home", "away", "kickoff", "market", "line",
               "win", "draw", "lose", "under", "over"]


def load_csv(path: Path) -> list[Fixture]:
    """CSV 형식(헤더 필수):
    round,match_no,sport,league,home,away,kickoff,market,line,win,draw,lose,under,over
    - sport: 축구/농구/야구/배구 또는 soccer/basketball/...
    - kickoff: 2026-11-28 21:30 (한국시간)
    - market: 일반 / 핸디캡 / 언더오버
    - line: 핸디캡은 홈팀 기준(-1 = 홈 -1골), 언더오버는 기준점(2.5)
    """
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            mk = (r.get("market") or "일반").strip()
            mtype = {"일반": "1X2", "핸디캡": "HANDICAP", "핸디": "HANDICAP", "언더오버": "OU", "U/O": "OU",
                     "1X2": "1X2", "HANDICAP": "HANDICAP", "OU": "OU"}.get(mk)
            if not mtype:  # 홀짝 등 분석하지 않는 유형
                continue
            rows.append((r, mtype))
    fixtures: dict[str, Fixture] = {}
    for r, mtype in rows:
        sport_raw = (r.get("sport") or "").strip()
        sport = SPORT_CODES.get(sport_raw, SPORT_CODES.get(sport_raw.upper(), sport_raw.lower() or "other"))
        kickoff = _parse_time(r.get("kickoff"))
        if not kickoff:
            continue
        line = _num(r.get("line"))
        if mtype == "OU":
            odds = {k: v for k, v in (("U", _num(r.get("under"))), ("O", _num(r.get("over")))) if v and v > 1}
        else:
            odds = {k: v for k, v in (("W", _num(r.get("win"))), ("D", _num(r.get("draw"))),
                                       ("L", _num(r.get("lose")))) if v and v > 1}
        if len(odds) < 2:
            continue
        fx = Fixture(round_id=(r.get("round") or "csv").strip(), sport=sport, league=(r.get("league") or "").strip(),
                     home=r["home"].strip(), away=r["away"].strip(), kickoff=kickoff)
        fixtures.setdefault(fx.key, fx).markets.append(
            Market(match_no=str(r.get("match_no") or "").strip(), market=mtype,
                   line=line if mtype != "1X2" else None, odds=odds))
    return list(fixtures.values())


def normalize_name(name: str) -> str:
    return re.sub(r"[\s.\-_'()]", "", name).lower()
