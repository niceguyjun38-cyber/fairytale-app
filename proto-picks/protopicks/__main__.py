"""실행 진입점.

  python -m protopicks run              # 수집 → 분석 → 7경기 + 4조합 추천 리포트
  python -m protopicks run --csv 파일   # 베트맨 자동수집 대신 CSV 사용
  python -m protopicks snapshot         # 배당만 저장(배당 변동 추적용, 하루 여러 번 실행)
  python -m protopicks settle           # 지난 추천 결과 정산(축구 자동)
  python -m protopicks result 회차 경기번호 win|lose|void   # 축구 외 종목 수동 정산
  python -m protopicks betman-dump      # 베트맨 원본 응답 저장(구조 확인용)
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from .config import KST, settings


def _load_fixtures(csv_path: str | None):
    from .betman import BetmanClient, BetmanError, load_csv

    if csv_path:
        return load_csv(Path(csv_path))
    try:
        return BetmanClient().fetch_fixtures()
    except BetmanError as e:
        print(f"[베트맨] {e}")
        sys.exit(2)


def cmd_snapshot(args) -> None:
    from .db import Store

    fixtures = _load_fixtures(args.csv)
    n = Store(settings.db_path).save_snapshot(fixtures)
    print(f"배당 스냅샷 저장: {len(fixtures)}경기 / {n}개 배당")


def cmd_run(args) -> None:
    from . import analyzer, combos, notify, report
    from .db import Store

    settings.ensure_dirs()
    if args.no_llm:
        settings.anthropic_api_key = ""
    now = datetime.now(KST)
    store = Store(settings.db_path)

    print("1) 베트맨 프로토 경기·배당 수집")
    fixtures = _load_fixtures(args.csv)
    store.save_snapshot(fixtures, now)
    upcoming = fixtures if args.ignore_time else analyzer.filter_upcoming(fixtures, now)
    print(f"   발매 {len(fixtures)}경기 중 분석 대상 {len(upcoming)}경기 (향후 {settings.lookahead_hours}시간)")
    if not upcoming:
        print("   분석할 경기가 없습니다.")
        return

    print("2) 분석 (축구: FotMob 통계 모델 / 기타: 웹 리서치)"
          + ("" if settings.has_claude else " — Claude 키 없음: 축구 외 종목은 배당·변동만 사용"))
    cands = analyzer.build_candidates(upcoming, store, use_llm=settings.has_claude)

    print("3) 추천 경기·조합 구성")
    picks = combos.select_picks(cands)
    combo_list = combos.build_combos(picks)
    store.save_picks(now.strftime("%Y-%m-%d"), combo_list)

    stats = {
        "fixtures": len(upcoming),
        "fotmob": len({c.fixture.key for c in cands if c.fixture.fotmob_match_id}),
        "research": len({c.fixture.key for c in cands if c.p_model is not None and c.fixture.sport != "soccer"}),
    }
    record = store.record_summary()
    txt = report.text_report(now, picks, combo_list, record)
    html_doc = report.html_report(now, picks, combo_list, record, stats)
    out = settings.report_dir / f"{now:%Y-%m-%d_%H%M}.html"
    out.write_text(html_doc, encoding="utf-8")
    (settings.report_dir / "latest.html").write_text(html_doc, encoding="utf-8")
    (settings.report_dir / f"{now:%Y-%m-%d_%H%M}.txt").write_text(txt, encoding="utf-8")
    print()
    print(txt)
    print(f"\n리포트: {out}")
    if notify.send_telegram(txt):
        print("텔레그램 전송 완료")


def cmd_settle(args) -> None:
    from .db import Store
    from .settle import settle_soccer

    n = settle_soccer(Store(settings.db_path))
    print(f"정산 완료: {n}건")


def cmd_result(args) -> None:
    from .db import Store

    n = Store(settings.db_path).set_result_by_match(args.round, args.match_no, args.result)
    print(f"{n}건 반영")


def cmd_dump(args) -> None:
    from .betman import BetmanClient

    settings.ensure_dirs()
    for p in BetmanClient().dump(settings.data_dir / "betman_dump"):
        print(f"저장: {p}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="protopicks", description="베트맨 프로토 추천 분석기")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="오늘의 추천 생성")
    r.add_argument("--csv", help="베트맨 자동수집 대신 사용할 CSV 경로")
    r.add_argument("--no-llm", action="store_true", help="Claude(웹 리서치·매칭) 사용 안 함")
    r.add_argument("--ignore-time", action="store_true", help="킥오프 시간 필터 무시(테스트용)")
    r.set_defaults(func=cmd_run)

    s = sub.add_parser("snapshot", help="배당 스냅샷만 저장")
    s.add_argument("--csv")
    s.set_defaults(func=cmd_snapshot)

    sub.add_parser("settle", help="축구 추천 결과 자동 정산").set_defaults(func=cmd_settle)

    res = sub.add_parser("result", help="수동 정산")
    res.add_argument("round")
    res.add_argument("match_no")
    res.add_argument("result", choices=["win", "lose", "void"])
    res.set_defaults(func=cmd_result)

    sub.add_parser("betman-dump", help="베트맨 원본 응답 저장").set_defaults(func=cmd_dump)

    args = ap.parse_args(argv)
    settings.ensure_dirs()
    args.func(args)


if __name__ == "__main__":
    main()
