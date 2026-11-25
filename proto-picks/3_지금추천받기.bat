@echo off
chcp 65001 > nul
set PYTHONUTF8=1
cd /d %~dp0
call .venv\Scripts\activate.bat
python -m protopicks settle
python -m protopicks run
if exist reports\latest.html start "" reports\latest.html
pause
