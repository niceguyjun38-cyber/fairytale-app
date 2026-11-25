@echo off
chcp 65001 > nul
set PYTHONUTF8=1
cd /d %~dp0
call .venv\Scripts\activate.bat
python -m protopicks betman-dump
echo.
echo 위에 "저장:" 줄이 여러 개 나오면 연결 성공입니다.
echo 오류가 나면 data\betman_dump 폴더(있다면)와 이 화면을 캡처해서 보내 주세요.
start "" data\betman_dump
pause
