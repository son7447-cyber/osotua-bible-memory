# OSOTUA Bible Memory Platform V4.4

## New
- Installable PWA for phone and computer
- Offline cached app shell and Bible content
- Offline recording submission queue using IndexedDB
- Automatic sync when internet returns
- Manual Sync button and pending-upload list
- Cached participant, settings, progress and current verse fallback

## No SQL required
V4.4 uses the same Supabase tables and policies as V4.3.

## Deploy
Upload every file and folder to GitHub:
- index.html
- manifest.webmanifest
- sw.js
- offline.html
- css/
- js/
- assets/

Netlify will redeploy automatically.

## Offline test
1. Open the deployed site online once.
2. Select a participant.
3. Turn off Wi-Fi/internet.
4. Refresh or reopen the installed app.
5. Record and Submit.
6. Confirm the Offline Queue shows 1 item.
7. Restore internet and press Sync, or wait for automatic sync.
