import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const PLAN_CREDITS: Record<string, number> = { free: 2, moon: 8, star: 18 };
const PAGE_COST: Record<number, number> = { 8: 1, 12: 1.5, 15: 2 };

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

// 월이 바뀌었으면 크레딧 리셋 (유료 플랜만)
function needsReset(plan: string, resetAt: string): boolean {
  if (plan === 'free') return false;
  const last = new Date(resetAt);
  const now = new Date();
  return (
    last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth()
  );
}

// GET: 내 플랜/크레딧 조회
export async function GET() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ plan: 'guest', credits: 0 });
    }

    let { data: profile } = await supabase
      .from('profiles')
      .select('plan, credits, credits_reset_at')
      .eq('id', user.id)
      .single();

    // 프로필이 없으면 생성
    if (!profile) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, plan: 'free', credits: 2 })
        .select('plan, credits, credits_reset_at')
        .single();
      profile = created;
    }

    if (!profile) {
      return NextResponse.json({ plan: 'free', credits: 0 });
    }

    // 월간 리셋
    if (needsReset(profile.plan, profile.credits_reset_at)) {
      const fresh = PLAN_CREDITS[profile.plan] ?? 0;
      await supabase
        .from('profiles')
        .update({ credits: fresh, credits_reset_at: new Date().toISOString() })
        .eq('id', user.id);
      return NextResponse.json({ plan: profile.plan, credits: fresh });
    }

    return NextResponse.json({ plan: profile.plan, credits: Number(profile.credits) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 크레딧 차감 (동화 만들기 시작할 때)
export async function POST(req: NextRequest) {
  try {
    const { pages } = await req.json();
    const cost = PAGE_COST[pages] ?? 1;

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, credits')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없어요' }, { status: 404 });
    }

    const current = Number(profile.credits);
    if (current < cost) {
      return NextResponse.json(
        { error: 'NOT_ENOUGH', credits: current, needed: cost },
        { status: 402 }
      );
    }

    const remaining = current - cost;
    await supabase.from('profiles').update({ credits: remaining }).eq('id', user.id);

    return NextResponse.json({ success: true, credits: remaining, used: cost });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}