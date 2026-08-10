'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

const PLANS = [
  {
    id: 'moon',
    emoji: '🌙',
    name: '달빛',
    price: '6,900',
    credits: 8,
    features: ['별가루 8개 / 매달', '8장 · 12장 동화', '읽어주기 월 5회', '내 서재 무제한 보관'],
    highlight: false,
  },
  {
    id: 'star',
    emoji: '⭐',
    name: '별빛',
    price: '9,900',
    credits: 18,
    features: [
      '별가루 18개 / 매달',
      '8장 · 12장 · 15장 모두',
      '읽어주기 무제한',
      '동요 만들기 월 3곡',
      '연말 인기 랭킹 참여',
    ],
    highlight: true,
  },
];

export default function PlansPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        setCurrentPlan(d.plan || 'free');
        setCredits(Number(d.credits) || 0);
      })
      .catch(() => {});
  }, [user]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <header
        className="relative px-4 pt-8 pb-12 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 100%)',
          borderRadius: '0 0 32px 32px',
        }}
      >
        <span className="star text-xs" style={{ top: '25%', left: '82%' }}>✦</span>
        <span className="star text-[9px]" style={{ top: '55%', left: '8%', animationDelay: '1s' }}>✧</span>
        <div className="max-w-md mx-auto relative">
          <button
            onClick={() => router.back()}
            className="text-sm font-bold mb-3"
            style={{ color: 'var(--lavender)' }}
          >
            ← 돌아가기
          </button>
          <h1 className="font-title text-white text-3xl">✨ 별가루 충전소</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--lavender)' }}>
            별가루로 동화를 만들 수 있어요
          </p>
          {user && (
            <p className="font-title text-lg mt-3" style={{ color: 'var(--star-gold)' }}>
              지금 내 별가루: {credits}개
            </p>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 pb-20">
        <div
          className="rounded-2xl p-4 mb-5 text-center"
          style={{ background: 'var(--lavender-light)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>
            8장 동화 = 별가루 1개 · 12장 = 1.5개 · 15장 = 2개
          </p>
        </div>

        <div className="space-y-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-3xl p-5 relative overflow-hidden"
              style={{
                background: plan.highlight
                  ? 'linear-gradient(135deg, var(--night-deep), var(--night))'
                  : 'white',
                border: plan.highlight ? 'none' : '2px solid #E8E4F4',
                boxShadow: plan.highlight
                  ? '0 8px 28px rgba(43,45,92,0.35)'
                  : '0 4px 16px rgba(61,58,92,0.08)',
              }}
            >
              {plan.highlight && (
                <>
                  <span className="star text-xs" style={{ top: '12%', left: '85%' }}>✦</span>
                  <span
                    className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--star-gold)', color: 'var(--night-deep)' }}
                  >
                    가장 인기
                  </span>
                </>
              )}

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl">{plan.emoji}</span>
                <h2
                  className="font-title text-2xl font-bold"
                  style={{ color: plan.highlight ? 'white' : 'var(--ink)' }}
                >
                  {plan.name}
                </h2>
              </div>
              <p
                className="font-title text-3xl mb-4"
                style={{ color: plan.highlight ? 'var(--star-gold)' : 'var(--ink)' }}
              >
                {plan.price}
                <span className="text-sm"> 원 / 월</span>
              </p>

              <ul className="space-y-2 mb-5">
                {plan.features.map((f, i) => (
                  <li
                    key={i}
                    className="text-xs flex items-center gap-2"
                    style={{ color: plan.highlight ? 'var(--lavender)' : 'var(--ink-soft)' }}
                  >
                    <span style={{ color: 'var(--star-gold)' }}>✦</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  alert('💳 결제 기능은 곧 열려요!\n조금만 기다려주세요 😊')
                }
                disabled={currentPlan === plan.id}
                className="w-full py-3.5 rounded-full font-title text-base font-bold transition-all active:scale-98"
                style={{
                  background:
                    currentPlan === plan.id
                      ? '#E8E4F4'
                      : plan.highlight
                      ? 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))'
                      : 'var(--night)',
                  color:
                    currentPlan === plan.id
                      ? '#B4AFC9'
                      : plan.highlight
                      ? 'var(--night-deep)'
                      : 'white',
                }}
              >
                {currentPlan === plan.id ? '사용 중인 플랜' : `${plan.name} 시작하기`}
              </button>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-center mt-6 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          무료 회원은 가입 시 별가루 2개를 드려요.
          <br />
          구독하면 매달 1일에 별가루가 새로 채워져요.
        </p>
      </main>
    </div>
  );
}