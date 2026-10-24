-- demo hygiene and in-app notifications.
-- bots (npm run fake-players) are real rows but never count: no leaderboards, no watching
-- counts, no notifications. rls on, no policies, as for every table: only the server reads these

alter table public.users add column is_bot boolean not null default false;
create index users_is_bot on public.users (is_bot) where is_bot;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- one row per event per user, however often it is generated
  dedupe_key text not null unique
);
create index notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to service_role;
revoke all on public.notifications from anon, authenticated;
