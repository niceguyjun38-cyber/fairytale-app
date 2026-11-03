'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StoryReader, type ReaderPage } from '@/components/StoryReader';
import { Icon } from '@/components/Icon';
import { SEED_STORIES } from '@/data/seedStories';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { shareStory } from '@/lib/share';

type Tale = { id: string; title: string; user_id: string; is_public: boolean; like_count: number; seed_story_id: number; status: string };

export function StoryView({ id }: { id: string }) {
  const { user, loading, signInWithKakao } = useAuth();
  const [tale, setTale] = useState<Tale | null>(null);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [toast, setToast] = useState('');
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    const supabase = createClient();
    (async () => {
      const { data: t } = await supabase.from('fairytales').select('id, title, user_id, is_public, like_count, seed_story_id, status').eq('id', id).maybeSingle();
      if (!t || t.status !== 'completed') {
        if (t && t.user_id === user?.id) { window.location.replace(`/create?story=${id}`); return; }
        setError(user ? '이 그림책은 지금 볼 수 없어요. 작가가 비공개로 바꿨을 수 있어요.' : '이 그림책을 보려면 로그인이 필요하거나, 비공개로 바뀐 책이에요.');
        return;
      }
      const { data: p, error: pe } = await supabase.from('pages').select('page_number, ai_text, image_url').eq('fairytale_id', id).order('page_number');
      if (pe || !p?.length) { setError('그림책 페이지를 불러오지 못했어요.'); return; }
      setTale(t);
      setPages(p.map((row, i) => ({ tag: i === 0 ? '표지' : i === 1 ? '이야기의 시작' : `${i - 1}번째 장`, text: row.ai_text, imageUrl: row.image_url, imageState: row.image_url ? 'ready' : 'failed' })));
      if (t.is_public && t.user_id !== user?.id) supabase.rpc('increment_view', { story_id: id }).then(() => {}, () => {});
      if (user) {
        const { data: l } = await supabase.from('likes').select('id').eq('user_id', user.id).eq('fairytale_id', id).maybeSingle();
        setLiked(!!l);
      }
    })().catch(() => setError('그림책을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }, [id, loading, user]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600); };

  const toggleLike = async () => {
    if (!tale) return;
    if (!user) { signInWithKakao().catch(() => {}); return; }
    const supabase = createClient();
    const next = !liked;
    setLiked(next);
    setTale({ ...tale, like_count: Math.max(0, tale.like_count + (next ? 1 : -1)) });
    const { error: e } = next
      ? await supabase.from('likes').insert({ user_id: user.id, fairytale_id: id })
      : await supabase.from('likes').delete().eq('user_id', user.id).eq('fairytale_id', id);
    if (e) { setLiked(!next); setTale(tale); flash('좋아요를 남기지 못했어요.'); }
  };

  if (error) {
    return (
      <div className="night-page"><main className="container"><div className="empty card-night" style={{ marginTop: 60 }}>
        <div className="big">🌙</div><h1 className="title-2">{error}</h1>
        <div className="stack" style={{ marginTop: 20 }}>
          {!user && <button className="kakao-btn lg" onClick={() => signInWithKakao().catch(() => {})}>카카오로 로그인</button>}
          <Link href="/feed" className="btn btn-ghost">친구들 이야기 둘러보기</Link>
        </div>
      </div></main></div>
    );
  }
  if (!tale) return <div className="night-page"><div className="loading-screen"><div><div className="moon-loader" />그림책을 펼치는 중이에요…</div></div></div>;

  const seed = SEED_STORIES.find(s => s.id === tale.seed_story_id) || SEED_STORIES[0];
  const mine = user?.id === tale.user_id;

  return (
    <>
      <StoryReader
        title={tale.title}
        emoji={seed.emoji}
        storyId={id}
        pages={pages}
        closeHref={mine ? '/library' : '/feed'}
        closeLabel={mine ? '서재로 가기' : '책장으로 가기'}
        onFinished={() => setEndOpen(true)}
        actions={
          <>
            <button className={`btn btn-ghost ${liked ? 'listen-btn' : ''}`} onClick={toggleLike} aria-pressed={liked}>
              <Icon name="heart" size={18} filled={liked} /> {tale.like_count}
            </button>
            {tale.is_public && <button className="btn btn-ghost" onClick={() => shareStory(id, tale.title).then(r => r && flash(r))}><Icon name="share" size={18} /> 공유</button>}
          </>
        }
      />
      {endOpen && (
        <div className="overlay" onClick={() => setEndOpen(false)}>
          <div className="sheet card-paper done-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="sheet-head"><span /><button className="sheet-close" onClick={() => setEndOpen(false)} aria-label="닫기"><Icon name="close" size={18} /></button></div>
            <div style={{ fontSize: '2.6rem' }}>🌙</div>
            <h2 className="title-2" style={{ color: 'var(--ink)', margin: '8px 0' }}>끝까지 읽었어요!</h2>
            <p className="sheet-sub">{mine ? '오늘도 멋진 이야기를 만들었어요. 다음 이야기도 기대할게요.' : '마음에 들었다면 작가에게 좋아요를 남겨 주세요.'}</p>
            <div className="stack">
              {!mine && <button className="btn btn-ink btn-block" onClick={() => { toggleLike(); setEndOpen(false); }}><Icon name="heart" size={18} filled={liked} /> {liked ? '좋아요 남겼어요' : '좋아요 남기기'}</button>}
              <Link href="/start" className="btn btn-gold btn-block"><Icon name="sparkles" size={18} /> 우리 아이 동화도 만들기</Link>
              <Link href={mine ? '/library' : '/feed'} className="btn btn-paper btn-block">{mine ? '내 서재로' : '다른 이야기 읽기'}</Link>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
