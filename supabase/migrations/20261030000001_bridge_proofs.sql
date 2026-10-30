-- End-to-end bridge proof (epic fondasi, Done when 5): one row per workbook
-- downloaded from /dev/bridge-proof, keyed by the SHA-256 of its attempt token
-- (never the token itself). The download writes the row through the user's
-- session; the Finish macro's POST records what the server read from the file
-- through the service-role client (AD-9, macro path only). Proof only: dropped
-- in epic 2 once `attempts` exists.

create table public.bridge_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Lowercase hex SHA-256 of `WHE_AttemptToken`.
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  template_version integer not null check (template_version > 0),
  created_at timestamptz not null default now(),
  -- Set by the macro path on each Finish; the latest one wins.
  received_at timestamptz,
  receive_count integer not null default 0 check (receive_count >= 0),
  bytes integer check (bytes >= 0),
  token_matches boolean,
  fingerprint_matches boolean,
  -- Up to 20 cells: [{ "sheet": "Data", "ref": "I2", "formula": "SUMIFS(...)" }].
  formulas jsonb check (formulas is null or jsonb_typeof(formulas) = 'array')
);

create index bridge_proofs_user_created_idx on public.bridge_proofs (user_id, created_at desc);

alter table public.bridge_proofs enable row level security;

-- Supabase's default privileges on `public` grant every API role every table
-- privilege: take them all back, then grant only what each path needs.
revoke all on public.bridge_proofs from anon, authenticated, service_role;
-- The user's session: read own rows, create a row with only these two columns
-- (`user_id` comes from its default, `auth.uid()`). No update or delete policy.
grant select on public.bridge_proofs to authenticated;
grant insert (token_sha256, template_version) on public.bridge_proofs to authenticated;
-- The macro path (service role): find the row by hash and record the receipt.
grant select on public.bridge_proofs to service_role;
grant update (received_at, receive_count, bytes, token_matches, fingerprint_matches, formulas)
  on public.bridge_proofs to service_role;

create policy "bridge_proofs are readable by their owner"
  on public.bridge_proofs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "bridge_proofs are created by their owner"
  on public.bridge_proofs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- One Finish: stamps the server's time and adds one to `receive_count` in a
-- single statement, so two posts of the same file cannot lose a count. Returns
-- whether a row has this hash (false for a token the server never issued).
create or replace function public.record_bridge_proof_receipt(
  p_token_sha256 text,
  p_bytes integer,
  p_token_matches boolean,
  p_fingerprint_matches boolean,
  p_formulas jsonb
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.bridge_proofs
      set received_at = now(),
          receive_count = receive_count + 1,
          bytes = p_bytes,
          token_matches = p_token_matches,
          fingerprint_matches = p_fingerprint_matches,
          formulas = p_formulas
      where token_sha256 = p_token_sha256
      returning 1
  )
  select exists (select 1 from updated);
$$;

revoke execute on function public.record_bridge_proof_receipt(text, integer, boolean, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_bridge_proof_receipt(text, integer, boolean, boolean, jsonb)
  to service_role;

update public.app_meta
  set value = '20261030000001', updated_at = now()
  where key = 'schema_version';
