'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';

function Fail() {
  const q = useSearchParams();
  const canceled = q.get('code') === 'PAY_PROCESS_CANCELED' || q.get('code') === 'USER_CANCEL';
  return (
    <div className="night-page">
      <SiteHeader />
      <main className="container">
        <div className="result card-paper on-paper">
          <div className="big">{canceled ? '🌙' : '🌧️'}</div>
          <h1 className="title-2">{canceled ? '결제를 취소했어요' : '결제가 완료되지 않았어요'}</h1>
          <p className="muted">{canceled ? '언제든 다시 이용권을 고를 수 있어요.' : q.get('message') || '잠시 후 다시 시도해 주세요.'}</p>
          <div className="stack"><Link href="/plans" className="btn btn-ink btn-block">이용권 다시 보기</Link><Link href="/" className="btn btn-paper btn-block">처음으로</Link></div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Fail /></Suspense>;
}
