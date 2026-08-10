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

    // 로그인 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 });
    }

    const { title, seedId, totalPages, isPublic, pages } = await req.json();

    // 1. 동화 레코드 생성
    const { data: fairytale, error: ftError } = await supabase
      .from('fairytales')
      .insert({
        user_id: user.id,
        title,
        seed_story_id: seedId,
        total_pages: totalPages,
        is_public: isPublic,
        status: 'completed',
      })
      .select()
      .single();

    if (ftError) throw new Error(ftError.message);

    // 2. 각 페이지 저장 (이미지는 Storage에 업로드)
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      let imageUrl = null;

      // base64 이미지를 Storage에 업로드
      if (page.imageUrl && page.imageUrl.startsWith('data:image')) {
        const base64Data = page.imageUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = `${fairytale.id}/page-${i}.png`;

        const { error: uploadError } = await supabase.storage
          .from('story-images')
          .upload(filePath, buffer, { contentType: 'image/png' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('story-images')
            .getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        }
      }

      await supabase.from('pages').insert({
        fairytale_id: fairytale.id,
        page_number: i,
        ai_text: page.text,
        image_url: imageUrl,
      });

      // 표지 이미지를 동화 커버로 설정
      if (i === 0 && imageUrl) {
        await supabase
          .from('fairytales')
          .update({ cover_image_url: imageUrl })
          .eq('id', fairytale.id);
      }
    }

    return NextResponse.json({ success: true, id: fairytale.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}