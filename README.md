# LessonCreator

Methodical lesson builder for private language tutors. Next.js on Vercel, Supabase for auth and data,
Claude for lesson text and news search, Gemini for the lesson image, YouTube Data API for the video.

## Setup

1. Run `supabase/migrations/0001_init.sql` on a new Supabase project.
2. Copy `.env.example` into the Vercel project's environment variables and fill in the keys.
3. Sign up with an email listed in `ADMIN_EMAILS` and confirm it; that account sees the Admin panel.

## Structure

- `src/app/api/generate` builds the lesson text in one structured call; `extras` fills image, news and video afterwards.
- `src/lib/lesson.ts` holds the lesson schema and prompts; `src/lib/characters.ts` the recurring characters,
  whose reference images live in `public/characters`.
- Guests get Greek only and `guest_limit` lessons in total; signed-in users get day/week/month limits from Admin.
