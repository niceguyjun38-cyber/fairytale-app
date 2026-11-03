'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { BookCard } from '@/components/BookCard';
import { Icon, KakaoIcon } from '@/components/Icon';
import { SEED_STORIES } from '@/data/seedStories';
import { createClient } from '@/lib/supabase';
import { useAuth, useWallet } from '@/lib/useAuth';
import { shareStory } from '@/lib/share';

type Row = {
  id: string; title: string; cover_image_url: string | null; is_public: boolean; like_count: number; view_count: number;
  total_pages: number; status: string; seed_story_id: number; draft_parts: unknown[] | null; created_at: string;
};

export default function LibraryPage() {
  const { user, loading, signInWithKakao } = useAuth();
  const { wallet } = useWallet(user);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('fairytales')
      .select('id, title, cover_image_url, is_public, like_count, view_count, total_pages, status, seed_story_id, draft_parts, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => (e ? setError('서재를 불러오지 못했어요.') : setRows((data as Row[]) || [])));
  }, [user]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600); };

  const togglePublic = async (r: Row) => {
    const next = !r.is_public;
    setRows(list => list?.map(x => (x.id === r.id ? { ...x, is_public: next } : x)) ?? null);
    const { error: e } = await createClient().from('fairytales').update({ is_public: next }).eq('id', r.id);
    if (e) { setRows(list => list?.map(x => (x.id === r.id ? { ...x, is_public: !next } : x)) ?? null); flash('공개 설정을 바꾸지 못했어요.'); return; }
    flash(next ? '친구들 책장에 꽂았어요!' : '나만 보는 책으로 바꿨어요.');
  };

  const remove = async (r: Row) => {
    if (!confirm(`「${r.title}」을(를) 서재에서 지울까요? 지운 책은 되돌릴 수 없어요.`)) return;
    const { error: e } = await createClient().from('fairytales').delete().eq('id', r.id);
    if (e) { flash('지우지 못했어요. 다시 시도해 주세요.'); return; }
    setRows(list => list?.filter(x => x.id !== r.id) ?? null);
  };

  const books = rows?.filter(r => r.status === 'completed') ?? [];
  const drafts = rows?.filter(r => r.status !== 'completed') ?? [];

  return (
    <div className="night-page">
      <SiteHeader credits={wallet?.credits ?? null} authUser={user} />
      <main className="container">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Icon name="library" size={15} /> 내 서재</span>
            <h1 className="title-1" style={{ marginTop: 8 }}>우리 아이가 쓴 책들</h1>
            <p className="lead">만든 그림책은 여기에 차곡차곡 쌓여요. 언제든 다시 꺼내 읽고 들을 수 있어요.</p>
          </div>
          {user && <Link href="/start" className="btn btn-gold"><Icon name="sparkles" size={18} /> 새 이야기 만들기</Link>}
        </div>

        {!loading && !user ? (
          <div className="empty card-night">
            <div className="big">📚</div>
            <h2 className="title-2">로그인하면 서재가 열려요</h2>
            <p className="lead">카카오로 로그인하고 첫 그림책을 만들어 보세요. 별가루 2개를 선물로 드려요.</p>
            <button className="kakao-btn lg" style={{ marginTop: 22 }} onClick={() => signInWithKakao('/library').catch(() => {})}><KakaoIcon /> 카카오로 시작하기</button>
          </div>
        ) : error ? (
          <div className="notice" role="alert" style={{ marginBottom: 60 }}>{error}</div>
        ) : !rows ? (
          <div className="loading-screen" style={{ minHeight: '40vh' }}><div><div className="moon-loader" />서재 문을 여는 중…</div></div>
        ) : (
          <>
            {drafts.length > 0 && (
              <section aria-label="만들던 이야기">
                <h2 className="title-3" style={{ marginBottom: 12 }}>만들던 이야기</h2>
                <div className="draft-list">
                  {drafts.map(d => {
                    const seed = SEED_STORIES.find(s => s.id === d.seed_story_id) || SEED_STORIES[0];
                    const written = Array.isArray(d.draft_parts) ? d.draft_parts.length : 0;
                    const ready = written >= d.total_pages;
                    return (
                      <div key={d.id} className="draft-row card-night">
                        <span className="d-emoji" aria-hidden="true">{seed.emoji}</span>
                        <div>
                          <strong>{d.title === '만들고 있는 이야기' ? seed.title : d.title}</strong>
                          <small>{ready ? '이야기 완성 · 그림을 기다려요' : `${written} / ${d.total_pages}장까지 썼어요`}</small>
                        </div>
                        <Link href={ready ? `/book?story=${d.id}` : `/create?story=${d.id}`} className="btn btn-gold btn-sm">
                          {ready ? '그림책 완성하기' : '이어서 쓰기'}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {books.length === 0 ? (
              drafts.length === 0 && (
                <div className="empty card-night">
                  <div className="big">🌱</div>
                  <h2 className="title-2">아직 서재가 비어 있어요</h2>
                  <p className="lead">오늘 밤, 첫 번째 그림책을 만들어 볼까요?</p>
                  <Link href="/start" className="btn btn-gold btn-lg"><Icon name="sparkles" /> 첫 동화 만들기</Link>
                </div>
              )
            ) : (
              <div className="book-grid">
                {books.map(b => (
                  <BookCard key={b.id} book={b} href={`/story/${b.id}`} badge={b.is_public ? '공개' : '나만 보기'}>
                    <div className="book-actions">
                      <button className={b.is_public ? 'public' : ''} onClick={() => togglePublic(b)}>
                        {b.is_public ? '공개 중' : '공개하기'}
                      </button>
                      <button onClick={() => (b.is_public ? shareStory(b.id, b.title).then(r => r && flash(r)) : flash('공개해야 링크로 보여줄 수 있어요.'))}>공유</button>
                      <button className="danger" onClick={() => remove(b)}>지우기</button>
                    </div>
                  </BookCard>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
