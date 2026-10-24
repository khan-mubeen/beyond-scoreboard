-- profiles: the teams a fan follows, their language (it also words call it! and picks the
-- summary's audio), and which notifications they want. plus each call's finnish wording, so a
-- finnish-speaking fan reads the same call in finnish. rls on, no policies: only the server reads these

create table public.user_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  team_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index user_favorites_team on public.user_favorites (team_id);
alter table public.user_favorites enable row level security;

alter table public.users
  add column language text not null default 'en' check (language in ('en', 'fi')),
  add column notification_prefs jsonb not null default '{"callResults": true, "favoriteReminders": true, "favoriteResults": true}'::jsonb;

-- { "fi": { "question": "...", "options": [{ "id", "label" }] } }
alter table public.calls add column i18n jsonb;

grant select, insert, update, delete on public.user_favorites to service_role;
revoke all on public.user_favorites from anon, authenticated;
