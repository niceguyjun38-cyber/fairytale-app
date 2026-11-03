'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/lib/useAuth';
import { Icon, KakaoIcon } from './Icon';

export function SiteHeader({ credits, authUser }: { credits?: number | null; authUser?: User | null }) {
  const pathname = usePathname();
  const auth = useAuth();
  const user = authUser !== undefined ? authUser : auth.user;
  const [busy, setBusy] = useState(false);
  const is = (p: string) => (pathname === p || pathname.startsWith(p + '/') ? 'page' : undefined);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand" aria-label="꼬마작가 동화공방 홈">
          <span className="brand-mark"><Icon name="book" size={21} /></span>
          <span className="brand-text"><small>꼬마작가</small><strong>동화공방</strong></span>
        </Link>
        <nav className="site-nav" aria-label="주 메뉴">
          <Link href="/start" aria-current={is('/start') || is('/create') || is('/book')}>동화 만들기</Link>
          <Link href="/library" aria-current={is('/library')}>내 서재</Link>
          <Link href="/feed" aria-current={is('/feed') || is('/story')}>친구들 이야기</Link>
          <Link href="/plans" aria-current={is('/plans')}>이용권</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              {typeof credits === 'number' && (
                <Link href="/plans" className="credit-pill" aria-label={`별가루 ${credits}개`}>
                  <Icon name="sparkles" size={15} /> {credits}
                </Link>
              )}
              <button className="text-btn" onClick={() => auth.signOut().catch(() => {})}>로그아웃</button>
            </>
          ) : (
            <button
              className="kakao-btn"
              disabled={busy || auth.loading}
              onClick={async () => {
                setBusy(true);
                try { await auth.signInWithKakao(); } catch { setBusy(false); }
              }}
            >
              <KakaoIcon /> {auth.loading ? '확인 중' : '카카오 로그인'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
