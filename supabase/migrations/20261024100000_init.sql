-- kaleva sports: users, rooms, calls, points, comments, reminders, content.
-- rls is on for every table with no policies: browsers never talk to these tables,
-- only the server does, with the service role (which bypasses rls).

create table public.users (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null unique,
  nickname text check (char_length(nickname) between 1 and 24),
  created_at timestamptz not null default now()
);

create table public.match_rooms (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.match_rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  type text not null,
  trigger text not null,
  question text not null,
  options jsonb not null,
  stakes_line text,
  opened_game_time integer not null,
  opened_at timestamptz not null default now(),
  locks_at timestamptz not null,
  lock_game_time integer,
  resolves_rule jsonb not null,
  status text not null default 'open' check (status in ('open', 'locked', 'resolved', 'cancelled')),
  correct_option_id text,
  resolved_at timestamptz
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  option_id text not null,
  answered_at timestamptz not null default now(),
  correct boolean,
  unique (call_id, user_id)
);

-- season total, weekly total and level are all computed from this table
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  match_id text,
  call_id uuid references public.calls (id) on delete set null,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
-- a call can pay a user only once, even if resolution runs twice
create unique index points_ledger_one_award_per_call on public.points_ledger (user_id, call_id) where call_id is not null;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.reminders (
  user_id uuid not null references public.users (id) on delete cascade,
  match_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

-- key: {matchId}:{teamId}:{kind}:{lang}
create table public.content_cache (
  key text primary key,
  content jsonb not null,
  source text not null check (source in ('template', 'llm')),
  created_at timestamptz not null default now()
);

create table public.phrase_bank (
  id uuid primary key default gen_random_uuid(),
  call_type text not null,
  lang text not null check (lang in ('en', 'fi')),
  template text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index match_rooms_match_id on public.match_rooms (match_id);
create index room_members_user_id on public.room_members (user_id);
create index calls_match_id on public.calls (match_id);
create index answers_user_id on public.answers (user_id);
create index points_ledger_user_id on public.points_ledger (user_id);
create index points_ledger_match_id on public.points_ledger (match_id);
create index points_ledger_created_at on public.points_ledger (created_at);
create index comments_match_id on public.comments (match_id, created_at desc);
create index comments_user_id on public.comments (user_id);
create index comment_likes_user_id on public.comment_likes (user_id);
create index reminders_match_id on public.reminders (match_id);
create index phrase_bank_lookup on public.phrase_bank (call_type, lang) where approved;

alter table public.users enable row level security;
alter table public.match_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.calls enable row level security;
alter table public.answers enable row level security;
alter table public.points_ledger enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.reminders enable row level security;
alter table public.content_cache enable row level security;
alter table public.phrase_bank enable row level security;
