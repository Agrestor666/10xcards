-- F-01: flashcard_sets and flashcards schema + RLS

create table public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcard_sets_user_id_idx on public.flashcard_sets (user_id);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets (id) on delete cascade,
  question text not null,
  answer text not null,
  srs_state jsonb not null default '{}'::jsonb,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.flashcards.srs_state is
  'Opaque SRS algorithm state; S-04 owns sync when a grading library is wired.';

comment on column public.flashcards.due_at is
  'Next review time; S-04 session queries filter due_at <= now(). Default now() for immediate review.';

create index flashcards_set_id_idx on public.flashcards (set_id);

create index flashcards_set_id_due_at_idx on public.flashcards (set_id, due_at);

-- Phase 2: row-level security (authenticated only; no anon policies)

alter table public.flashcard_sets enable row level security;

create policy flashcard_sets_select_own on public.flashcard_sets
  for select
  to authenticated
  using (user_id = auth.uid());

create policy flashcard_sets_insert_own on public.flashcard_sets
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy flashcard_sets_update_own on public.flashcard_sets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy flashcard_sets_delete_own on public.flashcard_sets
  for delete
  to authenticated
  using (user_id = auth.uid());

alter table public.flashcards enable row level security;

create policy flashcards_select_own_set on public.flashcards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.flashcard_sets s
      where s.id = flashcards.set_id
        and s.user_id = auth.uid()
    )
  );

create policy flashcards_insert_own_set on public.flashcards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.flashcard_sets s
      where s.id = flashcards.set_id
        and s.user_id = auth.uid()
    )
  );

create policy flashcards_update_own_set on public.flashcards
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.flashcard_sets s
      where s.id = flashcards.set_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.flashcard_sets s
      where s.id = flashcards.set_id
        and s.user_id = auth.uid()
    )
  );

create policy flashcards_delete_own_set on public.flashcards
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.flashcard_sets s
      where s.id = flashcards.set_id
        and s.user_id = auth.uid()
    )
  );
