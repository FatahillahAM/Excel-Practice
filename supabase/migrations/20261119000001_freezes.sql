-- Streak freezes (CAP-10, AD-7, AD-8): one row per (user, local date) the
-- user froze, and `use_freeze`, the one way to write it. Plus the P1
-- tightening of `attempts_result_only_when_graded`.
--
-- The streak and the freezes left are never stored (AD-7): they are derived
-- per request from graded attempts and these rows. A day is the local date of
-- an instant in the user's `profiles.time_zone` (immutable, AD-8); a week is
-- ISO Monday–Sunday in that zone; "now" is the database's clock.
--
-- Rules, for every role (superuser included), enforced by the fence trigger
-- below (SQLSTATE 23514):
--   `freezes_today_only`  `local_date` is not today in the user's zone
--                         (no backdated or future freeze), or no profile
--   `freezes_not_safe`    the user already has a graded attempt today
--   `freezes_week_quota`  the user already has 2 freezes this ISO week
-- and by the unique key (23505) for a second freeze of the same day. The
-- fence locks the user's profile row (`for update`), so two concurrent
-- freezes of one user run one after the other.
--
-- Writes go only through `use_freeze(date)` (security definer, executable by the
-- session): it acts for `auth.uid()` only. No role is granted insert, update
-- or delete on the table; the owner reads their rows through their session.
--
-- P1: migration 20261110000001 made `graded → closed` unreachable, so the
-- `closed` allowance of `attempts_result_only_when_graded` (migration
-- 20261109000001) is dead; the check becomes `result is null or status =
-- 'graded'`. The current paths never write a Result on a `closed` attempt;
-- should a row exist anyway, this migration fails and nothing changes.
--
-- Deploy order (AD-13): apply this migration before the code that reads it.
-- The Dashboard's Streak Hero reads `freezes`; without the table it shows the
-- first-load message.

-- (1) The table.
create table public.freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  constraint freezes_user_day unique (user_id, local_date)
);

-- (2) RLS and grants. Take back Supabase's default privileges, then grant
-- the session `select` of its own rows only.
alter table public.freezes enable row level security;

revoke all on public.freezes from anon, authenticated, service_role;
grant select on public.freezes to authenticated;

create policy freezes_owner_select on public.freezes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- (3) The fence, for every role.
create or replace function public.freezes_fence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_zone text;
  v_today date;
begin
  select p.time_zone into v_zone
    from public.profiles p
    where p.id = new.user_id
    for update;

  if v_zone is not null and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_zone) then
    v_today := (now() at time zone v_zone)::date;
  end if;

  if v_today is null or new.local_date is distinct from v_today then
    raise exception 'freezes: % is not today for user %', new.local_date, new.user_id
      using errcode = 'check_violation', constraint = 'freezes_today_only';
  end if;

  if exists (
    select 1 from public.attempts a
      where a.user_id = new.user_id
        and a.status = 'graded'
        and a.result is not null
        and a.received_at is not null
        and (a.received_at at time zone v_zone)::date = v_today
  ) then
    raise exception 'freezes: user % already has a graded attempt today', new.user_id
      using errcode = 'check_violation', constraint = 'freezes_not_safe';
  end if;

  if (
    select count(*) from public.freezes f
      where f.user_id = new.user_id
        and f.local_date >= v_today - (extract(isodow from v_today)::int - 1)
        and f.local_date < v_today - (extract(isodow from v_today)::int - 1) + 7
  ) >= 2 then
    raise exception 'freezes: user % has used 2 freezes this week', new.user_id
      using errcode = 'check_violation', constraint = 'freezes_week_quota';
  end if;
  return new;
end;
$$;

revoke all on function public.freezes_fence() from public, anon, authenticated, service_role;

create trigger freezes_fence
  before insert on public.freezes
  for each row
  execute function public.freezes_fence();

-- (4) `use_freeze`: the Dashboard's Use freeze Server Action calls it on the
-- user's session with the local date the page showed as today. One
-- transaction: lock the profile, then, in order —
--   `no_session`      no `auth.uid()`
--   `no_profile`      no profile row, or a zone the database does not know
--   `day_changed`     today (the database's clock, the user's zone) is not
--                     `p_expected_date` (the page went stale over midnight):
--                     nothing written
--   `already_frozen`  today is already frozen: nothing written
--   `safe`            today already has a graded attempt: nothing written
--   `quota_used`      2 freezes this ISO week already: nothing written
--   `frozen`          today's row is written
-- Always `{code, localDate (today, or null), left (freezes left this week)}`.
create or replace function public.use_freeze(p_expected_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_zone text;
  v_today date;
  v_used integer;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'no_session', 'localDate', null, 'left', 0);
  end if;

  select p.time_zone into v_zone
    from public.profiles p
    where p.id = v_uid
    for update;

  if v_zone is null or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_zone) then
    return jsonb_build_object('code', 'no_profile', 'localDate', null, 'left', 0);
  end if;

  v_today := (now() at time zone v_zone)::date;

  if p_expected_date is distinct from v_today then
    return jsonb_build_object('code', 'day_changed', 'localDate', v_today, 'left', 0);
  end if;

  select count(*) into v_used
    from public.freezes f
    where f.user_id = v_uid
      and f.local_date >= v_today - (extract(isodow from v_today)::int - 1)
      and f.local_date < v_today - (extract(isodow from v_today)::int - 1) + 7;

  if exists (select 1 from public.freezes f where f.user_id = v_uid and f.local_date = v_today) then
    return jsonb_build_object('code', 'already_frozen', 'localDate', v_today, 'left', greatest(2 - v_used, 0));
  end if;

  if exists (
    select 1 from public.attempts a
      where a.user_id = v_uid
        and a.status = 'graded'
        and a.result is not null
        and a.received_at is not null
        and (a.received_at at time zone v_zone)::date = v_today
  ) then
    return jsonb_build_object('code', 'safe', 'localDate', v_today, 'left', greatest(2 - v_used, 0));
  end if;

  if v_used >= 2 then
    return jsonb_build_object('code', 'quota_used', 'localDate', v_today, 'left', 0);
  end if;

  insert into public.freezes (user_id, local_date) values (v_uid, v_today);

  return jsonb_build_object('code', 'frozen', 'localDate', v_today, 'left', 2 - v_used - 1);
end;
$$;

revoke all on function public.use_freeze(date) from public, anon, authenticated, service_role;
grant execute on function public.use_freeze(date) to authenticated;

-- (5) `streak_days`: the signed-in user's distinct local dates (their zone)
-- with a graded attempt carrying a Result: the same "graded day" as the
-- fence, uncapped (one row per day, not per attempt). Empty without a
-- session, a profile or a known zone.
create or replace function public.streak_days()
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select distinct (a.received_at at time zone p.time_zone)::date
    from public.profiles p
    join public.attempts a on a.user_id = p.id
    where p.id = (select auth.uid())
      and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p.time_zone)
      and a.status = 'graded'
      and a.result is not null
      and a.received_at is not null
    order by 1;
$$;

revoke all on function public.streak_days() from public, anon, authenticated, service_role;
grant execute on function public.streak_days() to authenticated;

-- (6) P1: a Result only on a `graded` attempt.
alter table public.attempts
  drop constraint attempts_result_only_when_graded;

alter table public.attempts
  add constraint attempts_result_only_when_graded
    check (result is null or status = 'graded');

update public.app_meta
  set value = '20261119000001', updated_at = now()
  where key = 'schema_version';
