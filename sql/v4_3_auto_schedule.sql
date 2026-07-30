-- OSOTUA V4.3 automatic schedule upgrade

alter table public.project_settings
add column if not exists auto_advance boolean not null default false;

alter table public.project_settings
add column if not exists start_date date;

update public.project_settings
set start_date = coalesce(start_date, current_date)
where id = 1;
