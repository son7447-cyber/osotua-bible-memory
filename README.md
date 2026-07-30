# OSOTUA Bible Memory Platform V5.1

## New
- Reference Maa audio for each Day
- Administrator upload / replace / remove controls
- Optional speaker name
- Korean Learner Coach compares the model recording with a private practice recording
- Dedicated practice recorder does not upload or affect Community progress
- All V5.0 Memory Coach, PWA, offline queue, multilingual content and Admin features retained

## Required
Run `sql/v5_1_reference_audio.sql` once in Supabase SQL Editor.

## Test
1. Deploy all files to GitHub.
2. Open Admin with PIN `0808`.
3. On the current Day, choose an Maa reference audio file and speaker name.
4. Press **Upload / Replace**.
5. Select `SON`, open the Memory Coach, and choose the same Practice Day.
6. Play the reference audio, record a private practice attempt, and compare them.

## Audio note
No reference recording is included in this package. Upload an original recording for which you have permission.

## Prototype security note
The current small-group prototype still uses public client write policies and a browser PIN. Before wider public launch, move Admin writes behind authenticated server-side functions.
