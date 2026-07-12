-- ============================================
-- Akili: chat_messages (persistent "Talk to Akili" history)
-- Run AFTER 01-03.
-- ============================================

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- Only two roles exist in a chat transcript. CHECK enforces it.
  role text not null check (role in ('user', 'assistant')),

  content text not null check (char_length(content) between 1 and 4000),

  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy "Users can view own chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Clearing your conversation history is a privacy right.
create policy "Users can delete own chat messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

-- Design note: the CLIENT saves both user and assistant messages
-- (simplest path with RLS). A user could technically forge an
-- "assistant" row — harmless, since it's only their own private
-- history. If that ever matters, move saving to the server with a
-- service-role key.
