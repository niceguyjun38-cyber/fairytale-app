"""경기별 확률 계산 → 후보(베팅 선택지) 생성.

최종확률 = [w × 모델확률 + (1-w) × 배당역산확률] × 배당변동 보정 (마켓 내 재정규화)
 - 축구: FotMob 기반 포아송 모델 (w = MODEL_WEIGHT_SOCCER × 데이터품질)
 - 그 외: Claude 웹 리서치 확률 (w = MODEL_WEIGHT_OTHER × 리서치 confidence)
"""
from __future__ import annotations

from datetime import datetime, timedelta

from . import matcher, research, soccer_model
from .config import KST, settings
from .db import Store
from .fotmob import FotMob, extract_features
from .models import OUTCOME_LABEL, Candidate, Fixture, Market


MAX_MODEL_GAP = 0.25


def implied_probs(market: Market) -> dict[str, float]:
    inv = {k: 1.0 / v for k, v in market.odds.items() if v > 1}
    s = sum(inv.values())
    return {k: v / s for k, v in inv.items()}


def payout_rate(market: Market) -> float:
    return 1.0 / sum(1.0 / v for v in market.odds.values())


def filter_upcoming(fixtures: list[Fixture], now: datetime | None = None) -> list[Fixture]:
    now = now or datetime.now(KST)
    # 프로토는 경기 시작 10분 전 마감 → 최소 15분 여유
    lo, hi = now + timedelta(minutes=15), now + timedelta(hours=settings.lookahead_hours)
    return [fx for fx in fixtures if lo <= fx.kickoff <= hi]


# ------------------------------------------------------------------ 축구
def attach_fotmob(fixtures: list[Fixture], fm: FotMob, store: Store, use_llm: bool) -> None:
    soccer = [fx for fx in fixtures if fx.sport == "soccer"]
    if not soccer:
        return
    matcher.load_user_aliases(settings.data_dir)
    fm_matches = fm.matches_around([fx.kickoff for fx in soccer])
    by_id = {m["id"]: m for m in fm_matches}
    unresolved: list[tuple[Fixture, list[dict]]] = []
    for fx in soccer:
        cached = store.get_mapping(fx)
        if cached and cached[0]:
            fx.fotmob_match_id, fx.fotmob_names = cached[0], (cached[1], cached[2])
            continue
        cands = matcher.candidates_for(fx, fm_matches)
        hit = matcher.match_by_alias(fx, cands)
        if hit:
            fx.fotmob_match_id, fx.fotmob_names = hit["id"], (hit["home"], hit["away"])
            store.put_mapping(fx, hit["id"], hit["home"], hit["away"])
        elif cands:
            unresolved.append((fx, cands))
    if unresolved and use_llm:
        print(f"  팀명 자동매칭 실패 {len(unresolved)}경기 → Claude로 매칭")
        mapped = research.llm_match(unresolved)
        for fx, _ in unresolved:
            mid = mapped.get(fx.key)
            if mid and mid in by_id:
                m = by_id[mid]
                fx.fotmob_match_id, fx.fotmob_names = mid, (m["home"], m["away"])
                store.put_mapping(fx, mid, m["home"], m["away"])


def soccer_analysis(fx: Fixture, fm: FotMob) -> dict | None:
    """{"probs": {match_no: {outcome: p}}, "quality", "factors", "lambdas"}"""
    if not fx.fotmob_match_id:
        return None
    details = fm.match_details(fx.fotmob_match_id)
    if not details:
        return None
    feats = extract_features(details)
    table_rows = None
    for league_id in {feats.get("league_id"), feats.get("parent_league_id")} - {None}:
        for group in fm.table(league_id):
            ids = {r["id"] for r in group}
            if feats["home_id"] in ids and feats["away_id"] in ids:
                table_rows = group
                break
        if table_rows:
            break
    xg = soccer_model.expected_goals(table_rows, feats["home_id"], feats["away_id"]) if table_rows else None
    factors: list[str] = []
    hn, an = feats.get("home_name") or fx.home, feats.get("away_name") or fx.away
    if feats.get("home_form_str") or feats.get("away_form_str"):
        factors.append(f"최근5경기 {hn} {feats.get('home_form_str', '-')} / {an} {feats.get('away_form_str', '-')}")
    for side, name in (("home", hn), ("away", an)):
        if feats.get(f"{side}_injured"):
            factors.append(f"{name} 부상: {', '.join(feats[f'{side}_injured'][:3])}")
    if feats.get("h2h_summary"):
        w, d, l = feats["h2h_summary"]
        factors.append(f"상대전적 {hn} {w}승 {d}무 {l}패")
    try:
        pid = feats.get("parent_league_id") or feats.get("league_id")
        ins = fm.insights(pid, fx.fotmob_match_id) if pid else None
        if ins and ins.get("bettingInsight"):
            factors.append(f"Opta: {ins['bettingInsight']}")
    except Exception:
        pass
    factors.extend(feats.get("notes", [])[:2])

    if not xg:
        # 순위표가 없는 컵대회 등: 확률 모델 대신 근거만 제공(시장 확률 위주)
        return {"probs": {}, "quality": 0.0, "factors": factors, "lambdas": None}
    lam_h, lam_a, quality = xg
    lam_h, lam_a, notes = soccer_model.adjust_lambdas(lam_h, lam_a, feats)
    w = settings.model_weight_soccer * quality
    mkt = soccer_model.fit_market_lambdas(fx.markets, total_hint=lam_h + lam_a)
    if mkt:
        fin_h, fin_a = soccer_model.blend_lambdas(mkt, (lam_h, lam_a), w)
        factors.insert(0, f"예상득점 {hn} {fin_h:.2f} : {fin_a:.2f} {an} "
                          f"(배당기준 {mkt[0]:.2f}:{mkt[1]:.2f}, 통계 {lam_h:.2f}:{lam_a:.2f})")
    else:
        fin_h, fin_a = lam_h, lam_a
        factors.insert(0, f"예상득점 {hn} {fin_h:.2f} : {fin_a:.2f} {an}")
    mat = soccer_model.score_matrix(fin_h, fin_a)
    probs = {m.match_no: soccer_model.market_probs(mat, m) for m in fx.markets}
    factors.extend(notes)
    # anchored=True: 이미 시장 기준점과 혼합된 확률이므로 뒤 단계에서 다시 섞지 않는다
    return {"probs": probs, "quality": quality, "factors": factors, "lambdas": (fin_h, fin_a),
            "anchored": bool(mkt), "weight": w}


# ------------------------------------------------------------------ 공통
def build_candidates(fixtures: list[Fixture], store: Store, use_llm: bool = True) -> list[Candidate]:
    fm = FotMob(settings.data_dir / "cache")
    try:
        attach_fotmob(fixtures, fm, store, use_llm)
    except Exception as e:
        print(f"  [FotMob] 경기 목록 수집 실패: {e}")

    analyses: dict[str, dict] = {}
    for fx in fixtures:
        if fx.sport == "soccer" and fx.fotmob_match_id:
            try:
                a = soccer_analysis(fx, fm)
            except Exception as e:
                print(f"  [FotMob] {fx.title} 분석 실패: {e}")
                a = None
            if a:
                a["source"] = "fotmob"
                analyses[fx.key] = a

    # 리서치 대상: 축구 외 종목 + 모델확률 없는 축구. 비용 제한을 위해 '추천 가능성 있는' 경기 우선.
    if use_llm and settings.has_claude:
        need = [fx for fx in fixtures if not analyses.get(fx.key, {}).get("probs")]
        need = [fx for fx in need if any(1.2 <= o <= 3.6 for m in fx.markets for o in m.odds.values())]
        need.sort(key=lambda fx: fx.kickoff)
        need = need[: settings.max_research_fixtures]
        if need:
            print(f"  웹 리서치(Claude) {len(need)}경기 진행...")
            for key, r in research.research_fixtures(need).items():
                prev = analyses.get(key, {})
                analyses[key] = {
                    "probs": r["probs"], "quality": r["confidence"],
                    "factors": prev.get("factors", []) + r["factors"], "source": "research",
                }

    cands: list[Candidate] = []
    for fx in fixtures:
        a = analyses.get(fx.key, {})
        base_w = settings.model_weight_soccer if a.get("source") == "fotmob" else settings.model_weight_other
        for m in fx.markets:
            p_mkt = implied_probs(m)
            p_mod = (a.get("probs") or {}).get(m.match_no)
            sanity_note = None
            if p_mod and max(abs(p_mod.get(k, p_mkt[k]) - p_mkt[k]) for k in p_mkt) > MAX_MODEL_GAP:
                # 모델과 배당이 25%p 넘게 차이나면 데이터 오류(유형 오인식·팀 매칭 실수) 가능성이 커서 배당 기준으로 처리
                p_mod, sanity_note = None, "모델·배당 차이가 너무 커서 배당 기준으로 계산"
            if not p_mod:
                w = 0.0
            elif a.get("anchored"):
                w = 1.0  # 축구: 기대득점 단계에서 이미 배당 기준점과 혼합됨
            else:
                w = base_w * (a.get("quality") or 0.0)
            blended = {k: w * (p_mod.get(k, p_mkt[k]) if p_mod else 0) + (1 - w) * p_mkt[k] for k in p_mkt}

            # 배당 변동 보정
            opens = {k: store.opening_odds(fx.round_id, m.match_no, k, m.line) for k in m.odds}
            adj = {}
            for k, p in blended.items():
                o = opens.get(k)
                drift = (o - m.odds[k]) / o if o else 0.0
                drift = max(-0.15, min(0.15, drift))
                adj[k] = p * (1 + settings.movement_factor * drift)
            s = sum(adj.values())
            adj = {k: v / s for k, v in adj.items()}

            for k in m.odds:
                reasons = list(a.get("factors", []))
                if sanity_note:
                    reasons.insert(0, sanity_note)
                o = opens.get(k)
                if o and abs(o - m.odds[k]) >= 0.01:
                    arrow = "하락" if m.odds[k] < o else "상승"
                    reasons.insert(0, f"배당 {o:.2f}→{m.odds[k]:.2f} {arrow}")
                cands.append(Candidate(
                    fixture=fx, market=m, outcome=k, odds=m.odds[k],
                    p_market=p_mkt[k], p_model=p_mod.get(k) if p_mod else None, p_final=adj[k],
                    open_odds=o, confidence=0.0 if sanity_note else (a.get("quality") or 0.0), reasons=reasons,
                ))
    return cands


def describe_outcome(c: Candidate) -> str:
    return f"{c.fixture.title} · {c.pick_label} ({OUTCOME_LABEL.get(c.outcome, c.outcome)})"
