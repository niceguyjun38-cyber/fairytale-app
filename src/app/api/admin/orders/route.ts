import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { getAdminSupabase, getServerSupabase } from '@/lib/supabaseServer';

// 관리자: 계좌이체 입금 확인 → 이용권 지급 / 주문 취소

async function guard() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 }) };
  if (!isAdmin(user)) return { error: NextResponse.json({ error: '관리자만 볼 수 있어요.', userId: user.id }, { status: 403 }) };
  const admin = getAdminSupabase();
  if (!admin) return { error: NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았어요.' }, { status: 503 }) };
  return { admin, user };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const { data, error } = await g.admin
    .from('orders')
    .select('id, user_id, plan, amount, status, method, depositor, created_at, approved_at')
    .eq('method', 'bank')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('admin orders', error.message);
    return NextResponse.json({ error: `주문을 불러오지 못했어요. 2026-11-17-payments.sql 을 실행했는지 확인해 주세요. (${error.message})` }, { status: 500 });
  }
  const ids = [...new Set((data || []).map(o => o.user_id))];
  const { data: people } = ids.length
    ? await g.admin.from('profiles').select('id, nickname, credits, plan').in('id', ids)
    : { data: [] as { id: string; nickname: string | null; credits: number; plan: string }[] };
  const byId = new Map((people || []).map(p => [p.id, p]));
  return NextResponse.json({
    orders: (data || []).map(o => ({ ...o, nickname: byId.get(o.user_id)?.nickname ?? null, credits: byId.get(o.user_id)?.credits ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const { orderId, action } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || !['confirm', 'cancel'].includes(action)) {
    return NextResponse.json({ error: '요청을 확인해 주세요.' }, { status: 400 });
  }
  const { data: order } = await g.admin.from('orders').select('id, status, method').eq('id', orderId).maybeSingle();
  if (!order || order.method !== 'bank') return NextResponse.json({ error: '계좌이체 주문을 찾을 수 없어요.' }, { status: 404 });

  if (action === 'cancel') {
    const { error } = await g.admin.from('orders').update({ status: 'canceled' }).eq('id', orderId).eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (order.status !== 'pending' && order.status !== 'canceled') {
    return NextResponse.json({ error: '이미 처리된 주문이에요.' }, { status: 409 });
  }
  // 기한이 지나 취소된 주문도 늦게 입금되면 확인할 수 있게 다시 대기로 돌려요
  if (order.status === 'canceled') await g.admin.from('orders').update({ status: 'pending' }).eq('id', orderId).eq('status', 'canceled');
  const stamp = `bank:${new Date().toISOString().slice(0, 10)}:${g.user.id.slice(0, 8)}`;
  const { data, error } = await g.admin.rpc('grant_paid_order', { p_order: orderId, p_payment_key: stamp });
  if (error || !data?.[0]) {
    console.error('admin grant', error?.message);
    return NextResponse.json({ error: `지급하지 못했어요. 2026-11-17-payments.sql 을 실행했는지 확인해 주세요. (${error?.message})` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, plan: data[0].plan, credits: Number(data[0].credits) });
}
