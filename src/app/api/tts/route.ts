import { NextRequest, NextResponse } from 'next/server';

const VOICE_MAP: Record<string, string> = {
  wizard: 'onyx',    // 🧙 마법사 할아버지 (낮고 따뜻한)
  princess: 'nova',  // 👸 공주님 (밝고 부드러운)
  bear: 'echo',      // 🧸 곰돌이 (귀엽고 낮은)
  fairy: 'shimmer',  // 🌟 요정 언니 (경쾌한)
};

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: VOICE_MAP[voice] || 'nova',
        input: text,
        speed: 0.9,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message }, { status: 500 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}