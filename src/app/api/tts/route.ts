import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { consumeUsage, getAdminSupabase, getServerSupabase } from '@/lib/supabaseServer';

export const maxDuration = 60;

const VOICE: Record<string, { voice: string; instructions: string }> = {
  grandpa: {
    voice: 'onyx',
    instructions: '포근한 할아버지 이야기꾼. 낮고 따뜻한 목소리로 아주 천천히, 한국어를 또박또박 읽어요. 문장 사이에 여유 있게 쉬고, 잠들기 전 아이에게 들려주듯 다정하게.',
  },
  mom: {
    voice: 'coral',
    instructions: '아이에게 그림책을 읽어주는 다정한 엄마. 따뜻하고 차분한 목소리로 천천히, 한국어를 자연스럽게. 등장인물의 감정을 살짝 살려서 읽어요.',
  },
  sister: {
    voice: 'shimmer',
    instructions: '밝고 생기 있는 언니. 맑고 경쾌한 목소리로 한국어를 또렷하게, 신나는 장면에서는 기대감을 담아 읽어요. 너무 빠르지 않게.',
  },
  friend: {
    voice: 'fable',
    instructions: '장난기 많은 어린 친구 같은 목소리. 높고 귀여운 톤으로 신나게, 한국어를 또박또박 읽어요. 놀라는 장면은 깜짝 놀란 듯이.',
  },
};
const PREVIEW = '옛날 옛날, 달빛이 반짝이는 숲속 마을에 작은 이야기 하나가 살고 있었어요.';

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { storyId, pageIndex, text, voice, preview } = await req.json();
    const v = VOICE[voice as string];
    if (!v) return NextResponse.json({ error: '목소리를 다시 골라 주세요.' }, { status: 400 });

    const supabase = await getServerSupabase();
    const admin = getAdminSupabase();
    const bucket = (admin ?? supabase).storage.from('story-audio');

    let input: string;
    let path: string;
    if (preview) {
      input = PREVIEW;
      path = `previews/${voice}-v2.mp3`;
    } else {
      if (typeof text !== 'string' || !text.trim() || text.length > 800) {
        return NextResponse.json({ error: '읽을 문장을 확인해 주세요.' }, { status: 400 });
      }
      input = text.trim();
      const hash = createHash('sha1').update(input).digest('hex').slice(0, 10);
      path = `${storyId}/v2-p${Number(pageIndex) || 0}-${voice}-${hash}.mp3`;
    }

    const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
    if (await exists(publicUrl)) return NextResponse.json({ url: publicUrl, cached: true });

    const { data: { user } } = await supabase.auth.getUser();
    if (preview) {
      if (!user && !admin) return NextResponse.json({ error: '로그인하면 목소리를 들어볼 수 있어요.' }, { status: 401 });
    } else {
      if (!user && !admin) return NextResponse.json({ error: '로그인하면 읽어주기를 들을 수 있어요.' }, { status: 401 });
      if (!(await consumeUsage(supabase, storyId, 'tts'))) {
        return NextResponse.json({ error: '지금은 읽어주기를 준비할 수 없어요.' }, { status: 429 });
      }
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: v.voice, input, instructions: v.instructions, response_format: 'mp3' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('openai tts', res.status, err.error?.message);
      return NextResponse.json({ error: '목소리를 만들지 못했어요.' }, { status: 502 });
    }
    const audio = Buffer.from(await res.arrayBuffer());
    const { error: upErr } = await bucket.upload(path, audio, { contentType: 'audio/mpeg', cacheControl: '31536000' });
    if (upErr && !/exists|Duplicate/i.test(upErr.message)) {
      console.error('upload audio', upErr.message);
      return NextResponse.json({ url: `data:audio/mpeg;base64,${audio.toString('base64')}`, cached: false });
    }
    return NextResponse.json({ url: publicUrl, cached: false });
  } catch (e) {
    console.error('tts', e);
    return NextResponse.json({ error: '목소리를 만들지 못했어요.' }, { status: 500 });
  }
}
