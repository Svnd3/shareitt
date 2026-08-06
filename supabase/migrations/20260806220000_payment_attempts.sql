create table if not exists public.payment_attempts (
  reference text primary key,
  user_id uuid references auth.users(id) not null,
  tier text not null check (tier in ('join', 'host', 'combo', 'power', 'unlimited')),
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.payment_attempts enable row level security;

drop policy if exists "payment_attempts_insert_own" on public.payment_attempts;
create policy "payment_attempts_insert_own" on public.payment_attempts
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "payment_attempts_select_own" on public.payment_attempts;
create policy "payment_attempts_select_own" on public.payment_attempts
  for select to authenticated
  using (user_id = auth.uid());
