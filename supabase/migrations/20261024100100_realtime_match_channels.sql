-- live match updates go out on private realtime channels "match:{id}".
-- browsers (anon / authenticated) may only RECEIVE broadcasts there; there is no insert
-- policy, so no browser can broadcast a fake call or result to other fans.
-- the server publishes with the service role, which bypasses rls.

create policy "fans receive match broadcasts"
  on realtime.messages
  for select
  to anon, authenticated
  using (realtime.topic() like 'match:%' and extension = 'broadcast');
