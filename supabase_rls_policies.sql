-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security hardening for ShareIt
--
-- The Supabase anon key is embedded in the frontend bundle (this is normal
-- and expected for Supabase), which means ANY visitor can call the REST API
-- directly with that key. Without RLS, every table is fully readable and
-- writable by anyone who has the anon key — including every member's phone
-- number, email, social handles, and every payment record.
--
-- Run this whole file once in the Supabase SQL editor (Dashboard > SQL
-- Editor > New query). It is safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────

-- families.unique_name is referenced by the app (ServiceCard.jsx) but was
-- never added to the schema — add it so the host "custom link" feature works.
alter table families add column if not exists unique_name text unique;

-- ── Enable RLS on every table ──────────────────────────────────────────────
alter table families enable row level security;
alter table members enable row level security;
alter table payments enable row level security;
alter table escrow_payments enable row level security;

-- ── families ────────────────────────────────────────────────────────────
-- Anyone (including signed-out visitors) can browse listings — this is the
-- core "marketplace" feature of the app.
drop policy if exists "families_select_public" on families;
create policy "families_select_public"
  on families for select
  using (true);

-- Only signed-in users can create a listing, and only as themselves.
drop policy if exists "families_insert_own" on families;
create policy "families_insert_own"
  on families for insert
  to authenticated
  with check (created_by = auth.uid());

-- Hosts can only edit/delete their own listings.
drop policy if exists "families_update_own" on families;
create policy "families_update_own"
  on families for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "families_delete_own" on families;
create policy "families_delete_own"
  on families for delete
  to authenticated
  using (created_by = auth.uid());

-- ── members ─────────────────────────────────────────────────────────────
-- A member's PII (phone, email, social handles) is visible only to:
--  - the member themselves, and
--  - the host of the family they joined (so the host can verify/contact them).
drop policy if exists "members_select_own_or_host" on members;
create policy "members_select_own_or_host"
  on members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  );

-- Signed-in users can only create a membership row for themselves.
drop policy if exists "members_insert_own" on members;
create policy "members_insert_own"
  on members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Only the host of the family can remove a member.
drop policy if exists "members_delete_host" on members;
create policy "members_delete_host"
  on members for delete
  to authenticated
  using (
    exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  );

-- No update policy: membership rows are immutable once created.

-- ── payments ────────────────────────────────────────────────────────────
-- Users can see and create only their own payment records. Confirming a
-- payment (payment_confirmed) is an admin/back-office action and intentionally
-- has NO policy here, so it can only be done with the service role key.
drop policy if exists "payments_select_own" on payments;
create policy "payments_select_own"
  on payments for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "payments_insert_own" on payments;
create policy "payments_insert_own"
  on payments for insert
  to authenticated
  with check (user_id = auth.uid());

-- ── escrow_payments ─────────────────────────────────────────────────────
drop policy if exists "escrow_payments_select_own" on escrow_payments;
create policy "escrow_payments_select_own"
  on escrow_payments for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "escrow_payments_insert_own" on escrow_payments;
create policy "escrow_payments_insert_own"
  on escrow_payments for insert
  to authenticated
  with check (user_id = auth.uid());

-- ── Atomic slot counter ────────────────────────────────────────────────────
-- Joining a family increments families.filled_slots, but the joiner is not
-- the owner of that row, so the "families_update_own" policy above correctly
-- blocks a direct .update() from a non-host. This SECURITY DEFINER function
-- is the one narrow, safe exception: it can ONLY increment filled_slots by 1,
-- and ONLY if there's a free slot — it cannot be abused to change any other
-- column or to over-fill a family.
create or replace function public.increment_family_slot(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update families
  set filled_slots = filled_slots + 1
  where id = p_family_id
    and filled_slots < total_slots;

  if not found then
    raise exception 'Family is full or does not exist';
  end if;
end;
$$;

revoke all on function public.increment_family_slot(uuid) from public;
grant execute on function public.increment_family_slot(uuid) to authenticated;

-- ── Auto-verification ──────────────────────────────────────────────────────
-- New listings show "Pending Review" until verified. Rather than requiring
-- manual review, families auto-verify 3 minutes after creation. This runs as
-- the row owner (SECURITY DEFINER) since "families_update_own" would
-- otherwise block anon/other-user callers from flipping is_verified on
-- someone else's listing.
create or replace function public.auto_verify_families()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update families
  set is_verified = true
  where is_verified = false
    and created_at <= now() - interval '3 minutes';
end;
$$;

revoke all on function public.auto_verify_families() from public;
grant execute on function public.auto_verify_families() to anon, authenticated;

-- One-time backfill: verify every family that already exists today so
-- nobody is stuck on "Pending Review" from before this feature shipped.
update families set is_verified = true where is_verified = false;

-- Belt-and-suspenders scheduler: if pg_cron is available on this project,
-- run the sweep every minute so verification happens even with no traffic.
-- The app also calls auto_verify_families() opportunistically on page load
-- (see Home.jsx) as a fallback for projects where pg_cron isn't enabled.
do $$
begin
  create extension if not exists pg_cron with schema extensions;

  perform cron.unschedule('auto-verify-families')
  where exists (select 1 from cron.job where jobname = 'auto-verify-families');

  perform cron.schedule(
    'auto-verify-families',
    '* * * * *',
    $sql$select public.auto_verify_families();$sql$
  );
exception when others then
  raise notice 'pg_cron not available — relying on client-triggered auto_verify_families() calls instead.';
end $$;
