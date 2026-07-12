-- ============================================
-- Akili: journal_entries (Ally-inspired private reflection)
-- Run AFTER 01 and 02.
-- ============================================

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- Free-form private reflection. Capped so a bug or abuse can't
  -- store megabytes; 5000 chars is roughly two pages of writing.
  content text not null check (char_length(content) between 1 and 5000),

  created_at timestamptz not null default now()
);

create index journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

alter table public.journal_entries enable row level security;

create policy "Users can view own journal entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own journal entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

-- Deleting your own words is a privacy right in a mental-health app.
create policy "Users can delete own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

-- NOTE (architecture decision): journal content is stored readable by
-- the database (encrypted at rest by Supabase, but not end-to-end
-- encrypted). This is deliberate: Phase 2's AI reflection features
-- must be able to read entries. True E2EE and AI analysis are
-- mutually exclusive — this table chooses AI analysis.
