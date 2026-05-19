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

-- Seed data
insert into families (service_name, host_name, host_phone, price_per_slot, total_slots, filled_slots, is_verified, whatsapp_group_link) values
('Spotify Premium','Brian M.','+254700000001',250,6,5,true,'https://chat.whatsapp.com/example1'),
('Netflix Standard','Amina K.','+254700000002',400,4,4,true,'https://chat.whatsapp.com/example2'),
('ChatGPT Plus','David O.','+254700000003',600,5,3,false,''),
('Claude Pro','Faith W.','+254700000004',550,5,4,true,'https://chat.whatsapp.com/example4'),
('Canva Pro','James N.','+254700000005',200,5,5,true,'https://chat.whatsapp.com/example5'),
('YouTube Premium','Grace A.','+254700000006',300,6,2,false,''),
('Prime Video','Kevin L.','+254700000007',350,4,3,true,'https://chat.whatsapp.com/example7');
