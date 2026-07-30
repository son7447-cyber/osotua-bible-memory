-- OSOTUA V4.0 content database
create table if not exists public.memory_content (
  day integer primary key check (day between 1 and 50),
  verse_number integer not null,
  reference text not null,
  maa_text text not null default '',
  english_text text not null default '',
  korean_text text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.memory_content enable row level security;

drop policy if exists "public can read memory content" on public.memory_content;
create policy "public can read memory content"
on public.memory_content for select
to public
using (true);

drop policy if exists "public can update memory content" on public.memory_content;
create policy "public can update memory content"
on public.memory_content for update
to public
using (true)
with check (true);

-- Seed Days 1–2. The app can edit all content later from Admin.
insert into public.memory_content(day,verse_number,reference,maa_text,english_text,korean_text)
values
(1,1,'Romans 8:1','Metii naa taata enkiguana te lelo ootii atua Kristo Yesu.','Therefore, there is now no condemnation for those who are in Christ Jesus.','그러므로 이제 그리스도 예수 안에 있는 자에게는 결코 정죄함이 없습니다.'),
(2,2,'Romans 8:2','Amu aatalakutua nanu nkitanapat e Nkiyang''et e nkishui natii atua Kristo Yesu aaitung''uaa nkitanapat oo ng''ok o keeya.','For the law of the Spirit of life in Christ Jesus has set me free from the law of sin and death.','이는 그리스도 예수 안에 있는 생명의 성령의 법이 죄와 사망의 법에서 나를 해방했기 때문입니다.')
on conflict(day) do nothing;

-- Create placeholders for the rest of the 50-day project.
insert into public.memory_content(day,verse_number,reference,maa_text,english_text,korean_text)
select d,
       case when d <= 39 then d else 39 end,
       case when d <= 39 then 'Romans 8:' || d else 'Romans 8 Review Day ' || d end,
       case when d <= 39 then '' else 'Review day.' end,
       '',
       ''
from generate_series(3,50) as d
on conflict(day) do nothing;
