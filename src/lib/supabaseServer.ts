import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
  if (typeof storyId !== 'string' || !/^[0-9a-f-]{36}$/i.test(storyId)) return false;
  const { data, error } = await supabase.rpc('consume_story_usage', { p_story: storyId, p_kind: kind });
  if (error) {
    console.error('consume_story_usage', error.message);
    return false;
  }
  return data === true;
}

export function errorMessage(e: unknown, fallback = '잠시 후 다시 시도해 주세요.') {
  return e instanceof Error && e.message ? e.message : fallback;
}
