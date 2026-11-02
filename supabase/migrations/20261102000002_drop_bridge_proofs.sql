-- The end-to-end bridge proof of epic fondasi (migration 20261030000001) is
-- replaced by real attempts (20261102000001): drop its receipt function and
-- its table.
drop function if exists public.record_bridge_proof_receipt(text, integer, boolean, boolean, jsonb);
drop table if exists public.bridge_proofs;

update public.app_meta
  set value = '20261102000002', updated_at = now()
  where key = 'schema_version';
