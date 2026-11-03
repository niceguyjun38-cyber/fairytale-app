'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Icon, KakaoIcon } from '@/components/Icon';
import { PAGE_OPTIONS, SEED_STORIES, canUsePages, type SeedStory } from '@/data/seedStories';
import { useAuth, useWallet } from '@/lib/useAuth';

export default function StartPage() {
  const router = useRouter();
  const { user, loading, signInWithKakao } = useAuth();
  const { wallet, walletError } = useWallet(user);
  const [seed, setSeed] = useState<SeedStory>(SEED_STORIES[0]);
  const [pages, setPages] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; plans?: boolean } | null>(null);
  const lock = useRef(false);
  const setupRef = useRef<HTMLElement>(null);
  const pick = (s: SeedStory) => {
    setSeed(s);
    if (window.matchMedia('(max-width: 1000px)').matches) {
      window.setTimeout(() => setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  };

  const plan = wallet?.plan ?? 'free';
  const option = PAGE_OPTIONS.find(o => o.count === pages)!;

  const start = async () => {
    if (lock.current) return;
    setError(null);
    if (!user) {
      try { await signInWithKakao('/start'); } catch { setError({ text: '카카오 로그인에 연결하지 못했어요. 다시 시도해 주세요.' }); }
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seed.id, pages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.storyId) {
        setError({
          text: data.code === 'NOT_ENOUGH'
            ? `별가루가 부족해요. 이 동화에는 ${option.cost}개가 필요해요.`
            : data.error || '이야기를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
          plans: data.code === 'NOT_ENOUGH' || data.code === 'PLAN_REQUIRED',
        });
        return;
      }
      router.push(`/create?story=${data.storyId}`);
    } catch {
      setError({ text: '인터넷 연결을 확인하고 다시 시도해 주세요.' });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="night-page">
      <SiteHeader credits={wallet?.credits ?? null} authUser={user} />
      <main className="container">
        <div className="start-head">
          <div>
            <span className="eyebrow"><Icon name="sparkles" size={15} /> 01 · 이야기의 문 고르기</span>
            <h1 className="title-1" style={{ marginTop: 10 }}>어떤 이야기의 문을 열어볼까요?</h1>
            <p className="lead">마음에 드는 시작을 고르면, 그다음은 우리 아이의 차례예요.</p>
          </div>
          {user && (
            <div className="wallet-card card-night">
              <Icon name="sparkles" size={24} />
              <div>
                <p className="label">{plan === 'star' ? '별빛 이용 중' : plan === 'moon' ? '달빛 이용 중' : '무료 체험'}</p>
                <p className="num">{wallet ? `별가루 ${wallet.credits}개` : walletError ? '확인 실패' : '확인 중…'}</p>
              </div>
              <Link href="/plans" style={{ marginLeft: 8 }}>충전</Link>
            </div>
          )}
        </div>

        <div className="start-grid">
          <section className="seed-panel card-night" aria-labelledby="seed-title">
            <div className="panel-title">
              <h2 id="seed-title"><span className="step-dot">01</span> 이야기의 시작</h2>
              <span className="muted">{SEED_STORIES.length}가지 시작</span>
            </div>
            <div className="seed-grid">
              {SEED_STORIES.map((s, i) => (
                <button key={s.id} className="seed-card" aria-pressed={seed.id === s.id} onClick={() => pick(s)}>
                  <div className="seed-card-art">
                    {s.art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.art} alt="" loading={i < 3 ? 'eager' : 'lazy'} />
                    ) : (
                      <div className="seed-card-emoji" aria-hidden="true">{s.emoji}</div>
                    )}
                    <span className="seed-check"><Icon name="check" size={16} /></span>
                  </div>
                  <div className="seed-card-body">
                    <span className="seed-theme">{s.theme}</span>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside ref={setupRef} className="setup-card card-night" aria-label="선택한 이야기" style={{ scrollMarginTop: 120 }}>
            <div className="setup-top">
              <p className="eyebrow">우리 이야기의 첫 문장</p>
              <h2>{seed.emoji} {seed.title}</h2>
              <p className="setup-preview" key={seed.id}>{seed.preview}</p>
              <p className="setup-next"><Icon name="pen" size={15} /> {seed.firstPrompt}</p>
            </div>
            <div className="setup-bottom">
              <h3><span className="step-dot">02</span> 이야기 길이</h3>
              <div className="length-options" role="group" aria-label="동화 길이">
                {PAGE_OPTIONS.map(o => {
                  const ok = canUsePages(plan, o.minPlan);
                  return (
                    <button
                      key={o.count}
                      className={`length-option ${ok ? '' : 'locked'}`}
                      aria-pressed={pages === o.count}
                      onClick={() => {
                        if (!ok) {
                          setError({ text: `${o.count}장 동화는 ${o.minPlan === 'star' ? '별빛' : '달빛'} 이용권에서 만들 수 있어요.`, plans: true });
                          return;
                        }
                        setError(null);
                        setPages(o.count);
                      }}
                    >
                      <strong>{o.count}<small>장</small></strong>
                      <span>{ok ? o.label : <><Icon name="lock" size={11} />{o.minPlan === 'star' ? '별빛' : '달빛'}</>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="cost-row">
                <span>{option.time} · 표지와 시작 장면 포함</span>
                <strong><Icon name="sparkles" size={15} /> {option.cost}개</strong>
              </div>
              {error && (
                <div className="notice on-paper" role="alert" style={{ marginBottom: 12 }}>
                  <span>{error.text}{error.plans && <Link href="/plans">이용권 보기</Link>}</span>
                </div>
              )}
              {user || loading ? (
                <button className="btn btn-gold btn-lg btn-block" onClick={start} disabled={busy || loading}>
                  {busy ? <><span className="spin" /> 작업실을 여는 중…</> : <>이 이야기로 시작하기 <Icon name="arrow" /></>}
                </button>
              ) : (
                <button className="kakao-btn lg" style={{ width: '100%' }} onClick={start}>
                  <KakaoIcon /> 카카오로 시작하기
                </button>
              )}
              <p className="setup-foot">{user ? '시작하면 별가루가 사용돼요. 만들던 이야기는 서재에 보관돼요.' : '가입하면 별가루 2개를 선물로 드려요.'}</p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
