-- OSOTUA V3.2 Admin setup
create table if not exists public.project_settings (
  id integer primary key,
  current_day integer not null default 1 check (current_day between 1 and 50),
  updated_at timestamptz not null default now()
);

insert into public.project_settings (id,current_day)
values (1,1)
on conflict (id) do nothing;

alter table public.project_settings enable row level security;

drop policy if exists "public can read project settings" on public.project_settings;
create policy "public can read project settings"
on public.project_settings for select
to public
using (true);

drop policy if exists "public can update project settings" on public.project_settings;
create policy "public can update project settings"
on public.project_settings for update
to public
using (true)
with check (true);

-- Existing participants policies should already allow SELECT/INSERT/UPDATE.
