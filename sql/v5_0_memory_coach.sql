-- OSOTUA V5.0 Memory Coach

create table if not exists public.memory_coach (
  day integer primary key references public.memory_content(day) on delete cascade,
  pronunciation text not null default '',
  direct_translation text not null default '',
  meaning_chunks text not null default '',
  word_study text not null default '',
  memory_image text not null default '',
  previous_connection text not null default '',
  rhythm text not null default '',
  song text not null default '',
  test_prompt text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.memory_coach enable row level security;

drop policy if exists "public can read memory coach" on public.memory_coach;
create policy "public can read memory coach"
on public.memory_coach for select
to public
using (true);

drop policy if exists "public can update memory coach" on public.memory_coach;
create policy "public can update memory coach"
on public.memory_coach for update
to public
using (true)
with check (true);

insert into public.memory_coach (
  day, pronunciation, direct_translation, meaning_chunks, word_study,
  memory_image, previous_connection, rhythm, song, test_prompt
)
values
(
  1,
  $txt$메티이 나아 타아타 엔키구아나 테 렐로 오오티이 아투아 크리스토 예수.$txt$,
  $txt$그러므로 이제 그리스도 예수 안에 있는 사람들에게는 정죄가 없습니다.$txt$,
  $txt$Metii naa taata | 이제 없다
enkiguana | 정죄·심판이
te lelo | 그 사람들에게
ootii atua Kristo Yesu | 그리스도 예수 안에 있는$txt$,
  $txt$Metii = 없다, 존재하지 않는다
naa = 그러므로, 그래서
taata = 지금, 이제
enkiguana = 심판, 정죄
lelo = 그 사람들
ootii = 있는 사람들
atua = 안에, 내부에
Kristo Yesu = 그리스도 예수$txt$,
  $txt$법정에서 판사가 정죄의 망치를 들지만, 십자가가 그 망치를 막습니다. 십자가 안에 서 있는 사람 위에는 ‘NO CONDEMNATION’이라고 쓰여 있습니다.$txt$,
  $txt$로마서 7장의 ‘나는 곤고한 사람이로다’라는 절규 다음에, 로마서 8장은 ‘그러므로 이제 정죄가 없다’는 복음의 선언으로 시작합니다.$txt$,
  $txt$Metii naa taata | enkiguana | te lelo ootii | atua Kristo Yesu$txt$,
  $txt$Metii naa taata, 정죄함 없네
Enkiguana, 사라졌네
Te lelo ootii, 그 사람들
Atua Kristo Yesu, 예수 안에$txt$,
  $txt$30초 동안 네 덩어리를 순서대로 암송하세요. 막히면 마지막 장면인 ‘atua Kristo Yesu’를 먼저 떠올린 뒤 앞으로 연결하세요.$txt$
),
(
  2,
  $txt$아무 아아탈라쿠투아 나누 은키타나팟 에 은키양엣 에 은키슈이 나티이 아투아 크리스토 예수 아아이퉁우아 은키타나팟 오오 응옥 오 케에야.$txt$,
  $txt$왜냐하면 그리스도 예수 안에 있는 생명의 성령의 법이 나를 죄와 죽음의 법에서 해방했기 때문입니다.$txt$,
  $txt$Amu | 왜냐하면
Aatalakutua nanu | 나를 해방하셨다
nkitanapat e Nkiyang'et e nkishui | 생명의 성령의 법이
natii atua Kristo Yesu | 그리스도 예수 안에 있는
aaitung'uaa nkitanapat oo ng'ok o keeya | 죄와 죽음의 법으로부터$txt$,
  $txt$Amu = 왜냐하면
Aatalakutua = 해방했다, 풀어 주었다
nanu = 나를, 나
nkitanapat = 법, 명령
Nkiyang'et = 영, 성령
nkishui = 생명
natii = 있는
atua = 안에
ng'ok = 죄
keeya = 죽음$txt$,
  $txt$‘죄’와 ‘죽음’이라고 적힌 두 쇠사슬에 묶인 사람이 있습니다. 생명의 성령이 오셔서 쇠사슬을 끊고, 그 사람을 그리스도 예수 안으로 이끌어 냅니다.$txt$,
  $txt$1절은 ‘정죄가 없다’는 신분의 선언이고, 2절은 그 이유를 설명합니다. 성령의 생명의 법이 죄와 죽음의 법에서 실제로 해방했기 때문입니다.$txt$,
  $txt$Amu | aatalakutua nanu | nkitanapat e Nkiyang'et e nkishui | natii atua Kristo Yesu | aaitung'uaa nkitanapat oo ng'ok o keeya$txt$,
  $txt$Amu, 아무, 그 이유는
Aatalakutua nanu, 나를 자유케
Nkiyang'et e nkishui, 생명의 성령
Ng'ok o keeya, 죄와 죽음에서$txt$,
  $txt$30초 동안 ‘왜냐하면–해방–생명의 성령–그리스도 안–죄와 죽음에서’의 다섯 장면을 따라 암송하세요.$txt$
)
on conflict (day) do update
set pronunciation = excluded.pronunciation,
    direct_translation = excluded.direct_translation,
    meaning_chunks = excluded.meaning_chunks,
    word_study = excluded.word_study,
    memory_image = excluded.memory_image,
    previous_connection = excluded.previous_connection,
    rhythm = excluded.rhythm,
    song = excluded.song,
    test_prompt = excluded.test_prompt,
    updated_at = now();
