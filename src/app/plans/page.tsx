'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Icon, KakaoIcon } from '@/components/Icon';
import { PLANS } from '@/data/seedStories';
import { BUSINESS, bankEnabled } from '@/data/business';
import { useAuth, useWallet } from '@/lib/useAuth';

type TossPayment = { requestPayment: (o: Record<string, unknown>) => Promise<void> };
type TossFactory = (key: string) => { payment: (o: { customerKey: string }) => TossPayment };

type BankOrder = {
  orderId: string; plan: string; orderName: string; amount: number; depositor: string | null; dueAt: string;
  bank: { bank: string; account: string; holder: string };
};

const TOSS_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';
const CARD_ON = !!TOSS_KEY && !TOSS_KEY.includes('_gck_');
const BANK_ON = bankEnabled();

function loadToss(): Promise<TossFactory> {
  const w = window as unknown as { TossPayments?: TossFactory };
  if (w.TossPayments) return Promise.resolve(w.TossPayments);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.tosspayments.com/v2/standard';
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error('결제창을 불러오지 못했어요.')));
    s.onerror = () => reject(new Error('결제창을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}

export default function PlansPage() {
  const { user, loading, signInWithKakao } = useAuth();
  const { wallet } = useWallet(user);
  const [agree, setAgree] = useState(false);
  const agreeRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [bankPlan, setBankPlan] = useState<'moon' | 'star' | null>(null);
  const [depositor, setDepositor] = useState('');
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState('');
  const [pending, setPending] = useState<BankOrder[]>([]);
  const [toast, setToast] = useState('');

  const loadPending = useCallback(() => {
    if (!user || !BANK_ON) return;
    fetch('/api/payments/bank', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setPending(Array.isArray(d.orders) ? d.orders : []))
      .catch(() => {});
  }, [user]);
  useEffect(() => { loadPending(); }, [loadPending]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600); };

  const plan = wallet?.plan ?? 'free';
  const until = wallet?.planExpiresAt ? new Date(wallet.planExpiresAt) : null;

  const fail = (msg: string) => {
    setError(msg);
    window.setTimeout(() => agreeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const buy = async (planId: 'moon' | 'star') => {
    setError('');
    if (!user) { signInWithKakao('/plans').catch(() => {}); return; }
    if (!agree) { fail('결제 전에 위의 주문 내용 확인에 체크해 주세요.'); return; }
    if (!CARD_ON) { fail('카드 결제를 준비하고 있어요. 계좌이체로 구매해 주세요. (C1)'); return; }
    const clientKey = TOSS_KEY;
    setBusy(planId);
    try {
      const res = await fetch('/api/payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planId }) });
      const order = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(order.error || `주문을 만들지 못했어요. (O${res.status})`);
      const Toss = await loadToss();
      const payment = Toss(clientKey).payment({ customerKey: order.customerKey });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        card: { useEscrow: false, flowMode: 'DEFAULT', useCardPoint: false, useAppCardOnly: false },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code || '';
      const msg = e instanceof Error ? e.message : '';
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED' || /취소|cancel/i.test(msg)) return;
      fail(`${msg || '결제를 시작하지 못했어요. 다시 시도해 주세요.'}${code ? ` (${code})` : ''}`);
    } finally {
      setBusy(null);
    }
  };

  const openBank = (planId: 'moon' | 'star') => {
    setError('');
    if (!user) { signInWithKakao('/plans').catch(() => {}); return; }
    if (!agree) { fail('결제 전에 위의 주문 내용 확인에 체크해 주세요.'); return; }
    const meta = user.user_metadata as { name?: string; full_name?: string } | undefined;
    setDepositor(d => d || meta?.name || meta?.full_name || '');
    setBankError('');
    setBankPlan(planId);
  };

  const orderBank = async () => {
    if (!bankPlan || bankBusy) return;
    setBankBusy(true);
    setBankError('');
    try {
      const res = await fetch('/api/payments/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: bankPlan, depositor }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '주문을 만들지 못했어요.');
      setPending(list => [d as BankOrder, ...list.filter(o => o.orderId !== d.orderId)]);
      setBankPlan(null);
      window.setTimeout(() => document.getElementById('bank-pending')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : '주문을 만들지 못했어요.');
    } finally {
      setBankBusy(false);
    }
  };

  const cancelBank = async (o: BankOrder) => {
    if (!confirm(`${o.orderName} 주문을 취소할까요? 이미 입금하셨다면 취소하지 말고 기다려 주세요.`)) return;
    const res = await fetch('/api/payments/bank', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: o.orderId }) });
    if (!res.ok) { flash('취소하지 못했어요. 다시 시도해 주세요.'); return; }
    setPending(list => list.filter(x => x.orderId !== o.orderId));
    flash('주문을 취소했어요.');
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => flash('계좌번호를 복사했어요.'), () => {});

  return (
    <div className="night-page">
      <SiteHeader credits={wallet?.credits ?? null} authUser={user} />
      <main className="container">
        <div className="section-head" style={{ paddingTop: 50, marginBottom: 34 }}>
          <span className="eyebrow"><Icon name="sparkles" size={15} /> 별가루 충전소</span>
          <h1 className="title-1">한 달 동안, 매일 밤 새 그림책을</h1>
          <p className="lead">자동결제 없이 30일 단위로 구매해요. 남은 별가루는 기간이 끝나도 사라지지 않아요.</p>
        </div>

        {user && wallet && (
          <div className="notice info" style={{ maxWidth: 640, margin: '0 auto 34px', justifyContent: 'center', textAlign: 'center' }}>
            <span>
              지금 <b>{plan === 'star' ? '별빛' : plan === 'moon' ? '달빛' : '무료 체험'}</b>
              {until && plan !== 'free' ? ` · ${until.toLocaleDateString('ko-KR')}까지` : ''} · 남은 별가루 <b>{wallet.credits}개</b>
            </span>
          </div>
        )}

        {pending.length > 0 && (
          <div id="bank-pending" className="card-paper on-paper bank-box" role="status">
            <h2 className="title-3">입금을 기다리고 있어요</h2>
            {pending.map(o => (
              <div key={o.orderId} className="bank-order">
                <p className="bank-amount"><b>{o.orderName}</b> · {o.amount.toLocaleString()}원</p>
                <dl>
                  <dt>입금 계좌</dt><dd>{o.bank.bank} <b>{o.bank.account}</b> <button className="text-btn" onClick={() => copy(o.bank.account)}>복사</button></dd>
                  <dt>예금주</dt><dd>{o.bank.holder}</dd>
                  <dt>입금자명</dt><dd><b>{o.depositor}</b> (꼭 이 이름으로 보내 주세요)</dd>
                  <dt>입금 기한</dt><dd>{new Date(o.dueAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}까지</dd>
                </dl>
                <p className="muted bank-note">입금이 확인되면 보통 하루 안에 이용권과 별가루가 들어와요. 급하시면 {BUSINESS.phone} 으로 문자 주세요.</p>
                <button className="text-btn bank-cancel" onClick={() => cancelBank(o)}>주문 취소</button>
              </div>
            ))}
          </div>
        )}

        <div ref={agreeRef} className="card-night" style={{ maxWidth: 640, margin: '0 auto 30px', padding: '22px 24px' }}>
          <h2 className="title-3" style={{ marginBottom: 10 }}>결제 전에 꼭 확인해 주세요</h2>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem', color: '#c9d2e8', lineHeight: 1.7, listStyle: 'disc', paddingLeft: 18 }}>
            <li>이용권은 <b style={{ color: '#fff1d6' }}>30일 단위 1회 결제</b>예요. 자동으로 다시 결제되지 않아요.</li>
            <li>결제 후 <b style={{ color: '#fff1d6' }}>7일 이내, 별가루를 쓰지 않았다면 전액 환불</b>해 드려요.</li>
            <li>별가루를 일부 썼다면 사용한 만큼을 뺀 금액을 환불해 드려요.</li>
            {BANK_ON && <li>계좌이체로 구매하셨다면 환불은 입금하신 계좌로 보내 드려요.</li>}
            <li>환불 문의: {BUSINESS.email} · {BUSINESS.phone}</li>
          </ul>
          <p style={{ display: 'flex', gap: 16, margin: '12px 0 16px', fontSize: '0.86rem', fontWeight: 700 }}>
            <a href="/terms#refund" target="_blank" rel="noopener" style={{ color: 'var(--moon)', textDecoration: 'underline', textUnderlineOffset: 3 }}>환불 정책 전문 보기</a>
            <a href="/terms" target="_blank" rel="noopener" style={{ color: 'var(--moon)', textDecoration: 'underline', textUnderlineOffset: 3 }}>이용약관 보기</a>
          </p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.92rem', color: '#f2e7cf', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setError(''); }} style={{ width: 22, height: 22, flexShrink: 0, accentColor: '#f5cf80' }} />
            <span>위 내용과 이용약관을 확인했고, 결제에 동의해요.</span>
          </label>
          {error && <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div>}
        </div>

        <div className="pricing">
          <div className="price-card card-night">
            <div className="price-name"><span aria-hidden="true">🌱</span><h2 className="title-3">처음 만나는 공방</h2></div>
            <p className="price">무료</p>
            <ul className="price-list">
              <li><Icon name="check" size={16} />가입하면 별가루 2개</li>
              <li><Icon name="check" size={16} />8장 그림책 2권</li>
              <li><Icon name="check" size={16} />목소리 낭독 · 영어 단어</li>
              <li><Icon name="check" size={16} />내 서재 평생 보관</li>
            </ul>
            {user ? <Link href="/start" className="btn btn-ghost btn-block">동화 만들러 가기</Link> : <button className="kakao-btn lg" onClick={() => signInWithKakao('/start').catch(() => {})}><KakaoIcon /> 무료로 시작하기</button>}
          </div>
          {PLANS.map(p => (
            <div key={p.id} className={`price-card card-night ${p.highlight ? 'featured' : ''}`}>
              {p.highlight && <span className="price-badge">한 권에 550원꼴</span>}
              <div className="price-name"><span aria-hidden="true">{p.id === 'star' ? '⭐' : '🌙'}</span><h2 className="title-3">{p.name} 30일 이용권</h2></div>
              <p className="price">{p.price.toLocaleString()}<small>원</small></p>
              <p className="muted" style={{ marginTop: -8 }}>{p.tagline}</p>
              <ul className="price-list">{p.features.map(f => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul>
              {CARD_ON && (
                <button className={`btn btn-block btn-lg ${p.highlight ? 'btn-gold' : 'btn-ghost'}`} onClick={() => buy(p.id)} disabled={!!busy || loading}>
                  {busy === p.id ? <><span className="spin" /> 결제창 여는 중</> : `${p.price.toLocaleString()}원 카드 결제`}
                </button>
              )}
              {BANK_ON && (
                <button className={`btn btn-block ${CARD_ON ? 'btn-ghost' : `btn-lg ${p.highlight ? 'btn-gold' : 'btn-ghost'}`}`} style={CARD_ON ? { marginTop: 8 } : undefined} onClick={() => openBank(p.id)} disabled={loading}>
                  {CARD_ON ? '계좌이체로 구매' : `${p.price.toLocaleString()}원 계좌이체로 구매`}
                </button>
              )}
              {!CARD_ON && !BANK_ON && <button className="btn btn-block btn-lg btn-ghost" disabled>결제 준비 중이에요</button>}
              {plan === p.id && <p className="price-current">지금 이용 중이에요 · 결제하면 30일 연장돼요</p>}
            </div>
          ))}
        </div>

        <div className="section-head" style={{ marginTop: 70 }}>
          <h2 className="title-2">별가루는 이렇게 써요</h2>
        </div>
        <div className="steps steps-3">
          {[['8장 동화', '별가루 1개', '표지 · 시작 장면 포함 10장의 그림'], ['12장 동화', '별가루 1.5개', '달빛 · 별빛 이용권'], ['15장 동화', '별가루 2개', '별빛 이용권 전용']].map(([a, b, c]) => (
            <div key={a} className="step card-night" style={{ textAlign: 'center' }}>
              <h3 className="title-3">{a}</h3>
              <p className="price" style={{ fontSize: '1.6rem', margin: '8px 0' }}>{b}</p>
              <p>{c}</p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ textAlign: 'center', margin: '26px auto 90px', maxWidth: 640 }}>
          목소리 낭독과 영어 단어는 별가루 없이 무제한이에요. 결제 후 사용하지 않은 이용권은 7일 이내 전액 환불받을 수 있어요.
        </p>
      </main>
      <SiteFooter />
      {bankPlan && (
        <div className="overlay" onClick={() => setBankPlan(null)}>
          <div className="sheet card-paper" role="dialog" aria-modal="true" aria-labelledby="bank-title" onClick={e => e.stopPropagation()}>
            <div className="sheet-head"><h2 id="bank-title">계좌이체로 구매</h2><button className="sheet-close" onClick={() => setBankPlan(null)} aria-label="닫기"><Icon name="close" size={18} /></button></div>
            <p className="sheet-sub">
              {PLANS.find(p => p.id === bankPlan)?.name} 30일 이용권 · <b>{PLANS.find(p => p.id === bankPlan)?.price.toLocaleString()}원</b><br />
              주문하면 입금할 계좌를 알려드려요. 입금이 확인되면 이용권과 별가루가 들어와요.
            </p>
            <label htmlFor="depositor" className="bank-label">입금하실 분 이름 (통장에 찍히는 이름)</label>
            <input id="depositor" className="field" value={depositor} maxLength={20} onChange={e => setDepositor(e.target.value)} placeholder="예) 김하늘" autoComplete="name" />
            {bankError && <div className="notice on-paper" role="alert" style={{ marginTop: 12 }}>{bankError}</div>}
            <button className="btn btn-ink btn-block btn-lg" style={{ marginTop: 16 }} onClick={orderBank} disabled={bankBusy || depositor.trim().length < 2}>
              {bankBusy ? <><span className="spin" /> 주문 만드는 중</> : '주문하고 입금 계좌 보기'}
            </button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
