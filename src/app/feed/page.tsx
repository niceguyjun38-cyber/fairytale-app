'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { BookCard, type BookSummary } from '@/components/BookCard';
import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

const PAGE = 24;

export default function FeedPage() {
  const { user, signInWithKakao } = useAuth();
  const [sort, setSort] = useState<'popular' | 'recent'>('popular');
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const load = async (offset: number, mode = sort) => {
    const supabase = createClient();
    let q = supabase
      .from('fairytales')
      .select('id, title, cover_image_url, like_count, view_count, total_pages')
      .eq('is_public', true)
      .eq('status', 'completed');
    q = mode === 'popular'
      ? q.order('like_count', { ascending: false }).order('completed_at', { ascending: false, nullsFirst: false })
      : q.order('completed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    const { data, error: e } = await q.range(offset, offset + PAGE - 1);
    if (e) { setError('책장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
    setError('');
    setBooks(prev => (offset === 0 ? data || [] : [...(prev || []), ...(data || [])]));
    setMore((data || []).length === PAGE);
  };

  useEffect(() => {
    // load 안의 setState는 응답을 받은 뒤에 실행돼요
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(0, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    if (!user) return;
    createClient().from('likes').select('fairytale_id').eq('user_id', user.id)
      .then(({ data }) => setLikes(new Set((data || []).map(l => l.fairytale_id))));
  }, [user]);

  const toggleLike = async (b: BookSummary) => {
    if (!user) { signInWithKakao('/feed').catch(() => {}); return; }
    const on = !likes.has(b.id); // 로그인 상태에서만 호출돼요
    const apply = (yes: boolean) => {
      setLikes(prev => { const n = new Set(prev); if (yes) n.add(b.id); else n.delete(b.id); return n; });
      setBooks(prev => prev?.map(x => (x.id === b.id ? { ...x, like_count: Math.max(0, x.like_count + (yes ? 1 : -1)) } : x)) ?? null);
    };
    apply(on);
    const supabase = createClient();
    const { error: e } = on
      ? await supabase.from('likes').insert({ user_id: user.id, fairytale_id: b.id })
      : await supabase.from('likes').delete().eq('user_id', user.id).eq('fairytale_id', b.id);
    if (e) apply(!on);
  };

  return (
    <div className="night-page">
      <SiteHeader authUser={user} />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Icon name="heart" size={15} /> 동화마을 책장</span>
            <h1 className="title-1" style={{ marginTop: 8 }}>친구들의 이야기</h1>
            <p className="lead">꼬마작가들이 직접 만든 그림책이에요. 마음에 드는 이야기에 하트를 남겨 주세요.<br />한 해 동안 가장 사랑받은 이야기는 진짜 종이책이 돼요.</p>
          </div>
          <div className="tabs" role="group" aria-label="정렬">
            <button aria-pressed={sort === 'popular'} onClick={() => { if (sort !== 'popular') { setBooks(null); setSort('popular'); } }}>인기순</button>
            <button aria-pressed={sort === 'recent'} onClick={() => { if (sort !== 'recent') { setBooks(null); setSort('recent'); } }}>새로 나온 책</button>
          </div>
        </div>

        {error ? (
          <div className="notice" role="alert" style={{ marginBottom: 60 }}>{error}<button onClick={() => load(0)}>다시 시도</button></div>
        ) : !books ? (
          <div className="loading-screen" style={{ minHeight: '40vh' }}><div><div className="moon-loader" />책장을 정리하는 중…</div></div>
        ) : books.length === 0 ? (
          <div className="empty card-night">
            <div className="big">🌙</div>
            <h2 className="title-2">아직 책장이 비어 있어요</h2>
            <p className="lead">첫 번째로 이야기를 꽂아 줄 꼬마작가를 기다리고 있어요.</p>
            <Link href="/start" className="btn btn-gold btn-lg"><Icon name="sparkles" /> 첫 이야기 만들기</Link>
          </div>
        ) : (
          <>
            <div className="book-grid" style={{ paddingBottom: more ? 20 : 80 }}>
              {books.map((b, i) => (
                <BookCard key={b.id} book={b} href={`/story/${b.id}`} rank={sort === 'popular' && i < 3 && b.like_count > 0 ? i + 1 : undefined} liked={!!user && likes.has(b.id)} onLike={() => toggleLike(b)} />
              ))}
            </div>
            {more && <div style={{ textAlign: 'center', paddingBottom: 80 }}><button className="btn btn-ghost" onClick={() => load(books.length)}>더 보기</button></div>}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
