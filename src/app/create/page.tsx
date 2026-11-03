'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SEED_STORIES, PAGE_OPTIONS } from '@/data/seedStories';
import { SiteHeader } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

type StoryPart = { user: string; ai: string };
type SpeechResult = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
const PROMPTS = [
  '주인공은 지금 어떤 기분일까요? 왜 그런 기분이 들었을까요?',
  '갑자기 아주 작은 소리가 들렸어요. 어디에서 나는 소리일까요?',
  '주인공이 가진 물건 하나에 마법이 생긴다면 무엇을 할 수 있을까요?',
  '누군가 주인공에게 도움을 부탁한다면, 어떻게 도와줄까요?',
  '이곳에 딱 하나의 규칙을 만든다면 어떤 규칙이 좋을까요?',
];
const FIRST_PROMPTS: Record<number, string> = {
  1: '곰이 오두막 문을 열었을 때, 앞에 무엇이 놓여 있었을까요?',
  2: '손바닥 위의 별이 처음 건넨 말은 무엇이었을까요?',
  3: '마법의 빵을 한 입 먹고, 어떤 소원을 빌고 싶나요?',
  4: '구름 위 친구는 무지개를 무엇으로 만들고 있었을까요?',
  5: '물고기를 따라간 바다 마을에는 어떤 집이 있었을까요?',
  6: '로켓 안에서 인사를 건넨 건 누구였을까요?',
};

function CreateContent() {
  const router = useRouter();
  const params = useSearchParams();
  const seed = SEED_STORIES.find(s => s.id === Number(params.get('seed'))) || SEED_STORIES[0];
  const requestedPages = Number(params.get('pages'));
  const totalPages = PAGE_OPTIONS.some(p => p.count === requestedPages) ? requestedPages : 8;
  const [storyParts, setStoryParts] = useState<StoryPart[]>([]);
  const [input, setInput] = useState('');
  const [title, setTitle] = useState(seed.title);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [hintIndex, setHintIndex] = useState(-1);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const submitRef = useRef(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const currentPage = storyParts.length;
  const isDone = currentPage >= totalPages;
  const isLastPage = currentPage === totalPages - 1;

  useEffect(() => () => { recognitionRef.current?.abort(); }, []);
  useEffect(() => {
    if (currentPage > 0) composerRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  }, [currentPage]);

  const toggleMic = () => {
    if (loading) return;
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) { setError('이 브라우저에서는 말하기를 사용할 수 없어요. 글로 입력하거나 음성 인식을 지원하는 브라우저를 이용해 주세요.'); return; }
    setError('');
    const recognition = new SR();
    recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = event => {
      const said = event.results[0][0].transcript.trim();
      setInput(previous => `${previous.trim()} ${said}`.trim().slice(0, 1500));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = event => {
      setIsRecording(false);
      if (event.error !== 'aborted') setError(event.error === 'not-allowed' ? '마이크 사용 권한을 허용해 주세요. 글로 입력해도 괜찮아요.' : '말을 잘 듣지 못했어요. 다시 말하거나 글로 적어 주세요.');
    };
    recognitionRef.current = recognition;
    try { recognition.start(); setIsRecording(true); }
    catch { setError('마이크를 시작하지 못했어요. 다시 시도해 주세요.'); }
  };

  const handleContinue = async () => {
    if (!input.trim() || submitRef.current || isDone || editingIdx !== null) return;
    submitRef.current = true; setLoading(true); setError('');
    recognitionRef.current?.stop(); setIsRecording(false);
    const original = input.trim();
    try {
      const res = await fetch('/api/story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: `${seed.preview} ${storyParts.map(p => p.ai).join(' ')}`, input: original, isLastPage }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.text !== 'string' || !data.text.trim()) throw new Error(data.error || '문장을 다듬지 못했어요. 다시 시도해 주세요.');
      setStoryParts(previous => [...previous, { user: original, ai: data.text }]);
      setInput(''); setHintIndex(-1);
    } catch (e) { setError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요. 입력한 이야기는 그대로 남아 있어요.'); }
    finally { setLoading(false); submitRef.current = false; }
  };

  const saveEdit = () => {
    if (editingIdx === null || !editText.trim()) return;
    setStoryParts(previous => previous.map((part, i) => i === editingIdx ? { ...part, ai: editText.trim() } : part));
    setEditingIdx(null);
  };
  const handleFinish = () => {
    if (!isDone || editingIdx !== null || loading) return;
    try {
      sessionStorage.setItem('completedStory', JSON.stringify({ seedId: seed.id, title: title.trim() || seed.title, totalPages: storyParts.length, parts: storyParts }));
      router.push('/book');
    } catch { setError('브라우저에 이야기를 전달하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.'); }
  };
  const leaveStudio = () => {
    if ((storyParts.length || input.trim()) && !confirm('아직 그림책으로 완성하지 않은 이야기가 있어요. 나가면 작성 내용이 사라져요. 처음으로 돌아갈까요?')) return;
    router.push('/');
  };
  const hint = isLastPage ? '이야기를 어떻게 끝내고 싶나요? 주인공이 마지막으로 하는 말도 들려주세요.' : hintIndex === 0 && currentPage === 0 ? FIRST_PROMPTS[seed.id] : PROMPTS[(Math.max(0, hintIndex) + currentPage) % PROMPTS.length];

  return <><SiteHeader/><main className="studio">
    <div className="studio-top"><div><h1>우리 이야기 작업실</h1><p>아이의 상상을 한 장씩 이어가요.</p></div><button className="button-secondary" onClick={leaveStudio}><Icon name="back" size={16}/> 처음으로</button></div>
    <div className="studio-layout">
      <aside className="studio-sidebar"><div className="studio-seed"><span>이야기의 시작</span><h2>{seed.emoji} {seed.title}</h2><p>{seed.preview}</p></div><div className="studio-progress"><div className="progress-caption"><span>우리가 만든 이야기</span><strong>{currentPage} / {totalPages}장</strong></div><div className="progress-track" role="progressbar" aria-label="동화 작성 진행" aria-valuenow={currentPage} aria-valuemin={0} aria-valuemax={totalPages}><span style={{ width: `${currentPage / totalPages * 100}%` }}/></div><div className="progress-steps" aria-hidden="true">{Array.from({ length: totalPages }, (_, i) => <span key={i} className={i < currentPage ? 'done' : ''}>{i < currentPage ? <Icon name="check" size={13}/> : i + 1}</span>)}</div><p className="studio-help">정답은 없어요. 엉뚱한 생각도, 짧은 한마디도 멋진 이야기의 재료예요.</p></div></aside>
      <section className="studio-content" aria-label="동화 작성">
        {storyParts.map((part, i) => <article className="story-entry" key={i}><div className="entry-top"><strong>{String(i + 1).padStart(2, '0')} 번째 장</strong><button onClick={() => { setEditingIdx(i); setEditText(part.ai); }} disabled={loading || editingIdx !== null}><Icon name="pen" size={14}/> 문장 고치기</button></div>{editingIdx === i ? <><textarea className="entry-editor" aria-label={`${i + 1}장 문장 수정`} value={editText} onChange={e => setEditText(e.target.value)} maxLength={1500}/><div className="edit-actions"><button className="button-primary" onClick={saveEdit} disabled={!editText.trim()}>수정 완료</button><button className="button-secondary" onClick={() => setEditingIdx(null)}>취소</button></div></> : <p>{part.ai}</p>}<details className="story-original"><summary>아이가 처음 들려준 말</summary><p>{part.user}</p></details></article>)}
        <div ref={composerRef}>
          {isDone ? <div className="finish-panel"><p className="eyebrow"><Icon name="check"/> {totalPages}장 이야기 완성</p><h2>이제 우리 책에 이름을 붙여요.</h2><p>문장을 한 번 더 읽어보고, 마음에 드는 제목을 지어 주세요.</p><label htmlFor="book-title">우리 동화의 제목</label><input id="book-title" value={title} maxLength={70} onChange={e => setTitle(e.target.value)}/><button className="button-primary" onClick={handleFinish} disabled={editingIdx !== null}><Icon name="book"/> 그림책 완성하기</button></div> : <div className="composer"><div className="composer-label"><Icon name="pen" size={18}/> {currentPage + 1}번째 장을 만들어요</div><h2>{isLastPage ? '어떤 마지막 장면을 남길까요?' : currentPage ? '그다음에는 무슨 일이 있었나요?' : '첫 번째 상상을 들려주세요.'}</h2><p className="composer-intro">아이의 말을 적거나, 마이크를 눌러 함께 말해 보세요.</p><textarea aria-label="아이가 이어서 만든 이야기" className="composer-input" placeholder={isLastPage ? '주인공은 마지막에…' : '그리고 주인공은…'} value={input} onChange={e => setInput(e.target.value)} maxLength={1500} disabled={loading}/><div className="composer-tools"><button className={`mic-button ${isRecording ? 'is-recording' : ''}`} onClick={toggleMic} disabled={loading} aria-pressed={isRecording}><Icon name="mic" size={18}/>{isRecording ? '듣고 있어요 · 멈추기' : '말로 들려주기'}</button><span>한두 문장부터 시작해도 좋아요.</span></div><button className="button-primary" onClick={handleContinue} disabled={!input.trim() || loading || isRecording || editingIdx !== null}><Icon name="sparkles"/>{loading ? '아이의 말로 문장을 다듬고 있어요…' : '이 말로 한 장 완성하기'}</button><div className="idea-prompt"><button onClick={() => setHintIndex(i => i + 1)}><Icon name="sparkles" size={16}/>{hintIndex < 0 ? '생각이 막혔나요? 질문 하나 보기' : '다른 질문 보기'}</button>{hintIndex >= 0 && <p aria-live="polite">{hint}</p>}</div></div>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {loading && <p role="status" className="dialog-caption">작성한 이야기를 다듬고 있어요. 잠시만 기다려 주세요.</p>}
        </div>
      </section>
    </div>
  </main></>;
}
export default function CreatePage() { return <Suspense fallback={<p className="studio" role="status">작업실을 열고 있어요…</p>}><CreateContent/></Suspense>; }
