'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SEED_STORIES } from '@/data/seedStories';

interface BookPageData {
  tag: string;
  text: string;
  imageUrl: string | null;
  isLoading: boolean;
}

interface CompletedStory {
  seedId: number;
  title: string;
  totalPages: number;
  parts: { user: string; ai: string }[];
}

interface StudyWord {
  korean: string;
  english: string;
  emoji: string;
  sentence: string;
}

const VOICES = [
  { id: 'wizard', emoji: '🧙', name: '마법사 할아버지' },
  { id: 'princess', emoji: '👸', name: '공주님' },
  { id: 'bear', emoji: '🧸', name: '곰돌이' },
  { id: 'fairy', emoji: '🌟', name: '요정 언니' },
];

const PREVIEW_TEXT = '옛날 옛날에, 반짝이는 별 하나가 있었어요.';

export default function BookViewer() {
  const router = useRouter();
  const [story, setStory] = useState<CompletedStory | null>(null);
  const [pages, setPages] = useState<BookPageData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [imgProgress, setImgProgress] = useState({ current: 0, total: 0, done: false });
  const [touchStartX, setTouchStartX] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayRef = useRef(false);
  const pagesRef = useRef<BookPageData[]>([]);
  // TTS 오디오 캐시: "voiceId-pageIdx" -> blob URL
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const [showWords, setShowWords] = useState(false);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    const saved = sessionStorage.getItem('completedStory');
    if (!saved) {
      router.push('/');
      return;
    }
    const data: CompletedStory = JSON.parse(saved);
    setStory(data);

    const seed = SEED_STORIES.find((s) => s.id === data.seedId) || SEED_STORIES[0];

    const initialPages: BookPageData[] = [
      { tag: '표지', text: data.title, imageUrl: null, isLoading: true },
      { tag: '시작 이야기', text: seed.preview, imageUrl: null, isLoading: true },
      ...data.parts.map((p, i) => ({
        tag: `${i + 1}장`,
        text: p.ai,
        imageUrl: null,
        isLoading: true,
      })),
    ];
    setPages(initialPages);
    generateImages(initialPages, seed.character, data.title);

    return () => {
      autoPlayRef.current = false;
      audioRef.current?.pause();
      previewAudioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateImages = async (pageList: BookPageData[], character: string, title: string) => {
    setImgProgress({ current: 0, total: pageList.length, done: false });
    for (let i = 0; i < pageList.length; i++) {
      setImgProgress({ current: i + 1, total: pageList.length, done: false });
      try {
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character,
            sceneText: pageList[i].text,
            isCover: i === 0,
            title,
          }),
        });
        const data = await res.json();
        setPages((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], imageUrl: data.url || null, isLoading: false };
          return next;
        });
      } catch {
        setPages((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], isLoading: false };
          return next;
        });
      }
    }
    setImgProgress((p) => ({ ...p, done: true }));
  };

  // TTS 오디오 가져오기 (캐시 우선)
  const fetchAudio = async (voiceId: string, pageIdx: number): Promise<string | null> => {
    const key = `${voiceId}-${pageIdx}`;
    if (audioCacheRef.current.has(key)) {
      return audioCacheRef.current.get(key)!;
    }
    const pageList = pagesRef.current;
    if (pageIdx >= pageList.length) return null;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageList[pageIdx].text, voice: voiceId }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(key, url);
      return url;
    } catch {
      return null;
    }
  };

  // 오디오북 모드: 재생 시작과 동시에 다음 페이지 미리 생성
  const playFromPage = async (voiceId: string, pageIdx: number) => {
    const pageList = pagesRef.current;
    if (pageIdx >= pageList.length) {
      setIsPlaying(false);
      autoPlayRef.current = false;
      setShowFinish(true);
      return;
    }

    setCurrentIdx(pageIdx);
    setTtsLoading(true);

    const url = await fetchAudio(voiceId, pageIdx);
    setTtsLoading(false);

    if (!url) {
      autoPlayRef.current = false;
      setIsPlaying(false);
      alert('음성 생성에 실패했어요. 다시 시도해주세요.');
      return;
    }

    // 🔑 핵심: 재생 시작하면서 다음 페이지 음성을 백그라운드에서 미리 생성
    fetchAudio(voiceId, pageIdx + 1);

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      if (autoPlayRef.current) {
        setTimeout(() => {
          if (autoPlayRef.current) playFromPage(voiceId, pageIdx + 1);
        }, 600);
      } else {
        setIsPlaying(false);
      }
    };

    audio.play();
    setIsPlaying(true);
  };

  // 목소리 미리듣기
  const previewVoice = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    previewAudioRef.current?.pause();
    setPreviewing(voiceId);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: PREVIEW_TEXT, voice: voiceId }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewing(null);
      audio.play();
    } catch {
      setPreviewing(null);
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    previewAudioRef.current?.pause();
    setShowVoicePicker(false);
    autoPlayRef.current = true;
    playFromPage(voiceId, currentIdx);
  };

  const stopPlaying = () => {
    autoPlayRef.current = false;
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const goPrev = () => {
    stopPlaying();
    setCurrentIdx((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    stopPlaying();
    if (currentIdx === pages.length - 1) {
      setShowFinish(true);
      return;
    }
    setCurrentIdx((i) => Math.min(pages.length - 1, i + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const fetchWords = async () => {
    if (words.length > 0) {
      setShowWords(true);
      return;
    }
    setWordsLoading(true);
    setShowWords(true);
    try {
      const fullText = pagesRef.current.map((p) => p.text).join(' ');
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyText: fullText }),
      });
      const data = await res.json();
      if (data.words) setWords(data.words);
    } catch {
      // 실패 시 조용히 넘어감
    } finally {
      setWordsLoading(false);
    }
  };

  const speakWord = (text: string) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.8;
    speechSynthesis.speak(utter);
  };

  const handlePublish = async (isPublic: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/save-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story!.title,
          seedId: story!.seedId,
          totalPages: story!.totalPages,
          isPublic,
          pages: pagesRef.current.map((p) => ({
            text: p.text,
            imageUrl: p.imageUrl,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (res.status === 401) {
          alert('로그인하면 동화를 서재에 보관할 수 있어요! 메인에서 카카오 로그인 해주세요 😊');
          router.push('/');
          return;
        }
        throw new Error(data.error);
      }
      alert(isPublic ? '🌟 동화가 모두에게 공개됐어요!' : '🔒 내 서재에 저장됐어요!');
      sessionStorage.removeItem('completedStory');
      router.push('/library');
    } catch (e: any) {
      alert('저장 오류: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!story || pages.length === 0) return null;

  const page = pages[currentIdx];
  const seed = SEED_STORIES.find((s) => s.id === story.seedId) || SEED_STORIES[0];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 60%, #3A3670 100%)' }}
    >
      <span className="star text-xs" style={{ top: '8%', left: '10%' }}>✦</span>
      <span className="star text-[10px]" style={{ top: '12%', left: '88%', animationDelay: '0.6s' }}>✧</span>
      <span className="star text-sm" style={{ top: '45%', left: '5%', animationDelay: '1.4s' }}>⋆</span>
      <span className="star text-[9px]" style={{ top: '70%', left: '92%', animationDelay: '0.9s' }}>✦</span>

      <header className="flex items-center justify-between px-5 py-4 relative">
        <button
          onClick={() => router.push('/')}
          className="text-sm font-bold"
          style={{ color: 'var(--lavender)' }}
        >
          ✕ 닫기
        </button>
        <span className="font-title text-lg" style={{ color: 'var(--star-gold)' }}>
          {story.title}
        </span>
        <span className="text-xs" style={{ color: 'var(--lavender)' }}>
          {currentIdx + 1} / {pages.length}
        </span>
      </header>

      {!imgProgress.done && imgProgress.total > 0 && (
        <div className="px-5 pb-2 relative">
          <p className="text-xs text-center mb-1.5" style={{ color: 'var(--lavender)' }}>
            🎨 요정 화가가 그림 그리는 중... ({imgProgress.current}/{imgProgress.total})
          </p>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                background: 'linear-gradient(90deg, var(--star-gold), var(--peach-soft))',
                width: `${(imgProgress.current / imgProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div
        className="flex-1 flex items-center justify-center px-5 py-3 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="w-full max-w-sm rounded-3xl overflow-hidden"
          style={{
            background: 'var(--paper)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 0 0 6px rgba(255,201,77,0.15)',
          }}
        >
          <div
            className="w-full aspect-[4/3] flex items-center justify-center"
            style={{ background: 'var(--lavender-light)' }}
          >
            {page.isLoading ? (
              <span className="text-5xl floaty">{seed.emoji}</span>
            ) : page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.imageUrl} alt={page.tag} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">{seed.emoji}</span>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: '#7A6BC4' }}>
                ✦ {page.tag} ✦
              </p>
              {isPlaying ? (
                <button
                  onClick={stopPlaying}
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background: '#FF7B7B', color: 'white' }}
                >
                  ⏸ 멈추기
                </button>
              ) : (
                <button
                  onClick={() => setShowVoicePicker(true)}
                  disabled={ttsLoading}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, var(--lavender), #9D8BD8)',
                    color: 'white',
                  }}
                >
                  {ttsLoading ? '🪄 준비 중...' : '🔊 여기부터 읽어주기'}
                </button>
              )}
            </div>
            <p
              className={`leading-loose text-center font-title ${
                currentIdx === 0 ? 'text-2xl font-bold' : 'text-lg'
              }`}
              style={{ color: 'var(--ink)' }}
            >
              {page.text}
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] pb-1 relative" style={{ color: 'rgba(255,255,255,0.3)' }}>
        ← 손가락으로 넘겨보세요 →
      </p>

      <div className="flex items-center justify-between px-5 py-4 relative">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="w-12 h-12 rounded-full text-xl transition-all active:scale-90 disabled:opacity-15"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--star-gold)' }}
        >
          ‹
        </button>
        <div className="flex gap-1.5">
          {pages.map((_, i) => (
            <span key={i} className="text-xs transition-all" style={{ opacity: i === currentIdx ? 1 : 0.25 }}>
              ⭐
            </span>
          ))}
        </div>
        <button
          onClick={goNext}
          className="w-12 h-12 rounded-full text-xl transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--star-gold)' }}
        >
          ›
        </button>
      </div>

      {/* 목소리 선택 모달 (미리듣기 포함) */}
      {showVoicePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowVoicePicker(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-6 pb-8"
            style={{ background: 'var(--paper)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-title text-xl text-center mb-1" style={{ color: 'var(--ink)' }}>
              누가 읽어줄까요?
            </p>
            <p className="text-xs text-center mb-5" style={{ color: 'var(--ink-soft)' }}>
              🔊 버튼으로 목소리를 미리 들어보세요
            </p>
            <div className="grid grid-cols-2 gap-3">
              {VOICES.map((v) => (
                <div
                  key={v.id}
                  className="rounded-2xl py-4 px-3 text-center bg-white relative"
                  style={{ boxShadow: '0 3px 10px rgba(61,58,92,0.1)' }}
                >
                  <button
                    onClick={(e) => previewVoice(v.id, e)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full text-sm flex items-center justify-center transition-all active:scale-90"
                    style={{
                      background: previewing === v.id ? 'var(--star-gold)' : 'var(--lavender-light)',
                    }}
                  >
                    {previewing === v.id ? '🎵' : '🔊'}
                  </button>
                  <button onClick={() => handleVoiceSelect(v.id)} className="w-full">
                    <span className="text-4xl block mb-1.5">{v.emoji}</span>
                    <span className="text-sm font-bold block" style={{ color: 'var(--ink)' }}>
                      {v.name}
                    </span>
                    <span
                      className="text-[10px] font-bold mt-1.5 inline-block px-3 py-1 rounded-full"
                      style={{ background: 'var(--lavender-light)', color: '#7A6BC4' }}
                    >
                      이 목소리로 듣기
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 완성 화면 */}
      {showFinish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(20,20,45,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-7 text-center relative overflow-hidden"
            style={{ background: 'var(--paper)' }}
          >
            <span className="absolute top-4 left-5 text-sm star">✦</span>
            <span className="absolute top-8 right-6 text-xs star" style={{ animationDelay: '0.7s' }}>✧</span>
            <span className="text-6xl block mb-3">🏆</span>
            <p className="font-title text-2xl font-bold mb-1" style={{ color: 'var(--ink)' }}>
              멋진 이야기 완성!
            </p>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              「{story.title}」를 다른 친구들에게도
              <br />
              보여줄까요?
            </p>

            <button
              onClick={() => {
                setShowFinish(false);
                fetchWords();
              }}
              className="w-full py-4 rounded-full font-title text-lg font-bold mb-2.5 transition-all active:scale-98"
              style={{
                background: 'linear-gradient(135deg, var(--lavender), #9D8BD8)',
                color: 'white',
                boxShadow: '0 6px 18px rgba(184,169,232,0.45)',
              }}
            >
              📚 오늘의 단어 배우기
            </button>

            <button
              onClick={() => handlePublish(true)}
              disabled={saving}
              className="w-full py-4 rounded-full font-title text-lg font-bold mb-2.5 transition-all active:scale-98"
              style={{
                background: 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))',
                color: 'var(--night-deep)',
                boxShadow: '0 6px 18px rgba(255,201,77,0.4)',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '🌟 모두에게 공개하기'}
            </button>
            <button
              onClick={() => handlePublish(false)}
              disabled={saving}
              className="w-full py-3.5 rounded-full font-title text-base font-bold mb-2.5 transition-all active:scale-98"
              style={{ border: '2px solid var(--lavender)', color: '#7A6BC4', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '저장 중...' : '🔒 나만 보기'}
            </button>
            <button
              onClick={() => setShowFinish(false)}
              className="text-xs font-bold"
              style={{ color: 'var(--ink-soft)' }}
            >
              다시 읽어보기
            </button>
          </div>
        </div>
      )}

      {/* 오늘의 단어 모달 */}
      {showWords && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: 'rgba(20,20,45,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 relative overflow-hidden max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--paper)' }}
          >
            <span className="absolute top-4 right-6 text-xs star">✦</span>
            <p className="font-title text-2xl font-bold text-center mb-1" style={{ color: 'var(--ink)' }}>
              📚 오늘의 단어
            </p>
            <p className="text-xs text-center mb-5" style={{ color: 'var(--ink-soft)' }}>
              내 동화에서 나온 영어 단어들이에요!
              <br />
              단어를 누르면 발음을 들려줘요 🔊
            </p>

            {wordsLoading ? (
              <div className="text-center py-8">
                <span className="text-4xl inline-block floaty">🔤</span>
                <p className="font-title text-base mt-2" style={{ color: '#7A6BC4' }}>
                  단어를 고르고 있어요...
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 mb-5">
                {words.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => speakWord(w.english + '. ' + w.sentence)}
                    className="w-full rounded-2xl p-4 text-left transition-all active:scale-98 bg-white flex items-center gap-3"
                    style={{ boxShadow: '0 3px 10px rgba(61,58,92,0.08)' }}
                  >
                    <span className="text-3xl">{w.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-title text-xl font-bold" style={{ color: 'var(--ink)' }}>
                          {w.english}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                          {w.korean}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#7A6BC4' }}>
                        {w.sentence}
                      </p>
                    </div>
                    <span className="text-lg">🔊</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowWords(false);
                setShowFinish(true);
              }}
              className="w-full py-3.5 rounded-full font-title text-base font-bold transition-all active:scale-98"
              style={{
                background: 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))',
                color: 'var(--night-deep)',
              }}
            >
              다 배웠어요! ✨
            </button>
          </div>
        </div>
      )}
    </div>
  );
}