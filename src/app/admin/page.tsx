'use client';

import { useCallback, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { KakaoIcon } from '@/components/Icon';
import { useAuth } from '@/lib/useAuth';

type Order = {
  id: string; user_id: string; plan: string; amount: number; status: string; depositor: string | null;
  created_at: string; approved_at: string | null; nickname: string | null; credits: number | null;
};

const PLAN = { moon: '달빛', star: '별빛' } as Record<string, string>;
const STATUS = { pending: '입금 대기', paid: '지급 완료', canceled: '취소', failed: '실패', refunded: '환불' } as Record<string, string>;
const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AdminPage() {
  const { user, loading, signInWithKakao } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    setError('');
    const r = await fetch('/api/admin/orders', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || '불러오지 못했어요.'); if (d.userId) setMyId(d.userId); return; }
    setOrders(d.orders);
  }, []);

  useEffect(() => {
    // load 안의 setState는 응답을 받은 뒤에 실행돼요
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  const act = async (o: Order, action: 'confirm' | 'cancel') => {
    const msg = action === 'confirm'
      ? `${o.depositor} 님이 ${o.amount.toLocaleString()}원 입금한 것을 통장에서 확인했나요?\n확인하면 ${PLAN[o.plan]} 이용권과 별가루가 바로 지급돼요.`
      : `${o.depositor} 님의 주문을 취소할까요?`;
    if (!confirm(msg)) return;
    setBusy(o.id);
    const r = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: o.id, action }) });
    const d = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) { alert(d.error || '처리하지 못했어요.'); return; }
    load();
  };

  const list = (orders || []).filter(o => (tab === 'pending' ? o.status === 'pending' : true));

  return (
    <div className="night-page">
      <SiteHeader authUser={user} />
      <main className="container" style={{ paddingTop: 34, paddingBottom: 80 }}>
        <h1 className="title-2">관리자 · 계좌이체 입금 확인</h1>
        <p className="lead" style={{ marginTop: 6 }}>통장 앱에서 입금자명과 금액을 확인한 뒤 &lsquo;입금 확인&rsquo;을 누르면 이용권과 별가루가 지급돼요.</p>

        {!loading && !user ? (
          <button className="kakao-btn lg" style={{ marginTop: 24 }} onClick={() => signInWithKakao('/admin').catch(() => {})}><KakaoIcon /> 카카오로 로그인</button>
        ) : error ? (
          <div className="notice" role="alert" style={{ marginTop: 24, display: 'block' }}>
            <p>{error}</p>
            {myId && (
              <p style={{ marginTop: 10 }}>
                내 사용자 ID: <code style={{ userSelect: 'all', fontWeight: 700 }}>{myId}</code><br />
                Vercel → Settings → Environment Variables 에 <b>ADMIN_USER_IDS</b> 이름으로 이 값을 넣고 Redeploy 하면 이 화면이 열려요.
              </p>
            )}
          </div>
        ) : !orders ? (
          <div className="loading-screen" style={{ minHeight: '30vh' }}><div><div className="moon-loader" />불러오는 중…</div></div>
        ) : (
          <>
            <div className="tabs" role="group" aria-label="보기" style={{ margin: '22px 0 16px' }}>
              <button aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>입금 대기 {orders.filter(o => o.status === 'pending').length}</button>
              <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>전체</button>
              <button onClick={load}>새로고침</button>
            </div>
            {list.length === 0 ? (
              <p className="muted">{tab === 'pending' ? '입금을 기다리는 주문이 없어요.' : '아직 계좌이체 주문이 없어요.'}</p>
            ) : (
              <div className="admin-list">
                {list.map(o => (
                  <div key={o.id} className="card-paper on-paper admin-row">
                    <div>
                      <strong>{o.depositor}</strong> · {o.amount.toLocaleString()}원 · {PLAN[o.plan] ?? o.plan}
                      <small>
                        주문 {when(o.created_at)} · {STATUS[o.status] ?? o.status}{o.approved_at ? ` (${when(o.approved_at)})` : ''}
                        <br />카카오 닉네임 {o.nickname || '-'} · 별가루 {o.credits ?? '-'} · {o.id}
                      </small>
                    </div>
                    {o.status === 'pending' && (
                      <div className="admin-actions">
                        <button className="btn btn-ink btn-sm" disabled={busy === o.id} onClick={() => act(o, 'confirm')}>입금 확인</button>
                        <button className="btn btn-paper btn-sm" disabled={busy === o.id} onClick={() => act(o, 'cancel')}>취소</button>
                      </div>
                    )}
                    {o.status === 'canceled' && (
                      <div className="admin-actions">
                        <button className="btn btn-paper btn-sm" disabled={busy === o.id} onClick={() => act(o, 'confirm')}>늦은 입금 확인</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
