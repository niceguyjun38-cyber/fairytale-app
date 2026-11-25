from datetime import datetime, timedelta
from pathlib import Path

from protopicks import betman, combos, soccer_model
from protopicks.analyzer import implied_probs
from protopicks.config import KST
from protopicks.models import Candidate, Fixture, Market
from protopicks.settle import judge

SAMPLE = Path(__file__).resolve().parent.parent / "samples" / "sample_proto.csv"


def test_score_matrix_sums_to_one_and_markets():
    mat = soccer_model.score_matrix(1.6, 1.1)
    assert abs(sum(map(sum, mat)) - 1) < 1e-9
    p = soccer_model.market_probs(mat, Market("1", "1X2", None, {"W": 2, "D": 3, "L": 4}))
    assert abs(sum(p.values()) - 1) < 1e-9 and p["W"] > p["L"]
    # 핸디 -1 승은 일반 승보다 확률이 낮아야 한다
    ph = soccer_model.market_probs(mat, Market("2", "HANDICAP", -1.0, {"W": 3, "D": 3.5, "L": 2}))
    assert ph["W"] < p["W"]
    pou = soccer_model.market_probs(mat, Market("3", "OU", 2.5, {"U": 1.8, "O": 1.9}))
    assert abs(pou["U"] + pou["O"] - 1) < 1e-9


def test_expected_goals_home_advantage():
    table = [
        {"id": i, "played": 10, "gf": 14, "ga": 14, "home_played": 5, "home_gf": 8, "home_ga": 6,
         "away_played": 5, "away_gf": 6, "away_ga": 8} for i in range(1, 11)
    ]
    lam_h, lam_a, q = soccer_model.expected_goals(table, 1, 2)
    assert lam_h > lam_a and q == 1.0


def test_implied_probs_removes_margin():
    p = implied_probs(Market("1", "1X2", None, {"W": 1.8, "D": 3.2, "L": 4.0}))
    assert abs(sum(p.values()) - 1) < 1e-9


def test_judge():
    assert judge("1X2", None, "W", 2, 1) == "win"
    assert judge("HANDICAP", -1.0, "D", 2, 1) == "win"
    assert judge("HANDICAP", -1.0, "W", 2, 1) == "lose"
    assert judge("OU", 2.5, "O", 2, 1) == "win"
    assert judge("OU", 3.0, "O", 2, 1) == "void"


def test_betman_keys_datas_parser():
    payload = {"compSchedules": {
        "keys": ["itemCode", "leagueName", "matchSeq", "homeName", "awayName", "gameDate", "mchType", "handi",
                 "winAllot", "drawAllot", "loseAllot"],
        "datas": [
            ["SC", "EPL", 1, "토트넘", "아스널", 1795628700000, "일반", 0, 3.1, 3.3, 2.0],
            ["SC", "EPL", 2, "토트넘", "아스널", 1795628700000, "핸디캡", 1.0, 1.7, 3.6, 3.9],
            ["SC", "EPL", 3, "토트넘", "아스널", 1795628700000, "언더오버", 2.5, 1.8, 0, 1.8],
            ["BK", "KBL", 4, "서울SK", "창원LG", 1795628700000, "일반", 0, 1.6, 0, 2.1],
        ]}}
    fx = betman.rows_to_fixtures(betman._table_to_rows(payload), "260137")
    assert len(fx) == 2
    epl = next(f for f in fx if f.sport == "soccer")
    assert [m.market for m in epl.markets] == ["1X2", "HANDICAP", "OU"]
    assert epl.markets[2].odds == {"U": 1.8, "O": 1.8}


def test_csv_loader():
    fx = betman.load_csv(SAMPLE)
    assert len(fx) > 10
    assert any(m.market == "OU" for f in fx for m in f.markets)


def _cand(i: int, p: float, odds: float) -> Candidate:
    fx = Fixture("r", "soccer", f"L{i % 4}", f"H{i}", f"A{i}", datetime.now(KST) + timedelta(hours=i))
    m = Market(str(i), "1X2", None, {"W": odds, "L": 2.0})
    fx.markets.append(m)
    return Candidate(fx, m, "W", odds, p, p, p)


def test_picks_and_combos():
    cands = [_cand(i, p, o) for i, (p, o) in enumerate(
        [(0.80, 1.20), (0.75, 1.30), (0.70, 1.40), (0.66, 1.50), (0.45, 2.60), (0.40, 2.90), (0.35, 3.40),
         (0.50, 1.80), (0.30, 3.00)])]
    picks = combos.select_picks(cands, 7)
    assert len(picks) == 7 and len({c.fixture.key for c in picks}) == 7
    cs = combos.build_combos(picks)
    kinds = [c.kind for c in cs]
    assert kinds.count("safe") == 2 and kinds.count("risky") == 2
    safe = [c for c in cs if c.kind == "safe"]
    risky = [c for c in cs if c.kind == "risky"]
    assert min(c.hit_prob for c in safe) > max(c.hit_prob for c in risky)
    assert set(map(id, safe[0].legs)) != set(map(id, safe[1].legs))


def test_research_flow_with_fake_client(monkeypatch):
    from types import SimpleNamespace as NS

    from protopicks import research

    fx = Fixture("r", "basketball", "KBL", "서울SK", "창원LG", datetime.now(KST) + timedelta(hours=5))
    fx.markets.append(Market("25", "1X2", None, {"W": 1.62, "L": 2.05}))
    answers = iter([
        NS(stop_reason="pause_turn", content=[NS(type="text", text="검색 중")]),
        NS(stop_reason="end_turn", content=[NS(type="text", text=(
            '분석 결과\n```json\n{"fixtures":[{"id":"g1","confidence":0.7,"factors":["SK 5연승"],'
            '"markets":[{"match_no":"25","probs":[{"outcome":"W","p":0.66},{"outcome":"L","p":0.34}]}]}]}\n```'))]),
    ])
    monkeypatch.setattr(research, "_client", lambda: None)
    monkeypatch.setattr(research, "_create", lambda client, **kw: next(answers))
    out = research.research_fixtures([fx])
    assert out[fx.key]["probs"]["25"]["W"] == 0.66
    assert out[fx.key]["factors"] == ["SK 5연승"]
