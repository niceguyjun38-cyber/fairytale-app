'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StoryReader, type ReaderPage } from '@/components/StoryReader';
import { Icon } from '@/components/Icon';
import { SEED_STORIES, type SeedStory } from '@/data/seedStories';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { shareStory } from '@/lib/share';

type Part = { user: string; ai: string };
const PARALLEL = 2;

function Book() {
  const router = useRouter();
  const params = useSearchParams();
  const storyId = params.get('story') || '';
  const { user, loading: authLoading, signInWithKakao } = useAuth();

  const [seed, setSeed] = useState<SeedStory | null>(null);
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [finishOpen, setFinishOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [toast, setToast] = useState('');

  const pagesRef = useRef<ReaderPage[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const started = useRef(false);
  const savingRef = useRef(false);

  const update = useCallback((i: number, patch: Partial<ReaderPage>) => {
    const next = pagesRef.current.map((p, k) => (k === i ? { ...p, ...patch } : p));
    pagesRef.current = next;
    setPages(next);
  }, []);

  const persistImages = useCallback(() => {
    const images = pagesRef.current.map(p => p.imageUrl);
    queue.current = queue.current.then(() => createClient().from('fairytales').update({ draft_images: images }).eq('id', storyId));
  }, [storyId]);

  const finalize = useCallback(async (pub?: boolean) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaveError('');
    try {
      await queue.current;
      const res = await fetch('/api/finish-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, title: pagesRef.current[0]?.text, pages: pagesRef.current.map(p => ({ text: p.text, imageUrl: p.imageUrl })), isPublic: pub }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error && e.message ? e.message : '서재에 저장하지 못했어요.');
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [storyId]);

  const draw = useCallback(async (i: number, s: SeedStory, bookTitle: string) => {
    update(i, { imageState: 'drawing' });
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, pageIndex: i, sceneText: pagesRef.current[i].text, isCover: i === 0, title: bookTitle, seedId: s.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error);
      update(i, { imageUrl: data.url, imageState: 'ready' });
      persistImages();
      // 그림이 모두 완성되면 자동으로 서재에 저장
      if (pagesRef.current.every(p => p.imageState === 'ready')) finalize();
    } catch {
      update(i, { imageState: 'failed' });
    }
  }, [finalize, persistImages, storyId, update]);

  const drawAll = useCallback(async (s: SeedStory, bookTitle: string) => {
    const todo = pagesRef.current.map((p, i) => (p.imageUrl ? -1 : i)).filter(i => i >= 0);
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const i = todo[cursor++];
        await draw(i, s, bookTitle);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker));
  }, [draw]);


  // 초안 불러오기 → 그림 그리기
  useEffect(() => {
    if (authLoading || started.current) return;
    if (!storyId) { router.replace('/library'); return; }
    if (!user) { signInWithKakao(`/book?story=${storyId}`).catch(() => setLoadError('로그인이 필요해요.')); return; }
    started.current = true;
    createClient()
      .from('fairytales')
      .select('id, user_id, title, seed_story_id, total_pages, status, draft_parts, draft_images, is_public')
      .eq('id', storyId)
      .single()
      .then(({ data, error }) => {
        if (error || !data || data.user_id !== user.id) { setLoadError('그림책을 찾을 수 없어요.'); return; }
        if (data.status === 'completed') { router.replace(`/story/${storyId}`); return; }
        const parts: Part[] = Array.isArray(data.draft_parts) ? data.draft_parts : [];
        if (parts.length < (data.total_pages || 8)) { router.replace(`/create?story=${storyId}`); return; }
        const s = SEED_STORIES.find(x => x.id === data.seed_story_id) || SEED_STORIES[0];
        const images: (string | null)[] = Array.isArray(data.draft_images) ? data.draft_images : [];
        const bookTitle = data.title || s.title;
        const list: ReaderPage[] = [
          { tag: '표지', text: bookTitle },
          { tag: '이야기의 시작', text: s.preview },
          ...parts.map((p, i) => ({ tag: `${i + 1}번째 장`, text: p.ai })),
        ].map((p, i) => ({ ...p, imageUrl: images[i] || null, imageState: images[i] ? 'ready' : 'waiting' }));
        pagesRef.current = list;
        setSeed(s);
        setTitle(bookTitle);
        setIsPublic(!!data.is_public);
        setPages(list);
        if (list.every(p => p.imageUrl)) finalize();
        else drawAll(s, bookTitle);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, storyId]);

  const drawn = pages.filter(p => p.imageState === 'ready').length;
  const failed = pages.filter(p => p.imageState === 'failed').length;
  const pending = pages.length - drawn - failed;

  const retry = (i: number) => seed && draw(i, seed, title);
  const retryAll = () => seed && pages.forEach((p, i) => p.imageState === 'failed' && draw(i, seed, title));

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2600); };

  const togglePublic = async () => {
    const next = !isPublic;
    if (!saved) { const ok = await finalize(next); if (ok) setIsPublic(next); return; }
    const { error } = await createClient().from('fairytales').update({ is_public: next }).eq('id', storyId);
    if (error) { flash('공개 설정을 바꾸지 못했어요.'); return; }
    setIsPublic(next);
    flash(next ? '친구들 책장에 꽂았어요!' : '나만 보는 책으로 바꿨어요.');
  };

  if (loadError) {
    return (
      <div className="night-page"><main className="container"><div className="empty card-night" style={{ marginTop: 60 }}><div className="big">🌙</div><h1 className="title-2">{loadError}</h1><Link href="/library" className="btn btn-gold">내 서재로 가기</Link></div></main></div>
    );
  }
  if (!seed || !pages.length) {
    return <div className="night-page"><div className="loading-screen"><div><div className="moon-loader" />그림책을 펼치는 중이에요…</div></div></div>;
  }

  const status = pending > 0
    ? <><span className="spin" /> 요정 화가가 그림을 그리고 있어요 · {drawn} / {pages.length}장 (먼저 읽어 보셔도 돼요)</>
    : failed > 0
      ? <>그림 {failed}장을 그리지 못했어요. <button className="text-btn" style={{ color: 'var(--moon)', textDecoration: 'underline' }} onClick={retryAll}>다시 그리기</button> 또는 <button className="text-btn" style={{ color: 'var(--moon)', textDecoration: 'underline' }} onClick={() => finalize()}>그대로 저장</button></>
      : saved
        ? <><Icon name="check" size={15} /> 그림책 완성! 내 서재에 저장했어요.</>
        : saveError
          ? <>{saveError} <button className="text-btn" style={{ color: 'var(--moon)', textDecoration: 'underline' }} onClick={() => finalize()}>다시 저장</button></>
          : <><span className="spin" /> 서재에 꽂는 중…</>;

  return (
    <>
      <StoryReader
        title={title}
        emoji={seed.emoji}
        storyId={storyId}
        pages={pages}
        closeHref="/library"
        closeLabel="서재로 가기"
        status={status}
        onRetryImage={retry}
        onFinished={() => setFinishOpen(true)}
        actions={<button className="btn btn-ghost" onClick={() => setFinishOpen(true)}><Icon name="check" size={18} /> 완성!</button>}
      />
      {finishOpen && (
        <div className="overlay" onClick={() => setFinishOpen(false)}>
          <div className="sheet card-paper done-card" role="dialog" aria-modal="true" aria-labelledby="done-title" onClick={e => e.stopPropagation()}>
            <div className="sheet-head"><span /><button className="sheet-close" onClick={() => setFinishOpen(false)} aria-label="닫기"><Icon name="close" size={18} /></button></div>
            {pages[0].imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="cover-thumb" src={pages[0].imageUrl} alt="" />
              : <div style={{ fontSize: '3rem' }}>📖</div>}
            <h2 id="done-title" className="title-2 on-paper" style={{ color: 'var(--ink)' }}>「{title}」 완성!</h2>
            <p className="sheet-sub" style={{ marginTop: 6 }}>
              {pending > 0 ? '그림이 다 그려지면 서재에 자동으로 저장돼요.' : saved ? '서재에 저장됐어요. 언제든 다시 꺼내 읽을 수 있어요.' : '서재에 저장하고 있어요.'}
            </p>
            <div className="toggle-row">
              <div><strong>친구들 책장에 공개하기</strong><small>공개하면 다른 꼬마작가들이 읽고 좋아요를 남길 수 있어요</small></div>
              <button className="switch" role="switch" aria-checked={isPublic} aria-label="공개하기" onClick={togglePublic} disabled={pending > 0} />
            </div>
            <div className="stack">
              <button className="btn btn-ink btn-block" disabled={!saved} onClick={() => (isPublic ? shareStory(storyId, title).then(r => r && flash(r)) : flash('공개를 켜야 링크를 받은 분도 읽을 수 있어요.'))}><Icon name="share" size={18} /> 할머니께 보내기 (링크 공유)</button>
              <Link href="/library" className="btn btn-paper btn-block"><Icon name="library" size={18} /> 내 서재로 가기</Link>
              <Link href="/start" className="btn btn-paper btn-block"><Icon name="sparkles" size={18} /> 새 이야기 만들기</Link>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="night-page"><div className="loading-screen"><div><div className="moon-loader" />그림책을 펼치는 중이에요…</div></div></div>}>
      <Book />
    </Suspense>
  );
}
