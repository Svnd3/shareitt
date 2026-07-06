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

-- ── payment_grants ──────────────────────────────────────────────────────
-- Unlike `payments`/`escrow_payments` above, there is deliberately NO insert
-- (or update) policy here for authenticated users. A grant is only ever
-- created by the verify-payment edge function using the service-role key,
-- after it has independently verified the transaction with Paystack's
-- server-side API — a client can never insert a fabricated "paid" row.
alter table payment_grants enable row level security;

drop policy if exists "payment_grants_select_own" on payment_grants;
create policy "payment_grants_select_own"
  on payment_grants for select
  to authenticated
  using (user_id = auth.uid());

-- ── Atomic capacity consumption ─────────────────────────────────────────
-- Mirrors increment_family_slot above: the one narrow, safe way for a user
-- to spend one unit of their own host/join capacity. An active unlimited
-- grant is preferred first (nothing to decrement); otherwise the oldest
-- grant with remaining capacity is used. Raises if none is available, so
-- the caller (Host.jsx/Join.jsx) knows to show the paywall instead.
create or replace function public.consume_capacity(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if p_type not in ('host', 'join') then
    raise exception 'Invalid capacity type: %', p_type;
  end if;

  if exists (
    select 1 from payment_grants
    where user_id = auth.uid() and is_unlimited and expires_at > now()
  ) then
    return;
  end if;

  select id into target_id
  from payment_grants
  where user_id = auth.uid()
    and (
      (p_type = 'host' and host_slots_used < host_slots_total) or
      (p_type = 'join' and join_slots_used < join_slots_total)
    )
  order by created_at asc
  limit 1;

  if target_id is null then
    raise exception 'No available capacity for %', p_type;
  end if;

  if p_type = 'host' then
    update payment_grants set host_slots_used = host_slots_used + 1 where id = target_id;
  else
    update payment_grants set join_slots_used = join_slots_used + 1 where id = target_id;
  end if;
end;
$$;

revoke all on function public.consume_capacity(text) from public;
grant execute on function public.consume_capacity(text) to authenticated;

-- ── Leaving a group ──────────────────────────────────────────────────────
-- A joined member can't delete their own `members` row today — the only
-- delete policy is "members_delete_host" (host-only) — and even if they
-- could, the follow-up `families.filled_slots` decrement would be blocked
-- too, since "families_update_own" only allows the host to update their own
-- listing. This SECURITY DEFINER function is the narrow, safe fix: it can
-- only delete the caller's own membership row for the given family and
-- decrement that family's filled_slots by 1 (never below 0) — nothing else.
create or replace function public.leave_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from members
  where family_id = p_family_id
    and user_id = auth.uid();

  if not found then
    raise exception 'You are not a member of this group';
  end if;

  update families
  set filled_slots = greatest(filled_slots - 1, 0)
  where id = p_family_id;
end;
$$;

revoke all on function public.leave_family(uuid) from public;
grant execute on function public.leave_family(uuid) to authenticated;

-- ── Group photos (Supabase Storage) ─────────────────────────────────────
-- Lets a host upload a photo for their listing instead of relying only on
-- scraped favicons. Images are compressed/resized client-side before
-- upload (see src/lib/imageUpload.js), so the free-tier 1GB storage cap
-- goes a long way — this migration just needs the column and the bucket.
alter table families add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('service-logos', 'service-logos', true)
on conflict (id) do nothing;

-- ── Group description ───────────────────────────────────────────────────
-- Short host-written blurb shown on the group card. Listings created before
-- this field existed (or left blank) fall back to an auto-generated
-- description client-side (see src/lib/groupDescription.js) instead of
-- being backfilled here.
alter table families add column if not exists group_description text;

-- Anyone can view a logo (the marketplace listing itself is public), but
-- only the uploader can add/replace/remove their own file. Storage sets
-- `owner` to auth.uid() automatically on upload via the client SDK.
drop policy if exists "service_logos_public_read" on storage.objects;
create policy "service_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'service-logos');

drop policy if exists "service_logos_insert_own" on storage.objects;
create policy "service_logos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'service-logos');

drop policy if exists "service_logos_update_own" on storage.objects;
create policy "service_logos_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'service-logos' and owner = auth.uid());

drop policy if exists "service_logos_delete_own" on storage.objects;
create policy "service_logos_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'service-logos' and owner = auth.uid());

-- ── Realtime for live slot counts ────────────────────────────────────────
-- Lets the browse page (Home.jsx) and the join page (Join.jsx) reflect
-- filled_slots changes the instant another user joins, instead of only on
-- next page load/refresh. Guarded so re-running this script is safe even
-- if the table is already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'families'
  ) then
    alter publication supabase_realtime add table families;
  end if;
end;
$$;
