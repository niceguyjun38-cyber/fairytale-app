# 프로토 추천 분석기 (proto-picks)

베트맨 **프로토 승부식**에 올라온 경기를 매일 자동으로 모아 분석하고,
**추천 7경기**와 **안전 조합 2개 + 모험 조합 2개**를 리포트로 만들어 주는 프로그램입니다.

| 종목 | 분석 자료 |
|---|---|
| 축구 | FotMob 무료 데이터: 리그 순위표(홈/원정 득실 분리), 최근 5경기 폼, 부상·결장자(시장가치 비중), 상대전적, Opta 인사이트 → 포아송 득점 모델 |
| 농구·야구·배구 등 | Claude 웹 검색으로 부상·선발투수·연전·최근 경기력 등을 조사해 확률 추정 |
| 공통 | 베트맨 배당 역산 확률(마진 제거) + **배당 변동**(첫 관측 대비 하락/상승) |

## 어떻게 고르나

1. **예상 확률** = `가중치 × 모델 확률 + (1 − 가중치) × 배당 확률` → 배당 변동 보정
   - 축구 가중치 0.40 × 데이터 품질, 기타 종목 0.35 × 리서치 신뢰도 (`.env`에서 조정)
   - 배당이 떨어진 쪽(돈·정보가 몰린 쪽)은 확률을 소폭 올림 (최대 ±9%)
2. **기대값(EV)** = 예상 확률 × 배당 − 1
3. **추천 7경기**: 한 경기당 선택지 1개, 같은 리그 최대 3경기
   - 고확률형 4경기(배당 1.15~2.3, 예상 확률 50% 이상) + 가치형 3경기(배당 1.6~4.5, EV 우선)
4. **조합**: 7경기 안에서 모든 조합을 계산해
   - 🛡 안전 A·B: 적중 확률이 가장 높은 3폴더 (총배당 2.0 이상)
   - 🎯 모험 A·B: 기대값이 가장 높은 4폴더 (총배당 5.0 이상)

폴더 수·기준은 `.env`의 `SAFE_LEGS`, `RISKY_LEGS`, `SAFE_MIN_ODDS`, `RISKY_MIN_ODDS`로 바꿀 수 있습니다.

## 설치 (Windows 기준)

> ⚠️ **베트맨은 해외 IP 접속을 막습니다.** 반드시 **한국 인터넷에 연결된 PC**에서 실행하세요.
> (해외 클라우드·GitHub Actions 등에서는 베트맨 수집이 실패합니다.)

1. [Python 3.10 이상](https://www.python.org/downloads/) 설치 (설치 시 "Add python.exe to PATH" 체크)
2. 이 `proto-picks` 폴더에서 명령 프롬프트를 열고:

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

```bash
copy env.example .env
```

3. `.env` 파일을 메모장으로 열어 `ANTHROPIC_API_KEY`(축구 외 종목 분석용, [Claude Console](https://console.anthropic.com)에서 발급)를 넣습니다.
   텔레그램으로 받고 싶으면 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`도 넣습니다.

## 실행

```bash
python -m protopicks run
```

- 결과: 화면 출력 + `reports\latest.html` (브라우저로 열기) + 텔레그램(설정 시)
- 축구만 무료로 쓰려면: `python -m protopicks run --no-llm`

| 명령 | 하는 일 |
|---|---|
| `python -m protopicks run` | 수집 → 분석 → 7경기·4조합 리포트 |
| `python -m protopicks snapshot` | 배당만 저장 (하루 여러 번 돌리면 배당 변동을 잡아냄) |
| `python -m protopicks settle` | 지난 축구 추천 결과 자동 정산 (FotMob 최종 스코어) |
| `python -m protopicks result 회차 경기번호 win` | 축구 외 종목 수동 정산 (`win`/`lose`/`void`) |
| `python -m protopicks betman-dump` | 베트맨 원본 응답을 `data\betman_dump`에 저장 (구조 확인용) |
| `python -m protopicks run --csv 파일.csv` | 베트맨 자동 수집 대신 CSV 사용 |

## 매일 자동 실행 (Windows 작업 스케줄러)

1. 시작 메뉴 → "작업 스케줄러" → **기본 작업 만들기**
2. 트리거: 매일 / 시간 예: **오후 6시** (유럽 축구가 밤에 열리므로 저녁 실행 권장)
3. 동작: 프로그램 시작 → `proto-picks\run_daily.bat` 선택
4. 배당 변동 추적용으로 `snapshot.bat`을 **오전 10시, 오후 2시** 등에 같은 방법으로 추가

macOS/Linux는 `crontab -e`에 예: `0 18 * * * /경로/proto-picks/run_daily.sh`

## 처음 실행할 때 꼭 확인할 것

베트맨은 공개 API 문서가 없어, 내부 JSON 응답의 필드명을 여러 후보로 읽도록 만들었습니다.
개발 환경(해외)에서는 베트맨에 접속할 수 없어 **실제 응답으로 검증하지 못했습니다.** 처음 한 번은:

```bash
python -m protopicks betman-dump
```

- 경기 목록이 잘 나오면 그대로 쓰면 됩니다.
- 오류가 나거나 경기가 0개면 `data\betman_dump` 안의 json 파일을 공유해 주시면 파서를 맞춰 드립니다.
- 특히 **언더오버**는 '승' 칸=언더, '패' 칸=오버로 읽도록 되어 있으니 리포트의 배당이 베트맨 화면과 같은지 한 번 대조해 주세요.

그동안은 CSV로 바로 쓸 수 있습니다 (`samples/sample_proto.csv` 형식):

```
round,match_no,sport,league,home,away,kickoff,market,line,win,draw,lose,under,over
137,12,축구,라리가,엘체,AT마드리,2026-11-29 02:30,일반,,4.30,3.40,1.72,,
137,16,축구,세리에A,인테르,제노아,2026-11-29 04:45,언더오버,2.5,,,,2.15,1.55
137,20,축구,분데스,함부르크,바이에른,2026-11-28 23:30,핸디캡,1,3.05,4.00,1.78,,
```

- `line`: 핸디캡은 **홈팀 기준**(−1 = 홈팀 −1골), 언더오버는 기준점
- `sport`: 축구/농구/야구/배구

## 팀명 매칭

베트맨 한글 약칭(예: `맨체스U`, `AT마드리`)을 FotMob 영문 팀과 연결합니다.
① 킥오프 시각 ±2시간 후보 중 내장 별칭 사전 → ② 실패 시 Claude가 일괄 매칭 → 결과는 DB에 저장돼 다음부터 재사용.
자주 틀리는 팀은 `data\aliases_user.json`에 추가하세요:

```json
{"코번트리": "coventry", "울버햄튼": "wolverhampton"}
```

## 비용

- FotMob·베트맨: 무료
- Claude 웹 리서치: 경기 6개씩 묶어 조사하며 하루 최대 `MAX_RESEARCH_FIXTURES`(기본 24)경기.
  모델 사용료 + 웹 검색 사용료가 들며 `CLAUDE_EFFORT=low`로 낮추면 줄어듭니다. 정확한 금액은 Claude Console 사용량에서 확인하세요.

## 한계와 주의

- 예상 확률은 통계 추정치이며 결과를 보장하지 않습니다. 시즌 초반(경기 수 적음)·컵대회(순위표 없음)는 모델 비중이 자동으로 줄어 배당 확률에 가까워집니다.
- 베트맨 배당은 환급률이 낮아 장기적으로 EV가 플러스인 선택지는 드뭅니다. `settle`로 쌓이는 누적 적중률을 보며 가중치를 조정하세요.
- FotMob 데이터는 비공식 웹 API라 사이트 변경 시 수정이 필요할 수 있습니다. 요청 간격을 두고 캐시(90분)를 사용합니다.
- 베트맨 1회 구매 한도(10만원) 안에서 감당 가능한 금액으로만 즐기세요. 도박 문제 상담: 한국도박문제예방치유원 ☎1336

## 테스트

```bash
pip install pytest
```

```bash
python -m pytest
```
