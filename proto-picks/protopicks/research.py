"""Claude API 활용: ① 축구 외 종목(및 FotMob 미매칭 경기) 웹 리서치 → 확률 추정, ② 한글↔영문 팀명 매칭 보조.

Claude 웹 검색 서버 도구(web_search)를 사용한다. ANTHROPIC_API_KEY 가 없으면 이 모듈은 호출되지 않는다.
"""
from __future__ import annotations

import json
import re
from typing import Any

from .config import settings
from .models import OUTCOME_LABEL, SPORT_LABEL, Fixture

FALLBACK_BETA = "server-side-fallback-2026-07-01"

RESEARCH_SYSTEM = """당신은 스포츠 데이터 분석가입니다. 한국 스포츠토토 '프로토 승부식'에 올라온 경기들의 실제 결과 확률을 추정합니다.
- 웹 검색으로 각 경기의 최신 정보를 확인하세요: 최근 경기력/연승·연패, 부상·결장자, 휴식일·백투백·원정 연전,
  (야구) 선발투수와 최근 투구 내용, (농구) 주전 출전 여부와 페이스, (배구) 세트 득실·주포 컨디션, 상대 전적, 동기부여(순위 경쟁 등).
- 베트맨 배당은 참고용으로만 보고, 근거에 기반해 독립적으로 확률을 추정하세요. 정보가 부족하면 배당 확률에 가깝게 두고 confidence를 낮추세요.
- 핸디캡 line은 홈팀 점수에 더하는 값입니다(예: -1.5 → 홈팀이 2점 이상 이겨야 '승'). 언더오버 line은 양 팀 합계 기준점입니다.
- 같은 마켓 안의 결과 확률 합은 1이어야 합니다.
- factors는 한국어로, 확인한 구체적 사실 위주로 2~4개 적으세요.
- 마지막에 반드시 ```json 코드블록 하나로 결과만 출력하세요. 형식:
{"fixtures":[{"id":"<경기 id>","confidence":0.0~1.0,"factors":["..."],"markets":[{"match_no":"<경기번호>","probs":[{"outcome":"W","p":0.55},{"outcome":"L","p":0.45}]}]}]}"""

RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "fixtures": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "confidence": {"type": "number"},
                    "factors": {"type": "array", "items": {"type": "string"}},
                    "markets": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "match_no": {"type": "string"},
                                "probs": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {"outcome": {"type": "string"}, "p": {"type": "number"}},
                                        "required": ["outcome", "p"],
                                        "additionalProperties": False,
                                    },
                                },
                            },
                            "required": ["match_no", "probs"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["id", "confidence", "factors", "markets"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["fixtures"],
    "additionalProperties": False,
}

MAP_SCHEMA = {
    "type": "object",
    "properties": {
        "mappings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "fotmob_match_id": {"type": ["integer", "null"]},
                },
                "required": ["id", "fotmob_match_id"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["mappings"],
    "additionalProperties": False,
}


def _client():
    import anthropic  # 지연 import: 키가 없으면 설치 안 해도 동작하도록

    return anthropic.Anthropic(max_retries=3)


def _create(client, **kwargs):
    """refusal 시 서버측 대체 모델로 자동 재시도(fallbacks="default")."""
    return client.beta.messages.create(
        model=settings.claude_model,
        betas=[FALLBACK_BETA],
        fallbacks="default",
        **kwargs,
    )


def _text_of(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def _extract_json(text: str) -> dict | None:
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, re.S)
    for raw in reversed(blocks):
        try:
            return json.loads(raw)
        except ValueError:
            continue
    try:
        start, end = text.index("{"), text.rindex("}")
        return json.loads(text[start:end + 1])
    except ValueError:
        return None


def _fixture_payload(fx: Fixture, fid: str) -> dict:
    return {
        "id": fid,
        "sport": SPORT_LABEL.get(fx.sport, fx.sport),
        "league": fx.league,
        "home": fx.home,
        "away": fx.away,
        "kickoff_kst": fx.kickoff.strftime("%Y-%m-%d %H:%M"),
        "markets": [
            {"match_no": m.match_no, "type": m.market, "line": m.line,
             "betman_odds": {f"{k}({OUTCOME_LABEL[k]})": v for k, v in m.odds.items()}}
            for m in fx.markets
        ],
    }


def research_fixtures(fixtures: list[Fixture]) -> dict[str, dict]:
    """fixture.key → {"confidence", "factors", "probs": {match_no: {outcome: p}}}"""
    if not fixtures:
        return {}
    client = _client()
    results: dict[str, dict] = {}
    size = max(1, settings.research_batch_size)
    for i in range(0, len(fixtures), size):
        batch = fixtures[i:i + size]
        ids = {f"g{i + j + 1}": fx for j, fx in enumerate(batch)}
        payload = [_fixture_payload(fx, fid) for fid, fx in ids.items()]
        messages: list[dict[str, Any]] = [{
            "role": "user",
            "content": "다음 경기들을 조사해 각 마켓 결과 확률을 추정해 주세요.\n\n"
                       + json.dumps(payload, ensure_ascii=False, indent=1),
        }]
        try:
            text = _run_search_turns(client, messages)
        except Exception as e:  # 네트워크/API 오류: 해당 배치만 건너뜀
            print(f"  [리서치] 배치 {i // size + 1} 실패: {e}")
            continue
        data = _extract_json(text) or _coerce_json(client, text)
        for item in (data or {}).get("fixtures", []):
            fx = ids.get(str(item.get("id")))
            if not fx:
                continue
            probs = {}
            for mk in item.get("markets", []):
                ps = {p["outcome"]: float(p["p"]) for p in mk.get("probs", []) if p.get("outcome") in OUTCOME_LABEL}
                s = sum(ps.values())
                if s > 0:
                    probs[str(mk.get("match_no"))] = {k: v / s for k, v in ps.items()}
            results[fx.key] = {
                "confidence": max(0.0, min(1.0, float(item.get("confidence", 0.4)))),
                "factors": [str(f) for f in item.get("factors", [])][:4],
                "probs": probs,
            }
    return results


def _run_search_turns(client, messages: list[dict]) -> str:
    tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 12}]
    for _ in range(6):  # pause_turn 이어가기
        resp = _create(
            client,
            max_tokens=16000,
            system=RESEARCH_SYSTEM,
            output_config={"effort": settings.claude_effort},
            tools=tools,
            messages=messages,
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("모델이 요청을 거절했습니다")
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        return _text_of(resp)
    return _text_of(resp)


def _coerce_json(client, text: str) -> dict | None:
    """리서치 답변에서 JSON을 못 뽑았을 때 구조화 출력으로 변환."""
    try:
        resp = _create(
            client,
            max_tokens=8000,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": RESULT_SCHEMA}},
            messages=[{"role": "user", "content": "아래 분석 내용을 지정된 JSON 형식으로 옮겨 주세요.\n\n" + text}],
        )
        if resp.stop_reason == "refusal":
            return None
        return json.loads(_text_of(resp))
    except Exception:
        return None


def llm_match(pairs: list[tuple[Fixture, list[dict]]]) -> dict[str, int | None]:
    """베트맨 경기(한글) ↔ FotMob 후보(영문) 매칭. fixture.key → fotmob match id."""
    if not pairs:
        return {}
    client = _client()
    items, ids = [], {}
    for n, (fx, cands) in enumerate(pairs):
        fid = f"m{n + 1}"
        ids[fid] = fx
        items.append({
            "id": fid, "league": fx.league, "home": fx.home, "away": fx.away,
            "kickoff_kst": fx.kickoff.strftime("%Y-%m-%d %H:%M"),
            "candidates": [{"fotmob_match_id": c["id"], "league": c["league"], "home": c["home"], "away": c["away"],
                            "kickoff_kst": c["kickoff"].strftime("%Y-%m-%d %H:%M")} for c in cands[:40]],
        })
    prompt = ("한국 베트맨의 축구 경기(한글 약칭 팀명)를 FotMob 후보 경기(영문)와 짝지어 주세요. "
              "홈/원정이 모두 같은 경기만 선택하고, 확실하지 않으면 null로 두세요.\n\n"
              + json.dumps(items, ensure_ascii=False))
    try:
        resp = _create(
            client,
            max_tokens=8000,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": MAP_SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        )
        if resp.stop_reason == "refusal":
            return {}
        data = json.loads(_text_of(resp))
    except Exception as e:
        print(f"  [매칭] Claude 매칭 실패: {e}")
        return {}
    out = {}
    for mp in data.get("mappings", []):
        fx = ids.get(mp.get("id"))
        if fx:
            out[fx.key] = mp.get("fotmob_match_id")
    return out
