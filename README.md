# OSOTUA Bible Memory Platform V5.0

## New
- Korean Learner Memory Coach shown when participant `SON` is selected
- Independent Practice Day selector, so global project Day does not need to change
- Ten-part study flow:
  1. Original Maa text
  2. Korean pronunciation
  3. Direct translation
  4. Meaning chunks
  5. Maa word study
  6. Memory image
  7. Previous-verse connection
  8. Memory rhythm
  9. Original memory song/chant
  10. 30-second test
- Day 1 and Day 2 coach content seeded in Supabase
- Coach content cached for offline review after it has been opened online once
- All V4.4 PWA, offline recording, syncing, multilingual content, Admin, Community and Progress features retained

## Required
Run `sql/v5_0_memory_coach.sql` once in Supabase SQL Editor.

## Test
1. Deploy all files to GitHub.
2. Open the site and select `SON`.
3. Open `Korean Learner Mode`.
4. Choose Day 1 or Day 2.
5. Test the 30-second memory test.

## Note
V5.0 is structured database coaching. Automatic analysis of the user's recorded speech will be added in a later voice-AI version.
