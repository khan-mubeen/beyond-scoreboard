-- public storage buckets: the demo rotation's highlight videos (+ posters) and the spoken match
-- summaries. anyone can read them (they are public media by design); only the server writes,
-- with the secret key, so storage.objects needs no policies. sizes stay under the 50 MB upload limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('highlights', 'highlights', true, 52428800, array['video/mp4', 'image/jpeg']),
  ('match-audio', 'match-audio', true, 10485760, array['audio/mpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
