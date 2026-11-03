import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { BUSINESS } from '@/data/business';

export const metadata: Metadata = { title: '개인정보처리방침' };

export default function Privacy() {
  return (
    <div className="night-page">
      <SiteHeader />
      <main className="container-narrow doc">
        <article className="card-paper">
          <h1>개인정보처리방침</h1>
          <p className="updated">시행일 2026년 11월 3일</p>
          <p>{BUSINESS.company}(이하 &ldquo;회사&rdquo;)는 {BUSINESS.service} 이용자의 개인정보를 소중히 다루며, 「개인정보 보호법」을 지킵니다.</p>

          <h2>1. 수집하는 개인정보</h2>
          <table>
            <thead><tr><th>구분</th><th>항목</th><th>목적</th></tr></thead>
            <tbody>
              <tr><td>회원가입(카카오)</td><td>카카오 회원번호, 닉네임, 프로필 사진</td><td>회원 식별, 로그인</td></tr>
              <tr><td>서비스 이용</td><td>회원이 입력한 이야기 글, 만든 그림·음성, 공개 여부, 좋아요 기록</td><td>그림책 제작·보관·공개</td></tr>
              <tr><td>결제</td><td>주문번호, 결제 금액, 결제 일시, 결제 승인 정보(카드번호는 저장하지 않음)</td><td>이용권 제공, 환불</td></tr>
              <tr><td>자동 수집</td><td>접속 기록, 브라우저 정보</td><td>오류 확인, 부정 이용 방지</td></tr>
            </tbody>
          </table>
          <p>음성으로 말하기 기능은 이용자의 브라우저(구글·애플 음성 인식)가 글자로 바꾼 결과만 받으며, 회사는 목소리 녹음을 저장하지 않습니다. 이야기에 아이의 실명·주소 등 개인정보를 넣지 않도록 권장합니다.</p>

          <h2>2. 보유 기간</h2>
          <ul>
            <li>회원 정보와 그림책: 회원 탈퇴 또는 삭제 요청 시까지</li>
            <li>결제·환불 기록: 전자상거래법에 따라 5년</li>
            <li>접속 기록: 통신비밀보호법에 따라 3개월</li>
          </ul>

          <h2>3. 처리 위탁 및 국외 이전</h2>
          <table>
            <thead><tr><th>받는 곳</th><th>위탁 업무</th><th>이전 국가</th></tr></thead>
            <tbody>
              <tr><td>Supabase Inc.</td><td>회원·그림책 데이터 저장</td><td>대한민국(서울 리전)</td></tr>
              <tr><td>Vercel Inc.</td><td>웹사이트 운영</td><td>미국 등</td></tr>
              <tr><td>Anthropic PBC</td><td>이야기 문장 다듬기, 영어 단어 선정 (이야기 글)</td><td>미국</td></tr>
              <tr><td>OpenAI, L.L.C.</td><td>그림·낭독 음성 생성 (이야기 글)</td><td>미국</td></tr>
              <tr><td>(주)비바리퍼블리카 토스페이먼츠</td><td>결제 처리</td><td>대한민국</td></tr>
              <tr><td>(주)카카오</td><td>로그인</td><td>대한민국</td></tr>
            </tbody>
          </table>
          <p>국외 이전은 서비스 이용 시점에 네트워크로 전송되며, 각 사업자의 정책에 따라 모델 학습에 사용되지 않는 API 방식으로 처리됩니다. 이전을 원하지 않으면 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.</p>

          <h2>4. 이용자의 권리</h2>
          <p>이용자는 언제든 자신의 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있습니다. 그림책은 서재에서 직접 지울 수 있고, 회원 탈퇴는 아래 연락처로 요청해 주세요.</p>

          <h2>5. 아동의 개인정보</h2>
          <p>서비스는 보호자 계정으로 이용하며, 만 14세 미만 아동의 개인정보를 직접 수집하지 않습니다.</p>

          <h2>6. 안전성 확보 조치</h2>
          <p>접근 권한 관리, 전송 구간 암호화(HTTPS), 데이터베이스 행 단위 접근 제어를 적용합니다.</p>

          <h2>7. 개인정보 보호책임자</h2>
          <p>책임자 {BUSINESS.privacyOfficer} · {BUSINESS.email} · {BUSINESS.phone}</p>
          <p>개인정보 침해 신고는 개인정보침해신고센터(국번 없이 118), 개인정보분쟁조정위원회(1833-6972)에도 할 수 있습니다.</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
