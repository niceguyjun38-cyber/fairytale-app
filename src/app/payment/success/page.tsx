'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

function Success() {
  const q = useSearchParams();
  const [state, setState] = useState<{ ok?: boolean; plan?: string; credits?: number; error?: string }>({});
  const once = useRef(false);
  const paymentKey = q.get('paymentKey');
  const orderId = q.get('orderId');
  const amount = q.get('amount');
  const missing = !paymentKey || !orderId;

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (missing) return;
    fetch('/api/payments/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }) })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setState({ ok: true, plan: d.plan, credits: d.credits }); })
      .catch(e => setState({ error: e instanceof Error && e.message ? e.message : '결제를 확인하지 못했어요.' }));
    }, [amount, missing, orderId, paymentKey]);

  const view: typeof state = missing ? { error: '결제 정보가 없어요.' } : state;
  const name = view.plan === 'star' ? '별빛' : '달빛';
  return (
    <div className="night-page">
      <SiteHeader />
      <main className="container">
        <div className="result card-paper on-paper">
          {!view.ok && !view.error ? (
            <><div className="moon-loader" style={{ margin: '0 auto 16px' }} /><h1 className="title-2">결제를 확인하고 있어요</h1><p className="muted">창을 닫지 말고 잠시만 기다려 주세요.</p></>
          ) : view.ok ? (
            <>
              <div className="big">🌟</div>
              <h1 className="title-2">{name} 이용권이 시작됐어요!</h1>
              <p className="muted">{typeof view.credits === 'number' ? `지금 별가루가 ${view.credits}개 있어요. ` : ''}30일 동안 마음껏 이야기를 만들어 보세요.</p>
              <div className="stack"><Link href="/start" className="btn btn-gold btn-lg btn-block"><Icon name="sparkles" /> 새 이야기 만들기</Link><Link href="/library" className="btn btn-paper btn-block">내 서재로</Link></div>
            </>
          ) : (
            <>
              <div className="big">🌧️</div>
              <h1 className="title-2">결제를 마치지 못했어요</h1>
              <p className="muted">{view.error} 카드에서 돈이 빠져나갔다면 {`kalliskj0730@naver.com`}으로 알려 주세요. 바로 확인해 드릴게요.</p>
              <div className="stack"><Link href="/plans" className="btn btn-ink btn-block">이용권 페이지로</Link></div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Success /></Suspense>;
}
