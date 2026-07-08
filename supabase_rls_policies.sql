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

-- ── Soft delete ─────────────────────────────────────────────────────────
-- Deleting a family or a member used to be a real DELETE — unrecoverable.
-- Both tables get a deleted_at marker instead: the app's delete actions
-- (Host.jsx handleDeleteFamily/handleRemoveMember, the admin panel in
-- Account.jsx) now set this instead of removing the row, everyday reads
-- (Home.jsx, Join.jsx, familyData.js, Host.jsx) filter deleted_at is null,
-- and the admin "Deleted" view queries deleted_at is not null with a
-- Restore action that just clears it back to null.
alter table families add column if not exists deleted_at timestamptz;
alter table members add column if not exists deleted_at timestamptz;

-- New columns don't inherit existing column-level SELECT grants (see the
-- logo_url/group_description gotcha further down this file) — without this,
-- any select() that lists deleted_at 401s the whole query.
grant select (deleted_at) on public.families to anon, authenticated;
grant select (deleted_at) on public.members to anon, authenticated;

-- ── Enable RLS on every table ──────────────────────────────────────────────
alter table families enable row level security;
alter table members enable row level security;
alter table payments enable row level security;
alter table escrow_payments enable row level security;

-- ── Realtime ────────────────────────────────────────────────────────────
-- families was already broadcasting (Join.jsx's live slot-count
-- subscription depends on it). members is added here too so the admin
-- "All groups" view and the Account page's hosted/joined lists update
-- instantly on a join/leave instead of needing a refresh — realtime still
-- only ever delivers rows a session's RLS policies let it SELECT.
-- ALTER PUBLICATION ... ADD TABLE errors if the table is already a member,
-- so this is guarded to stay idempotent like the rest of this file.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table members;
  end if;
end $$;

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

-- Hosts can edit their own listings; the two admin accounts below can edit
-- any family's details (see src/lib/adminAccess.js for the client-side
-- mirror of this allowlist).
drop policy if exists "families_update_own" on families;
create policy "families_update_own"
  on families for update
  to authenticated
  using (
    created_by = auth.uid()
    or auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
  )
  with check (
    created_by = auth.uid()
    or auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
  );

-- The app itself never issues a real DELETE anymore (Host.jsx/Account.jsx
-- soft-delete via families_update_own instead, so it's restorable) — this
-- stays for a genuine permanent purge from the SQL editor/dashboard if one
-- is ever needed (e.g. a GDPR erasure request), now including admins.
drop policy if exists "families_delete_own" on families;
create policy "families_delete_own"
  on families for delete
  to authenticated
  using (
    created_by = auth.uid()
    or auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
  );

-- ── members ─────────────────────────────────────────────────────────────
-- A member's PII (phone, email, social handles) is visible only to:
--  - the member themselves,
--  - the host of the family they joined (so the host can verify/contact them),
--  - and the two admin accounts below (see families_update_own above and
--    src/lib/adminAccess.js), so admin support/moderation can see every
--    group's member list, not just families they personally host.
drop policy if exists "members_select_own_or_host" on members;
create policy "members_select_own_or_host"
  on members for select
  to authenticated
  using (
    user_id = auth.uid()
    or auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
    or exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  );

-- Signed-in users can only create a membership row for themselves. Admins
-- (see families_update_own above) can additionally add a member on someone
-- else's behalf with no ShareIt account of their own — e.g. resolving a
-- support case where a host asks to add a member directly. Those rows get
-- user_id = null, same as the launch-time seed members.
drop policy if exists "members_insert_own" on members;
create policy "members_insert_own"
  on members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
  );

-- The app soft-deletes members too (see families_delete_own above) — this
-- stays as the real-DELETE fallback for the host, now also admins.
drop policy if exists "members_delete_host" on members;
create policy "members_delete_host"
  on members for delete
  to authenticated
  using (
    auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
    or exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  );

-- Lets the host of a family (to fix a typo'd phone/name, or soft-delete via
-- deleted_at) or an admin (editing any member's details, same allowlist as
-- families_update_own) update a membership row. Previously there was no
-- update policy at all, so a member's details were immutable once created
-- and nobody could soft-delete/restore one without a raw SQL statement.
drop policy if exists "members_update_host_or_admin" on members;
create policy "members_update_host_or_admin"
  on members for update
  to authenticated
  using (
    auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
    or exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  )
  with check (
    auth.email() in ('hezronsande2@gmail.com', 'keninnofficial@gmail.com')
    or exists (
      select 1 from families f
      where f.id = members.family_id
        and f.created_by = auth.uid()
    )
  );

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

-- Column-level grants on this table (see the RLS-hardening comment at the
-- top of this file) do NOT auto-extend to new columns — ALTER TABLE ADD
-- COLUMN grants INSERT/UPDATE/REFERENCES to existing grantees but never
-- SELECT. Forgetting this line is exactly what silently 401'd every
-- families read once logo_url was added, since select("*") — or any select
-- list containing an ungranted column — fails the whole query, not just
-- that column.
grant select (logo_url, group_description) on public.families to anon, authenticated;

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
