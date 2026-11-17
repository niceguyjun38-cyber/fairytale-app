// 사업자 정보 · 푸터와 약관에 표시돼요. 통신판매업 신고번호가 나오면 mailOrderNo 를 채워 주세요.
export const BUSINESS = {
  service: '꼬마작가 동화공방',
  company: '칼리스(Kallis)',
  ceo: '김경준',
  bizNo: '332-21-02007',
  mailOrderNo: '',
  address: '경기도 용인시 처인구 이동읍 원천로41번길 7-14',
  phone: '010-4941-3023',
  email: 'kalliskj0730@naver.com',
  privacyOfficer: '김경준',
};

// 계좌이체(무통장입금) 받을 사업자 계좌 · Vercel 환경변수로 넣어요 (넣은 뒤 Redeploy).
//   NEXT_PUBLIC_BANK_NAME=농협은행  NEXT_PUBLIC_BANK_ACCOUNT=301-1234-5678-91  NEXT_PUBLIC_BANK_HOLDER=칼리스(김경준)
// 셋 중 하나라도 비어 있으면 계좌이체 결제가 화면에 나오지 않아요.
export const BANK = {
  bank: process.env.NEXT_PUBLIC_BANK_NAME || '',
  account: process.env.NEXT_PUBLIC_BANK_ACCOUNT || '',
  holder: process.env.NEXT_PUBLIC_BANK_HOLDER || '',
  /** 입금 기한 (일) — 지나면 주문이 목록에서 사라져요 */
  days: 3,
};
export const bankEnabled = () => !!(BANK.bank && BANK.account && BANK.holder);
