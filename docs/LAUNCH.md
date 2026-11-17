# 꼬마작가 동화공방 · 판매 시작 안내서

결제는 **계좌이체(무통장입금)** 로 시작해요. PG(카드 결제 대행사) 계약이 없어서 가입비·연관리비·수수료가 0원이에요.
손님이 입금하면 사장님이 통장 앱에서 확인하고, `/admin` 화면에서 **입금 확인** 버튼을 누르면 이용권과 별가루가 바로 들어가요.

아래 순서대로 하세요. 한 번만 하면 되는 일은 1~7, 매일 하는 일은 8번이에요.

---

## 1. 새 코드를 main 에 합치기 (GitHub, 5분)
1. https://github.com/niceguyjun38-cyber/fairytale-app 접속
2. 위쪽 **Pull requests** 탭 → **New pull request**
3. `base: main` ← `compare: claude/friendly-albattani-0ikk6k` 선택 → **Create pull request** → 한 번 더 **Create pull request**
4. **Merge pull request** → **Confirm merge**
5. Vercel이 1~2분 안에 자동 배포해요. (Vercel → fairytale-app → **Deployments** 맨 위가 `Ready` 면 끝)

## 2. Supabase 에 SQL 2개 실행 (5분)
1. https://supabase.com/dashboard → 이 서비스 프로젝트 클릭
2. 왼쪽 메뉴 **SQL Editor** → **+ New query**
3. GitHub에서 `supabase/launch.sql` 파일 열기 → 오른쪽 위 **Raw** (또는 복사 아이콘) → 전체 복사
4. SQL Editor 에 붙여넣기 → **Run** (Ctrl+Enter) → 아래에 `Success. No rows returned` 가 나오면 성공
   - 예전에 이미 실행했어도 다시 실행해도 괜찮아요.
5. 다시 **+ New query** → `supabase/2026-11-17-payments.sql` 도 똑같이 복사 → 붙여넣기 → **Run** → `Success`

## 3. Vercel 환경변수 정리 (10분)
Vercel → **fairytale-app** → **Settings** → **Environment Variables**

**추가** (각각 Key / Value 입력 → Environments 는 Production 체크 → **Save**):

| Key | Value 예시 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_BANK_NAME` | `농협은행` | 입금받을 은행 이름 |
| `NEXT_PUBLIC_BANK_ACCOUNT` | `301-1234-5678-91` | 계좌번호 (사업자 명의 계좌 권장) |
| `NEXT_PUBLIC_BANK_HOLDER` | `칼리스(김경준)` | 예금주 — 통장에 표시되는 이름과 같게 |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | 이미 있으면 그대로. 없으면 Supabase → **Project Settings** → **API Keys** → **Secret keys** 에서 복사 |

**삭제** (있다면 줄 오른쪽 **⋯** → **Delete**):
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
  - ⚠️ 테스트 키가 남아 있으면 화면에 카드 결제 버튼이 생기고, **돈이 안 나가는 테스트 결제로 별가루를 받을 수 있어요.** 꼭 지워 주세요.
  - 나중에 카드 결제를 붙일 때 다시 넣으면 카드 버튼이 자동으로 나타나요.

**저장 후 반드시 다시 배포**: **Deployments** → 맨 위 배포 오른쪽 **⋯** → **Redeploy** → **Redeploy**
(환경변수는 다시 배포해야 화면에 반영돼요.)

## 4. 나를 관리자로 등록 (5분)
1. 휴대폰이나 PC로 https://fairytale-app-silk.vercel.app/admin 접속 → 카카오 로그인
2. "관리자만 볼 수 있어요" 아래 **내 사용자 ID** (`xxxxxxxx-xxxx-...`) 를 복사
3. Vercel 환경변수에 추가: Key `ADMIN_USER_IDS`, Value 방금 복사한 ID → **Save**
   (관리자가 여러 명이면 쉼표로 이어서: `id1,id2`)
4. 다시 **Redeploy** → `/admin` 새로고침 → "관리자 · 계좌이체 입금 확인" 화면이 나오면 성공
   - 휴대폰 홈 화면에 `/admin` 을 바로가기로 추가해 두면 편해요.

## 5. 직접 한 번 사 보기 (10분)
1. 로그아웃 상태 브라우저(시크릿 창)에서 다른 카카오 계정으로 로그인 → **이용권** → 체크박스 체크 → **6,900원 계좌이체로 구매**
2. 입금자명 입력 → **주문하고 입금 계좌 보기** → 계좌번호·예금주·입금 기한이 맞게 나오는지 확인
3. 관리자 계정으로 `/admin` → 주문이 보이는지 → **입금 확인** → 손님 화면 새로고침 → 달빛 이용권·별가루 8개가 들어왔는지 확인
4. 테스트 주문은 실제 입금이 없었으니, 별가루를 되돌려 놓으세요 (SQL Editor):
   ```sql
   update profiles set credits = greatest(credits - 8, 0), plan = 'free', plan_expires_at = null where id = '테스트계정 사용자ID';
   ```

## 6. AI 키 새로 발급 + 사용 한도 걸기 (15분)
개발 중에 화면에 보였던 키는 누가 썼을지 모르니 새로 만들고 옛 키는 지워요.

**Anthropic (문장 다듬기·영어 단어)**
1. https://console.anthropic.com → **Settings** → **API keys** → **Create Key** → 이름 `fairytale-prod` → 생성된 키 복사 (한 번만 보여요)
2. Vercel 환경변수 `ANTHROPIC_API_KEY` 줄 **⋯** → **Edit** → 새 키 붙여넣기 → **Save**
3. 콘솔로 돌아와 옛 키 **⋯** → **Delete** (또는 Disable)
4. **Settings** → **Billing**: 자동 충전(Auto reload)을 끄거나 금액을 작게 → 충전한 금액 이상은 쓰이지 않아요. **Limits** 메뉴가 있으면 월 한도도 설정

**OpenAI (그림·낭독)**
1. https://platform.openai.com → 오른쪽 위 톱니(**Settings**) → **API keys** → **Create new secret key** → 복사
2. Vercel `OPENAI_API_KEY` **Edit** → 새 키 → **Save** → OpenAI 화면에서 옛 키 **Revoke**
3. **Settings** → **Billing**: 자동 충전(Auto recharge) 끄기 → 남은 크레딧이 곧 한도예요. **Limits** 에서 예산 알림 메일도 설정

마지막에 Vercel **Redeploy**. PC의 `.env.local` 에도 새 키로 바꿔 넣으세요.
(메뉴 이름은 각 회사 화면 개편에 따라 조금 다를 수 있어요.)

## 7. 법·세금 확인 (판매 전)
- **통신판매업 신고**: 직전 연도 판매가 50회 미만이거나 간이과세자이면 신고가 **면제**돼요. 처음 파는 지금은 면제일 가능성이 높아요.
  - 면제여도 사업자 정보 표시 의무는 있어요 → 사이트 맨 아래에 이미 표시돼 있어요.
  - 1년 판매가 50회를 넘을 것 같거나 카드 결제(PG)를 붙일 때는 신고하세요: **정부24 → "통신판매업 신고" 검색 → 신청** (사업자등록증 필요, 처리 1~3일, 매년 1월 등록면허세 부과).
  - 정확한 판단은 용인시 처인구청(통신판매업 담당 부서)에 전화로 확인하는 게 가장 확실해요.
  - 신고번호가 나오면 GitHub에서 `src/data/business.ts` 의 `mailOrderNo: ''` 따옴표 안에 번호를 넣고 커밋하세요.
- **구매안전서비스(에스크로)**: 전자상거래법은 선결제 판매에 에스크로 제공을 요구하지만, 정보통신망으로 전달되는 상품(이 서비스 같은 디지털 이용권)은 예외로 보고 있어요. 신고할 때 구청에 같이 확인하세요.
- **현금영수증**: 계좌이체 손님이 요청하면 홈택스(또는 손택스 앱)에서 발급해 주세요.

---

## 8. 매일 하는 일: 입금 확인
1. 은행 앱의 **입금 알림**을 켜 두세요 (주문 알림이 따로 오지 않아요. 입금 알림이 곧 주문 알림이에요).
2. 입금 알림이 오면 `/admin` 열기 → **입금자명·금액**이 같은 주문의 **입금 확인** 누르기 → 끝
3. 이름이 다르게 들어온 입금은 금액·시간으로 찾고, 애매하면 손님께 문자로 확인
4. 입금 기한(3일)이 지난 주문은 손님 화면에서 사라져요. 늦게 입금되면 `/admin` → **전체** → 그 주문의 **늦은 입금 확인** 을 누르면 돼요.

## 9. 환불하는 법
1. 손님이 알려준 계좌로 직접 송금 (계좌이체 구매) — 카드 결제를 붙인 뒤에는 PG 관리자 화면에서 결제 취소
2. Supabase **SQL Editor** 에서 별가루와 주문 상태 정리:
   ```sql
   -- 주문 찾기 (입금자명으로)
   select id, user_id, plan, amount, status, depositor, created_at from orders where depositor like '%홍길동%' order by created_at desc;
   -- 별가루 회수 + 이용권 해제 (별빛 전액 환불이면 18, 달빛이면 8)
   update profiles set credits = greatest(credits - 18, 0), plan = 'free', plan_expires_at = null where id = '사용자ID';
   update orders set status = 'refunded' where id = 'dh_주문번호';
   ```
3. 서비스 오류로 동화를 못 만든 경우 별가루 돌려주기: `update profiles set credits = credits + 1 where id = '사용자ID';`

## 10. 회원 탈퇴 요청이 오면
결제 기록은 법에 따라 5년 보관해야 하는데, 계정을 지우면 주문 기록도 같이 지워지게 되어 있어요. 그래서 순서를 지켜 주세요.
1. Supabase → **Table Editor** → `orders` → 위쪽 필터로 `user_id` = 그 사용자 → **Export → CSV** 로 내려받아 보관
2. **Authentication** → **Users** → 그 사용자 **⋯** → **Delete user**

---

## 나중에: 카드 결제 붙이기
판매가 늘어 카드 결제가 필요해지면 아래를 비교해 고르세요 (조건은 수시로 바뀌니 신청 전 각 회사에 확인):
- **포트원(PortOne) 결제 패키지**: 포트원 쪽 설명으로는 이를 통해 PG에 가입하면 PG 가입비(보통 22만 원)를 면제해 준다고 해요.
- **NHN KCP, 나이스페이먼츠**: 연관리비 면제를 내세우는 경우가 있어요.
- **페이앱(PayApp)**: 소상공인용 결제 서비스. 가입비·수수료·API 조건은 1800-3772 로 확인.
- **토스페이먼츠**: 가입비 22만 원 + 연관리비 11만 원, 카드 수수료 3.4% (공식 요금 페이지 기준).

지금 코드는 토스 방식으로 카드 결제가 준비돼 있어요. 토스를 쓰면 키 2개만 넣으면 되고, 다른 회사를 고르면 그 회사 방식으로 연결 코드를 바꿔야 해요.

---

## 구조 한눈에
- `/` 서비스 소개 · `/start` 이야기 고르기 · `/create` 작업실 · `/book` 그림 그리기+읽기 · `/story/[id]` 공유용 읽기 · `/library` 서재 · `/feed` 친구들 이야기 · `/plans` 이용권 · `/admin` 입금 확인(관리자)
- 동화를 시작하면 서버가 별가루 차감과 초안 생성을 한 번에 처리 (`start_story`)
- 쓰는 중 내용·그림이 자동 저장돼서 새로고침/이탈해도 이어서 만들 수 있음
- 낭독 음성은 문장별로 저장 → 같은 문장은 몇 번을 들어도 추가 비용 0원
- 낭독·영어 단어는 DB에 저장된 동화 문장만 사용 (아무 글이나 보내 AI 비용을 쓰는 것 차단)
- 공개 책장에는 이 동화의 저장소에 그려진 그림만 올라감
- 결제: 30일 이용권(자동결제 아님), 금액은 서버에서 결정, 결제 확인과 지급은 한 번에 처리 (`grant_paid_order`)
- 계좌이체: 같은 이용권의 입금 대기 주문은 하나만, 한 사람당 대기 주문 최대 3개, 입금 기한 3일
