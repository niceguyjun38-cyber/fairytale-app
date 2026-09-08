'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SEED_STORIES, PAGE_OPTIONS, SeedStory } from '@/data/seedStories';
import { useAuth } from '@/lib/useAuth';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

const PAGE_COST: Record<number, number> = { 8: 1, 12: 1.5, 15: 2 };
const ART: Record<number, string> = { 1: '/illustrations/forest-bear.png', 2: '/illustrations/fallen-star.png', 3: '/illustrations/magic-bakery.png' };

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithKakao } = useAuth();
  const [selected, setSelected] = useState<SeedStory>(SEED_STORIES[0]);
  const [pageCount, setPageCount] = useState(8);
  const [userPlan, setUserPlan] = useState('guest');
  const [credits, setCredits] = useState(0);
  const [starting, setStarting] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [error, setError] = useState('');
  const startRef = useRef(false);

  useEffect(() => {
    if (!user) { setUserPlan('guest'); setCredits(0); return; }
    let alive = true;
    setCreditLoading(true);
    fetch('/api/credits').then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(); return d; })
      .then(d => { if (alive) { setUserPlan(d.plan || 'free'); setCredits(Number(d.credits) || 0); } })
      .catch(() => { if (alive) setError('별가루 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); })
      .finally(() => { if (alive) setCreditLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const handleStart = async () => {
    if (startRef.current || authLoading || creditLoading) return;
    setError('');
    if (!user) {
      try { await signInWithKakao(); } catch { setError('로그인에 연결하지 못했어요. 다시 시도해 주세요.'); }
      return;
    }
    startRef.current = true;
    setStarting(true);
    try {
      const res = await fetch('/api/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pages: pageCount }) });
      const data = await res.json();
      if (res.status === 402) { setError(`별가루가 부족해요. 필요한 별가루 ${data.needed}개, 남은 별가루 ${data.credits}개`); return; }
      if (!res.ok || data.error) throw new Error(data.error || '이야기를 시작하지 못했어요.');
      setCredits(Number(data.credits));
      router.push(`/create?seed=${selected.id}&pages=${pageCount}`);
    } catch (e) { setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setStarting(false); startRef.current = false; }
  };

  return <div className="workshop-home"><SiteHeader/>
    <main className="workshop-container">
      <div className="workshop-heading">
        <div><p className="eyebrow"><Icon name="sparkles" size={16}/> 달빛 아래, 이야기가 깨어나는 곳</p><h1>어떤 이야기의 문을<br className="mobile-break"/> 열어볼까요?</h1><p className="lead">마음에 드는 시작을 고르면, 다음 이야기는 우리 아이의 차례예요.</p></div>
        <div className="credit-note"><Icon name="sparkles" size={21}/><div>{user ? <><strong>{creditLoading ? '확인 중…' : `별가루 ${credits}개`}</strong><Link href="/plans">내 플랜 보기</Link></> : <><strong>첫 동화를 선물해요</strong><span>가입하면 별가루 2개</span></>}</div></div>
      </div>
      <div className="workshop-grid">
        <section className="seed-selection" aria-labelledby="seed-heading">
          <div className="section-caption"><h2 id="seed-heading"><span className="step-number">01</span> 이야기의 시작 고르기</h2><span>{SEED_STORIES.length}가지 시작</span></div>
          <div className="featured-seeds">
            {SEED_STORIES.slice(0, 3).map((s, i) => <button key={s.id} className={`seed-cover ${selected.id === s.id ? 'is-selected' : ''}`} onClick={() => setSelected(s)} aria-pressed={selected.id === s.id}>
              <div className="seed-cover-art"><img src={ART[s.id]} alt="" width="768" height="512" loading={i ? 'lazy' : 'eager'}/><span className="seed-check"><Icon name="check" size={16}/></span></div>
              <div className="seed-cover-copy"><span className="seed-category">{s.theme.replace('/', ' · ')}</span><h3>{s.title}</h3><p>{s.description}</p></div>
            </button>)}
          </div>
          <p className="more-seeds-label">다른 상상도 기다리고 있어요</p>
          <div className="compact-seeds">
            {SEED_STORIES.slice(3).map(s => <button key={s.id} className={`seed-row ${selected.id === s.id ? 'is-selected' : ''}`} onClick={() => setSelected(s)} aria-pressed={selected.id === s.id}><span className="seed-symbol" aria-hidden="true">{s.emoji}</span><span><strong>{s.title}</strong><small>{s.description}</small></span><span className="seed-row-check">{selected.id === s.id ? <Icon name="check" size={18}/> : <Icon name="arrow" size={17}/>}</span></button>)}
          </div>
          <div className="process-strip" aria-label="동화 제작 과정"><span><Icon name="mic"/> 상상을 말하고</span><span><Icon name="pen"/> 문장을 다듬고</span><span><Icon name="book"/> 우리 책으로 간직해요</span></div>
        </section>
        <aside className="story-setup" aria-label="선택한 이야기와 분량">
          <div className="story-setup-top"><span className="eyebrow">우리 이야기의 첫 문장</span><span className="setup-symbol" aria-hidden="true">{selected.emoji}</span><h2>{selected.title}</h2><p className="seed-preview" key={selected.id}>{selected.preview}</p><div className="continuation"><Icon name="pen" size={17}/><span>그다음엔 어떤 일이 일어날까요?</span></div></div>
          <div className="story-setup-bottom">
            <h3><span className="step-number">02</span> 이야기 길이 고르기</h3>
            <div className="page-options" role="group" aria-label="동화 분량">
              {PAGE_OPTIONS.map(opt => { const locked = (opt.minPlan === 'moon' && !['moon', 'star'].includes(userPlan)) || (opt.minPlan === 'star' && userPlan !== 'star'); return <button key={opt.count} className={`page-option ${pageCount === opt.count ? 'is-selected' : ''}`} aria-pressed={pageCount === opt.count} onClick={() => { if (locked) { router.push('/plans'); return; } setPageCount(opt.count); }} aria-label={`${opt.count}장 ${locked ? (opt.minPlan === 'star' ? '별빛' : '달빛') + ' 플랜 필요' : opt.label}`}><strong>{opt.count}<small>장</small></strong><span>{locked ? <><Icon name="lock" size={12}/>{opt.minPlan === 'star' ? '별빛' : '달빛'}</> : opt.label}</span></button>; })}
            </div>
            <p className="page-note">시작 이야기와 표지는 별도로 더해져요.</p>
            <div className="cost-line"><span>사용할 별가루</span><strong><Icon name="sparkles" size={15}/>{PAGE_COST[pageCount]}개</strong></div>
            {error && <div className="inline-error" role="alert">{error} <Link href="/plans">플랜 확인</Link></div>}
            <button className="button-primary start-story" onClick={handleStart} disabled={starting || authLoading || creditLoading}>{starting ? '이야기를 준비하고 있어요…' : user ? '우리 동화 시작하기' : '로그인하고 동화 시작하기'}<Icon name="arrow"/></button>
            <p className="setup-footnote">말하기와 글쓰기, 편한 방법으로 함께해요.</p>
          </div>
        </aside>
      </div>
      <footer className="workshop-footer"><span>꼬마작가 동화공방</span><p>오늘 나눈 상상이, 오래 꺼내 읽을 이야기가 되도록.</p><Link href="/feed">친구들 이야기 둘러보기 <Icon name="arrow" size={16}/></Link></footer>
    </main>
  </div>;
}
