import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const VOICE_MAP: Record<string, string> = {
  wizard: 'onyx',
  princess: 'nova',
  bear: 'echo',
  fairy: 'shimmer',
};

export async function POST(req: NextRequest) {
  try {
    const { text, voice, pageId, storyId, pageNumber } = await req.json();

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // TTS 생성
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
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

    if (!ttsRes.ok) {
      const err = await ttsRes.json();
      return NextResponse.json({ error: err.error?.message }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // Storage에 영구 저장
    const filePath = `${storyId}/page-${pageNumber}-${voice}.mp3`;
    await supabase.storage
      .from('story-audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    const { data: urlData } = supabase.storage
      .from('story-audio')
      .getPublicUrl(filePath);

    // pages 테이블에 URL 기록 (다음부턴 재생성 없이 사용)
    const { data: pageRow } = await supabase
      .from('pages')
      .select('audio_urls')
      .eq('id', pageId)
      .single();

    const audioUrls = { ...(pageRow?.audio_urls || {}), [voice]: urlData.publicUrl };
    await supabase.from('pages').update({ audio_urls: audioUrls }).eq('id', pageId);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}