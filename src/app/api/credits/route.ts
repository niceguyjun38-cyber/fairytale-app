import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

const ERRORS: Record<string, [number, string]> = {
  NOT_LOGGED_IN: [401, '로그인이 필요해요.'],
  NOT_ENOUGH: [402, '별가루가 부족해요.'],
  PLAN_REQUIRED: [403, '이 길이는 구독 플랜에서 만들 수 있어요.'],
  BAD_PAGES: [400, '동화 길이를 다시 골라 주세요.'],
};

function mapError(message: string) {
  const key = Object.keys(ERRORS).find(k => message.includes(k));
  return key ? { code: key, status: ERRORS[key][0], text: ERRORS[key][1] } : { code: 'UNKNOWN', status: 500, text: '잠시 후 다시 시도해 주세요.' };
}

// 내 플랜과 별가루
export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ plan: 'guest', credits: 0, planExpiresAt: null });

  const { data, error } = await supabase.rpc('get_my_wallet');
  if (error || !data?.[0]) {
    console.error('get_my_wallet', error?.message);
    return NextResponse.json({ error: '별가루 정보를 불러오지 못했어요.' }, { status: 500 });
  }
  const w = data[0];
  return NextResponse.json({ plan: w.plan, credits: Number(w.credits), planExpiresAt: w.plan_expires_at });
}

// 동화 시작: 별가루 차감 + 초안 생성
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pages = Number(body.pages);
  const seed = Number(body.seed);
  if (![8, 12, 15].includes(pages) || !(seed >= 1 && seed <= 6)) {
    return NextResponse.json({ error: '동화 길이를 다시 골라 주세요.', code: 'BAD_PAGES' }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('start_story', { p_seed: seed, p_pages: pages });
  if (error || !data?.[0]) {
    const m = mapError(error?.message || '');
    if (m.code === 'UNKNOWN') console.error('start_story', error?.message);
    return NextResponse.json({ error: m.text, code: m.code }, { status: m.status });
  }
  return NextResponse.json({ storyId: data[0].story_id, credits: Number(data[0].credits) });
}
