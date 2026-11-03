import { NextRequest, NextResponse } from 'next/server';
import { SEED_STORIES } from '@/data/seedStories';
import { consumeUsage, getAdminSupabase, getServerSupabase } from '@/lib/supabaseServer';

export const maxDuration = 120;

const STYLE =
  'Warm painterly children\'s picture book illustration, soft gouache and watercolor texture, gentle glowing light, ' +
  'rounded friendly shapes, rich but soft colors, cozy and magical mood, wide landscape composition with space around the characters. ' +
  'Absolutely no text, letters, words, numbers, captions, or watermarks in the image. Child-safe and gentle.';

async function generate(prompt: string, fancy: boolean) {
  const body: Record<string, unknown> = { model: 'gpt-image-1-mini', prompt, n: 1, quality: 'low', size: fancy ? '1536x1024' : '1024x1024' };
  if (fancy) { body.output_format = 'webp'; body.output_compression = 82; }
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { storyId, pageIndex, sceneText, isCover, title, seedId } = await req.json();
    const index = Number(pageIndex);
    if (!Number.isInteger(index) || index < 0 || index > 20 || typeof sceneText !== 'string') {
      return NextResponse.json({ error: '그림 요청을 확인해 주세요.' }, { status: 400 });
    }
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
    if (!(await consumeUsage(supabase, storyId, 'image'))) {
      return NextResponse.json({ error: '이 동화의 그림을 더 그릴 수 없어요.' }, { status: 429 });
    }

    const seed = SEED_STORIES.find(s => s.id === Number(seedId)) || SEED_STORIES[0];
    const hero = `Main character (draw EXACTLY the same design, colors and outfit in every picture): ${seed.character}. World: ${seed.setting}.`;
    const prompt = isCover
      ? `${STYLE}\n${hero}\nBook cover scene: the main character in a beautiful, inviting moment that captures the feeling of a story titled "${String(title || seed.title).slice(0, 60)}".`
      : `${STYLE}\n${hero}\nScene to illustrate (Korean story text): ${sceneText.slice(0, 400)}`;

    let res = await generate(prompt, true);
    if (res.status === 400) res = await generate(prompt, false); // 일부 옵션이 막혀 있으면 기본값으로
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, 6000));
      res = await generate(prompt, true);
    }
    const data = await res.json();
    if (!res.ok || !data.data?.[0]?.b64_json) {
      console.error('openai image', res.status, data.error?.message);
      const blocked = data.error?.code === 'moderation_blocked';
      return NextResponse.json({ error: blocked ? '이 장면은 그림으로 그리기 어려워요.' : '그림을 그리지 못했어요.' }, { status: 502 });
    }

    const isWebp = !!data.output_format ? data.output_format === 'webp' : true;
    const bytes = Buffer.from(data.data[0].b64_json, 'base64');
    const mime = bytes.subarray(0, 4).toString('ascii') === 'RIFF' ? 'image/webp' : bytes[0] === 0x89 ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
    const ext = mime.split('/')[1];
    const path = `${storyId}/p${index}-${Date.now().toString(36)}.${ext}`;

    const storage = (getAdminSupabase() ?? supabase).storage.from('story-images');
    const { error: upErr } = await storage.upload(path, bytes, { contentType: mime, cacheControl: '31536000' });
    if (upErr) {
      console.error('upload image', upErr.message);
      return NextResponse.json({ error: '그림을 저장하지 못했어요.' }, { status: 500 });
    }
    return NextResponse.json({ url: storage.getPublicUrl(path).data.publicUrl });
  } catch (e) {
    console.error('image', e);
    return NextResponse.json({ error: '그림을 그리지 못했어요.' }, { status: 500 });
  }
}
