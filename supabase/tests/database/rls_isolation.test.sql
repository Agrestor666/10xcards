begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rls-user-1@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-user-2@example.test');

insert into public.flashcard_sets (id, user_id, name)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'User 1 set'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'User 2 set'
  );

insert into public.flashcards (id, set_id, question, answer)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'User 1 question',
    'User 1 answer'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'User 2 question',
    'User 2 answer'
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq(
  'select count(*) from public.flashcard_sets',
  array[1::bigint],
  'User 1 can only read their own set'
);

select results_eq(
  'select count(*) from public.flashcards',
  array[1::bigint],
  'User 1 can only read cards from their own set'
);

select lives_ok(
  $$
    insert into public.flashcard_sets (user_id, name)
    values ('11111111-1111-4111-8111-111111111111', 'User 1 second set')
  $$,
  'User 1 can create a set for themselves'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select results_eq(
  'select count(*) from public.flashcard_sets',
  array[1::bigint],
  'User 2 can only read their own set'
);

select results_eq(
  'select count(*) from public.flashcards',
  array[1::bigint],
  'User 2 can only read cards from their own set'
);

select throws_ok(
  $$
    insert into public.flashcard_sets (user_id, name)
    values ('11111111-1111-4111-8111-111111111111', 'Forged set')
  $$,
  '42501',
  'new row violates row-level security policy for table "flashcard_sets"',
  'User 2 cannot create a set owned by User 1'
);

select results_eq(
  $$
    update public.flashcard_sets
    set name = 'Compromised'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    returning 1
  $$,
  'select 1 where false',
  'User 2 cannot update User 1 set'
);

select results_eq(
  $$
    delete from public.flashcards
    where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    returning 1
  $$,
  'select 1 where false',
  'User 2 cannot delete User 1 card'
);

select throws_ok(
  $$
    insert into public.flashcards (set_id, question, answer)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Forged question',
      'Forged answer'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "flashcards"',
  'User 2 cannot create a card in User 1 set'
);

set local role anon;
set local request.jwt.claim.sub = '';

select results_eq(
  'select count(*) from public.flashcard_sets',
  array[0::bigint],
  'Anonymous users cannot read any sets'
);

select * from finish();

rollback;
