import type { User } from '@supabase/supabase-js';

/**
 * 관리자 = Vercel 환경변수 ADMIN_USER_IDS 에 적힌 사용자 ID (쉼표로 여러 명).
 * 내 사용자 ID는 로그인한 뒤 /admin 화면에서 확인할 수 있어요.
 */
export function isAdmin(user: User | null | undefined) {
  if (!user) return false;
  const ids = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(user.id);
}
