import { NextRequest, NextResponse } from 'next/server';
import { BANK, bankEnabled } from '@/data/business';
import { getAdminSupabase, getServerSupabase } from '@/lib/supabaseServer';

// 계좌이체(무통장입금) 주문 · 입금이 확인되면 관리자가 /admin 에서 이용권을 지급해요.

const DAY = 24 * 60 * 60 * 1000;
const PLAN_NAME: Record<string, string> = { moon: '달빛 30일 이용권', star: '별빛 30일 이용권' };

type OrderRow = { id: string; plan: string; amount: number; status: string; depositor: string | null; created_at: string };

function view(o: OrderRow) {
  return {
    orderId: o.id,
    plan: o.plan,
    orderName: PLAN_NAME[o.plan] ?? o.plan,
    amount: o.amount,
    depositor: o.depositor,
    createdAt: o.created_at,
    dueAt: new Date(new Date(o.created_at).getTime() + BANK.days * DAY).toISOString(),
    bank: { bank: BANK.bank, account: BANK.account, holder: BANK.holder },
  };
}

type Ready = { admin: NonNullable<ReturnType<typeof getAdminSupabase>>; supabase: Awaited<ReturnType<typeof getServerSupabase>>; user: { id: string } };
async function setup(): Promise<Ready | { error: NextResponse }> {
  const admin = getAdminSupabase();
  if (!bankEnabled() || !admin) return { error: NextResponse.json({ error: '계좌이체 결제를 준비하고 있어요. (B1)' }, { status: 503 }) };
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 }) };
  return { admin, supabase, user };
}

async function myPending(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, userId: string) {
  const since = new Date(Date.now() - BANK.days * DAY).toISOString();
  const { data, error } = await admin
    .from('orders')
    .select('id, plan, amount, status, depositor, created_at')
    .eq('user_id', userId)
    .eq('method', 'bank')
    .eq('status', 'pending')
    .gt('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as OrderRow[];
}

// 내 입금 대기 주문
export async function GET() {
  const s = await setup();
  if ('error' in s) return s.error.status === 503 ? NextResponse.json({ orders: [] }) : s.error;
  try {
    return NextResponse.json({ orders: (await myPending(s.admin, s.user.id)).map(view) });
  } catch (e) {
    console.error('bank list', e);
    return NextResponse.json({ orders: [] });
  }
}

// 계좌이체 주문 만들기 (금액은 서버가 정해요)
export async function POST(req: NextRequest) {
  const { plan, depositor } = await req.json().catch(() => ({}));
  if (plan !== 'moon' && plan !== 'star') return NextResponse.json({ error: '이용권을 다시 골라 주세요.' }, { status: 400 });
  const name = typeof depositor === 'string' ? depositor.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 20) return NextResponse.json({ error: '입금하실 분 이름을 2~20자로 적어 주세요.' }, { status: 400 });

  const s = await setup();
  if ('error' in s) return s.error;
  try {
    // 같은 이용권의 입금 대기 주문이 있으면 새로 만들지 않고 그걸 보여줘요
    const pending = await myPending(s.admin, s.user.id);
    if (pending.length >= 3) return NextResponse.json({ error: '입금 대기 중인 주문이 많아요. 먼저 입금하거나 취소해 주세요.' }, { status: 429 });
    const same = pending.find(o => o.plan === plan);
    if (same) {
      if (same.depositor !== name) await s.admin.from('orders').update({ depositor: name }).eq('id', same.id);
      return NextResponse.json(view({ ...same, depositor: name }));
    }

    const { data, error } = await s.supabase.rpc('create_order', { p_plan: plan });
    if (error || !data?.[0]) throw new Error(error?.message || 'create_order');
    const id = data[0].order_id as string;
    const { data: row, error: upErr } = await s.admin
      .from('orders')
      .update({ method: 'bank', depositor: name })
      .eq('id', id)
      .select('id, plan, amount, status, depositor, created_at')
      .single();
    if (upErr || !row) throw new Error(upErr?.message || 'update order');
    return NextResponse.json(view(row as OrderRow));
  } catch (e) {
    console.error('bank order', e);
    return NextResponse.json({ error: '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요. (B2)' }, { status: 500 });
  }
}

// 입금 전 주문 취소
export async function DELETE(req: NextRequest) {
  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string') return NextResponse.json({ error: '주문을 확인해 주세요.' }, { status: 400 });
  const s = await setup();
  if ('error' in s) return s.error;
  const { error } = await s.admin
    .from('orders')
    .update({ status: 'canceled' })
    .eq('id', orderId)
    .eq('user_id', s.user.id)
    .eq('method', 'bank')
    .eq('status', 'pending');
  if (error) return NextResponse.json({ error: '취소하지 못했어요.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
