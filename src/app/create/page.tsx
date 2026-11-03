'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { SEED_STORIES, type SeedStory } from '@/data/seedStories';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';

type Part = { user: string; ai: string };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

const IDEAS = [
  '주인공은 지금 어떤 기분일까요? 왜 그런 기분이 들었을까요?',
  '갑자기 아주 작은 소리가 들렸어요. 어디에서 나는 소리일까요?',
  '주인공 앞에 누가 나타났을까요? 그 친구는 뭐라고 말했을까요?',
  '주인공이 가진 물건 하나에 마법이 생긴다면 무엇을 할 수 있을까요?',
  '누군가 주인공에게 도움을 부탁했어요. 어떻게 도와줄까요?',
  '날씨가 갑자기 바뀌었어요. 무슨 일이 벌어졌을까요?',
];

function Studio() {
  const router = useRouter();
  const params = useSearchParams();
  const storyId = params.get('story');
  const { user, loading: authLoading, signInWithKakao } = useAuth();

  const [seed, setSeed] = useState<SeedStory | null>(null);
  const [total, setTotal] = useState(8);
  const [parts, setParts] = useState<Part[]>([]);
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const [live, setLive] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [idea, setIdea] = useState(-1);
  const [finishing, setFinishing] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  // 초안 불러오기
  useEffect(() => {
    if (authLoading) return;
    if (!storyId) { router.replace('/start'); return; }
    if (!user) { signInWithKakao(`/create?story=${storyId}`).catch(() => setLoadError('로그인이 필요해요.')); return; }
    createClient()
      .from('fairytales')
      .select('id, user_id, seed_story_id, total_pages, status, draft_parts, title')
      .eq('id', storyId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data || data.user_id !== user.id) { setLoadError('이야기를 찾을 수 없어요. 서재에서 다시 열어 주세요.'); return; }
        if (data.status === 'completed') { router.replace(`/story/${storyId}`); return; }
        const s = SEED_STORIES.find(x => x.id === data.seed_story_id) || SEED_STORIES[0];
        setSeed(s);
        setTotal(data.total_pages || 8);
        setParts(Array.isArray(data.draft_parts) ? data.draft_parts : []);
        setTitle(data.title && data.title !== '만들고 있는 이야기' ? data.title : s.title);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, storyId]);

  useEffect(() => () => recRef.current?.abort(), []);

  const persist = useCallback(async (next: Part[], extra: Record<string, unknown> = {}) => {
    if (!storyId) return;
    const { error: e } = await createClient().from('fairytales').update({ draft_parts: next, ...extra }).eq('id', storyId);
    if (e) setError('작성 내용을 저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }, [storyId]);

  const current = parts.length;
  const done = current >= total;
  const isLast = current === total - 1;

  useEffect(() => {
    if (current > 0) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [current]);

  const toggleMic = () => {
    if (recording) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setError('이 브라우저에서는 말하기를 쓸 수 없어요. 크롬이나 사파리에서 열거나 글로 적어 주세요.'); return; }
    setError('');
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    const base = input.trim();
    let finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(`${base} ${finalText}`.trim().slice(0, 1500));
      setLive(interim);
    };
    rec.onend = () => { setRecording(false); setLive(''); };
    rec.onerror = e => {
      setRecording(false);
      setLive('');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('마이크 사용을 허용해 주세요. 주소창 옆 자물쇠 버튼에서 바꿀 수 있어요.');
      else if (e.error !== 'aborted' && e.error !== 'no-speech') setError('말을 잘 듣지 못했어요. 다시 말하거나 글로 적어 주세요.');
    };
    recRef.current = rec;
    try { rec.start(); setRecording(true); } catch { setError('마이크를 켜지 못했어요. 다시 눌러 주세요.'); }
  };

  const write = async () => {
    const said = input.trim();
    if (!said || busy.current || done || !seed) return;
    busy.current = true;
    recRef.current?.stop();
    setWriting(true);
    setError('');
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, context: [seed.preview, ...parts.map(p => p.ai)].join('\n'), input: said, isLastPage: isLast }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) throw new Error(data.error || '문장을 다듬지 못했어요. 다시 눌러 주세요.');
      const next = [...parts, { user: said, ai: data.text }];
      setParts(next);
      setInput('');
      setIdea(-1);
      await persist(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요. 적은 내용은 그대로 남아 있어요.');
    } finally {
      busy.current = false;
      setWriting(false);
    }
  };

  const saveEdit = async () => {
    if (editing === null || !editText.trim()) return;
    const next = parts.map((p, i) => (i === editing ? { ...p, ai: editText.trim() } : p));
    setParts(next);
    setEditing(null);
    await persist(next);
  };

  const undoLast = async () => {
    if (!parts.length || writing) return;
    if (!confirm('마지막 장을 지우고 다시 쓸까요?')) return;
    const last = parts[parts.length - 1];
    const next = parts.slice(0, -1);
    setParts(next);
    setInput(last.user);
    await persist(next);
  };

  const finish = async () => {
    if (!done || finishing) return;
    setFinishing(true);
    await persist(parts, { title: title.trim().slice(0, 70) || seed?.title });
    router.push(`/book?story=${storyId}`);
  };

  if (loadError) {
    return (
      <div className="night-page"><SiteHeader />
        <main className="container"><div className="empty card-night" style={{ marginTop: 50 }}><div className="big">🌙</div><h1 className="title-2">{loadError}</h1><Link href="/library" className="btn btn-gold">내 서재로 가기</Link></div></main>
      </div>
    );
  }
  if (!seed) {
    return <div className="night-page"><SiteHeader /><div className="loading-screen"><div><div className="moon-loader" />작업실을 여는 중이에요…</div></div></div>;
  }

  const hint = isLast
    ? '이야기를 어떻게 끝내고 싶나요? 주인공이 마지막에 하는 말도 들려주세요.'
    : current === 0
      ? seed.firstPrompt
      : '아이의 말을 그대로 적거나, 마이크를 눌러 함께 말해 보세요. 한두 문장이면 충분해요.';
  const question = IDEAS[(Math.max(0, idea) + current) % IDEAS.length];

  return (
    <div className="night-page">
      <SiteHeader authUser={user} />
      <main className="container studio">
        <div className="studio-top">
          <div>
            <span className="eyebrow"><Icon name="pen" size={14} /> 우리 이야기 작업실</span>
            <h1 className="title-2" style={{ marginTop: 6 }}>한 장씩, 아이의 상상을 이어가요</h1>
          </div>
          <Link href="/library" className="btn btn-ghost btn-sm">잠시 나가기</Link>
        </div>

        <div className="studio-layout">
          <aside className="studio-side">
            <div className="studio-seed card-night">
              <span className="seed-theme">이야기의 시작 · {seed.theme}</span>
              <h2>{seed.emoji} {seed.title}</h2>
              <p>{seed.preview}</p>
            </div>
            <div className="studio-progress card-paper">
              <div className="progress-label"><span>우리가 만든 장</span><strong>{current} / {total}장</strong></div>
              <div className="progress-bar" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total} aria-label="동화 작성 진행"><span style={{ width: `${(current / total) * 100}%` }} /></div>
              <div className="progress-stars" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < current ? 'done' : ''}>{i < current ? '★' : i + 1}</i>)}</div>
              <p className="studio-tip">쓴 내용은 자동으로 저장돼요. 나갔다가 서재에서 이어서 만들 수 있어요.</p>
            </div>
          </aside>

          <section className="studio-main" aria-label="동화 작성">
            {parts.map((p, i) => (
              <article className="entry card-paper" key={i}>
                <div className="entry-head">
                  <strong>{i + 1}번째 장</strong>
                  {editing !== i && <button onClick={() => { setEditing(i); setEditText(p.ai); }} disabled={writing || editing !== null}><Icon name="pen" size={13} /> 고치기</button>}
                </div>
                {editing === i ? (
                  <>
                    <textarea className="field" value={editText} onChange={e => setEditText(e.target.value)} maxLength={1200} aria-label={`${i + 1}장 문장 고치기`} />
                    <div className="edit-row">
                      <button className="btn btn-ink btn-sm" onClick={saveEdit} disabled={!editText.trim()}>고친 문장 저장</button>
                      <button className="btn btn-paper btn-sm" onClick={() => setEditing(null)}>취소</button>
                    </div>
                  </>
                ) : (
                  <p className="entry-text">{p.ai}</p>
                )}
                <details><summary>아이가 처음 들려준 말</summary><p>{p.user}</p></details>
              </article>
            ))}

            <div ref={composerRef}>
              {done ? (
                <div className="finish-card card-paper on-paper">
                  <span className="eyebrow"><Icon name="check" size={15} /> {total}장 이야기 완성</span>
                  <h2 className="title-2">이제 우리 책에 이름을 붙여요</h2>
                  <p className="muted">문장을 한 번 더 읽어 보고, 마음에 드는 제목을 지어 주세요. 다음 화면에서 그림이 그려져요.</p>
                  <label htmlFor="book-title">우리 그림책 제목</label>
                  <input id="book-title" className="field" value={title} maxLength={70} onChange={e => setTitle(e.target.value)} />
                  <button className="btn btn-gold btn-lg btn-block" style={{ marginTop: 18 }} onClick={finish} disabled={finishing || editing !== null || !title.trim()}>
                    {finishing ? <><span className="spin" /> 그림책을 펼치는 중…</> : <><Icon name="brush" /> 그림 그리고 책으로 만들기</>}
                  </button>
                  <button className="text-btn" style={{ color: 'var(--ink-3)', marginTop: 10 }} onClick={undoLast}>마지막 장 다시 쓰기</button>
                </div>
              ) : (
                <div className="composer card-paper">
                  <span className="composer-step"><Icon name="pen" size={14} /> {current + 1}번째 장 {isLast && '· 마지막 장'}</span>
                  <h2>{isLast ? '어떤 마지막 장면을 남길까요?' : current ? '그다음엔 무슨 일이 있었나요?' : '첫 번째 상상을 들려주세요'}</h2>
                  <p className="hint">{hint}</p>
                  <textarea
                    className="field"
                    aria-label="아이가 이어서 만든 이야기"
                    placeholder={recording ? '듣고 있어요. 천천히 말해 주세요…' : isLast ? '그래서 마지막에는…' : '그리고 주인공은…'}
                    value={live ? `${input} ${live}`.trim() : input}
                    onChange={e => setInput(e.target.value)}
                    maxLength={1500}
                    disabled={writing || recording}
                  />
                  <div className="composer-tools">
                    <button className={`mic-btn ${recording ? 'on' : ''}`} onClick={toggleMic} disabled={writing} aria-pressed={recording}>
                      <span className="mic-dot"><Icon name="mic" size={16} /></span>
                      {recording ? '다 말했어요' : '말로 들려주기'}
                    </button>
                    <span className="char-count">{input.length} / 1500</span>
                  </div>
                  {error && <div className="notice on-paper" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
                  <button className="btn btn-gold btn-lg btn-block" onClick={write} disabled={!input.trim() || writing || recording || editing !== null}>
                    {writing ? <><span className="spin" /> 요정들이 문장을 다듬고 있어요…</> : <><Icon name="sparkles" /> 이 말로 {current + 1}번째 장 만들기</>}
                  </button>
                  <button className="idea-btn" onClick={() => setIdea(i => i + 1)}><Icon name="sparkles" size={15} /> {idea < 0 ? '생각이 막혔나요? 질문 하나 보기' : '다른 질문 보기'}</button>
                  {idea >= 0 && <p className="idea-text" aria-live="polite">{question}</p>}
                  {current > 0 && <button className="text-btn" style={{ color: 'var(--ink-3)', display: 'block', marginTop: 8 }} onClick={undoLast} disabled={writing}>방금 쓴 장 다시 쓰기</button>}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="night-page"><div className="loading-screen"><div><div className="moon-loader" />작업실을 여는 중이에요…</div></div></div>}>
      <Studio />
    </Suspense>
  );
}
