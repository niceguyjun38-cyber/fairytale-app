import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { StoryView } from './StoryView';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from('fairytales').select('title, cover_image_url').eq('id', id).maybeSingle();
    if (!data) return { title: '그림책' };
    const description = '아이가 말로 만든 세상에 하나뿐인 그림책이에요. 꼬마작가 동화공방에서 읽어 보세요.';
    return {
      title: data.title,
      description,
      openGraph: { title: `「${data.title}」 · 꼬마작가 동화공방`, description, images: data.cover_image_url ? [{ url: data.cover_image_url }] : ['/og.jpg'] },
    };
  } catch {
    return { title: '그림책' };
  }
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params;
  return <StoryView id={id} />;
}
