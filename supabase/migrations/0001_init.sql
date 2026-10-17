-- LessonCreator schema. All writes go through the server with the service role;
-- RLS is on everywhere and only reference lists are readable by the browser.

create extension if not exists pgcrypto;

create type item_status as enum ('active', 'blocked');

create table languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- ISO code, e.g. el, ru, en
  name text not null,                   -- English name, e.g. Greek
  native_name text not null,            -- e.g. Ελληνικά
  tts_lang text not null,               -- BCP-47 for speech, e.g. el-GR
  ui_label text not null,               -- short label for the switch, e.g. GR
  ui_strings jsonb,                     -- interface translation for added languages
  is_guest_default boolean not null default false,
  status item_status not null default 'active',
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- A1..C2
  description text,
  status item_status not null default 'active',
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table durations (
  id uuid primary key default gen_random_uuid(),
  minutes int not null unique check (minutes > 0),
  status item_status not null default 'active',
  created_at timestamptz not null default now()
);

create table instruments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,             -- built-in keys have dedicated renderers
  name jsonb not null,                  -- {"el": "...", "ru": "...", "en": "..."}
  description text not null,            -- what to generate; used for custom instruments
  is_builtin boolean not null default false,
  default_on boolean not null default true,
  status item_status not null default 'active',
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table restricted_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  status item_status not null default 'active',
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status item_status not null default 'active',
  limit_day int,                        -- null = use the default from settings
  limit_week int,
  limit_month int,
  time_spent_seconds int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  language_code text not null,
  interface_code text not null,
  theme text not null,
  level text not null,
  duration int not null,
  instruments text[] not null,
  content jsonb not null,
  comments text,
  saved boolean not null default false,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_user_idx on lessons(user_id, created_at desc);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  guest_id text,
  ip_hash text,
  lesson_id uuid references lessons(id) on delete set null,
  kind text not null,                   -- lesson | news | image | video | block | ui_translation
  theme text,
  language_code text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index generations_user_idx on generations(user_id, created_at desc);
create index generations_guest_idx on generations(guest_id);
create index generations_ip_idx on generations(ip_hash);

-- Profile row for every new account.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

alter table languages enable row level security;
alter table levels enable row level security;
alter table durations enable row level security;
alter table instruments enable row level security;
alter table restricted_words enable row level security;
alter table settings enable row level security;
alter table profiles enable row level security;
alter table lessons enable row level security;
alter table generations enable row level security;

create policy "read active languages" on languages for select using (status = 'active');
create policy "read active levels" on levels for select using (status = 'active');
create policy "read active durations" on durations for select using (status = 'active');
create policy "read active instruments" on instruments for select using (status = 'active');
create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "read own lessons" on lessons for select using (auth.uid() = user_id);

-- Storage bucket for generated lesson images (public read).
insert into storage.buckets (id, name, public) values ('lesson-images', 'lesson-images', true)
  on conflict (id) do nothing;

-- Seed data
insert into languages (code, name, native_name, tts_lang, ui_label, is_guest_default, sort) values
  ('el', 'Greek', 'Ελληνικά', 'el-GR', 'GR', true, 1),
  ('ru', 'Russian', 'Русский', 'ru-RU', 'RU', false, 2);

insert into levels (code, description, sort) values
  ('A1', 'Beginner', 1), ('A2', 'Elementary', 2), ('B1', 'Intermediate', 3),
  ('B2', 'Upper intermediate', 4), ('C1', 'Advanced', 5), ('C2', 'Proficient', 6);

insert into durations (minutes) values (30), (45), (60), (90);

insert into instruments (key, name, description, is_builtin, default_on, sort) values
  ('intro', '{"el":"Θέμα και στόχοι","ru":"Тема и цели","en":"Theme and goals"}', 'Theme block with a description of what the student will learn.', true, true, 1),
  ('warmup', '{"el":"Προθέρμανση","ru":"Разминка","en":"Warm-up"}', 'Short ice-breaker questions that connect the theme to the student''s life.', true, true, 2),
  ('cards', '{"el":"Κάρτες λέξεων","ru":"Карточки слов","en":"Word cards"}', 'Flip cards with key words and phrases, translation and example.', true, true, 3),
  ('image', '{"el":"Εικόνα μαθήματος","ru":"Иллюстрация урока","en":"Lesson image"}', 'An illustration of the lesson scene with the recurring characters.', true, true, 4),
  ('text', '{"el":"Κείμενο","ru":"Текст","en":"Text"}', 'A reading text on the theme at the student''s level.', true, true, 5),
  ('translation', '{"el":"Μετάφραση","ru":"Перевод","en":"Translation"}', 'Translation of the text into the interface language.', true, true, 6),
  ('exercises', '{"el":"Ασκήσεις","ru":"Упражнения","en":"Exercises"}', 'Interactive exercises of different types in both directions, with checking.', true, true, 7),
  ('dialogue', '{"el":"Διάλογος","ru":"Диалог","en":"Dialogue"}', 'A dialogue between the lesson characters with speech.', true, true, 8),
  ('news', '{"el":"Άρθρα ειδήσεων","ru":"Новостные статьи","en":"News articles"}', 'Two news articles on the theme from the last month.', true, true, 9),
  ('video', '{"el":"Βίντεο","ru":"Видео","en":"Video"}', 'One video on the theme.', true, true, 10),
  ('summary', '{"el":"Σύνοψη","ru":"Итоги","en":"Summary"}', 'Summary of what was learned.', true, true, 11),
  ('homework', '{"el":"Εργασία για το σπίτι","ru":"Домашнее задание","en":"Homework"}', 'Home assignment tasks.', true, true, 12);

insert into settings (key, value) values
  ('guest_limit', '3'),
  ('default_limit_day', '10'),
  ('default_limit_week', '40'),
  ('default_limit_month', '120');

-- Atomic single-block update so parallel extras (image, news, video) don't overwrite each other.
create function set_lesson_block(p_lesson uuid, p_block text, p_value jsonb) returns void
language sql set search_path = public as $$
  update lessons set content = jsonb_set(content, array[p_block], p_value, true), updated_at = now()
  where id = p_lesson;
$$;

create function add_time_spent(p_user uuid, p_seconds int) returns void
language sql set search_path = public as $$
  update profiles set time_spent_seconds = time_spent_seconds + greatest(0, least(p_seconds, 120)),
    last_seen_at = now()
  where id = p_user;
$$;

revoke execute on function set_lesson_block(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function add_time_spent(uuid, int) from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
