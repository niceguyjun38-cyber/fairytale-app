-- ════════════════════════════════════════════════════════════════
-- 꼬마작가 동화공방 · 결제 지급을 한 번에 처리하는 함수 (2026-11-17)
-- Supabase → SQL Editor → New query → 전체 붙여넣기 → Run
-- launch.sql 을 이미 실행한 뒤에 실행하세요. 여러 번 실행해도 안전해요.
--
-- 왜 필요한가요?
--   예전에는 "주문을 결제됨으로 표시"와 "별가루 지급"이 따로 저장됐어요.
--   그 사이에 서버가 멈추면 돈은 결제됐는데 별가루가 안 들어갈 수 있었어요.
--   이 함수는 두 가지를 하나의 거래로 묶어서, 둘 다 되거나 둘 다 안 되게 해요.
--   (함수를 아직 안 만들었어도 서버는 예전 방식으로 동작하니 결제가 멈추지는 않아요.)
-- ════════════════════════════════════════════════════════════════

create or replace function grant_paid_order(p_order text, p_payment_key text)
returns table (plan text, credits numeric, plan_expires_at timestamptz, already boolean)
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  p profiles%rowtype;
  v_add numeric;
  v_base timestamptz;
  v_plan text;
begin
  -- 주문 잠금: 같은 주문을 동시에 두 번 처리하지 못해요
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  insert into profiles (id, plan, credits) values (o.user_id, 'free', 0) on conflict (id) do nothing;
  select * into p from profiles where id = o.user_id for update;

  if o.status = 'paid' then
    return query select p.plan, p.credits, p.plan_expires_at, true;
    return;
  end if;

  -- 지급 별가루 (src/data/seedStories.ts 의 PLANS 와 같아야 해요)
  v_add := case o.plan when 'moon' then 8 when 'star' then 18 else null end;
  if v_add is null then raise exception 'BAD_PLAN'; end if;

  -- 같은 이용권(또는 더 높은 별빛)이 남아 있으면 그 끝에서 30일 연장, 아니면 지금부터 30일
  if p.plan_expires_at is not null and p.plan_expires_at > now()
     and (p.plan = o.plan or p.plan = 'star') then
    v_base := p.plan_expires_at;
  else
    v_base := now();
  end if;
  -- 별빛 기간 중 달빛을 사도 별빛은 유지
  v_plan := case when p.plan = 'star' and p.plan_expires_at > now() and o.plan = 'moon' then 'star' else o.plan end;

  update orders set status = 'paid', payment_key = p_payment_key, approved_at = now() where id = o.id;
  update profiles
     set plan = v_plan,
         plan_expires_at = v_base + interval '30 days',
         credits = profiles.credits + v_add
   where id = o.user_id
  returning profiles.plan, profiles.credits, profiles.plan_expires_at into p.plan, p.credits, p.plan_expires_at;

  return query select p.plan, p.credits, p.plan_expires_at, false;
end $$;

-- 서버(관리자 키)만 부를 수 있어요
revoke execute on function grant_paid_order(text, text) from public, anon, authenticated;
grant execute on function grant_paid_order(text, text) to service_role;

-- 끝! "Success. No rows returned" 가 나오면 완료예요.
