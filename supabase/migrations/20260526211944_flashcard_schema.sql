-- F-01 Phase 1: flashcard_sets and flashcards schema (RLS in Phase 2)

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
