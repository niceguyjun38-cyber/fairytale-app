"""리포트 생성: HTML(브라우저용), 텍스트(텔레그램/콘솔용)."""
from __future__ import annotations

import html
from datetime import datetime

from .models import SPORT_LABEL, Candidate, Combo

WEEKDAY = "월화수목금토일"


def _pct(x: float | None) -> str:
    return "-" if x is None else f"{x * 100:.0f}%"


def _move(c: Candidate) -> str:
    mv = c.movement
    if mv is None or abs(mv) < 0.005:
        return "-"
    return f"{c.open_odds:.2f}→{c.odds:.2f} ({'▼' if mv > 0 else '▲'}{abs(mv) * 100:.0f}%)"


def _kick(c: Candidate) -> str:
    k = c.fixture.kickoff
    return f"{k:%m/%d}({WEEKDAY[k.weekday()]}) {k:%H:%M}"


def _grade(c: Candidate) -> str:
    if c.p_final >= 0.62:
        return "안정"
    if c.edge > 0.03:
        return "가치"
    return "보통"


def _membership(c: Candidate, combos: list[Combo]) -> str:
    return "·".join(combo.name.replace(" ", "") for combo in combos if any(leg is c for leg in combo.legs))


def text_report(run_at: datetime, picks: list[Candidate], combos: list[Combo], record: dict | None) -> str:
    lines = [f"⚽ 프로토 추천 {run_at:%Y-%m-%d}({WEEKDAY[run_at.weekday()]}) {run_at:%H:%M} 기준", ""]
    for combo in combos:
        icon = "🛡" if combo.kind == "safe" else "🎯"
        lines.append(f"{icon} {combo.name} ({len(combo.legs)}폴더) 총배당 {combo.total_odds:.2f} | "
                     f"적중확률 {_pct(combo.hit_prob)}")
        for c in combo.legs:
            lines.append(f"   {c.market.match_no:>4}번 {c.fixture.title} → {c.pick_label} @{c.odds:.2f}")
        lines.append("")
    lines.append(f"■ 경기별 근거 ({len(picks)}경기)")
    for c in picks:
        fx = c.fixture
        lines.append(
            f"[{c.market.match_no}번] {SPORT_LABEL.get(fx.sport, fx.sport)} {fx.league} {_kick(c)} · {_membership(c, combos)}\n"
            f"   {fx.title} → {c.pick_label} @{c.odds:.2f} | 예상 {_pct(c.p_final)} (배당 {_pct(c.p_market)})"
            f" | EV {c.edge * 100:+.0f}% | {_grade(c)}"
        )
        if c.reasons:
            lines.append("   · " + " / ".join(c.reasons[:3]))
    if record:
        lines.append("")
        lines.append(_record_line(record))
    lines.append("")
    lines.append("※ 통계 추정치이며 결과를 보장하지 않습니다. 베트맨 1회 구매 한도(10만원) 내 소액으로만 즐기세요.")
    return "\n".join(lines)


def _record_line(r: dict) -> str:
    s, k, legs = r.get("safe", {}), r.get("risky", {}), r.get("legs", {})
    lt = legs.get("hit", 0) + legs.get("miss", 0)
    leg_rate = f"{legs['hit'] / lt * 100:.0f}%" if lt else "-"
    return (f"누적 성적 · 안전조합 {s.get('hit', 0)}적중/{s.get('miss', 0)}실패 · "
            f"모험조합 {k.get('hit', 0)}적중/{k.get('miss', 0)}실패 · 개별경기 적중률 {leg_rate} ({lt}경기)")


CSS = """
:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--sub:#5d6470;--line:#e3e6ea;--safe:#0f7b5f;--risky:#b4461b;--accent:#2754c5}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--card:#1b1e23;--ink:#e9ebee;--sub:#9aa1ad;--line:#2b2f36;--safe:#3cc59c;--risky:#f08a5d;--accent:#7ea2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.sub{color:var(--sub);font-size:13px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.pick{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:start}.no{font-weight:700;font-size:18px;color:var(--accent)}
.sel{font-weight:700}.meta{color:var(--sub);font-size:13px}.nums{text-align:right;font-variant-numeric:tabular-nums}
.odds{font-size:20px;font-weight:700}.tag{display:inline-block;font-size:12px;padding:1px 8px;border-radius:99px;border:1px solid var(--line);margin-left:6px}
ul.r{margin:6px 0 0 0;padding-left:18px;color:var(--sub);font-size:13px}.combos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:10px}
.combo h3{margin:0 0 6px;font-size:16px}.combo.safe h3{color:var(--safe)}.combo.risky h3{color:var(--risky)}
.combo table{width:100%;border-collapse:collapse;font-size:13px}.combo td{padding:3px 0;border-bottom:1px solid var(--line)}
.combo td:last-child{text-align:right;font-variant-numeric:tabular-nums}.kpi{display:flex;gap:14px;margin-top:8px;font-size:13px}
.kpi b{font-size:16px;display:block}
@media (max-width:560px){.pick{grid-template-columns:32px 1fr}.pick .nums{grid-column:2;text-align:left;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}}footer{margin-top:28px;color:var(--sub);font-size:12px}
"""


def html_report(run_at: datetime, picks: list[Candidate], combos: list[Combo], record: dict | None,
                stats: dict | None = None) -> str:
    e = html.escape
    out = [f"<!doctype html><html lang='ko'><head><meta charset='utf-8'>"
           f"<meta name='viewport' content='width=device-width,initial-scale=1'>"
           f"<title>프로토 추천 {run_at:%Y-%m-%d}</title><style>{CSS}</style></head><body><main>"]
    out.append(f"<h1>프로토 추천 · {run_at:%Y-%m-%d}({WEEKDAY[run_at.weekday()]})</h1>")
    sub = f"{run_at:%H:%M} 기준 분석"
    if stats:
        sub += f" · 대상 {stats.get('fixtures', 0)}경기 · FotMob 분석 {stats.get('fotmob', 0)} · 웹리서치 {stats.get('research', 0)}"
    out.append(f"<div class='sub'>{e(sub)}</div>")

    out.append("<h2>추천 조합</h2><div class='combos'>")
    for combo in combos:
        rows = "".join(f"<tr><td>{e(c.market.match_no)}번 {e(c.fixture.title)}<br><b>{e(c.pick_label)}</b></td>"
                       f"<td>{c.odds:.2f}</td></tr>" for c in combo.legs)
        out.append(
            f"<div class='card combo {combo.kind}'><h3>{'🛡' if combo.kind == 'safe' else '🎯'} {e(combo.name)} "
            f"<span class='sub'>({len(combo.legs)}폴더)</span></h3><table>{rows}</table>"
            f"<div class='kpi'><div>총배당<b>{combo.total_odds:.2f}</b></div>"
            f"<div>적중확률<b>{_pct(combo.hit_prob)}</b></div><div>기대값<b>{combo.ev * 100:+.0f}%</b></div></div></div>"
        )
    out.append("</div>")
    out.append(f"<h2>경기별 근거 ({len(picks)}경기)</h2>")
    for c in picks:
        fx = c.fixture
        reasons = "".join(f"<li>{e(r)}</li>" for r in c.reasons[:4])
        out.append(
            f"<div class='card pick'><div class='no'>{e(c.market.match_no)}</div><div>"
            f"<div class='meta'>{e(SPORT_LABEL.get(fx.sport, fx.sport))} · {e(fx.league)} · {_kick(c)}</div>"
            f"<div>{e(fx.title)}</div><div class='sel'>{e(c.pick_label)}<span class='tag'>{_grade(c)}</span><span class='tag'>{e(_membership(c, combos))}</span></div>"
            f"<ul class='r'>{reasons}</ul></div>"
            f"<div class='nums'><div class='odds'>{c.odds:.2f}</div>"
            f"<div class='meta'>예상 {_pct(c.p_final)} / 배당 {_pct(c.p_market)}</div>"
            f"<div class='meta'>EV {c.edge * 100:+.0f}% · 변동 {e(_move(c))}</div></div></div>"
        )

    if record:
        out.append(f"<h2>누적 성적</h2><div class='card'>{e(_record_line(record))}</div>")
    out.append(
        "<footer>예상 확률 = FotMob 통계 모델 또는 웹 리서치 추정과 베트맨 배당 역산 확률의 혼합 + 배당 변동 보정. "
        "EV(기대값)는 예상 확률 × 배당 − 1 입니다. 통계 추정치일 뿐 결과를 보장하지 않으며, "
        "베트맨 1회 구매 한도(10만원) 안에서 감당 가능한 금액으로만 즐기세요. 도박 문제 상담: 1336</footer>"
    )
    out.append("</main></body></html>")
    return "".join(out)
