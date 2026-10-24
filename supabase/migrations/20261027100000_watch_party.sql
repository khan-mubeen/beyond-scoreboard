-- the watch party: one leader runs the live engine, presence lives in the database so every
-- server agrees on who is watching, the match discussion becomes the party feed (chat, system
-- lines, fact cards, trivia, reaction bursts), and friends, invites and guest passes.
-- rls on, no policies, as for every table: only the server (service role) reads or writes

-- ---------- the engine leader: a lease in settings ("engine_leader": instance + expires_at) ----------

-- claims or renews the lease in one statement (an atomic compare-and-set on the row): it is
-- taken when it is free, expired or already ours. the database's clock is the only clock
create or replace function public.claim_engine_leader(p_instance text, p_ttl_seconds integer default 15)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  insert into public.settings as s (key, value, updated_at)
  values ('engine_leader', jsonb_build_object('instance', p_instance, 'expires_at', now() + make_interval(secs => p_ttl_seconds)), now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now()
    where s.value ->> 'instance' = p_instance or (s.value ->> 'expires_at')::timestamptz <= now()
  returning value into v;
  if v is null then
    select value into v from public.settings where key = 'engine_leader';
  end if;
  return jsonb_build_object('leader', v ->> 'instance' = p_instance, 'instance', v ->> 'instance', 'expiresAt', v ->> 'expires_at', 'now', now());
end;
$$;

-- a leader shutting down lets go at once, so a follower takes over on its next try
create or replace function public.release_engine_leader(p_instance text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.settings
  set value = jsonb_set(value, '{expires_at}', to_jsonb(now())), updated_at = now()
  where key = 'engine_leader' and value ->> 'instance' = p_instance;
$$;

revoke execute on function public.claim_engine_leader(text, integer) from public, anon, authenticated;
revoke execute on function public.release_engine_leader(text) from public, anon, authenticated;
grant execute on function public.claim_engine_leader(text, integer) to service_role;
grant execute on function public.release_engine_leader(text) to service_role;

-- ---------- presence: who is in a match's party this cycle, and when they were last seen ----------

-- one row per fan per match and cycle (a rotation cycle, or "-" for other matches). a heartbeat
-- every 30 s upserts last_seen; active = seen in the last 90 s. the rows also say who joined the
-- party this cycle, so the party board lists everyone, 0 points included
create table public.party_presence (
  match_id text not null,
  cycle text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (match_id, cycle, user_id)
);
create index party_presence_active on public.party_presence (match_id, cycle, last_seen desc);
create index party_presence_user on public.party_presence (user_id, last_seen desc);

-- ---------- the party feed: the match discussion plus what the party sees in it ----------

-- kind: chat (a fan), system (a goal, a result; no author), fact (an "ask the match" answer),
-- trivia (a question card), burst (a floating reaction). cycle keeps each rotation run's party
-- apart. dedupe_key stops a system line being posted twice (a restart, a new leader)
alter table public.comments
  alter column user_id drop not null,
  add column kind text not null default 'chat' check (kind in ('chat', 'system', 'fact', 'trivia', 'burst')),
  add column cycle text not null default '',
  add column data jsonb,
  add column dedupe_key text unique;
create index comments_feed on public.comments (match_id, cycle, created_at desc);

-- emoji reactions on a feed item, one of each per fan
create table public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
create index comment_reactions_user on public.comment_reactions (user_id);

-- ---------- friends, invites and guest passes ----------

alter table public.users add column friend_code text unique;

-- one row per pair (user_a < user_b): pending until the other accepts
create table public.friendships (
  user_a uuid not null references public.users (id) on delete cascade,
  user_b uuid not null references public.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

-- an invite link (/i/<code>), used once: the visitor becomes the inviter's friend and joins
-- their party when a match is attached
create table public.invites (
  code text primary key,
  inviter_id uuid not null references public.users (id) on delete cascade,
  match_id text,
  created_at timestamptz not null default now(),
  used_by uuid references public.users (id) on delete cascade,
  used_at timestamptz
);
create index invites_open on public.invites (inviter_id) where used_by is null;

-- one free live match, from a member's invite. one per fan, ever. bound to the match and
-- rotation cycle where it is first played
create table public.guest_passes (
  user_id uuid primary key references public.users (id) on delete cascade,
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  used_at timestamptz,
  consumed_match_id text,
  consumed_cycle text
);

alter table public.party_presence enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.friendships enable row level security;
alter table public.invites enable row level security;
alter table public.guest_passes enable row level security;

grant select, insert, update, delete on
  public.party_presence, public.comment_reactions, public.friendships, public.invites, public.guest_passes
  to service_role;
revoke all on
  public.party_presence, public.comment_reactions, public.friendships, public.invites, public.guest_passes
  from anon, authenticated;
