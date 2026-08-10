import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 });
    }

    const { storyId, title, seedId, totalPages, isPublic, pages } = await req.json();

    const coverUrl = pages?.[0]?.imageUrl || null;

    // 1. 동화 레코드 생성 (클라이언트가 만든 id 사용)
    const { data: fairytale, error: ftError } = await supabase
      .from('fairytales')
      .insert({
        id: storyId,
        user_id: user.id,
        title,
        seed_story_id: seedId,
        total_pages: totalPages,
        is_public: isPublic,
        status: 'completed',
        cover_image_url: coverUrl,
      })
      .select()
      .single();

    if (ftError) throw new Error(ftError.message);

    // 2. 페이지 일괄 저장 (이미지는 이미 업로드된 URL)
    const rows = pages.map((p: any, i: number) => ({
      fairytale_id: fairytale.id,
      page_number: i,
      ai_text: p.text,
      image_url: p.imageUrl || null,
    }));

    const { error: pageError } = await supabase.from('pages').insert(rows);
    if (pageError) throw new Error(pageError.message);

    return NextResponse.json({ success: true, id: fairytale.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
