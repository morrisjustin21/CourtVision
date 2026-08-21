-- Run this in Supabase's SQL Editor to add team logo uploads.

alter table teams add column if not exists logo_url text;

-- Storage bucket for logo images, publicly readable so they display in the app.
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

create policy "Public read access for team logos"
  on storage.objects for select
  using (bucket_id = 'team-logos');

create policy "Authenticated users can upload team logos"
  on storage.objects for insert
  with check (bucket_id = 'team-logos' and auth.role() = 'authenticated');

create policy "Authenticated users can update team logos"
  on storage.objects for update
  using (bucket_id = 'team-logos' and auth.role() = 'authenticated');

create policy "Authenticated users can delete team logos"
  on storage.objects for delete
  using (bucket_id = 'team-logos' and auth.role() = 'authenticated');
