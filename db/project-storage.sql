-- Apply to an explicitly provisioned Supabase project. No service-role key is used by the app.
create table if not exists public.cornerpin_projects (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id),
  revision integer not null check (revision >= 0),
  record jsonb not null,
  updated_at timestamptz not null default now(),
  check (record->>'id' = id),
  check ((record->>'revision')::integer = revision)
);
alter table public.cornerpin_projects enable row level security;
create policy "read own projects" on public.cornerpin_projects for select to authenticated using (owner_id = auth.uid());
create policy "insert own projects" on public.cornerpin_projects for insert to authenticated with check (owner_id = auth.uid());
create policy "update own projects" on public.cornerpin_projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
insert into storage.buckets (id,name,public,file_size_limit) values ('cornerpin-private','cornerpin-private',false,26214400) on conflict(id) do nothing;
create policy "read own project files" on storage.objects for select to authenticated using (bucket_id='cornerpin-private' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "insert own project files" on storage.objects for insert to authenticated with check (bucket_id='cornerpin-private' and (storage.foldername(name))[1]=auth.uid()::text);
-- Files are immutable: new versions receive new IDs. No update/delete policies are granted.
