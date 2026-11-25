#!/usr/bin/env bash
# 매일 1회: 지난 추천 정산 → 오늘 추천 생성 (macOS/Linux)
cd "$(dirname "$0")"
source .venv/bin/activate
python -m protopicks settle
python -m protopicks run
