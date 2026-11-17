import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SEED_STORIES } from '@/data/seedStories';

/** 요청한 사용자의 로그인 정보로 동작하는 서버용 클라이언트 */
export async function getServerSupabase() {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // 서버 컴포넌트에서 호출된 경우 쿠키를 쓸 수 없어요. 무시해도 괜찮아요.
          }
        },
      },
    }
  );
}

let admin: SupabaseClient | null | undefined;
/** 서버 전용 관리자 클라이언트 (SUPABASE_SERVICE_ROLE_KEY 필요). 없으면 null */
export function getAdminSupabase(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = key
    ? createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return admin;
}

/** 사용량 확인. 함수가 아직 없으면(마이그레이션 전) 막아요. */
export async function consumeUsage(supabase: SupabaseClient, storyId: unknown, kind: 'story' | 'image' | 'tts' | 'word') {
  if (!isStoryId(storyId)) return false;
  const { data, error } = await supabase.rpc('consume_story_usage', { p_story: storyId, p_kind: kind });
  if (error) {
    console.error('consume_story_usage', error.message);
    return false;
  }
  return data === true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isStoryId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/**
 * 동화의 장별 문장을 DB에서 읽어요. 낭독·단어 기능은 화면이 보낸 글이 아니라 이 글만 사용해요.
 * (아무 글이나 보내서 유료 AI를 쓰는 것을 막기 위해서예요.)
 * 순서: [표지 제목, 이야기의 시작, 1장, 2장, …] — 그림책 화면의 쪽 순서와 같아요.
 * 볼 권한이 없거나 동화가 없으면 null.
 */
export async function loadStoryTexts(supabase: SupabaseClient, storyId: unknown): Promise<string[] | null> {
  if (!isStoryId(storyId)) return null;
  const { data: tale } = await supabase
    .from('fairytales')
    .select('title, seed_story_id, status, draft_parts')
    .eq('id', storyId)
    .maybeSingle();
  if (!tale) return null;
  if (tale.status === 'completed') {
    const { data: rows } = await supabase.from('pages').select('page_number, ai_text').eq('fairytale_id', storyId).order('page_number');
    if (!rows?.length) return null;
    return rows.map(r => String(r.ai_text ?? ''));
  }
  const seed = SEED_STORIES.find(s => s.id === tale.seed_story_id) || SEED_STORIES[0];
  const parts: { ai?: unknown }[] = Array.isArray(tale.draft_parts) ? tale.draft_parts : [];
  return [tale.title || seed.title, seed.preview, ...parts.map(p => String(p?.ai ?? ''))];
}

/** 이 동화의 그림으로 저장된 주소인지 확인 (다른 사이트 이미지가 공개 책장에 올라가지 않게) */
export function isOwnStoryImage(url: unknown, storyId: string): url is string {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/story-images/${storyId}/`;
  return typeof url === 'string' && url.startsWith(base) && !url.slice(base.length).includes('..');
}

export function errorMessage(e: unknown, fallback = '잠시 후 다시 시도해 주세요.') {
  return e instanceof Error && e.message ? e.message : fallback;
}
