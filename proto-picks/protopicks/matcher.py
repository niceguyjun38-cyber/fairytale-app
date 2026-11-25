"""베트맨(한글 약칭) 경기 ↔ FotMob(영문) 경기 매칭.

순서: ① 저장된 매핑 → ② 킥오프 시각 ±2시간 후보 중 별칭 사전 일치 → ③ Claude로 일괄 매칭(키가 있을 때).
별칭은 data/aliases_user.json 에 {"베트맨약칭": "영문팀명 일부"} 형식으로 추가할 수 있다.
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import timedelta
from difflib import SequenceMatcher
from pathlib import Path

from .models import Fixture

# 베트맨은 팀명을 4~6글자로 줄여 표기한다. 접두(prefix) 기준으로 비교한다.
ALIASES: dict[str, str] = {
    # EPL
    "맨체스U": "manchester united", "맨유": "manchester united", "맨체스C": "manchester city", "맨시티": "manchester city",
    "토트넘": "tottenham", "아스널": "arsenal", "리버풀": "liverpool", "첼시": "chelsea", "뉴캐슬": "newcastle",
    "아스톤": "aston villa", "A빌라": "aston villa", "웨스트햄": "west ham", "브라이": "brighton", "노팅엄": "nottingham",
    "본머스": "bournemouth", "브렌트": "brentford", "풀럼": "fulham", "크리스": "crystal palace", "에버턴": "everton",
    "울버햄": "wolverhampton", "레스터": "leicester", "입스위": "ipswich", "사우샘": "southampton", "리즈": "leeds",
    "번리": "burnley", "선덜랜": "sunderland",
    # LaLiga
    "R마드리": "real madrid", "레알마드": "real madrid", "바르셀": "barcelona", "AT마드": "atletico madrid",
    "A마드리": "atletico madrid", "빌바오": "athletic", "레알소": "real sociedad", "R소시에": "real sociedad",
    "비야레": "villarreal", "베티스": "betis", "세비야": "sevilla", "발렌시": "valencia", "셀타": "celta",
    "오사수": "osasuna", "지로나": "girona", "마요르": "mallorca", "라요": "rayo", "헤타페": "getafe",
    "알라베": "alaves", "에스파": "espanyol", "레가네": "leganes", "엘체": "elche", "오비에": "oviedo",
    # Serie A
    "인테르": "inter", "인터밀": "inter", "AC밀란": "ac milan", "유벤투": "juventus", "나폴리": "napoli",
    "AS로마": "roma", "라치오": "lazio", "아탈란": "atalanta", "피오렌": "fiorentina", "볼로냐": "bologna",
    "토리노": "torino", "제노아": "genoa", "우디네": "udinese", "코모": "como", "칼리아": "cagliari", "레체": "lecce",
    "파르마": "parma", "베로나": "verona", "엘라스": "verona", "사수올": "sassuolo", "피사": "pisa", "크레모": "cremonese",
    # Bundesliga
    "바이에": "bayern", "B뮌헨": "bayern", "뮌헨": "bayern", "도르트": "dortmund", "레버쿠": "leverkusen",
    "라이프": "leipzig", "프랑크": "frankfurt", "슈투트": "stuttgart", "볼프스": "wolfsburg", "프라이": "freiburg",
    "호펜하": "hoffenheim", "마인츠": "mainz", "묀헨글": "monchengladbach", "글라드": "monchengladbach",
    "우니온": "union berlin", "브레멘": "werder", "아우크": "augsburg", "하이덴": "heidenheim", "장크트": "st. pauli",
    "함부르": "hamburg", "쾰른": "koln",
    # Ligue 1
    "파리생": "paris saint", "PSG": "paris saint", "마르세": "marseille", "모나코": "monaco", "릴": "lille",
    "리옹": "lyon", "니스": "nice", "랑스": "lens", "렌": "rennes", "스트라": "strasbourg", "낭트": "nantes",
    "툴루즈": "toulouse", "브레스": "brest", "오세르": "auxerre", "르아브": "le havre", "앙제": "angers",
    "로리앙": "lorient", "메스": "metz", "파리FC": "paris fc",
    # 기타 유럽
    "아약스": "ajax", "PSV": "psv", "페예노": "feyenoord", "벤피카": "benfica", "포르투": "porto",
    "스포르": "sporting", "셀틱": "celtic", "레인저": "rangers", "갈라타": "galatasaray", "페네르": "fenerbahce",
    # K리그
    "울산": "ulsan", "전북": "jeonbuk", "포항": "pohang", "FC서울": "fc seoul", "서울": "seoul", "수원FC": "suwon fc",
    "수원삼": "suwon samsung", "강원": "gangwon", "광주": "gwangju", "대구": "daegu", "대전": "daejeon", "제주": "jeju",
    "인천": "incheon", "김천": "gimcheon", "안양": "anyang", "부산": "busan", "전남": "jeonnam", "성남": "seongnam",
}

STRIP_WORDS = r"\b(fc|cf|afc|sc|ac|club|de|calcio|1\.|sv|vfb|vfl|tsg|bsc|rc|ss|us|as)\b"


def _norm_en(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(STRIP_WORDS, " ", s)
    return re.sub(r"[^a-z0-9 ]", " ", s).strip()


def _norm_ko(s: str) -> str:
    return re.sub(r"[\s.\-_()·]", "", s)


def load_user_aliases(data_dir: Path) -> None:
    p = data_dir / "aliases_user.json"
    if p.exists():
        try:
            ALIASES.update(json.loads(p.read_text(encoding="utf-8")))
        except ValueError:
            pass


def alias_for(name_ko: str) -> str | None:
    n = _norm_ko(name_ko)
    best = None
    for k, v in ALIASES.items():
        kk = _norm_ko(k)
        if n.startswith(kk) or kk.startswith(n) and len(n) >= 2:
            if best is None or len(kk) > len(best[0]):
                best = (kk, v)
    return best[1] if best else None


def name_score(name_ko: str, name_en: str) -> float:
    target = _norm_en(name_en)
    if re.fullmatch(r"[A-Za-z0-9 .&'\-]+", name_ko or ""):  # 베트맨이 영문 표기한 경우
        return SequenceMatcher(None, _norm_en(name_ko), target).ratio()
    al = alias_for(name_ko)
    if not al:
        return 0.0
    al = _norm_en(al) or al
    if al in target:
        return 1.0
    return SequenceMatcher(None, al, target).ratio() * 0.9


def candidates_for(fx: Fixture, fm_matches: list[dict], window_min: int = 120) -> list[dict]:
    lo, hi = fx.kickoff - timedelta(minutes=window_min), fx.kickoff + timedelta(minutes=window_min)
    return [m for m in fm_matches if lo <= m["kickoff"] <= hi]


def match_by_alias(fx: Fixture, cands: list[dict]) -> dict | None:
    best, best_s = None, 0.0
    for m in cands:
        s = name_score(fx.home, m["home"]) + name_score(fx.away, m["away"])
        # 한쪽만 확실해도 같은 시간대에 그 팀 경기는 하나뿐이므로 채택(단, 0.95 이상)
        one_side = max(name_score(fx.home, m["home"]), name_score(fx.away, m["away"]))
        s = max(s, one_side * 1.1 if one_side >= 0.95 else 0)
        if s > best_s:
            best, best_s = m, s
    return best if best_s >= 1.05 else None
