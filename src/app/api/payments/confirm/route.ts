import { NextRequest, NextResponse } from 'next/server';
import { PLANS } from '@/data/seedStories';
import { getAdminSupabase, getServerSupabase } from '@/lib/supabaseServer';

const DAY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json();
    if (typeof paymentKey !== 'string' || typeof orderId !== 'string') {
      return NextResponse.json({ error: '결제 정보를 확인해 주세요.' }, { status: 400 });
    }
    const admin = getAdminSupabase();
    const secret = process.env.TOSS_SECRET_KEY;
    if (!admin || !secret) return NextResponse.json({ error: '결제 서버 설정이 아직 끝나지 않았어요.' }, { status: 503 });

    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
    if (!order || order.user_id !== user.id) return NextResponse.json({ error: '주문을 찾을 수 없어요.' }, { status: 404 });
    if (order.status === 'paid') return NextResponse.json({ ok: true, plan: order.plan, already: true });
    if (Number(amount) !== order.amount) return NextResponse.json({ error: '결제 금액이 주문과 달라요.' }, { status: 400 });

    const toss = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
    });
    const result = await toss.json();
    if (!toss.ok && result.code !== 'ALREADY_PROCESSED_PAYMENT') {
      await admin.from('orders').update({ status: 'failed', payment_key: paymentKey }).eq('id', orderId).eq('status', 'pending');
      return NextResponse.json({ error: result.message || '결제를 승인하지 못했어요.' }, { status: 400 });
    }

    // 주문을 먼저 '결제됨'으로 바꿔서 중복 지급을 막아요
    const { data: claimed } = await admin
      .from('orders')
      .update({ status: 'paid', payment_key: paymentKey, approved_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id');
    if (!claimed?.length) return NextResponse.json({ ok: true, plan: order.plan, already: true });

    const plan = PLANS.find(p => p.id === order.plan)!;
    const { data: profile } = await admin.from('profiles').select('plan, credits, plan_expires_at').eq('id', user.id).single();
    const now = Date.now();
    const currentEnd = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : 0;
    const keepGoing = profile?.plan === plan.id && currentEnd > now;
    const base = keepGoing ? currentEnd : now;
    // 별빛 → 달빛으로 바꿔도 더 높은 플랜은 남은 기간 동안 유지
    const nextPlan = profile?.plan === 'star' && currentEnd > now && plan.id === 'moon' ? 'star' : plan.id;
    await admin.from('profiles').upsert({
      id: user.id,
      plan: nextPlan,
      plan_expires_at: new Date(base + 30 * DAY).toISOString(),
      credits: Number(profile?.credits ?? 0) + plan.credits,
    });

    return NextResponse.json({ ok: true, plan: nextPlan, credits: Number(profile?.credits ?? 0) + plan.credits });
  } catch (e) {
    console.error('confirm', e);
    return NextResponse.json({ error: '결제 확인 중 문제가 생겼어요. 고객센터로 알려 주세요.' }, { status: 500 });
  }
}
