-- OSOTUA V5.1 Reference Maa Audio

alter table public.memory_content
add column if not exists reference_audio_path text not null default '';

alter table public.memory_content
add column if not exists reference_speaker text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reference_audio',
  'reference_audio',
  false,
  10485760,
  array['audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/wav','audio/x-wav','audio/aac']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read reference audio" on storage.objects;
create policy "public can read reference audio"
on storage.objects for select
to public
using (bucket_id = 'reference_audio');

drop policy if exists "public can upload reference audio" on storage.objects;
create policy "public can upload reference audio"
on storage.objects for insert
to public
with check (bucket_id = 'reference_audio');

drop policy if exists "public can update reference audio" on storage.objects;
create policy "public can update reference audio"
on storage.objects for update
to public
using (bucket_id = 'reference_audio')
with check (bucket_id = 'reference_audio');

drop policy if exists "public can delete reference audio" on storage.objects;
create policy "public can delete reference audio"
on storage.objects for delete
to public
using (bucket_id = 'reference_audio');
