'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SEED_STORIES } from '@/data/seedStories';

function CreateContent() {
  const router = useRouter();
  const params = useSearchParams();
  const seedId = Number(params.get('seed')) || 1;
  const totalPages = Number(params.get('pages')) || 8;

  const seed = SEED_STORIES.find((s) => s.id === seedId) || SEED_STORIES[0];

  const [storyParts, setStoryParts] = useState<{ user: string; ai: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 수정 모드 상태
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const currentPage = storyParts.length;
  const isDone = currentPage >= totalPages;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storyParts, loading]);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요!');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const handleContinue = async () => {
    if (!input.trim() || loading || isDone) return;
    setLoading(true);

    const isLastPage = currentPage === totalPages - 1;
    const context = seed.preview + ' ' + storyParts.map((p) => p.ai).join(' ');

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, input: input.trim(), isLastPage }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStoryParts([...storyParts, { user: input.trim(), ai: data.text }]);
      setInput('');
    } catch (e: any) {
      alert('오류가 발생했어요: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 수정 시작
  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditText(storyParts[idx].ai);
  };

  // 수정 저장
  const saveEdit = () => {
    if (editingIdx === null || !editText.trim()) return;
    setStoryParts((prev) => {
      const next = [...prev];
      next[editingIdx] = { ...next[editingIdx], ai: editText.trim() };
      return next;
    });
    setEditingIdx(null);
    setEditText('');
  };

  const handleFinish = () => {
    if (storyParts.length === 0) {
      alert('먼저 이야기를 한 장 이상 만들어주세요!');
      return;
    }
    sessionStorage.setItem(
      'completedStory',
      JSON.stringify({
        seedId: seed.id,
        title: seed.title,
        totalPages,
        parts: storyParts,
      })
    );
    router.push('/book');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* 밤하늘 헤더 */}
      <header
        className="relative px-4 pt-8 pb-8 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--night-deep) 0%, var(--night) 100%)',
          borderRadius: '0 0 28px 28px',
        }}
      >
        <span className="star text-xs" style={{ top: '25%', left: '80%' }}>✦</span>
        <span className="star text-[9px]" style={{ top: '60%', left: '10%', animationDelay: '1s' }}>✧</span>

        <div className="max-w-md mx-auto relative">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => router.push('/')}
              className="text-sm font-bold"
              style={{ color: 'var(--lavender)' }}
            >
              ← 처음으로
            </button>
            <span className="font-title text-lg" style={{ color: 'var(--star-gold)' }}>
              {currentPage} / {totalPages}장
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-all"
                style={{ background: i < currentPage ? 'var(--star-gold)' : 'rgba(255,255,255,0.2)' }}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 pb-60">
        {/* 씨앗 이야기 */}
        <div
          className="rounded-3xl p-4 flex gap-3 mb-4"
          style={{
            background: 'linear-gradient(135deg, #FFF4E0, var(--lavender-light))',
            boxShadow: '0 4px 14px rgba(61,58,92,0.08)',
          }}
        >
          <span className="text-2xl floaty">{seed.emoji}</span>
          <div>
            <h2 className="font-title text-base font-bold mb-1" style={{ color: 'var(--ink)' }}>
              {seed.title}
            </h2>
            <p className="text-xs leading-loose" style={{ color: 'var(--ink)' }}>
              {seed.preview}
            </p>
          </div>
        </div>

        {/* 이야기 로그 */}
        {storyParts.map((part, i) => (
          <div key={i} className="mb-4">
            <div
              className="rounded-2xl px-4 py-3 mb-2 bg-white"
              style={{ boxShadow: '0 2px 8px rgba(61,58,92,0.06)' }}
            >
              <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--ink-soft)' }}>
                ✏️ 내가 만든 이야기
              </p>
              <p className="text-sm leading-loose" style={{ color: 'var(--ink)' }}>
                {part.user}
              </p>
            </div>

            {editingIdx === i ? (
              /* 수정 모드 */
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: '#FFF4E0', border: '2px solid var(--star-gold)' }}
              >
                <p className="text-[10px] font-bold mb-2" style={{ color: '#C08A20' }}>
                  ✍️ 직접 고치는 중...
                </p>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-xl p-3 text-sm resize-none outline-none h-32 bg-white"
                  style={{ border: '1.5px solid #EDD9A8', color: 'var(--ink)', lineHeight: 1.8 }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-2.5 rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--star-gold)', color: 'var(--night-deep)' }}
                  >
                    ✓ 수정 완료
                  </button>
                  <button
                    onClick={() => setEditingIdx(null)}
                    className="px-4 py-2.5 rounded-full text-xs font-bold"
                    style={{ border: '1.5px solid #D9CFC4', color: 'var(--ink-soft)' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              /* 일반 모드 */
              <div
                className="rounded-2xl px-4 py-3 relative"
                style={{ background: 'var(--lavender-light)', border: '1.5px solid var(--lavender)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold" style={{ color: '#7A6BC4' }}>
                    📖 {i + 1}장 완성!
                  </p>
                  <button
                    onClick={() => startEdit(i)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95"
                    style={{ background: 'white', color: '#7A6BC4', border: '1px solid var(--lavender)' }}
                  >
                    ✏️ 고치기
                  </button>
                </div>
                <p className="text-sm leading-loose" style={{ color: 'var(--ink)' }}>
                  {part.ai}
                </p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-center py-5">
            <span className="text-4xl inline-block floaty">🪄</span>
            <p className="font-title text-base mt-2" style={{ color: '#7A6BC4' }}>
              요정들이 이야기를 다듬는 중...
            </p>
          </div>
        )}

        {isDone && !loading && (
          <div
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--night-deep), var(--night))' }}
          >
            <span className="star text-sm" style={{ top: '15%', left: '15%' }}>✦</span>
            <span className="star text-xs" style={{ top: '25%', left: '82%', animationDelay: '0.8s' }}>✧</span>
            <span className="text-5xl block mb-2">🎉</span>
            <p className="font-title text-xl text-white">{totalPages}장 이야기 완성!</p>
            <p className="text-xs mt-1" style={{ color: 'var(--lavender)' }}>
              문장을 고치고 싶으면 ✏️ 고치기를 눌러보세요
            </p>
          </div>
        )}

        <div ref={logEndRef} />
      </main>

      {/* 하단 입력 영역 */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-6"
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 28px rgba(61,58,92,0.12)',
        }}
      >
        <div className="max-w-md mx-auto">
          {!isDone ? (
            <>
              <div className="flex gap-2 mb-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="다음엔 어떤 일이 일어날까요?"
                  className="flex-1 rounded-2xl p-3.5 text-sm resize-none outline-none h-20"
                  style={{ background: 'var(--paper)', border: '2px solid #EDE8F5', color: 'var(--ink)' }}
                />
                <button
                  onClick={toggleMic}
                  className="w-20 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95"
                  style={{
                    background: isRecording ? '#FF7B7B' : 'linear-gradient(135deg, var(--lavender), #9D8BD8)',
                  }}
                >
                  <span className="text-2xl">🎤</span>
                  <span className="text-[10px] text-white font-bold mt-1">
                    {isRecording ? '듣는 중...' : '말하기'}
                  </span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleContinue}
                  disabled={!input.trim() || loading}
                  className="flex-1 py-3.5 rounded-full font-title text-base font-bold transition-all active:scale-98"
                  style={{
                    background:
                      input.trim() && !loading
                        ? 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))'
                        : '#EDE8F5',
                    color: input.trim() && !loading ? 'var(--night-deep)' : '#B4AFC9',
                  }}
                >
                  ✨ 다음 이야기 만들기
                </button>
                {storyParts.length > 0 && (
                  <button
                    onClick={handleFinish}
                    className="px-5 py-3.5 rounded-full font-title text-base font-bold transition-all active:scale-95"
                    style={{ border: '2px solid var(--lavender)', color: '#7A6BC4' }}
                  >
                    마무리
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-full font-title text-lg font-bold transition-all active:scale-98"
              style={{
                background: 'linear-gradient(135deg, var(--star-gold), var(--peach-soft))',
                color: 'var(--night-deep)',
                boxShadow: '0 8px 24px rgba(255,201,77,0.45)',
              }}
            >
              📖 그림책 완성하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateContent />
    </Suspense>
  );
}