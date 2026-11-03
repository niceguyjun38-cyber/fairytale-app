import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const { plan } = await req.json().catch(() => ({}));
  if (plan !== 'moon' && plan !== 'star') return NextResponse.json({ error: '플랜을 다시 골라 주세요.' }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || !process.env.TOSS_SECRET_KEY) {
    return NextResponse.json({ error: '결제 준비 중이에요. 조금만 기다려 주세요. (S1)' }, { status: 503 });
  }
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

  const { data, error } = await supabase.rpc('create_order', { p_plan: plan });
  if (error || !data?.[0]) {
    console.error('create_order', error?.message);
    return NextResponse.json({ error: `주문을 만들지 못했어요. 다시 시도해 주세요. (R${error ? 1 : 2})` }, { status: 500 });
  }
  return NextResponse.json({
    orderId: data[0].order_id,
    amount: data[0].amount,
    orderName: data[0].order_name,
    customerKey: user.id,
  });
}
