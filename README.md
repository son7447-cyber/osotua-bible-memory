# OSOTUA Bible Memory Platform V5.3

## New learning flow
1. **Learn / 말씀보기** — shows the complete selected verse in Maa, English, or Korean.
2. **Practice / 가리기 연습** — hides a little, half, most, or shows first letters only. Every word can be tapped to hide or reveal it individually.
3. **Recite & Submit / 암송·제출** — displays only the Bible reference. The verse text is not visible during recording.

## Recording check
- After recording stops, the learner may play the audio.
- The **Check Maa verse after recording** button becomes available only after recording.
- The Maa answer remains hidden while recording.

## Existing V5.2 features retained
- Select any Day 1–50, including future practice Days.
- Submit a recording for the selected Day.
- Participant screen shows only that selected participant's own progress.
- Admin retains all-participant status and recordings.
- Reference audio, Memory Coach, PWA, and offline queue remain available.

## SQL
No additional SQL is required for V5.3.

## Deploy
Upload all files and folders to the GitHub repository root and commit. Vercel deploys automatically.

## Test
1. Select a participant and a Day.
2. Open **Learn** and confirm the full verse is visible.
3. Open **Practice**, test all five hiding levels, and tap individual words.
4. Open **Recite & Submit** and confirm only the reference is visible.
5. Start recording and confirm no verse text appears.
6. Stop, play the recording, optionally check the Maa answer, and submit.
