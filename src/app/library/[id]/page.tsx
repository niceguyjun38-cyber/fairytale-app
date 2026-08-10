'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface PageData {
  id: string;
  page_number: number;
  ai_text: string;
  image_url: string | null;
  audio_urls: Record<string, string>;
}

const VOICES = [
  { id: 'wizard', emoji: '🧙', name: '마법사 할아버지' },
  { id: 'princess', emoji: '👸', name: '공주님' },
  { id: 'bear', emoji: '🧸', name: '곰돌이' },
  { id: 'fairy', emoji: '🌟', name: '요정 언니' },
];

const PREVIEW_TEXT = '옛날 옛날에, 반짝이는 별 하나가 있었어요.';

export default function ReadStoryPage() {
  const router = useRouter();
  const params = useParams();
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);

  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayRef = useRef(false);
  const pagesRef = useRef<PageData[]>([]);

  const supabase = createClient();

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    load();
    return () => {
      autoPlayRef.current = false;
      audioRef.current?.pause();
      previewAudioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const load = async () => {
    const { data: tale, error: taleError } = await supabase
      .from('fairytales')
      .select('title')
      .eq('id', params.id)
      .single();

    if (taleError) {
      alert('동화 불러오기 오류: ' + taleError.message);
      router.push('/library');
      return;
    }
    if (!tale) {
      alert('동화를 찾을 수 없어요');
      router.push('/library');
      return;
    }
    setTitle(tale.title);

    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .select('id, page_number, ai_text, image_url, audio_urls')
      .eq('fairytale_id', params.id)
      .order('page_number');

    if (pageError) {
      alert('페이지 불러오기 오류: ' + pageError.message);
      return;
    }
    setPages((pageData || []).map((p) => ({ ...p, audio_urls: p.audio_urls || {} })));
  };

  // 오디오 가져오기: 저장된 URL 있으면 재사용(0원), 없으면 생성 후 영구 저장
  const fetchAudio = async (voiceId: string, pageIdx: number): Promise<string | null> => {
    const pageList = pagesRef.current;
    if (pageIdx >= pageList.length) return null;
    const page = pageList[pageIdx];

    // 이미 저장된 오디오가 있으면 재사용 (원가 0원!)
    if (page.audio_urls?.[voiceId]) {
      return page.audio_urls[voiceId];
    }

    // 없으면 생성 + Storage에 영구 저장
    try {
      const res = await fetch('/api/tts-cached', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: page.ai_text,
          voice: voiceId,
          pageId: page.id,
          storyId: params.id,
          pageNumber: page.page_number,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      // 로컬 상태에도 반영
      setPages((prev) => {
        const next = [...prev];
        next[pageIdx] = {
          ...next[pageIdx],
          audio_urls: { ...next[pageIdx].audio_urls, [voiceId]: data.url },
        };
        return next;
      });
      return data.url;
    } catch {
      return null;
    }
  };

  const playFromPage = async (voiceId: string, pageIdx: number) => {
    const pageList = pagesRef.current;
    if (pageIdx >= pageList.length) {
      setIsPlaying(false);
      autoPlayRef.current = false;
      return;
    }

    setCurrentIdx(pageIdx);
    setTtsLoading(true);
    const url = await fetchAudio(voiceId, pageIdx);
    setTtsLoading(false);

    if (!url) {
      autoPlayRef.current = false;
      setIsPlaying(false);
      return;
    }

    // 다음 페이지 미리 준비
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

  if (pages.length === 0) return null;

  const page = pages[currentIdx];
  const tag = currentIdx === 0 ? '표지' : currentIdx === 1 ? '시작 이야기' : `${currentIdx - 1}장`;

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 60%, #3A3670 100%)' }}
    >
      <span className="star text-xs" style={{ top: '8%', left: '10%' }}>✦</span>
      <span className="star text-[10px]" style={{ top: '12%', left: '88%', animationDelay: '0.6s' }}>✧</span>

      <header className="flex items-center justify-between px-5 py-4 relative">
<button
          onClick={() => router.back()}
          className="text-sm font-bold"
          style={{ color: 'var(--lavender)' }}
        >
          ← 돌아가기
        </button>
        <span className="font-title text-lg" style={{ color: 'var(--star-gold)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--lavender)' }}>
          {currentIdx + 1} / {pages.length}
        </span>
      </header>

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
            {page.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.image_url} alt={tag} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">📖</span>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: '#7A6BC4' }}>
                ✦ {tag} ✦
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
              {page.ai_text}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-5 relative">
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
            <span key={i} className="text-xs" style={{ opacity: i === currentIdx ? 1 : 0.25 }}>
              ⭐
            </span>
          ))}
        </div>
        <button
          onClick={goNext}
          disabled={currentIdx === pages.length - 1}
          className="w-12 h-12 rounded-full text-xl transition-all active:scale-90 disabled:opacity-15"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--star-gold)' }}
        >
          ›
        </button>
      </div>

      {/* 목소리 선택 모달 */}
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
    </div>
  );
}