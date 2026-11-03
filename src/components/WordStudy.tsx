'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

type StudyWord = { korean: string; english: string; emoji: string; sentence: string };
const wordCache = new Map<string, Promise<StudyWord[]>>();

export function WordStudy({ storyText, autoPrepare = false, className = '' }: { storyText: string; autoPrepare?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [currentSpeech, setCurrentSpeech] = useState<string | null>(null);

  const loadWords = useCallback(async () => {
    if (!storyText.trim()) return;
    setLoading(true); setError('');
    let request = wordCache.get(storyText);
    if (!request) {
      request = fetch('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyText }) })
        .then(async response => {
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.words) || !data.words.length) throw new Error('단어를 가져오지 못했어요. 다시 시도해 주세요.');
          return data.words as StudyWord[];
        }).catch(e => { wordCache.delete(storyText); throw e; });
      if (wordCache.size > 24) wordCache.delete(wordCache.keys().next().value!);
      wordCache.set(storyText, request);
    }
    try { setWords(await request); }
    catch { setError('동화 속 단어를 고르지 못했어요. 다시 시도해 주세요.'); }
    finally { setLoading(false); }
  }, [storyText]);

  useEffect(() => { if (autoPrepare) void loadWords(); }, [autoPrepare, loadWords]);
  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const speak = (text: string, key: string) => {
    setSpeechError('');
    if (!('speechSynthesis' in window)) { setSpeechError('이 브라우저에서는 발음 듣기를 지원하지 않아요.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; utterance.rate = 0.75;
    utterance.onend = () => setCurrentSpeech(null);
    utterance.onerror = event => { setCurrentSpeech(null); if (!['interrupted', 'canceled'].includes(event.error)) setSpeechError('발음을 재생하지 못했어요. 다시 눌러 주세요.'); };
    setCurrentSpeech(key); window.speechSynthesis.speak(utterance);
  };
  const close = () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setCurrentSpeech(null); dialog.current?.close(); };

  return <>
    <button className={`button-secondary ${className}`} onClick={() => { dialog.current?.showModal(); void loadWords(); }}><Icon name="sound" size={18}/> 내 동화 속 영어 단어</button>
    <dialog ref={dialog} className="word-study-dialog" onCancel={close} onClose={() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }} aria-labelledby="word-study-title">
      <div className="dialog-heading"><h2 id="word-study-title">우리 이야기로 배우는 영어</h2><button className="dialog-close" onClick={close} aria-label="단어 학습 닫기"><Icon name="close" size={18}/></button></div>
      <p className="word-study-lead">완성한 동화에 나온 한글 단어를 영어로 만나보세요. 발음을 듣고 천천히 따라 말해요.</p>
      {loading ? <p role="status">이야기에서 중요한 단어를 고르고 있어요…</p> : error ? <div className="inline-error" role="alert">{error}<button className="button-secondary" onClick={() => void loadWords()}>다시 시도</button></div> : <>
        <p className="dialog-caption">동화에서 찾은 단어 {words.length}개</p>
        {words.map((word, i) => <article key={word.english} className="word-study-card"><div className="word-study-title"><span aria-hidden="true">{word.emoji}</span><div><small>{word.korean}</small><strong lang="en">{word.english}</strong></div></div><p lang="en">{word.sentence}</p><div className="word-study-actions"><button className="button-secondary" onClick={() => speak(word.english, `${i}-word`)} aria-label={`${word.korean}, ${word.english} 발음 듣기`}><Icon name="sound" size={16}/>{currentSpeech === `${i}-word` ? '듣는 중…' : '단어 듣기'}</button><button className="button-secondary" onClick={() => speak(word.sentence, `${i}-sentence`)}>{currentSpeech === `${i}-sentence` ? '듣는 중…' : '짧은 문장 듣기'}</button></div></article>)}
      </>}
      {speechError && <p className="inline-error" role="alert">{speechError}</p>}
      <button className="button-primary" onClick={close} style={{ width: '100%', marginTop: 14 }}>동화로 돌아가기</button>
    </dialog>
  </>;
}
