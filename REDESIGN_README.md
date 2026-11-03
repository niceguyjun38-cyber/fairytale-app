# 꼬마작가 동화공방 디자인 수정 파일 묶음

## 이번 디자인 반영
- 서비스 이름을 꼬마작가 동화공방으로 통일했습니다.
- 남색·보랏빛 밤하늘, 달빛과 불 켜진 집들이 있는 동화마을 삽화를 추가했습니다.
- 이야기 선택 영역은 밤빛 패널과 문 모양 카드, 금빛 테두리로 바꿨습니다.
- 읽고 쓰는 부분에는 따뜻한 종이 색을 적용했습니다.
- 아래 파일 묶음은 이전 수정본을 모두 포함합니다. 원본 또는 이전 수정본에 적용할 수 있습니다.

## 적용 방법
1. 현재 프로젝트를 복사해 백업합니다.
2. ZIP 안의 src와 public 폴더를 현재 donghwa-gongbang 프로젝트의 같은 위치에 덮어씁니다.
3. 기존 .env.local과 package.json, package-lock.json은 그대로 사용합니다.
4. 현재 개발 환경에서 npm run dev로 확인하고, 배포 전에 npm run build를 실행합니다.

변경된 소스와 추가 삽화만 담은 업데이트 패키지이므로 원본 프로젝트에 적용해 사용하세요. 계정 정보, API 키, node_modules, 빌드 결과물은 포함하지 않았습니다.

## 바뀐 내용
- 메인: 큰 화면에서는 이야기 선택과 분량 설정을 나란히 표시하고 모바일에 맞게 재배치합니다.
- 숲속의 작은 곰, 별을 모으는 아이, 마법 빵집에 맞춘 그림책 삽화 3종을 추가했습니다.
- 공통 메뉴, 글자 크기, 색상, 여백, 선택 상태, 키보드 포커스를 정리했습니다.
- 작성 화면에서 원래 말 펼쳐보기, 문장 수정, 생각을 돕는 질문, 마이크 오류 안내, 완성 후 제목 입력을 제공합니다.
- 문장 생성 프롬프트에 아이가 만든 사건과 엉뚱한 표현을 보존하도록 명시했습니다.
- 큰 화면의 읽기 화면에는 그림과 글을 나란히 배치하고 좌우 방향키 이동을 추가했습니다.
- 완성한 동화의 한글 핵심 단어 약 5개를 영어로 보여주는 별도 학습 창을 추가했습니다. 단어와 짧은 문장의 발음을 따로 들을 수 있으며, 저장된 동화에서도 열 수 있습니다.
- 서재, 공개 피드, 요금제에도 공통 디자인을 적용했습니다.
- 기존 미구현 결제 버튼에는 준비 중 상태를 명시했습니다. 가격은 유지했습니다.
- 한국어 문서 설정과 동화공방 페이지 제목·설명을 적용했습니다.

## 유지한 구조
Next.js 16.2.10, React 19, Tailwind CSS 4, Supabase와 기존 API 경로를 유지했습니다. 새로운 패키지는 추가하지 않았습니다. 기존 씨앗 이야기 6개와 8/12/15장 설정을 유지했습니다. 시작 이야기와 표지가 분량에 별도로 추가되는 기존 동작을 화면에 안내합니다.

## 확인한 범위와 한계
- TypeScript 검사: node node_modules/typescript/bin/tsc --noEmit 통과.
- 공통 CSS 파싱 및 수정한 읽기 화면 문법 검사 통과.
- 메인 화면은 실제 수정한 React 컴포넌트를 정적 렌더링해 미리보기 HTML을 만들었습니다.
- 삽화 3종의 내용을 확인했습니다.

전체 Next.js 빌드는 이 작업 환경의 실행 제한으로 완료하지 못했습니다. 전달받은 의존성에는 Windows용 네이티브 모듈이 포함돼 있었습니다. 실제 로그인, 음성 인식, 유료 AI 호출, Supabase 읽기·쓰기와 브라우저 동작 검증은 수행하지 않았습니다. 기존 개발 환경에서 확인한 뒤 배포해 주세요.

## 다음 확인 사항
- 실제 결제는 기존 코드에서 미구현입니다.
- 기존 유료 AI API의 서버 인증·사용량 검증, 실패 시 별가루 처리와 동시 차감 방지는 별도 점검이 필요합니다.
- 서버 테이블·스토리지 정책은 업로드된 소스에 없어 검증하지 않았습니다. 씨앗을 10개로 늘릴 때에는 seed_story_id 관계도 확인해야 합니다.
- 단어는 동화 본문에서 생성하고 실행 중에는 메모리에서 재사용합니다. 별도 DB 저장·학습 이력은 추가하지 않았습니다.

## 미리보기
함께 제공한 donghwa-gongbang-design-preview.html을 브라우저에서 열면 메인 디자인과 선택 상태를 볼 수 있습니다. 로그인·AI 생성·다른 화면 이동은 이 미리보기에는 연결돼 있지 않습니다.

## 포함 파일
- src/app/page.tsx
- src/app/layout.tsx
- src/app/globals.css
- src/app/create/page.tsx
- src/app/book/page.tsx
- src/app/library/page.tsx
- src/app/library/[id]/page.tsx
- src/app/feed/page.tsx
- src/app/plans/page.tsx
- src/app/api/story/route.ts
- src/app/api/words/route.ts
- src/lib/useAuth.ts
- src/components/Icon.tsx
- src/components/SiteHeader.tsx
- src/components/WordStudy.tsx
- public/illustrations/forest-bear.png
- public/illustrations/fallen-star.png
- public/illustrations/magic-bakery.png

- public/illustrations/moonlit-village.png
