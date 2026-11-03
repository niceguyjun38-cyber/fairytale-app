'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { VOICES, type VoiceId } from '@/data/seedStories';
import { Icon } from './Icon';

export type ReaderPage = {
  tag: string;
  text: string;
  imageUrl: string | null;
  imageState?: 'waiting' | 'drawing' | 'ready' | 'failed';
};

type Props = {
  title: string;
  emoji: string;
  storyId: string;
  pages: ReaderPage[];
  closeHref: string;
  closeLabel?: string;
  status?: ReactNode;
  actions?: ReactNode;
  onRetryImage?: (index: number) => void;
  onFinished?: () => void;
  canListen?: boolean;
  onNeedLogin?: () => void;
};

const VOICE_KEY = 'dh:voice';

// iOS 사파리는 사용자가 누른 순간에 소리를 한 번 재생해야 이후 자동 재생이 돼요.
let silentUrl: string | null = null;
function silentWav() {
  if (silentUrl) return silentUrl;
  const n = 200;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

function ensureAudio(ref: { current: HTMLAudioElement | null }) {
  if (!ref.current) ref.current = new Audio();
  return ref.current;
}
function load(audio: HTMLAudioElement, src: string, onEnd?: () => void) {
  audio.src = src;
  audio.onended = onEnd ?? null;
  return audio.play();
}
function savedVoice(): VoiceId | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(VOICE_KEY);
    return v && VOICES.some(x => x.id === v) ? (v as VoiceId) : null;
  } catch {
    return null;
  }
}

export function StoryReader({ title, emoji, storyId, pages, closeHref, closeLabel = '닫기', status, actions, onRetryImage, onFinished, canListen = true, onNeedLogin }: Props) {
  const [idx, setIdx] = useState(0);
  const [voice, setVoice] = useState<VoiceId | null>(savedVoice);
  const [sheet, setSheet] = useState<'voice' | 'words' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const autoRef = useRef(false);
  const runRef = useRef(0);
  const pagesRef = useRef(pages);
  const cache = useRef(new Map<string, Promise<string | null>>());
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  const playRef = useRef<(v: VoiceId, i: number) => void>(() => {});
  useEffect(() => {
    const auto = autoRef;
    const main = audioRef;
    const prev = previewRef;
    return () => {
      auto.current = false;
      main.current?.pause();
      prev.current?.pause();
    };
  }, []);

  const flash = useCallback((m: string) => {
    setMessage(m);
    window.setTimeout(() => setMessage(''), 2800);
  }, []);

  const audioFor = useCallback((v: VoiceId, i: number) => {
    const page = pagesRef.current[i];
    if (!page) return Promise.resolve(null);
    const key = `${v}|${i}|${page.text}`;
    let p = cache.current.get(key);
    if (!p) {
      p = fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, pageIndex: i, text: page.text, voice: v }),
      })
        .then(async r => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok || !d.url) throw new Error(d.error || '목소리를 만들지 못했어요.');
          return d.url as string;
        })
        .catch(e => {
          cache.current.delete(key);
          throw e;
        });
      cache.current.set(key, p);
    }
    return p;
  }, [storyId]);

  const stop = useCallback(() => {
    autoRef.current = false;
    runRef.current++;
    audioRef.current?.pause();
    setPlaying(false);
    setPreparing(false);
  }, []);

  const playFrom = useCallback(async (v: VoiceId, i: number) => {
    const run = ++runRef.current;
    const list = pagesRef.current;
    if (i >= list.length) {
      stop();
      onFinished?.();
      return;
    }
    setIdx(i);
    setPreparing(true);
    let url: string | null = null;
    try {
      url = await audioFor(v, i);
    } catch (e) {
      if (run !== runRef.current) return;
      stop();
      flash(e instanceof Error ? e.message : '목소리를 만들지 못했어요.');
      return;
    }
    if (run !== runRef.current || !url) return;
    audioFor(v, i + 1).catch(() => {});
    setPreparing(false);
    try {
      await load(ensureAudio(audioRef), url, () => {
        if (run !== runRef.current) return;
        if (autoRef.current) window.setTimeout(() => run === runRef.current && playRef.current(v, i + 1), 550);
        else setPlaying(false);
      });
      setPlaying(true);
    } catch {
      stop();
      flash('소리를 켤 수 없어요. 한 번 더 눌러 주세요.');
    }
  }, [audioFor, flash, onFinished, stop]);
  useEffect(() => { playRef.current = playFrom; }, [playFrom]);

  const startListening = (v: VoiceId) => {
    previewRef.current?.pause();
    setPreviewing(null);
    setVoice(v);
    try { localStorage.setItem(VOICE_KEY, v); } catch {}
    setSheet(null);
    // 사용자가 누른 순간 오디오를 깨워 둬요 (iOS)
    load(ensureAudio(audioRef), silentWav()).catch(() => {});
    autoRef.current = true;
    playFrom(v, idx);
  };

  const preview = async (v: VoiceId) => {
    previewRef.current?.pause();
    if (previewing === v) { setPreviewing(null); return; }
    setPreviewing(v);
    const a = ensureAudio(previewRef);
    load(a, silentWav()).catch(() => {});
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: v, preview: true }) });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error);
      await load(a, d.url, () => setPreviewing(null));
    } catch (e) {
      setPreviewing(null);
      flash(e instanceof Error && e.message ? e.message : '미리듣기를 재생하지 못했어요.');
    }
  };

  const go = useCallback((d: number) => {
    stop();
    const n = idx + d;
    if (n >= pagesRef.current.length) {
      onFinished?.();
      return;
    }
    setIdx(Math.max(0, n));
  }, [idx, onFinished, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, sheet]);

  const page = pages[idx];
  if (!page) return null;
  const isCover = idx === 0;
  const listenToggle = () => {
    if (!canListen) { onNeedLogin?.(); return; }
    if (playing || preparing) { stop(); return; }
    if (voice) startListening(voice); else setSheet('voice');
  };

  return (
    <div className="reader">
      <div className="reader-top">
        <Link href={closeHref} className="icon-btn" aria-label={closeLabel} onClick={stop}><Icon name="close" /></Link>
        <span className="reader-title">{title}</span>
        <span className="reader-count">{idx + 1} / {pages.length}</span>
      </div>
      <div className="reader-progress" aria-hidden="true"><span style={{ width: `${((idx + 1) / pages.length) * 100}%` }} /></div>
      {status && <div className="gen-status" role="status">{status}</div>}

      <div
        className="reader-stage"
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
        }}
      >
        <button className="reader-side" onClick={() => go(-1)} disabled={idx === 0} aria-label="이전 장"><Icon name="left" size={24} /></button>
        <article className="spread" key={idx} aria-live="polite">
          <div className="spread-art">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt={`${page.tag} 그림`} />
            ) : page.imageState === 'failed' ? (
              <div className="art-wait">
                <div><div className="big">{emoji}</div><p>그림을 그리지 못했어요.</p>
                  {onRetryImage && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => onRetryImage(idx)}>다시 그리기</button>}
                </div>
              </div>
            ) : (
              <div className="art-wait"><div><div className="big">{emoji}</div><p>{page.imageState === 'drawing' ? '요정 화가가 이 장면을 그리고 있어요…' : page.imageState === 'waiting' ? '곧 이 장면을 그릴 차례예요' : ''}</p></div></div>
            )}
          </div>
          <div className="spread-text">
            <span className="spread-tag">{page.tag}</span>
            <p className={`spread-body ${isCover ? 'cover' : ''}`}>{page.text}</p>
            {isCover && <p className="spread-cover-sub">꼬마작가 동화공방에서 함께 만든 그림책</p>}
          </div>
        </article>
        <button className="reader-side" onClick={() => go(1)} aria-label={idx === pages.length - 1 ? '마지막 장 다음' : '다음 장'}><Icon name="right" size={24} /></button>
      </div>

      <div className="reader-mobile-nav">
        <button className="reader-side" onClick={() => go(-1)} disabled={idx === 0} aria-label="이전 장"><Icon name="left" size={22} /></button>
        <div className="dots" aria-hidden="true">{pages.map((_, i) => <i key={i} className={i === idx ? 'on' : ''} />)}</div>
        <button className="reader-side" onClick={() => go(1)} aria-label="다음 장"><Icon name="right" size={22} /></button>
      </div>

      <div className="reader-bar">
        <button className={`btn btn-gold listen-btn ${playing || preparing ? 'on' : ''}`} onClick={listenToggle}>
          {preparing ? <><span className="spin" /> 목소리 준비 중</> : playing ? <><Icon name="pause" size={18} /> 멈추기</> : <><Icon name="sound" size={18} /> {idx === 0 ? '처음부터 읽어주기' : '여기부터 읽어주기'}</>}
        </button>
        {voice && canListen && !playing && !preparing && (
          <button className="btn btn-ghost" onClick={() => setSheet('voice')}>
            {VOICES.find(v => v.id === voice)?.emoji} 목소리 바꾸기
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setSheet('words')}><Icon name="words" size={18} /> 영어 단어</button>
        {actions}
      </div>

      {sheet === 'voice' && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <div className="sheet card-paper" role="dialog" aria-modal="true" aria-labelledby="voice-title" onClick={e => e.stopPropagation()}>
            <div className="sheet-head"><h2 id="voice-title">누가 읽어줄까요?</h2><button className="sheet-close" onClick={() => setSheet(null)} aria-label="닫기"><Icon name="close" size={18} /></button></div>
            <p className="sheet-sub">미리 들어보고 마음에 드는 목소리를 골라 주세요. 페이지가 저절로 넘어가며 끝까지 읽어드려요.</p>
            <div className="voice-grid">
              {VOICES.map(v => (
                <div key={v.id} className={`voice-card ${voice === v.id ? 'selected' : ''}`}>
                  <span className="v-emoji" aria-hidden="true">{v.emoji}</span>
                  <strong>{v.name}</strong>
                  <small>{v.desc}</small>
                  <div className="v-actions">
                    <button className="btn btn-paper" onClick={() => preview(v.id)} aria-label={`${v.name} 미리듣기`}>
                      {previewing === v.id ? <><span className="spin" /> 듣는 중</> : <><Icon name="play" size={14} /> 미리듣기</>}
                    </button>
                    <button className="btn btn-ink" onClick={() => startListening(v.id)}>선택</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sheet === 'words' && <WordSheet storyId={storyId} text={pages.slice(1).map(p => p.text).join(' ')} onClose={() => setSheet(null)} />}
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}

type Word = { korean: string; english: string; emoji: string; sentence: string };
const wordCache = new Map<string, Word[]>();

function WordSheet({ storyId, text, onClose }: { storyId: string; text: string; onClose: () => void }) {
  const [words, setWords] = useState<Word[] | null>(wordCache.get(storyId + text) ?? null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<number | null>(null);

  const fetchWords = useCallback(() => {
    fetch('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyText: text, storyId }) })
      .then(async r => {
        const d = await r.json();
        if (!r.ok || !Array.isArray(d.words)) throw new Error(d.error);
        wordCache.set(storyId + text, d.words);
        setWords(d.words);
      })
      .catch(e => setError(e instanceof Error && e.message ? e.message : '단어를 고르지 못했어요.'));
  }, [storyId, text]);

  useEffect(() => { if (!words) fetchWords(); }, [fetchWords, words]);
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const speak = (w: Word, i: number) => {
    if (!('speechSynthesis' in window)) { setError('이 브라우저에서는 발음 듣기를 지원하지 않아요.'); return; }
    window.speechSynthesis.cancel();
    const say = (t: string, rate: number) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'en-US';
      u.rate = rate;
      return u;
    };
    const a = say(w.english, 0.7);
    const b = say(w.sentence, 0.82);
    b.onend = () => setPlaying(null);
    b.onerror = () => setPlaying(null);
    setPlaying(i);
    window.speechSynthesis.speak(a);
    window.speechSynthesis.speak(b);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet card-paper" role="dialog" aria-modal="true" aria-labelledby="words-title" onClick={e => e.stopPropagation()}>
        <div className="sheet-head"><h2 id="words-title">우리 동화 속 영어 단어</h2><button className="sheet-close" onClick={onClose} aria-label="닫기"><Icon name="close" size={18} /></button></div>
        <p className="sheet-sub">내가 만든 이야기에서 고른 단어라 더 오래 기억해요. 카드를 누르면 단어와 문장을 읽어줘요.</p>
        {error ? (
          <div className="notice on-paper" role="alert">{error}<button onClick={() => { setError(''); fetchWords(); }}>다시 시도</button></div>
        ) : !words ? (
          <div className="writing"><span className="spin" /> 이야기에서 단어를 고르고 있어요…</div>
        ) : (
          <div className="word-list">
            {words.map((w, i) => (
              <button key={w.english + i} className={`word-card ${playing === i ? 'playing' : ''}`} onClick={() => speak(w, i)}>
                <span className="w-emoji" aria-hidden="true">{w.emoji}</span>
                <span className="w-main">
                  <span className="w-en" lang="en">{w.english}</span><span className="w-ko">{w.korean}</span>
                  <span className="w-sentence" lang="en" style={{ display: 'block' }}>{w.sentence}</span>
                </span>
                <span className="w-play" aria-hidden="true"><Icon name={playing === i ? 'sound' : 'play'} size={15} /></span>
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-ink btn-block" style={{ marginTop: 16 }} onClick={onClose}>동화로 돌아가기</button>
      </div>
    </div>
  );
}
