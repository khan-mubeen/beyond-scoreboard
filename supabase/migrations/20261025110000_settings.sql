-- small server settings that must survive a restart, e.g. the demo rotation's clock
-- (key "rotation": { epoch, pausedAt }), so a restarted server and every client agree on the phase.
-- rls on, no policies: only the server reads these
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

grant select, insert, update, delete on public.settings to service_role;
revoke all on public.settings from anon, authenticated;
