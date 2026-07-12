-- ============================================
-- Akili: mood_entries (Ally-inspired daily check-in)
-- Run in Supabase SQL Editor AFTER the profiles migration.
-- ============================================

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),

  -- Owner of the entry. Cascade delete = if the account goes,
  -- their mood history goes too (privacy / right-to-erasure).
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- 1 = very low ... 5 = very good. CHECK makes invalid scores
  -- impossible at the database level, not just in app code.
  mood_score int not null check (mood_score between 1 and 5),

  -- Optional short reflection ("what's on your mind?").
  -- Length-capped so a bug or abuse can't store megabytes.
  note text check (char_length(note) <= 1000),

  created_at timestamptz not null default now()
);

-- Index: every screen asks "this user's entries, newest first".
create index mood_entries_user_created_idx
  on public.mood_entries (user_id, created_at desc);

-- ============================================
-- Row Level Security — same pattern as profiles.
-- Deny everything, then allow only the owner.
-- ============================================
alter table public.mood_entries enable row level security;

create policy "Users can view own mood entries"
  on public.mood_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own mood entries"
  on public.mood_entries for insert
  with check (auth.uid() = user_id);

-- Users may delete their own entries (a privacy feature in a
-- mental-health app: people must be able to remove reflections).
create policy "Users can delete own mood entries"
  on public.mood_entries for delete
  using (auth.uid() = user_id);

-- Deliberately NO update policy in v1: an entry is a snapshot of a
-- moment. Editing history complicates trends; delete + re-add covers
-- the rare correction. Easy to add later if users ask.
