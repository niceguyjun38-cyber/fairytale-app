@echo off
REM 작업 스케줄러용: 매일 1회 정산 + 추천 생성 (창이 자동으로 닫힘)
chcp 65001 > nul
set PYTHONUTF8=1
cd /d %~dp0
if not exist reports mkdir reports
call .venv\Scripts\activate.bat
python -m protopicks settle >> reports\log.txt 2>&1
python -m protopicks run >> reports\log.txt 2>&1
