'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SEED_STORIES, PAGE_OPTIONS, SeedStory } from '@/data/seedStories';
import { useAuth } from '@/lib/useAuth';

const PAGE_COST: Record<number, number> = { 8: 1, 12: 1.5, 15: 2 };

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
      <header
        className="relative px-4 pt-6 pb-16 overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 70%, #4A4080 100%)',
          borderRadius: '0 0 32px 32px',
        }}
      >
        <span className="star text-xs" style={{ top: '18%', left: '12%' }}>✦</span>
        <span className="star text-sm" style={{ top: '30%', left: '85%', animationDelay: '0.7s' }}>✦</span>
        <span className="star text-[10px]" style={{ top: '55%', left: '75%', animationDelay: '1.2s' }}>✧</span>
        <span className="star text-xs" style={{ top: '15%', left: '60%', animationDelay: '1.8s' }}>⋆</span>
        <span className="star text-[9px]" style={{ top: '65%', left: '8%', animationDelay: '0.4s' }}>✧</span>
        <span className="absolute text-2xl floaty" style={{ top: '32%', right: '8%' }}>🌙</span>

        <div className="max-w-md mx-auto relative">
          <div className="flex justify-end gap-2 mb-3">
            <button
              onClick={() => router.push('/feed')}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--star-gold)' }}
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
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--lavender)' }}
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

          <p className="text-xs font-bold tracking-widest mb-2" style={{ color: 'var(--star-gold)' }}>
            ✦ 꼬마작가 동화공방 ✦
          </p>
          <h1 className="font-title text-white text-3xl leading-snug">
            오늘 밤엔 어떤 이야기가
            <br />
            피어날까요?
          </h1>

          {/* 별가루(크레딧) 현황 */}
          {user && (
            <button
              onClick={() => router.push('/plans')}
              className="mt-4 w-full rounded-2xl px-4 py-3 flex items-center justify-between transition-all active:scale-98"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,201,77,0.3)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <div className="text-left">
                  <p className="text-[10px]" style={{ color: 'var(--lavender)' }}>
                    {planLabel} 플랜
                  </p>
                  <p className="font-title text-lg" style={{ color: 'var(--star-gold)' }}>
                    별가루 {credits}개
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'var(--star-gold)', color: 'var(--night-deep)' }}
              >
                {userPlan === 'free' ? '충전하기 →' : '플랜 보기 →'}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-36" style={{ marginTop: '-24px' }}>
        <div className="grid grid-cols-2 gap-3">
          {SEED_STORIES.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => setSelected(story)}
              className="rounded-3xl p-4 text-left transition-all active:scale-95 relative"
              style={{
                background: selected?.id === story.id ? 'var(--lavender-light)' : 'white',
                border:
                  selected?.id === story.id
                    ? '2.5px solid var(--lavender)'
                    : '2.5px solid transparent',
                boxShadow:
                  selected?.id === story.id
                    ? '0 8px 24px rgba(184,169,232,0.35)'
                    : '0 4px 16px rgba(61,58,92,0.08)',
              }}
            >
              {selected?.id === story.id && (
                <span className="absolute -top-2 -right-1 text-lg">✨</span>
              )}
              <span className="text-4xl block mb-2 floaty" style={{ animationDelay: `${idx * 0.6}s` }}>
                {story.emoji}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5"
                style={{ background: 'var(--lavender-light)', color: '#7A6BC4' }}
              >
                {story.theme}
              </span>
              <h3 className="font-title text-base font-bold mb-0.5" style={{ color: 'var(--ink)' }}>
                {story.title}
              </h3>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {story.description}
              </p>
            </button>
          ))}
        </div>

        {selected && (
          <div
            className="mt-5 rounded-3xl p-5 relative"
            style={{
              background: 'linear-gradient(135deg, #FFF4E0 0%, var(--lavender-light) 100%)',
              boxShadow: '0 4px 16px rgba(61,58,92,0.1)',
            }}
          >
            <span className="absolute top-3 right-4 text-sm star">✦</span>
            <div className="flex gap-3 items-start">
              <span className="text-3xl floaty">{selected.emoji}</span>
              <div>
                <h3 className="font-title text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>
                  {selected.title}
                </h3>
                <p className="text-xs leading-loose" style={{ color: 'var(--ink)' }}>
                  {selected.preview}
                </p>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-6">
            <p className="font-title text-base mb-3 text-center" style={{ color: 'var(--ink)' }}>
              🌟 몇 장짜리 동화를 만들까요? 🌟
            </p>
            <div className="flex gap-3">
              {PAGE_OPTIONS.map((opt) => {
                const locked =
                  (opt.minPlan === 'moon' && (userPlan === 'free' || userPlan === 'guest')) ||
                  (opt.minPlan === 'star' && userPlan !== 'star');
                const cost = PAGE_COST[opt.count] ?? 1;

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
                    className="flex-1 rounded-3xl py-4 px-2 text-center transition-all active:scale-95 relative"
                    style={{
                      background: locked
                        ? '#F1EEF8'
                        : pageCount === opt.count
                        ? 'var(--night)'
                        : 'white',
                      border: '2.5px solid',
                      borderColor:
                        pageCount === opt.count && !locked ? 'var(--night)' : '#E8E4F4',
                      boxShadow:
                        pageCount === opt.count && !locked
                          ? '0 8px 20px rgba(43,45,92,0.3)'
                          : '0 2px 8px rgba(61,58,92,0.06)',
                      opacity: locked ? 0.75 : 1,
                    }}
                  >
                    {locked && (
                      <span
                        className="absolute -top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            opt.minPlan === 'star'
                              ? 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))'
                              : 'var(--lavender)',
                          color: opt.minPlan === 'star' ? 'var(--night-deep)' : 'white',
                        }}
                      >
                        {opt.minPlan === 'star' ? '⭐ 별빛' : '🌙 달빛'}
                      </span>
                    )}
                    <div
                      className="font-title text-3xl font-bold"
                      style={{
                        color: locked
                          ? '#C5BFDA'
                          : pageCount === opt.count
                          ? 'var(--star-gold)'
                          : 'var(--lavender)',
                      }}
                    >
                      {locked ? '🔒' : opt.count}
                    </div>
                    <div
                      className="text-xs font-bold mt-1"
                      style={{
                        color: locked
                          ? '#B4AFC9'
                          : pageCount === opt.count
                          ? 'white'
                          : 'var(--ink)',
                      }}
                    >
                      {opt.count}장 · {opt.label}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{
                        color: locked
                          ? '#C5BFDA'
                          : pageCount === opt.count
                          ? 'var(--star-gold)'
                          : 'var(--ink-soft)',
                      }}
                    >
                      ✨ 별가루 {cost}개
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 pb-6"
        style={{ background: 'linear-gradient(transparent, var(--paper) 35%)' }}
      >
        <div className="max-w-md mx-auto">
          <button
            onClick={handleStart}
            disabled={!selected || !pageCount || starting}
            className="w-full py-4 rounded-full font-title text-lg font-bold transition-all active:scale-98"
            style={{
              background:
                selected && pageCount
                  ? 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))'
                  : '#E8E4F4',
              color: selected && pageCount ? 'var(--night-deep)' : '#B4AFC9',
              boxShadow:
                selected && pageCount ? '0 8px 24px rgba(255,201,77,0.45)' : 'none',
            }}
          >
            {starting
              ? '별가루 준비 중...'
              : selected && pageCount
              ? `✨ ${selected.title} 이야기 시작!`
              : selected
              ? '장 수를 골라주세요'
              : '씨앗 이야기를 골라주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}