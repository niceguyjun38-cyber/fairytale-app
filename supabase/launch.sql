-- ════════════════════════════════════════════════════════════════
-- 꼬마작가 동화공방 · 출시 준비 마이그레이션
-- Supabase → SQL Editor → New query → 전체 붙여넣기 → Run
-- 여러 번 실행해도 안전하도록 작성되어 있어요.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 컬럼 추가 ────────────────────────────────────────────────
alter table profiles   add column if not exists plan_expires_at timestamptz;
alter table fairytales add column if not exists draft_parts  jsonb default '[]'::jsonb;
alter table fairytales add column if not exists draft_images jsonb default '[]'::jsonb;
alter table fairytales add column if not exists completed_at timestamptz;
alter table pages      add column if not exists audio_urls jsonb default '{}'::jsonb;

-- 기존 계정 중 프로필이 없는 계정에 무료 별가루 지급
insert into profiles (id, plan, credits)
select id, 'free', 2 from auth.users
on conflict (id) do nothing;

-- ── 2. AI 사용량 / 주문 테이블 (클라이언트 접근 불가) ──────────────
create table if not exists story_usage (
  story_id uuid primary key references fairytales(id) on delete cascade,
  story_calls int not null default 0,
  image_calls int not null default 0,
  tts_calls   int not null default 0,
  word_calls  int not null default 0
);
alter table story_usage enable row level security;

create table if not exists orders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount int not null,
  status text not null default 'pending',
  payment_key text,
  created_at timestamptz default now(),
  approved_at timestamptz
);
alter table orders enable row level security;
drop policy if exists "orders_select_own" on orders;
create policy "orders_select_own" on orders for select using (auth.uid() = user_id);

-- ── 3. 보안 정책 정리 ────────────────────────────────────────────
-- 프로필: 본인 조회만 가능. 별가루·플랜은 서버(함수/결제)만 바꿀 수 있음
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
revoke insert, update, delete on profiles from anon, authenticated;

-- 동화
drop policy if exists "fairytales_select" on fairytales;
drop policy if exists "fairytales_insert" on fairytales;
drop policy if exists "fairytales_update" on fairytales;
drop policy if exists "fairytales_delete" on fairytales;
create policy "fairytales_select" on fairytales for select
  using ((is_public = true and status = 'completed') or auth.uid() = user_id);
create policy "fairytales_update" on fairytales for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fairytales_delete" on fairytales for delete
  using (auth.uid() = user_id);
-- 새 동화는 start_story() 함수로만 만들어요 (별가루 차감과 함께)
revoke insert on fairytales from anon, authenticated;
-- 좋아요·조회수는 사용자가 직접 고칠 수 없게
revoke update on fairytales from anon, authenticated;
grant update (title, is_public, draft_parts, draft_images, cover_image_url, status, completed_at)
  on fairytales to authenticated;

-- 페이지
drop policy if exists "pages_select" on pages;
drop policy if exists "pages_insert" on pages;
drop policy if exists "pages_update" on pages;
drop policy if exists "pages_delete" on pages;
create policy "pages_select" on pages for select using (
  exists (select 1 from fairytales f where f.id = pages.fairytale_id
          and ((f.is_public and f.status = 'completed') or f.user_id = auth.uid())));
create policy "pages_insert" on pages for insert with check (
  exists (select 1 from fairytales f where f.id = pages.fairytale_id and f.user_id = auth.uid()));
create policy "pages_update" on pages for update using (
  exists (select 1 from fairytales f where f.id = pages.fairytale_id and f.user_id = auth.uid()));
create policy "pages_delete" on pages for delete using (
  exists (select 1 from fairytales f where f.id = pages.fairytale_id and f.user_id = auth.uid()));

-- 좋아요: 본인 이름으로만
drop policy if exists "likes_insert" on likes;
create policy "likes_insert" on likes for insert with check (auth.uid() = user_id);

-- 스토리지: 공개 버킷은 목록 조회 정책이 없어도 이미지·음성 주소로 열려요
drop policy if exists "public_read" on storage.objects;
drop policy if exists "public_read_audio" on storage.objects;
drop policy if exists "authenticated_upload" on storage.objects;
drop policy if exists "authenticated_upload_audio" on storage.objects;
create policy "authenticated_upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('story-images', 'story-audio'));

-- ── 4. 서버 함수 ─────────────────────────────────────────────────
-- 플랜 만료 처리 + 내 별가루 조회
create or replace function get_my_wallet()
returns table (plan text, credits numeric, plan_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  insert into profiles (id, plan, credits) values (uid, 'free', 2) on conflict (id) do nothing;
  update profiles p set plan = 'free'
   where p.id = uid and p.plan <> 'free' and p.plan_expires_at is not null and p.plan_expires_at < now();
  return query select p.plan, p.credits, p.plan_expires_at from profiles p where p.id = uid;
end $$;

-- 동화 시작: 플랜 확인 → 별가루 차감 → 초안 생성 (한 번에)
create or replace function start_story(p_seed int, p_pages int)
returns table (story_id uuid, credits numeric)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_cost numeric;
  v_plan text;
  v_left numeric;
  v_id uuid;
begin
  if uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  v_cost := case p_pages when 8 then 1 when 12 then 1.5 when 15 then 2 else null end;
  if v_cost is null then raise exception 'BAD_PAGES'; end if;

  select w.plan into v_plan from get_my_wallet() w;
  if p_pages = 12 and v_plan not in ('moon', 'star') then raise exception 'PLAN_REQUIRED'; end if;
  if p_pages = 15 and v_plan <> 'star' then raise exception 'PLAN_REQUIRED'; end if;

  update profiles set credits = profiles.credits - v_cost
   where id = uid and profiles.credits >= v_cost
   returning profiles.credits into v_left;
  if v_left is null then raise exception 'NOT_ENOUGH'; end if;

  insert into fairytales (user_id, title, seed_story_id, total_pages, is_public, status)
  values (uid, '만들고 있는 이야기', p_seed, p_pages, false, 'drafting')
  returning id into v_id;
  insert into story_usage (story_id) values (v_id);

  return query select v_id, v_left;
end $$;

-- AI 호출 횟수 확인 (한 동화당 상한)
create or replace function consume_story_usage(p_story uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_pages int;
  v_owner uuid;
  v_public boolean;
  v_ok boolean := false;
begin
  select user_id, total_pages, is_public into v_owner, v_pages, v_public from fairytales where id = p_story;
  if v_owner is null then return false; end if;
  -- 낭독·단어는 공개 동화라면 누구나, 나머지는 주인만
  if not ((p_kind in ('tts', 'word') and v_public) or v_owner = uid) then return false; end if;

  insert into story_usage (story_id) values (p_story) on conflict (story_id) do nothing;

  if p_kind = 'story' then
    update story_usage set story_calls = story_calls + 1
     where story_id = p_story and story_calls < v_pages * 3 returning true into v_ok;
  elsif p_kind = 'image' then
    update story_usage set image_calls = image_calls + 1
     where story_id = p_story and image_calls < v_pages + 8 returning true into v_ok;
  elsif p_kind = 'tts' then
    update story_usage set tts_calls = tts_calls + 1
     where story_id = p_story and tts_calls < (v_pages + 2) * 8 returning true into v_ok;
  elsif p_kind = 'word' then
    update story_usage set word_calls = word_calls + 1
     where story_id = p_story and word_calls < 6 returning true into v_ok;
  end if;
  return coalesce(v_ok, false);
end $$;

-- 결제 주문 만들기 (금액은 서버가 정해요)
create or replace function create_order(p_plan text)
returns table (order_id text, amount int, order_name text)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_amount int;
  v_name text;
  v_id text;
begin
  if uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  if p_plan = 'moon' then v_amount := 6900; v_name := '달빛 30일 이용권';
  elsif p_plan = 'star' then v_amount := 9900; v_name := '별빛 30일 이용권';
  else raise exception 'BAD_PLAN'; end if;
  v_id := 'dh_' || replace(gen_random_uuid()::text, '-', '');
  insert into orders (id, user_id, plan, amount) values (v_id, uid, p_plan, v_amount);
  return query select v_id, v_amount, v_name;
end $$;

-- 좋아요 수 자동 집계 / 조회수
create or replace function update_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update fairytales set like_count = like_count + 1 where id = NEW.fairytale_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update fairytales set like_count = greatest(like_count - 1, 0) where id = OLD.fairytale_id;
    return OLD;
  end if;
  return null;
end $$;
drop trigger if exists likes_count_trigger on likes;
create trigger likes_count_trigger after insert or delete on likes
for each row execute function update_like_count();

create or replace function increment_view(story_id uuid)
returns void language sql security definer set search_path = public as $$
  update fairytales set view_count = view_count + 1
   where id = story_id and is_public and status = 'completed';
$$;

-- 신규 가입 시 별가루 2개
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, plan, credits)
  values (new.id, new.raw_user_meta_data->>'name', 'free', 2)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

grant execute on function get_my_wallet() to authenticated;
grant execute on function start_story(int, int) to authenticated;
grant execute on function consume_story_usage(uuid, text) to anon, authenticated;
grant execute on function create_order(text) to authenticated;
grant execute on function increment_view(uuid) to anon, authenticated;

-- 끝! "Success. No rows returned" 가 나오면 완료예요.
