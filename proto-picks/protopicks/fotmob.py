"""FotMob 무료 데이터 수집 (비공식 웹 API, www.fotmob.com/api/data/*).

사용하는 자료: 날짜별 경기 목록, 경기 상세(최근 폼·결장자·예상 라인업 시장가치·맞대결·인사이트),
리그 순위표(홈/원정 득실 분리), Opta 매치 인사이트(베팅 인사이트 문장).
"""
from __future__ import annotations

import gzip
import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import requests

from .config import KST

API = "https://www.fotmob.com/api/data"
DATA = "https://data.fotmob.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def _maybe_gunzip(content: bytes) -> bytes:
    return gzip.decompress(content) if content[:2] == b"\x1f\x8b" else content


class FotMob:
    def __init__(self, cache_dir: Path, ttl_minutes: int = 90, pause: float = 0.4):
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": UA, "Accept": "application/json"})
        self.cache_dir = cache_dir
        self.ttl = ttl_minutes * 60
        self.pause = pause

    # ---- 공통 ----
    def _get(self, url: str, cache_key: str, raw: bool = False) -> Any:
        path = self.cache_dir / f"fm_{cache_key}"
        if path.exists() and time.time() - path.stat().st_mtime < self.ttl:
            data = path.read_bytes()
        else:
            time.sleep(self.pause)  # 예의상 요청 간격
            r = self.s.get(url, timeout=25)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            data = _maybe_gunzip(r.content)
            path.write_bytes(data)
        if raw:
            return data.decode("utf-8", "replace")
        try:
            return json.loads(data)
        except ValueError:
            return None

    # ---- 경기 목록 ----
    def matches_on(self, day: datetime) -> list[dict]:
        ymd = day.astimezone(KST).strftime("%Y%m%d")
        data = self._get(f"{API}/matches?date={ymd}&timezone=Asia%2FSeoul&ccode3=KOR", f"matches_{ymd}.json")
        out = []
        for lg in (data or {}).get("leagues", []):
            for m in lg.get("matches", []):
                st = m.get("status", {})
                utc = st.get("utcTime")
                if not utc or st.get("cancelled"):
                    continue
                out.append({
                    "id": m["id"],
                    "league_id": lg.get("id"),
                    "parent_league_id": lg.get("primaryId") or lg.get("id"),
                    "league": lg.get("name", ""),
                    "ccode": lg.get("ccode", ""),
                    "home": m["home"]["name"], "home_id": m["home"]["id"],
                    "away": m["away"]["name"], "away_id": m["away"]["id"],
                    "kickoff": datetime.fromisoformat(utc.replace("Z", "+00:00")).astimezone(KST),
                    "started": st.get("started"),
                })
        return out

    def matches_around(self, kickoffs: list[datetime]) -> list[dict]:
        days = sorted({(k.astimezone(KST)).date() for k in kickoffs} |
                      {(k.astimezone(KST) - timedelta(hours=6)).date() for k in kickoffs})
        seen, out = set(), []
        for d in days:
            for m in self.matches_on(datetime(d.year, d.month, d.day, tzinfo=KST)):
                if m["id"] not in seen:
                    seen.add(m["id"])
                    out.append(m)
        return out

    # ---- 경기 상세 ----
    def match_details(self, match_id: int) -> dict | None:
        return self._get(f"{API}/matchDetails?matchId={match_id}", f"match_{match_id}.json")

    def table(self, league_id: int | str) -> list[list[dict]]:
        """순위표(그룹이 여러 개면 그룹별 리스트). 각 팀: id, played, gf, ga, home_*, away_*."""
        txt = self._get(f"{DATA}/tables.ext.{league_id}.fot.gz", f"table_{league_id}.xml", raw=True)
        if not txt or "<t " not in txt:
            return []
        txt = re.sub(r"^\s*<\?xml[^>]*\?>", "", txt)
        try:
            root = ET.fromstring(f"<wrap>{txt}</wrap>")
        except ET.ParseError:
            return []
        groups = []
        for tbl in root.iter("table"):
            rows = []
            for t in tbl.iter("t"):
                a = {k: t.attrib.get(k, "0") for k in ("w", "d", "l", "g", "c", "hw", "hd", "hl", "hg", "hc")}
                n = {k: int(v or 0) for k, v in a.items()}
                played = n["w"] + n["d"] + n["l"]
                hp = n["hw"] + n["hd"] + n["hl"]
                rows.append({
                    "id": int(t.attrib.get("id", 0)), "name": t.attrib.get("name", ""),
                    "played": played, "gf": n["g"], "ga": n["c"],
                    "home_played": hp, "home_gf": n["hg"], "home_ga": n["hc"],
                    "away_played": played - hp, "away_gf": n["g"] - n["hg"], "away_ga": n["c"] - n["hc"],
                    "points": int(t.attrib.get("p", 0) or 0),
                })
            if rows:
                groups.append(rows)
        return groups

    def insights(self, parent_league_id: int, match_id: int, lang: str = "en") -> dict | None:
        return self._get(f"{DATA}/generated-match-insights/{parent_league_id}/{match_id}/matchinsights_{lang}.json",
                         f"ins_{match_id}_{lang}.json")


def extract_features(details: dict) -> dict:
    """matchDetails → 모델이 쓰는 특징값 + 리포트용 근거 문장."""
    content = details.get("content", {}) or {}
    general = details.get("general", {}) or {}
    mf = content.get("matchFacts", {}) or {}
    feats: dict[str, Any] = {
        "home_id": (general.get("homeTeam") or {}).get("id"),
        "away_id": (general.get("awayTeam") or {}).get("id"),
        "home_name": (general.get("homeTeam") or {}).get("name"),
        "away_name": (general.get("awayTeam") or {}).get("name"),
        "league_id": general.get("leagueId"),
        "parent_league_id": general.get("parentLeagueId"),
        "notes": [],
    }

    # 최근 폼(최근 5경기 승점/득실)
    forms = mf.get("teamForm") or []
    for side, form in zip(("home", "away"), forms[:2]):
        pts, gf, ga, letters = 0, 0, 0, ""
        for g in (form or [])[-5:]:
            res = g.get("resultString", "")
            letters += res
            pts += {"W": 3, "D": 1}.get(res, 0)
            try:
                tip = g.get("tooltipText", {})
                hs, as_ = int(tip.get("homeScore")), int(tip.get("awayScore"))
                ours_home = str(tip.get("homeTeamId")) == str(feats[f"{side}_id"])
                gf += hs if ours_home else as_
                ga += as_ if ours_home else hs
            except (TypeError, ValueError):
                pass
        n = max(1, len((form or [])[-5:]))
        feats[f"{side}_form_ppg"] = pts / n
        feats[f"{side}_form_str"] = letters
        feats[f"{side}_form_gd"] = (gf - ga) / n

    # 결장자(부상·징계) 시장가치 비중
    lineup = content.get("lineup") or {}
    for side, key in (("home", "homeTeam"), ("away", "awayTeam")):
        team = lineup.get(key) or {}
        unavailable = team.get("unavailable") or []
        miss_val = sum((p.get("marketValue") or 0) for p in unavailable
                       if (p.get("unavailability") or {}).get("type") in ("injury", "suspension", "doubtful", None))
        starters_val = team.get("totalStarterMarketValue") or 0
        feats[f"{side}_missing_ratio"] = miss_val / (miss_val + starters_val) if (miss_val + starters_val) else 0.0
        names = [p.get("name") for p in unavailable if (p.get("unavailability") or {}).get("type") == "injury"]
        feats[f"{side}_injured"] = names[:6]
        feats[f"{side}_squad_value"] = starters_val
    feats["lineup_type"] = lineup.get("lineupType")

    # 맞대결 요약 [홈승, 무, 원정승] (FotMob 기준: 이번 경기 홈팀 관점)
    h2h = content.get("h2h")
    if isinstance(h2h, dict) and isinstance(h2h.get("summary"), list) and len(h2h["summary"]) == 3:
        feats["h2h_summary"] = h2h["summary"]

    # 텍스트 인사이트
    for ins in (mf.get("insights") or [])[:6]:
        if ins.get("text"):
            team = feats["home_name"] if ins.get("teamId") == feats["home_id"] else (
                feats["away_name"] if ins.get("teamId") == feats["away_id"] else "")
            feats["notes"].append(f"{team}: {ins['text']}" if team else ins["text"])
    for fact in ((mf.get("poll") or {}).get("oddspoll") or {}).get("Facts", []) or []:
        if fact.get("defaultText"):
            feats["notes"].append(fact["defaultText"])
    return feats
