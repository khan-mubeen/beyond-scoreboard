-- responsible ai: an editor reviews the generated texts (their review lives in content_cache's
-- content json: pending / approved / rejected, who and when), the phrase bank's wordings get a
-- reviewer and a time, and fans can report a mistake in a text

-- phrase bank: approved stays the switch the engine reads; a review records who decided and when
-- (approved false with reviewed_at set = rejected; no reviewed_at = pending)
alter table public.phrase_bank add column if not exists reviewed_by text;
alter table public.phrase_bank add column if not exists reviewed_at timestamptz;

-- "report a mistake": what's wrong with which text (a content_cache key or a call id)
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  ref_kind text not null check (ref_kind in ('text', 'call')),
  ref_key text not null,
  match_id text,
  message text not null check (char_length(message) between 3 and 500),
  user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_reports_created on public.content_reports (created_at desc);

alter table public.content_reports enable row level security;
grant select, insert, update, delete on public.content_reports to service_role;
