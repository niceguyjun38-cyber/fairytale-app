@echo off
REM 매일 1회: 지난 추천 정산 → 오늘 추천 생성
cd /d %~dp0
call .venv\Scripts\activate.bat
python -m protopicks settle
python -m protopicks run
