# OSOTUA Bible Memory Platform V5.2

## New
- Participants can choose any Practice Day from Day 1 to Day 50.
- Clicking a numbered Day tile also opens that Day.
- The selected Day verse is shown in Maa, English and Korean.
- Recordings and submissions are saved under the selected Day, including future Days.
- The participant screen shows only the selected participant’s own Day submission.
- The participant screen shows only the selected participant’s own overall progress.
- Full Day status, recordings and all-participant overall progress remain available in Admin.
- V5.1 reference audio, Memory Coach, PWA and offline queue remain available.

## SQL
No additional SQL is required for V5.2. Use the same Supabase database from V5.1.

## Deploy
Upload all files and folders to the GitHub repository and commit. Vercel deploys automatically.

## Test
1. Select a participant.
2. Choose Day 3 or Day 4 from **Choose a Day to practice or submit**.
3. Confirm the verse changes.
4. Record and submit.
5. Confirm **My Selected Day Progress** shows only that participant.
6. Confirm **My Overall Progress** shows only that participant.
7. Open Admin and confirm the administrator can see all participants.

## Privacy limitation
V5.2 removes other participants’ information from the normal participant screen. It is not full identity security because the current prototype still allows a visitor to select another participant name and the Supabase prototype policies remain public. Participant PIN/login and authenticated RLS must be added before public or sensitive use.
