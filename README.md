# OSOTUA Bible Memory Platform V5.4

## Long Recording Update
- Main recitation recording safety limit increased from 3 minutes to 20 minutes.
- Speech recording uses mono, echo cancellation, noise suppression, and auto gain when supported.
- Opus/WebM recording targets 32 kbps to reduce upload size and mobile data use.
- Recording data is emitted in 1-second chunks for better long-recording stability.
- Practice recording uses the same speech-optimized recorder.
- The 20-minute value is centralized in `js/config.js` as `maxRecordingSeconds:1200`.
- Bitrate is centralized as `audioBitsPerSecond:32000`.

## Why not unlimited?
An unlimited browser recording can accidentally run for a very long time, consume device memory, and create large uploads. Twenty minutes is a safer cap for repeated Romans 8 recitation.

## Deploy
No Supabase SQL is required.
Upload the full V5.4 folder contents to the GitHub repository root and commit. Vercel should redeploy automatically.
