@echo off
chcp 65001 > nul
set PYTHONUTF8=1
cd /d %~dp0
echo ============================================
echo  프로토 추천 분석기 설치를 시작합니다
echo ============================================
set PY=
where py >nul 2>nul && set PY=py -3
if "%PY%"=="" (where python >nul 2>nul && set PY=python)
if "%PY%"=="" (
  echo [오류] 파이썬이 설치되어 있지 않습니다.
  echo https://www.python.org/downloads/ 에서 설치한 뒤 다시 실행하세요.
  echo 설치 첫 화면에서 "Add python.exe to PATH" 를 꼭 체크하세요.
  pause
  exit /b 1
)
if not exist .venv (
  echo 가상환경 만드는 중...
  %PY% -m venv .venv || (echo [오류] 가상환경 생성 실패 & pause & exit /b 1)
)
call .venv\Scripts\activate.bat
echo 필요한 프로그램 설치 중... (1~2분)
python -m pip install --upgrade pip -q
pip install -r requirements.txt -q || (echo [오류] 설치 실패. 인터넷 연결을 확인하세요. & pause & exit /b 1)
if not exist .env copy env.example .env > nul
echo.
echo 설치 완료! 설정 파일(.env)을 메모장으로 엽니다.
echo Claude API 키가 있으면 ANTHROPIC_API_KEY= 뒤에 붙여넣고 저장하세요. (없으면 그냥 닫아도 축구 분석은 됩니다)
notepad .env
pause
