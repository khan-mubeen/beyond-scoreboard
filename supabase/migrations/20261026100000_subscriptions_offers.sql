-- subscriptions paid with (demo) money plus some points, partner offer codes, and the atomic
-- spend. spending is a negative row in points_ledger, so the balance is always the sum of the
-- ledger. each spend runs in one transaction behind a per-fan advisory lock: parallel clicks
-- queue, the balance is checked inside the lock, and it can never go below zero.
-- rls on, no policies: only the server (service role) reads or writes, and only it may call
-- the functions

alter table public.points_ledger add column if not exists ref text;

create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  points_used integer not null check (points_used >= 0),
  -- money is always required: a purchase never costs nothing
  demo_amount_eur numeric(8, 2) not null check (demo_amount_eur > 0),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create index user_subscriptions_user on public.user_subscriptions (user_id, expires_at desc);

create table public.offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  offer_id text not null,
  points_used integer not null check (points_used >= 0),
  code text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, offer_id)
);

alter table public.user_subscriptions enable row level security;
alter table public.offer_redemptions enable row level security;
grant select, insert, update, delete on public.user_subscriptions, public.offer_redemptions to service_role;
revoke all on public.user_subscriptions, public.offer_redemptions from anon, authenticated;

-- a subscription: the debit and the subscription row together, or nothing. the same
-- idempotency key returns the first result. an active plan of the same kind is extended: the
-- new period starts when the current one ends
create or replace function public.purchase_subscription(
  p_user uuid,
  p_plan text,
  p_points integer,
  p_amount_eur numeric,
  p_days integer,
  p_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.user_subscriptions;
  v_balance integer;
  v_start timestamptz;
begin
  if p_points is null or p_points < 0 or p_amount_eur is null or p_amount_eur <= 0 or p_days is null or p_days <= 0 or p_key is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  -- one spend at a time per fan
  perform pg_advisory_xact_lock(hashtextextended('spend:' || p_user::text, 0));

  select * into v_sub from public.user_subscriptions where idempotency_key = p_key;
  if found then
    if v_sub.user_id <> p_user then
      return jsonb_build_object('status', 'conflict');
    end if;
    select coalesce(sum(points), 0) into v_balance from public.points_ledger where user_id = p_user;
    return jsonb_build_object('status', 'ok', 'replayed', true, 'subscription', to_jsonb(v_sub), 'balance', v_balance);
  end if;

  select coalesce(sum(points), 0) into v_balance from public.points_ledger where user_id = p_user;
  if v_balance < p_points then
    return jsonb_build_object('status', 'insufficient', 'balance', v_balance);
  end if;

  select max(expires_at) into v_start
  from public.user_subscriptions
  where user_id = p_user and plan_id = p_plan and status <> 'expired' and expires_at > now();
  v_start := greatest(coalesce(v_start, now()), now());

  insert into public.user_subscriptions (user_id, plan_id, started_at, expires_at, points_used, demo_amount_eur, status, idempotency_key)
  values (p_user, p_plan, v_start, v_start + make_interval(days => p_days), p_points, p_amount_eur, 'active', p_key)
  returning * into v_sub;

  if p_points > 0 then
    insert into public.points_ledger (user_id, points, reason, ref) values (p_user, -p_points, 'subscription', v_sub.id::text);
  end if;

  return jsonb_build_object('status', 'ok', 'replayed', false, 'subscription', to_jsonb(v_sub), 'balance', v_balance - p_points);
end;
$$;

-- a partner offer: once per fan. a second call returns the code already given
create or replace function public.redeem_offer(
  p_user uuid,
  p_offer text,
  p_points integer,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_red public.offer_redemptions;
  v_balance integer;
begin
  if p_points is null or p_points < 0 or p_code is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('spend:' || p_user::text, 0));

  select coalesce(sum(points), 0) into v_balance from public.points_ledger where user_id = p_user;
  select * into v_red from public.offer_redemptions where user_id = p_user and offer_id = p_offer;
  if found then
    return jsonb_build_object('status', 'ok', 'replayed', true, 'redemption', to_jsonb(v_red), 'balance', v_balance);
  end if;
  if v_balance < p_points then
    return jsonb_build_object('status', 'insufficient', 'balance', v_balance);
  end if;

  insert into public.offer_redemptions (user_id, offer_id, points_used, code)
  values (p_user, p_offer, p_points, p_code)
  returning * into v_red;

  if p_points > 0 then
    insert into public.points_ledger (user_id, points, reason, ref) values (p_user, -p_points, 'offer', v_red.id::text);
  end if;

  return jsonb_build_object('status', 'ok', 'replayed', false, 'redemption', to_jsonb(v_red), 'balance', v_balance - p_points);
end;
$$;

revoke execute on function public.purchase_subscription(uuid, text, integer, numeric, integer, text) from public, anon, authenticated;
revoke execute on function public.redeem_offer(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.purchase_subscription(uuid, text, integer, numeric, integer, text) to service_role;
grant execute on function public.redeem_offer(uuid, text, integer, text) to service_role;
