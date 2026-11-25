@echo off
REM 작업 스케줄러용: 배당 변동 추적 스냅샷 (하루 여러 번)
chcp 65001 > nul
set PYTHONUTF8=1
cd /d %~dp0
if not exist reports mkdir reports
call .venv\Scripts\activate.bat
python -m protopicks snapshot >> reports\log.txt 2>&1
