-- Hints revealed during an attempt (CAP-7, AD-5, AD-9): one row per
-- (attempt, question, hint index), and `reveal_hint`, the one way to write it.
--
-- The hint texts and the quota live in the attempt's snapshot (AD-3, migration
-- 20261104000001), which only the service role reads: a row here holds only
-- which hint was opened and when, never its text. `hint_index` is 0-based (the
-- position in `snapshot.questions[n].hints`; the UI shows it + 1).
--
-- Writes go only through `reveal_hint` (security definer, executable by the
-- service role only): it locks the attempt row (`for update`), so a reveal
-- and a concurrent Finish / upload / Abandon (each an UPDATE of that row) run
-- one after the other; it requires `open`, reads the quota and the hint text
-- from the snapshot, and records only the next index of the question. No role
-- is granted insert, update or delete on the table.
--
-- The fence below refuses, for every role (superuser included), an insert for
-- an attempt that is not `open` (23514 `hint_reveals_open_only`) or past the
-- snapshot's `hintQuota` (23514 `hint_reveals_quota`).
--
-- Deploy order (AD-13): apply this migration before the code that reads it.
-- Grading counts `hint_reveals` when it loads an attempt; without the table
-- every load fails (`load_failed`).

-- (1) The table.
create table public.hint_reveals (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_number integer not null check (question_number >= 1),
  hint_index integer not null check (hint_index >= 0),
  revealed_at timestamptz not null default now(),
  primary key (attempt_id, question_number, hint_index)
);

-- (2) RLS and grants. Supabase's default privileges on `public` grant every
-- API role every table privilege: take them all back, then grant only reads.
alter table public.hint_reveals enable row level security;

revoke all on public.hint_reveals from anon, authenticated, service_role;
-- The session reads its own attempt's reveals (AD-9: owner-only policy on an
-- exposed table); the exam page itself reads hint state with the service
-- role, because the quota and texts are in the snapshot.
grant select on public.hint_reveals to authenticated;
-- Grading counts the reveals; the exam page reads them (service role, AD-9).
grant select on public.hint_reveals to service_role;

create policy "hint reveals are readable by the attempt's owner"
  on public.hint_reveals for select
  to authenticated
  using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and a.user_id = (select auth.uid())
    )
  );

-- (3) The fence, for every role: the attempt (locked) must be `open`, and the
-- attempt's reveals so far must stay under the snapshot's `hintQuota`
-- (a missing or non-integer quota counts as 0).
create or replace function public.hint_reveals_fence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_snapshot jsonb;
  v_quota integer;
  v_used integer;
begin
  select a.status, a.snapshot into v_status, v_snapshot
    from public.attempts a
    where a.id = new.attempt_id
    for update;

  if v_status is distinct from 'open' then
    raise exception 'hint_reveals: attempt % is not open', new.attempt_id
      using errcode = 'check_violation', constraint = 'hint_reveals_open_only';
  end if;

  v_quota := case
    when jsonb_typeof(v_snapshot -> 'hintQuota') = 'number' and (v_snapshot ->> 'hintQuota') ~ '^[0-9]{1,6}$'
      then (v_snapshot ->> 'hintQuota')::integer
    else 0
  end;

  select count(*) into v_used from public.hint_reveals r where r.attempt_id = new.attempt_id;

  if v_used >= v_quota then
    raise exception 'hint_reveals: attempt % has used its % hints', new.attempt_id, v_quota
      using errcode = 'check_violation', constraint = 'hint_reveals_quota';
  end if;
  return new;
end;
$$;

revoke execute on function public.hint_reveals_fence() from public, anon, authenticated;

create trigger hint_reveals_fence
  before insert on public.hint_reveals
  for each row
  execute function public.hint_reveals_fence();

-- (4) `reveal_hint`: the exam screen's Server Action calls it with the service
-- role, after its session read proved the attempt is the user's (AD-9). One
-- transaction: lock the attempt, then, in order —
--   `not_found`        no such attempt
--   `not_open`         the attempt is not `open`
--   `snapshot_invalid` no integer `hintQuota` or no `questions` array
--   `no_question`      no question with that number in the snapshot
--   `already`          the index is already revealed: its text, nothing written
--   `out_of_order`     the index is past the question's next one
--   `no_more_hints`    the question has no hint at that index
--   `quota_used`       the attempt's reveals reached `hintQuota`
--   `revealed`         the row is written; its text
-- Always `{code, question, hintIndex, hint (text or null), used, quota}`.
create or replace function public.reveal_hint(p_attempt_id uuid, p_question integer, p_hint_index integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_snapshot jsonb;
  v_quota integer := 0;
  v_used integer := 0;
  v_next integer;
  v_question jsonb;
  v_hints jsonb;
  v_hint_count integer;
begin
  select a.status, a.snapshot into v_status, v_snapshot
    from public.attempts a
    where a.id = p_attempt_id
    for update;

  if not found then
    return jsonb_build_object('code', 'not_found', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', 0, 'quota', 0);
  end if;

  select count(*) into v_used from public.hint_reveals r where r.attempt_id = p_attempt_id;

  if coalesce(jsonb_typeof(v_snapshot -> 'hintQuota'), '') = 'number'
     and (v_snapshot ->> 'hintQuota') ~ '^[0-9]{1,6}$' then
    v_quota := (v_snapshot ->> 'hintQuota')::integer;
  else
    v_quota := null;
  end if;

  if v_status <> 'open' then
    return jsonb_build_object('code', 'not_open', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', coalesce(v_quota, 0));
  end if;

  if v_quota is null or coalesce(jsonb_typeof(v_snapshot -> 'questions'), '') <> 'array' then
    return jsonb_build_object('code', 'snapshot_invalid', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', 0);
  end if;

  select q into v_question
    from jsonb_array_elements(v_snapshot -> 'questions') q
    where jsonb_typeof(q -> 'number') = 'number' and (q ->> 'number') = p_question::text
    limit 1;

  if v_question is null then
    return jsonb_build_object('code', 'no_question', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', v_quota);
  end if;

  v_hints := case when jsonb_typeof(v_question -> 'hints') = 'array' then v_question -> 'hints' else '[]'::jsonb end;
  v_hint_count := jsonb_array_length(v_hints);

  select count(*) into v_next
    from public.hint_reveals r
    where r.attempt_id = p_attempt_id and r.question_number = p_question;

  if p_hint_index >= 0 and p_hint_index < v_next then
    return jsonb_build_object('code', 'already', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', v_hints ->> p_hint_index, 'used', v_used, 'quota', v_quota);
  end if;

  if p_hint_index is null or p_hint_index <> v_next then
    return jsonb_build_object('code', 'out_of_order', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', v_quota);
  end if;

  if p_hint_index >= v_hint_count then
    return jsonb_build_object('code', 'no_more_hints', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', v_quota);
  end if;

  if v_used >= v_quota then
    return jsonb_build_object('code', 'quota_used', 'question', p_question, 'hintIndex', p_hint_index,
      'hint', null, 'used', v_used, 'quota', v_quota);
  end if;

  insert into public.hint_reveals (attempt_id, question_number, hint_index)
    values (p_attempt_id, p_question, p_hint_index);

  return jsonb_build_object('code', 'revealed', 'question', p_question, 'hintIndex', p_hint_index,
    'hint', v_hints ->> p_hint_index, 'used', v_used + 1, 'quota', v_quota);
end;
$$;

revoke execute on function public.reveal_hint(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reveal_hint(uuid, integer, integer) to service_role;

update public.app_meta
  set value = '20261113000001', updated_at = now()
  where key = 'schema_version';
