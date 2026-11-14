-- Let signed-in users permanently delete their own projects and the files uploaded to them.
-- Apply once in the Supabase SQL editor for the production project. Owner-only, like the existing policies.
grant delete on public.cornerpin_projects to authenticated;
create policy "delete own projects" on public.cornerpin_projects for delete to authenticated using (owner_id = auth.uid());
create policy "delete own project files" on storage.objects for delete to authenticated using (bucket_id='cornerpin-private' and (storage.foldername(name))[1]=auth.uid()::text);
