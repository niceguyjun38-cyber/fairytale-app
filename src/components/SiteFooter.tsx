import Link from 'next/link';
import { BUSINESS } from '@/data/business';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <span className="footer-brand">{BUSINESS.service}</span>
          <nav className="footer-links" aria-label="약관">
            <Link href="/plans">이용권 안내</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy"><strong>개인정보처리방침</strong></Link>
            <Link href="/terms#refund">환불 정책</Link>
          </nav>
        </div>
        <p className="footer-biz">
          <span>상호 {BUSINESS.company}</span>
          <span>대표 {BUSINESS.ceo}</span>
          <span>사업자등록번호 {BUSINESS.bizNo}</span>
          {BUSINESS.mailOrderNo && <span>통신판매업 신고 {BUSINESS.mailOrderNo}</span>}
          <br />
          <span>{BUSINESS.address}</span>
          <span>{BUSINESS.phone}</span>
          <span>{BUSINESS.email}</span>
        </p>
        <p className="footer-biz" style={{ marginTop: 10 }}>© {new Date().getFullYear()} {BUSINESS.company}. 아이의 상상이 한 권의 책이 되는 곳.</p>
      </div>
    </footer>
  );
}
