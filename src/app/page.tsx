'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SEED_STORIES, PAGE_OPTIONS, SeedStory } from '@/data/seedStories';
import { useAuth } from '@/lib/useAuth';

const PAGE_COST: Record<number, number> = { 8: 1, 12: 1.5, 15: 2 };

// 씨앗별 색 팔레트 (동화마을의 각기 다른 문)
const SEED_THEME: Record<number, { bg: string; ring: string; glow: string }> = {
  1: { bg: 'linear-gradient(160deg,#EAF6E4 0%,#D6EBD0 100%)', ring: '#8FBF7F', glow: 'rgba(143,191,127,0.45)' },
  2: { bg: 'linear-gradient(160deg,#EDE7FB 0%,#DCD2F5 100%)', ring: '#9B87DC', glow: 'rgba(155,135,220,0.45)' },
  3: { bg: 'linear-gradient(160deg,#FFF1DC 0%,#FBE0BC 100%)', ring: '#E0A662', glow: 'rgba(224,166,98,0.45)' },
  4: { bg: 'linear-gradient(160deg,#E6F2FB 0%,#D0E6F7 100%)', ring: '#7FB2DC', glow: 'rgba(127,178,220,0.45)' },
  5: { bg: 'linear-gradient(160deg,#E0F4F4 0%,#C6E9E9 100%)', ring: '#6FBFBF', glow: 'rgba(111,191,191,0.45)' },
  6: { bg: 'linear-gradient(160deg,#F2E7F7 0%,#E4D3F0 100%)', ring: '#A87FCC', glow: 'rgba(168,127,204,0.45)' },
};

const STARS = [
  { top: '8%', left: '10%', size: 'text-xs', d: '0s' },
  { top: '14%', left: '82%', size: 'text-sm', d: '0.6s' },
  { top: '22%', left: '46%', size: 'text-[10px]', d: '1.3s' },
  { top: '30%', left: '22%', size: 'text-xs', d: '1.9s' },
  { top: '11%', left: '62%', size: 'text-[9px]', d: '0.9s' },
  { top: '36%', left: '90%', size: 'text-[10px]', d: '2.3s' },
  { top: '43%', left: '6%', size: 'text-xs', d: '1.1s' },
  { top: '26%', left: '70%', size: 'text-[9px]', d: '2.8s' },
];

const FIREFLIES = [
  { bottom: '18%', left: '12%', d: '0s' },
  { bottom: '24%', left: '34%', d: '1.8s' },
  { bottom: '14%', left: '58%', d: '3.4s' },
  { bottom: '28%', left: '78%', d: '2.6s' },
  { bottom: '20%', left: '90%', d: '4.6s' },
];

export default function Home() {
  const router = useRouter();
  const { user, signInWithKakao, signOut } = useAuth();
  const [selected, setSelected] = useState<SeedStory | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [userPlan, setUserPlan] = useState<string>('guest');
  const [credits, setCredits] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user) {
      setUserPlan('guest');
      setCredits(0);
      return;
    }
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        setUserPlan(d.plan || 'free');
        setCredits(Number(d.credits) || 0);
      })
      .catch(() => {});
  }, [user]);

  const handleStart = async () => {
    if (!selected || !pageCount || starting) return;

    if (!user) {
      if (confirm('동화를 만들려면 로그인이 필요해요! 카카오로 시작할까요?')) {
        signInWithKakao();
      }
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: pageCount }),
      });
      const data = await res.json();

      if (res.status === 402) {
        alert(
          `🌙 별가루가 부족해요!\n\n남은 별가루: ${data.credits}개\n필요한 별가루: ${data.needed}개\n\n구독하면 매달 별가루를 받을 수 있어요.`
        );
        router.push('/plans');
        return;
      }
      if (data.error) throw new Error(data.error);

      setCredits(Number(data.credits));
      router.push(`/create?seed=${selected.id}&pages=${pageCount}`);
    } catch (e: any) {
      alert('오류: ' + e.message);
    } finally {
      setStarting(false);
    }
  };

  const planLabel =
    userPlan === 'star' ? '⭐ 별빛' : userPlan === 'moon' ? '🌙 달빛' : '무료';

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* ══ 밤하늘 무대 ══ */}
      <header className="sky relative px-4 pt-5" style={{ paddingBottom: 96 }}>
        <div className="aurora" />

        {/* 구름 */}
        <div className="cloud" style={{ top: '18%', left: '-10%', width: 220, height: 46 }} />
        <div className="cloud" style={{ top: '34%', left: '55%', width: 180, height: 38, animationDelay: '6s' }} />
        <div className="cloud" style={{ top: '52%', left: '10%', width: 260, height: 42, animationDelay: '12s' }} />

        {/* 별 */}
        {STARS.map((s, i) => (
          <span key={i} className={`star ${s.size}`} style={{ top: s.top, left: s.left, animationDelay: s.d }}>
            {i % 3 === 0 ? '✦' : i % 3 === 1 ? '✧' : '⋆'}
          </span>
        ))}

        {/* 반딧불이 */}
        {FIREFLIES.map((f, i) => (
          <span key={i} className="firefly" style={{ bottom: f.bottom, left: f.left, animationDelay: f.d }} />
        ))}

        {/* 달 */}
        <div className="moon absolute" style={{ top: 74, right: 26 }}>
          <svg width="62" height="62" viewBox="0 0 62 62" fill="none">
            <circle cx="31" cy="31" r="24" fill="#FFE9B0" />
            <circle cx="41" cy="26" r="21" fill="#1A1B42" />
            <circle cx="24" cy="24" r="3.2" fill="#F5D98F" opacity="0.7" />
            <circle cx="21" cy="36" r="2.2" fill="#F5D98F" opacity="0.6" />
            <circle cx="30" cy="42" r="1.8" fill="#F5D98F" opacity="0.5" />
          </svg>
        </div>

        {/* 상단 네비 */}
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex justify-end gap-2 mb-6">
            <button
              onClick={() => router.push('/feed')}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.14)', color: 'var(--star-gold)', border: '1px solid rgba(255,201,77,0.25)' }}
            >
              ✨ 친구들 이야기
            </button>
            {user ? (
              <>
                <button
                  onClick={() => router.push('/library')}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--star-gold)', color: 'var(--night-deep)' }}
                >
                  📚 내 서재
                </button>
                <button
                  onClick={signOut}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
                  style={{ background: 'rgba(255,255,255,0.14)', color: 'var(--lavender)' }}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={signInWithKakao}
                className="text-xs font-bold px-4 py-2 rounded-full transition-all active:scale-95"
                style={{ background: '#FEE500', color: '#191919' }}
              >
                💬 카카오로 시작하기
              </button>
            )}
          </div>

          {/* 타이틀 */}
          <div className="text-center rise">
            <p className="text-[11px] font-bold tracking-[0.25em] mb-3" style={{ color: 'var(--star-gold)' }}>
              ✦ 꼬 마 작 가 동 화 공 방 ✦
            </p>
            <h1 className="font-title text-white text-[38px] leading-[1.25] glow-title">
              오늘 밤,
              <br />
              어떤 이야기가 피어날까요?
            </h1>
            <p className="text-xs mt-4 leading-relaxed" style={{ color: 'rgba(232,228,255,0.75)' }}>
              말하면 이야기가 되고, 이야기는 그림책이 돼요
              <br />
              완성된 동화는 목소리로 읽어드려요
            </p>
          </div>

          {/* 별가루 현황 */}
          {user && (
            <button
              onClick={() => router.push('/plans')}
              className="mt-6 w-full rounded-3xl px-5 py-4 flex items-center justify-between transition-all active:scale-98 backdrop-blur-sm"
              style={{
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,201,77,0.32)',
                boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl floaty">✨</span>
                <div className="text-left">
                  <p className="text-[10px] tracking-wide" style={{ color: 'var(--lavender)' }}>
                    {planLabel} 플랜
                  </p>
                  <p className="font-title text-2xl leading-tight" style={{ color: 'var(--star-gold)' }}>
                    별가루 {credits}개
                  </p>
                </div>
              </div>
              <span
                className="text-[11px] font-bold px-3 py-2 rounded-full"
                style={{ background: 'var(--star-gold)', color: 'var(--night-deep)' }}
              >
                {userPlan === 'free' ? '충전하기 →' : '플랜 보기 →'}
              </span>
            </button>
          )}
        </div>

        {/* 마을 실루엣 */}
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 90"
          preserveAspectRatio="none"
          style={{ height: 90 }}
        >
          {/* 뒷산 */}
          <path d="M0 62 L46 34 L88 60 L128 30 L176 60 L214 42 L262 64 L310 36 L352 60 L400 44 L400 90 L0 90 Z"
                fill="#1B1C46" opacity="0.85" />
          {/* 집들 */}
          <g fill="#141536">
            <rect x="34" y="60" width="30" height="24" />
            <path d="M30 61 L49 47 L68 61 Z" />
            <rect x="96" y="64" width="24" height="20" />
            <path d="M92 65 L108 53 L124 65 Z" />
            <rect x="252" y="62" width="28" height="22" />
            <path d="M248 63 L266 50 L284 63 Z" />
            <rect x="322" y="66" width="22" height="18" />
            <path d="M318 67 L333 56 L348 67 Z" />
          </g>
          {/* 창문 불빛 */}
          <g fill="#FFC94D">
            <rect x="43" y="67" width="7" height="7" rx="1" opacity="0.95" />
            <rect x="104" y="70" width="6" height="6" rx="1" opacity="0.85" />
            <rect x="261" y="69" width="7" height="7" rx="1" opacity="0.9" />
            <rect x="329" y="72" width="6" height="5" rx="1" opacity="0.8" />
          </g>
          {/* 나무 */}
          <g fill="#101230">
            <ellipse cx="160" cy="66" rx="13" ry="17" />
            <rect x="157.5" y="74" width="5" height="12" />
            <ellipse cx="200" cy="70" rx="10" ry="13" />
            <rect x="197.5" y="76" width="5" height="10" />
          </g>
          {/* 땅 */}
          <path d="M0 82 Q100 74 200 82 T400 80 L400 90 L0 90 Z" fill="var(--paper)" />
        </svg>
      </header>

      {/* ══ 본문 ══ */}
      <main className="max-w-md mx-auto px-4 pb-40" style={{ marginTop: -6 }}>
        {/* 섹션 헤더 */}
        <div className="text-center mb-5">
          <p className="font-round text-lg" style={{ color: 'var(--ink)' }}>
            어떤 문으로 들어가 볼까요?
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
            문을 고르면 이야기가 시작돼요
          </p>
        </div>

        {/* 씨앗 카드 */}
        <div className="grid grid-cols-2 gap-3.5">
          {SEED_STORIES.map((story, idx) => {
            const theme = SEED_THEME[story.id] ?? SEED_THEME[1];
            const isOn = selected?.id === story.id;
            return (
              <button
                key={story.id}
                onClick={() => setSelected(story)}
                className={`card-magic rounded-[26px] p-4 pt-5 text-left overflow-hidden rise ${isOn ? 'ring-magic' : ''}`}
                style={{
                  background: theme.bg,
                  border: `2px solid ${isOn ? 'var(--star-gold)' : 'rgba(255,255,255,0.8)'}`,
                  boxShadow: isOn ? undefined : '0 6px 18px rgba(61,58,92,0.12)',
                  animationDelay: `${idx * 0.06}s`,
                }}
              >
                {isOn && <span className="absolute top-2 right-3 text-base z-10">✨</span>}

                {/* 이모지 원판 */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3 floaty relative"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    boxShadow: `0 6px 16px ${theme.glow}, inset 0 0 0 2px ${theme.ring}33`,
                    animationDelay: `${idx * 0.5}s`,
                  }}
                >
                  <span className="text-3xl">{story.emoji}</span>
                </div>

                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5"
                  style={{ background: 'rgba(255,255,255,0.85)', color: theme.ring }}
                >
                  {story.theme}
                </span>
                <h3 className="font-round text-[15px] mb-1" style={{ color: 'var(--ink)' }}>
                  {story.title}
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {story.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* 미리보기 — 오래된 편지지 */}
        {selected && (
          <div
            className="mt-6 rounded-[26px] p-5 relative overflow-hidden rise"
            style={{
              background: 'linear-gradient(155deg, #FFFBF2 0%, var(--paper-warm) 100%)',
              border: '2px solid rgba(224,190,140,0.5)',
              boxShadow: '0 10px 28px rgba(61,58,92,0.14)',
            }}
          >
            <span className="star text-xs" style={{ top: 12, right: 18 }}>✦</span>
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ width: 5, background: 'linear-gradient(180deg, var(--star-gold), var(--peach-soft))' }}
            />
            <div className="flex gap-3 items-start pl-2">
              <span className="text-3xl floaty">{selected.emoji}</span>
              <div>
                <h3 className="font-round text-lg mb-1.5" style={{ color: 'var(--ink)' }}>
                  {selected.title}
                </h3>
                <p className="text-[13px] leading-loose" style={{ color: 'var(--ink)' }}>
                  {selected.preview}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 장 수 선택 */}
        {selected && (
          <div className="mt-7 rise">
            <p className="font-round text-base mb-1 text-center" style={{ color: 'var(--ink)' }}>
              몇 장짜리 동화를 만들까요?
            </p>
            <p className="text-[11px] text-center mb-4" style={{ color: 'var(--ink-soft)' }}>
              긴 이야기일수록 별가루가 더 필요해요
            </p>
            <div className="flex gap-3">
              {PAGE_OPTIONS.map((opt) => {
                const locked =
                  (opt.minPlan === 'moon' && (userPlan === 'free' || userPlan === 'guest')) ||
                  (opt.minPlan === 'star' && userPlan !== 'star');
                const cost = PAGE_COST[opt.count] ?? 1;
                const on = pageCount === opt.count && !locked;

                return (
                  <button
                    key={opt.count}
                    onClick={() => {
                      if (locked) {
                        alert(
                          opt.minPlan === 'star'
                            ? '⭐ 별빛 플랜에서 만들 수 있어요!'
                            : '🌙 달빛 플랜부터 만들 수 있어요!'
                        );
                        router.push('/plans');
                        return;
                      }
                      setPageCount(opt.count);
                    }}
                    className="flex-1 rounded-[22px] py-4 px-2 text-center transition-all active:scale-95 relative overflow-hidden"
                    style={{
                      background: locked
                        ? '#F1EEF8'
                        : on
                        ? 'linear-gradient(165deg, var(--night) 0%, var(--night-deep) 100%)'
                        : 'white',
                      border: '2px solid',
                      borderColor: on ? 'var(--star-gold)' : locked ? '#E4DEF2' : '#EDE8F5',
                      boxShadow: on
                        ? '0 10px 24px rgba(35,36,90,0.32)'
                        : '0 3px 10px rgba(61,58,92,0.07)',
                      opacity: locked ? 0.72 : 1,
                    }}
                  >
                    {on && <span className="star text-[9px]" style={{ top: 8, right: 10 }}>✦</span>}
                    {locked && (
                      <span
                        className="absolute -top-0.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background:
                            opt.minPlan === 'star'
                              ? 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))'
                              : 'var(--lavender)',
                          color: opt.minPlan === 'star' ? 'var(--night-deep)' : 'white',
                        }}
                      >
                        {opt.minPlan === 'star' ? '별빛' : '달빛'}
                      </span>
                    )}
                    <div
                      className="font-title text-[30px] font-bold leading-none mb-1.5"
                      style={{ color: locked ? '#C5BFDA' : on ? 'var(--star-gold)' : 'var(--lavender)' }}
                    >
                      {locked ? '🔒' : opt.count}
                    </div>
                    <div
                      className="text-[11px] font-bold"
                      style={{ color: locked ? '#B4AFC9' : on ? 'white' : 'var(--ink)' }}
                    >
                      {opt.label}
                    </div>
                    <div
                      className="text-[10px] mt-1 font-bold"
                      style={{ color: locked ? '#C5BFDA' : on ? 'var(--star-gold)' : 'var(--ink-soft)' }}
                    >
                      ✨ {cost}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 비로그인 소개 */}
        {!user && (
          <div className="mt-8 rounded-[26px] p-5 text-center rise" style={{ background: 'var(--lavender-light)' }}>
            <p className="font-round text-base mb-3" style={{ color: 'var(--ink)' }}>
              이렇게 만들어져요
            </p>
            <div className="flex items-start justify-between gap-2">
              {[
                { i: '🎤', t: '말하기', d: '아이가 말해요' },
                { i: '✨', t: '다듬기', d: '동화가 돼요' },
                { i: '🎨', t: '그리기', d: '그림이 생겨요' },
                { i: '🔊', t: '읽어주기', d: '목소리로 들어요' },
              ].map((s, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-1.5 floaty"
                    style={{ background: 'white', animationDelay: `${i * 0.4}s`, boxShadow: '0 3px 10px rgba(61,58,92,0.1)' }}
                  >
                    <span className="text-lg">{s.i}</span>
                  </div>
                  <p className="text-[11px] font-bold" style={{ color: 'var(--ink)' }}>{s.t}</p>
                  <p className="text-[9px] leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>{s.d}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-4" style={{ color: 'var(--ink-soft)' }}>
              가입하면 별가루 2개를 드려요 ✨
            </p>
          </div>
        )}
      </main>

      {/* 하단 CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-8 pb-6"
        style={{ background: 'linear-gradient(transparent, var(--paper) 45%)' }}
      >
        <div className="max-w-md mx-auto">
          <button
            onClick={handleStart}
            disabled={!selected || !pageCount || starting}
            className="w-full py-4 rounded-full font-round text-[17px] transition-all active:scale-98 relative overflow-hidden"
            style={{
              background:
                selected && pageCount
                  ? 'linear-gradient(135deg, var(--star-gold) 0%, var(--peach-soft) 100%)'
                  : '#E8E4F4',
              color: selected && pageCount ? 'var(--night-deep)' : '#B4AFC9',
              boxShadow: selected && pageCount ? '0 10px 30px rgba(255,201,77,0.5)' : 'none',
            }}
          >
            {starting
              ? '별가루 준비 중...'
              : selected && pageCount
              ? `✨ ${selected.title} 이야기 시작!`
              : selected
              ? '장 수를 골라주세요'
              : '문을 하나 골라주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}