-- newer supabase projects don't grant table privileges to the api roles automatically.
-- the server (service role) needs them; browsers (anon, authenticated) get none at all,
-- on top of rls with no policies

grant usage on schema public to service_role;
grant select, insert, update, delete on
  public.users, public.match_rooms, public.room_members, public.calls, public.answers,
  public.points_ledger, public.comments, public.comment_likes, public.reminders,
  public.content_cache, public.phrase_bank
  to service_role;

revoke all on
  public.users, public.match_rooms, public.room_members, public.calls, public.answers,
  public.points_ledger, public.comments, public.comment_likes, public.reminders,
  public.content_cache, public.phrase_bank
  from anon, authenticated;
