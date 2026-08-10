'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

interface FeedTale {
  id: string;
  title: string;
  cover_image_url: string | null;
  like_count: number;
  view_count: number;
  total_pages: number;
  created_at: string;
}

export default function FeedPage() {
  const router = useRouter();
  const { user, signInWithKakao } = useAuth();
  const [tales, setTales] = useState<FeedTale[]>([]);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'popular' | 'recent'>('popular');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    if (user) loadMyLikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadFeed = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fairytales')
      .select('id, title, cover_image_url, like_count, view_count, total_pages, created_at')
      .eq('is_public', true)
      .eq('status', 'completed')
      .order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
      .limit(50);
    setTales(data || []);
    setLoading(false);
  };

  const loadMyLikes = async () => {
    const { data } = await supabase
      .from('likes')
      .select('fairytale_id')
      .eq('user_id', user!.id);
    setMyLikes(new Set((data || []).map((l) => l.fairytale_id)));
  };

  const toggleLike = async (taleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      if (confirm('좋아요는 로그인이 필요해요! 카카오로 로그인할까요?')) {
        signInWithKakao();
      }
      return;
    }

    if (myLikes.has(taleId)) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('fairytale_id', taleId);
      setMyLikes((prev) => {
        const next = new Set(prev);
        next.delete(taleId);
        return next;
      });
      setTales((prev) =>
        prev.map((t) => (t.id === taleId ? { ...t, like_count: Math.max(t.like_count - 1, 0) } : t))
      );
    } else {
      await supabase.from('likes').insert({ user_id: user.id, fairytale_id: taleId });
      setMyLikes((prev) => new Set(prev).add(taleId));
      setTales((prev) =>
        prev.map((t) => (t.id === taleId ? { ...t, like_count: t.like_count + 1 } : t))
      );
    }
  };

  const openTale = async (taleId: string) => {
    await supabase.rpc('increment_view', { story_id: taleId });
    router.push(`/library/${taleId}`);
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
        <span className="star text-xs" style={{ top: '25%', left: '82%' }}>✦</span>
        <span className="star text-[9px]" style={{ top: '55%', left: '8%', animationDelay: '1s' }}>✧</span>
        <span className="absolute text-xl floaty" style={{ top: '30%', right: '10%' }}>🌙</span>
        <div className="max-w-md mx-auto relative">
          <button
            onClick={() => router.push('/')}
            className="text-sm font-bold mb-3"
            style={{ color: 'var(--lavender)' }}
          >
            ← 처음으로
          </button>
          <h1 className="font-title text-white text-3xl">✨ 친구들의 이야기</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--lavender)' }}>
            꼬마작가들이 만든 동화를 구경해보세요
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 pb-20">
        {/* 정렬 탭 */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setSort('popular')}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: sort === 'popular' ? 'var(--night)' : 'white',
              color: sort === 'popular' ? 'var(--star-gold)' : 'var(--ink-soft)',
              border: '1.5px solid',
              borderColor: sort === 'popular' ? 'var(--night)' : '#E8E4F4',
            }}
          >
            🏆 인기순
          </button>
          <button
            onClick={() => setSort('recent')}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: sort === 'recent' ? 'var(--night)' : 'white',
              color: sort === 'recent' ? 'var(--star-gold)' : 'var(--ink-soft)',
              border: '1.5px solid',
              borderColor: sort === 'recent' ? 'var(--night)' : '#E8E4F4',
            }}
          >
            🌱 최신순
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <span className="text-4xl inline-block floaty">📚</span>
            <p className="font-title text-base mt-2" style={{ color: '#7A6BC4' }}>
              이야기를 모으고 있어요...
            </p>
          </div>
        ) : tales.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-3">🌙</span>
            <p className="font-title text-xl mb-2" style={{ color: 'var(--ink)' }}>
              아직 공개된 이야기가 없어요
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              첫 번째 꼬마작가가 되어보세요!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {tales.map((tale, idx) => (
              <div
                key={tale.id}
                className="rounded-3xl overflow-hidden bg-white cursor-pointer transition-all active:scale-95 relative"
                style={{ boxShadow: '0 4px 16px rgba(61,58,92,0.1)' }}
                onClick={() => openTale(tale.id)}
              >
                {/* 인기 1~3위 뱃지 */}
                {sort === 'popular' && idx < 3 && tale.like_count > 0 && (
                  <span
                    className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded-full"
                    style={{
                      background: idx === 0 ? 'var(--star-gold)' : idx === 1 ? '#D8D8E8' : '#E8B888',
                      color: 'var(--night-deep)',
                    }}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                )}
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
                <div className="p-3">
                  <p className="font-title text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                    {tale.title}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                      {tale.total_pages}장 · 👀 {tale.view_count}
                    </span>
                    <button
                      onClick={(e) => toggleLike(tale.id, e)}
                      className="text-xs font-bold px-2 py-1 rounded-full transition-all active:scale-90"
                      style={{
                        background: myLikes.has(tale.id) ? '#FFE8EC' : '#F4F2FA',
                        color: myLikes.has(tale.id) ? '#E85D75' : 'var(--ink-soft)',
                      }}
                    >
                      {myLikes.has(tale.id) ? '❤️' : '🤍'} {tale.like_count}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}