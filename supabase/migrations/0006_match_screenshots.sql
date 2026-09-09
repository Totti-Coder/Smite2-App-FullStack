-- Points at the screenshot in Storage, if the player attached one when
-- logging the match. Nullable - most historical matches won't have one.
alter table public.matches
  add column if not exists screenshot_path text;

-- Private bucket: screenshots are personal match data, never public.
-- 5MB cap and image-only mime allowlist enforced at the storage layer too
-- (defense in depth - the app also checks this before uploading).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-screenshots', 'match-screenshots', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: "<user_id>/<uuid>.<ext>" - each policy checks that the
-- first path segment matches the caller's own auth.uid(), so a user can
-- never read, overwrite, or delete another user's screenshot.
create policy "Users can upload their own match screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'match-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read their own match screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'match-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own match screenshots"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'match-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
