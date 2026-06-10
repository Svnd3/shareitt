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
  created_by uuid references auth.users(id),
  created_at timestamp default now()
);

-- Members table
create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  user_id uuid references auth.users(id),
  name text not null,
  phone text not null,
  email text,
  social_media_1 text not null,
  social_media_2 text not null,
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
