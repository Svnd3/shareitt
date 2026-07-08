-- Families table
create table families (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  host_name text not null,
  host_phone text,
  price_per_slot integer not null,
  total_slots integer not null,
  filled_slots integer default 0,
  is_verified boolean default false,
  is_live boolean default true,
  whatsapp_group_link text,
  hosting_method text not null default 'whatsapp'
    check (hosting_method in ('escrow', 'whatsapp')),
  host_social_1 text,
  host_email text,
  host_payment_mpesa_code text,
  created_by uuid references auth.users(id),
  created_at timestamp default now()
);

-- Members table
-- social_media_1/2 are required from the self-serve Join form (enforced
-- client-side) but left nullable here so admins can add a vetted member
-- directly (see Account.jsx's "Add a member directly") without needing
-- socials the admin may not have on hand.
create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  user_id uuid references auth.users(id),
  name text not null,
  phone text not null,
  email text,
  social_media_1 text,
  social_media_2 text,
  payment_confirmed boolean default false,
  joined_at timestamp default now()
);

-- Payments table
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  mpesa_code text not null,
  amount integer not null default 90,
  payment_confirmed boolean default false,
  created_at timestamp default now()
);

-- Escrow payments table (joiner -> ShareIt, for families using hosting_method = 'escrow')
create table escrow_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  member_id uuid references members(id),
  user_id uuid references auth.users(id),
  service_amount integer not null,
  maintenance_fee integer not null,
  total_amount integer not null,
  mpesa_code text not null,
  payment_confirmed boolean default false,
  created_at timestamp default now()
);

-- Seed data
insert into families (service_name, host_name, host_phone, price_per_slot, total_slots, filled_slots, is_verified, whatsapp_group_link) values
('Spotify Premium','Brian M.','+254700000001',250,6,5,true,'https://chat.whatsapp.com/example1'),
('Netflix Standard','Amina K.','+254700000002',400,4,4,true,'https://chat.whatsapp.com/example2'),
('ChatGPT Plus','David O.','+254700000003',600,5,3,false,''),
('Claude Pro','Faith W.','+254700000004',550,5,4,true,'https://chat.whatsapp.com/example4'),
('Canva Pro','James N.','+254700000005',200,5,5,true,'https://chat.whatsapp.com/example5'),
('YouTube Premium','Grace A.','+254700000006',300,6,2,false,''),
('Prime Video','Kevin L.','+254700000007',350,4,3,true,'https://chat.whatsapp.com/example7');

-- MIGRATION: run this once against an existing database to add hosting methods
-- and ShareIt Escrow support (safe for existing rows — hosting_method defaults
-- to 'whatsapp' and host_social_1 stays nullable).
alter table families
  add column hosting_method text not null default 'whatsapp'
    check (hosting_method in ('escrow', 'whatsapp')),
  add column host_social_1 text;

create table escrow_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  member_id uuid references members(id),
  user_id uuid references auth.users(id),
  service_amount integer not null,
  maintenance_fee integer not null,
  total_amount integer not null,
  mpesa_code text not null,
  payment_confirmed boolean default false,
  created_at timestamp default now()
);

-- MIGRATION: run this once against an existing database to add the host's
-- email (used to notify hosts of incoming ShareIt Escrow payments).
alter table families add column if not exists host_email text;

-- MIGRATION: run this once against an existing database to record the
-- host's own M-Pesa contribution code when they pick the "escrow" hosting
-- method (paid to ShareIt's number before the listing is created).
alter table families add column if not exists host_payment_mpesa_code text;

-- MIGRATION: run this once against an existing database to add the tiered,
-- capacity-based paywall (Join Pass / Host Starter / Combo / Power Host /
-- Unlimited). Unlike `payments`/`escrow_payments` above, rows here are only
-- ever written by the verify-payment edge function after Paystack itself
-- confirms the transaction server-side — see supabase_rls_policies.sql for
-- why there is no client insert policy on this table.
create table payment_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  tier text not null check (tier in ('join', 'host', 'combo', 'power', 'unlimited')),
  amount integer not null,
  paystack_reference text not null unique,
  host_slots_total integer not null default 0,
  host_slots_used integer not null default 0,
  join_slots_total integer not null default 0,
  join_slots_used integer not null default 0,
  is_unlimited boolean not null default false,
  expires_at timestamp,
  created_at timestamp default now()
);

-- MIGRATION: run this once against an existing database to support
-- Unlimited-plan expiry reminder emails (see
-- supabase/functions/subscription-reminders). Each column records when that
-- threshold's reminder was sent for a grant, so the daily cron run never
-- double-emails the same person.
alter table payment_grants add column if not exists reminder_5day_sent_at timestamptz;
alter table payment_grants add column if not exists reminder_3day_sent_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- Automatic emails setup (one-time, manual dashboard steps)
--
-- 1. Deploy the edge functions: `supabase functions deploy send-email` and
--    `supabase functions deploy escrow-payment-confirmed`. Both need the
--    RESEND_API_KEY secret (already configured for send-email).
-- 2. In the Supabase Dashboard: Database -> Webhooks -> Create a new webhook
--    - Table: escrow_payments
--    - Events: Update
--    - Type: Supabase Edge Functions -> escrow-payment-confirmed
--    This sends a "payment confirmed" email to the joiner whenever staff set
--    escrow_payments.payment_confirmed = true.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- Unlimited-plan expiry reminders (one-time, manual dashboard/SQL steps)
--
-- 1. Deploy the edge function: `supabase functions deploy subscription-reminders`.
--    It uses the RESEND_API_KEY secret (already configured for send-email)
--    plus the auto-injected SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
-- 2. In the Supabase SQL Editor, enable pg_cron/pg_net (Database ->
--    Extensions, or just run the two `create extension` lines below) and
--    schedule a daily call to the function. Replace <project-ref> and
--    <service-role-key> with your project's values (Settings -> API):
--
--    create extension if not exists pg_cron with schema extensions;
--    create extension if not exists pg_net with schema extensions;
--
--    select cron.schedule(
--      'subscription-expiry-reminders',
--      '0 8 * * *', -- daily at 08:00 UTC
--      $$
--      select net.http_post(
--        url := 'https://<project-ref>.supabase.co/functions/v1/subscription-reminders',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer <service-role-key>',
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
--      $$
--    );
--
--    This emails every Unlimited-plan holder once when their plan has 5 days
--    left, and once more at 3 days left (see reminder_5day_sent_at /
--    reminder_3day_sent_at above — each threshold only ever fires once per
--    grant, so a missed cron run just catches up the next day instead of
--    double-sending).
-- ─────────────────────────────────────────────────────────────────────────
