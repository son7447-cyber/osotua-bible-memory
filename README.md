# OSOTUA Bible Memory V5.4.2

Romans 8 — 55 Day Cumulative Challenge

## Schedule

- Fixed start date: July 30, 2026.
- The schedule uses the local date reported by each participant's device.
- One new verse is added every Monday through Friday.
- Saturday and Sunday are cumulative review days with no new verse.
- Day 1 is Romans 8:1; Day 2 is Romans 8:1–2.
- The complete passage, Romans 8:1–39, is reached on September 22, 2026 (Day 55).
- Participants can still select future dates for early practice.

See `SCHEDULE.md` for the complete date-by-date plan.

## Interface

- All participant-facing Korean interface labels and instructions are now in English.
- The Korean Bible text option remains available under the English label `Korean`.
- The recitation screen now gives English-only instructions.
- Cache versions and asset URLs were updated to `5.4.2` so browsers receive the recording fix.
- Submission records always receive a valid cumulative verse number.
- Pending V5.4 recordings with a missing verse number are repaired automatically during Sync.
- The progress grid now consistently uses all 55 days.
- Online visits load app files from the network first and use the cache only when offline.
- The service worker checks for an update on every page load and refreshes once when a new version takes control.
- `legacy-redirect` contains a tiny redirect site for each old Netlify address.

## Deploy

Upload every file and folder in this directory to the root of the GitHub repository, replace files with the same names, and commit the changes. Vercel will deploy the commit automatically.

No Supabase SQL changes are required.
