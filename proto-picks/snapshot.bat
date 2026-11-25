@echo off
REM 하루 여러 번: 배당 변동 추적용 스냅샷
cd /d %~dp0
call .venv\Scripts\activate.bat
python -m protopicks snapshot
