'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { Icon } from './Icon';

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, signInWithKakao, signOut } = useAuth();
  const [error, setError] = useState('');
  const accountAction = async () => {
    setError('');
    try { if (user) await signOut(); else await signInWithKakao(); }
    catch { setError('로그인 연결을 확인하고 다시 시도해 주세요.'); }
  };
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/" className="brand" aria-label="꼬마작가 동화공방 홈"><span className="brand-mark"><Icon name="book" size={25}/></span><span className="brand-name"><span className="brand-prefix">꼬마작가</span> 동화공방<small>상상이 피어나는 동화마을</small></span></Link>
    <nav className="site-nav" aria-label="주 메뉴"><Link href="/" aria-current={pathname === '/' || pathname === '/create' ? 'page' : undefined}>동화 만들기</Link><Link href="/library" aria-current={pathname.startsWith('/library') ? 'page' : undefined}>내 서재</Link><Link href="/feed" aria-current={pathname === '/feed' ? 'page' : undefined}>친구들 이야기</Link></nav>
    <button className={`account-button ${user ? '' : 'kakao-button'}`} onClick={accountAction} disabled={loading}>{loading ? '연결 중' : user ? '로그아웃' : '카카오 로그인'}</button>
    </div>{error && <p className="header-error" role="alert">{error}</p>}</header>;
}
