'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

interface Fairytale {
  id: string;
  title: string;
  cover_image_url: string | null;
  is_public: boolean;
  like_count: number;
  total_pages: number;
  created_at: string;
}

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tales, setTales] = useState<Fairytale[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    loadTales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadTales = async () => {
    const { data } = await supabase
      .from('fairytales')
      .select('*')
      .eq('user_id', user!.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    setTales(data || []);
    setLoading(false);
  };

  const togglePublic = async (tale: Fairytale) => {
    await supabase
      .from('fairytales')
      .update({ is_public: !tale.is_public })
      .eq('id', tale.id);
    loadTales();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* 헤더 */}
      <header
        className="relative px-4 pt-8 pb-12 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 100%)',
          borderRadius: '0 0 32px 32px',
        }}
      >
        <span className="star text-xs" style={{ top: '25%', left: '80%' }}>✦</span>
        <span className="star text-[9px]" style={{ top: '55%', left: '10%', animationDelay: '1s' }}>✧</span>
        <div className="max-w-md mx-auto relative">
          <button
            onClick={() => router.push('/')}
            className="text-sm font-bold mb-3"
            style={{ color: 'var(--lavender)' }}
          >
            ← 처음으로
          </button>
          <h1 className="font-title text-white text-3xl">📚 내 서재</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--lavender)' }}>
            내가 만든 이야기들이 잠들어 있는 곳
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 pb-20">
        {loading ? (
          <div className="text-center py-16">
            <span className="text-4xl inline-block floaty">📖</span>
            <p className="font-title text-base mt-2" style={{ color: '#7A6BC4' }}>
              서재를 열고 있어요...
            </p>
          </div>
        ) : tales.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-3">🌱</span>
            <p className="font-title text-xl mb-2" style={{ color: 'var(--ink)' }}>
              아직 이야기가 없어요
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--ink-soft)' }}>
              첫 번째 동화를 만들어볼까요?
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3.5 rounded-full font-title text-base font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))',
                color: 'var(--night-deep)',
              }}
            >
              ✨ 동화 만들러 가기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {tales.map((tale) => (
              <div
                key={tale.id}
                className="rounded-3xl overflow-hidden bg-white"
                style={{ boxShadow: '0 4px 16px rgba(61,58,92,0.1)' }}
              >
                <button
                  onClick={() => router.push(`/library/${tale.id}`)}
                  className="w-full"
                >
                  <div
                    className="w-full aspect-square flex items-center justify-center"
                    style={{ background: 'var(--lavender-light)' }}
                  >
                    {tale.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tale.cover_image_url}
                        alt={tale.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">📖</span>
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <p className="font-title text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                      {tale.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {tale.total_pages}장 · ❤️ {tale.like_count}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => togglePublic(tale)}
                  className="w-full py-2 text-[11px] font-bold border-t"
                  style={{
                    borderColor: '#F0EDF8',
                    color: tale.is_public ? '#E8A020' : '#9A94B8',
                    background: tale.is_public ? '#FFF8E8' : 'white',
                  }}
                >
                  {tale.is_public ? '🌟 공개 중' : '🔒 나만 보기'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}