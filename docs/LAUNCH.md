# 꼬마작가 동화공방 · 출시 체크리스트

순서대로 하면 돼요. **1~3번은 한 번에 이어서** 해야 해요 (코드와 DB가 짝을 맞춰야 작동해요).

## 1. Vercel 환경변수 추가
Vercel → fairytale-app → Settings → Environment Variables 에서 아래를 추가해요.

| 이름 | 값 | 어디서 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Supabase → Settings → API Keys → **Secret keys** |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `test_ck_...` | 토스페이먼츠 개발자센터 → API 키 → **API 개별 연동 키** 의 클라이언트 키 |
| `TOSS_SECRET_KEY` | `test_sk_...` | 같은 곳의 시크릿 키 |

- 기존 4개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)는 그대로 둬요.
- 토스 키는 처음엔 **test_** 키로 넣고, 상점 심사가 끝나면 **live_** 키로 바꿔요.
- `SUPABASE_SERVICE_ROLE_KEY` 와 `TOSS_SECRET_KEY` 는 절대 화면 캡처하거나 다른 곳에 붙여넣지 마세요.

## 2. 코드 배포
GitHub `main` 에 올라가면 Vercel이 자동 배포해요 (1~2분).

## 3. Supabase SQL 실행 (배포 직후)
Supabase → SQL Editor → New query → `supabase/launch.sql` 전체 붙여넣기 → Run → "Success" 확인.

## 4. 동작 확인 (휴대폰으로)
1. 카카오 로그인 → 별가루가 보이는지
2. 8장 동화 만들기 → 중간에 나갔다가 **내 서재 → 이어서 쓰기**가 되는지
3. 그림책 완성 → 그림이 다 그려지면 "서재에 저장했어요" 표시
4. 읽어주기 → 목소리 미리듣기 → 자동 넘김 낭독
5. 영어 단어 → 발음
6. 공개 켜기 → 친구들 이야기에 보이는지 → 공유 링크를 카톡으로 보내서 열리는지
7. 이용권 → 테스트 결제(실제 돈 안 나가요) → 별가루가 늘어나는지

## 5. 판매 시작 전에 꼭
- [ ] **통신판매업 신고** (정부24, 1~3일) → 번호를 `src/data/business.ts` 의 `mailOrderNo` 에 넣기
- [ ] **토스페이먼츠 상점 심사** 신청 (서비스 URL: https://fairytale-app-silk.vercel.app) → 승인 후 Vercel의 토스 키 2개를 live 키로 교체 → Redeploy
- [ ] **API 키 재발급**: 개발 중 화면에 노출됐던 Anthropic / OpenAI 키를 새로 발급해 Vercel·`.env.local` 교체
- [ ] OpenAI·Anthropic 결제 한도(Usage limit) 설정 — 예상 밖 과금 방지

## 바뀐 구조 한눈에
- `/` 서비스 소개 · `/start` 이야기 고르기 · `/create` 작업실 · `/book` 그림 그리기+읽기 · `/story/[id]` 공유용 읽기 · `/library` 서재 · `/feed` 친구들 이야기 · `/plans` 이용권
- 동화를 시작하면 서버가 별가루 차감과 초안 생성을 한 번에 처리 (`start_story`)
- 쓰는 중 내용·그림이 자동 저장돼서 새로고침/이탈해도 이어서 만들 수 있음
- 그림은 서버에서 바로 저장(webp) → 저장 오류 원인이던 대용량 전송 제거
- 낭독 음성은 문장별로 저장 → 같은 문장은 몇 번을 들어도 추가 비용 0원
- AI 기능은 로그인 + 동화별 사용 한도로 보호 (외부에서 API 비용 도용 불가)
- 별가루·좋아요 수는 사용자가 직접 바꿀 수 없게 DB 권한 정리
- 결제: 30일 이용권(자동결제 아님), 금액은 서버에서 결정, 토스 승인 후 지급
