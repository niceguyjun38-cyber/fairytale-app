import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

// 그림까지 완성된 초안을 서재의 책으로 확정해요 (여러 번 호출해도 안전)
export async function POST(req: NextRequest) {
  try {
    const { storyId, title, pages, isPublic } = await req.json();
    if (typeof storyId !== 'string' || !Array.isArray(pages) || !pages.length || pages.length > 20) {
      return NextResponse.json({ error: '저장할 동화를 확인해 주세요.' }, { status: 400 });
    }
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

    const { data: tale } = await supabase.from('fairytales').select('id, user_id, status').eq('id', storyId).single();
    if (!tale || tale.user_id !== user.id) return NextResponse.json({ error: '동화를 찾을 수 없어요.' }, { status: 404 });

    const clean = pages.map((p: { text?: unknown; imageUrl?: unknown }, i: number) => ({
      fairytale_id: storyId,
      page_number: i,
      ai_text: String(p.text ?? '').slice(0, 2000),
      image_url: typeof p.imageUrl === 'string' && p.imageUrl.startsWith('https://') ? p.imageUrl : null,
    }));

    await supabase.from('pages').delete().eq('fairytale_id', storyId);
    const { error: pageError } = await supabase.from('pages').insert(clean);
    if (pageError) throw new Error(pageError.message);

    const update: Record<string, unknown> = {
      title: String(title || '').trim().slice(0, 70) || '우리 동화',
      cover_image_url: clean[0].image_url,
      status: 'completed',
    };
    if (tale.status !== 'completed') update.completed_at = new Date().toISOString();
    if (typeof isPublic === 'boolean') update.is_public = isPublic;
    const { error: ftError } = await supabase.from('fairytales').update(update).eq('id', storyId);
    if (ftError) throw new Error(ftError.message);

    return NextResponse.json({ ok: true, id: storyId });
  } catch (e) {
    console.error('finish-story', e);
    return NextResponse.json({ error: '서재에 저장하지 못했어요. 다시 시도해 주세요.' }, { status: 500 });
  }
}
