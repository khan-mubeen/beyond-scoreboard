-- one prediction per fan, match and rotation cycle. the prediction is a `calls` row of type
-- who_wins (one per match and cycle: its trigger is "<cycle>:who_wins"), and a fan's prediction is
-- their answer to it (answers are unique per call and fan, points unique per call and fan). the
-- call can now be made before the game, from what if? on the preview page, by any server, so it is
-- created through this function: one transaction behind a lock on (match, trigger), returning the
-- row that is already there instead of a second one

create or replace function public.create_call_once(p_call jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.calls;
  v_match text := p_call ->> 'match_id';
  v_trigger text := p_call ->> 'trigger';
begin
  perform pg_advisory_xact_lock(hashtextextended('call:' || v_match || ':' || v_trigger, 0));
  select * into v from public.calls where match_id = v_match and trigger = v_trigger order by opened_at limit 1;
  if found then
    return to_jsonb(v) || jsonb_build_object('created', false);
  end if;
  insert into public.calls (match_id, type, trigger, question, options, stakes_line, opened_game_time, opened_at, locks_at, lock_game_time, resolves_rule, status, correct_option_id, resolved_at, i18n)
  values (
    v_match,
    p_call ->> 'type',
    v_trigger,
    p_call ->> 'question',
    p_call -> 'options',
    p_call ->> 'stakes_line',
    (p_call ->> 'opened_game_time')::integer,
    coalesce((p_call ->> 'opened_at')::timestamptz, now()),
    (p_call ->> 'locks_at')::timestamptz,
    (p_call ->> 'lock_game_time')::integer,
    p_call -> 'resolves_rule',
    coalesce(p_call ->> 'status', 'open'),
    p_call ->> 'correct_option_id',
    (p_call ->> 'resolved_at')::timestamptz,
    p_call -> 'i18n'
  )
  returning * into v;
  return to_jsonb(v) || jsonb_build_object('created', true);
end;
$$;

revoke execute on function public.create_call_once(jsonb) from public, anon, authenticated;
grant execute on function public.create_call_once(jsonb) to service_role;

-- the prediction call of a match and cycle is looked up by its trigger
create index if not exists calls_match_trigger on public.calls (match_id, trigger);
