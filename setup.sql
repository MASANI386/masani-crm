-- =====================================================================
-- MASANI FINSURE CRM — Supabase setup (SAFE: dobara run karne par bhi error nahi)
-- Supabase -> SQL Editor -> New query -> poora paste -> RUN
-- =====================================================================

-- 1) Sub-agents (aapke partner agents)
create table if not exists public.sub_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  city text,
  default_commission_pct numeric default 0,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

-- 2) Policies me nayi columns (purani policies safe rahengi)
alter table public.policies add column if not exists sub_agent_id uuid references public.sub_agents(id) on delete set null;
alter table public.policies add column if not exists agent_commission numeric default 0;
alter table public.policies add column if not exists vehicle_reg text;
alter table public.policies add column if not exists vehicle_desc text;
alter table public.policies add column if not exists last_contact_date date;
alter table public.policies add column if not exists call_outcome text;
alter table public.customers add column if not exists alternate_mobile text;

-- 3) Agent ko diya gaya paisa (len-den)
create table if not exists public.agent_payments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.sub_agents(id) on delete cascade,
  policy_id uuid references public.policies(id) on delete set null,
  amount numeric not null,
  paid_on date default current_date,
  mode text,
  note text,
  created_at timestamptz default now()
);

-- 4) Endorsements
create table if not exists public.endorsements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  endorsement_date date default current_date,
  etype text,
  description text,
  charge numeric default 0,
  file_name text,
  file_path text,
  created_at timestamptz default now()
);

-- 5) Claims
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  claim_number text,
  claim_date date default current_date,
  status text default 'Registered',
  amount_claimed numeric default 0,
  amount_settled numeric default 0,
  description text,
  file_name text,
  file_path text,
  created_at timestamptz default now()
);

-- 6) Saal bhar ki service notes
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  service_date date default current_date,
  note text,
  created_at timestamptz default now()
);

-- 6b) Business settings + WhatsApp templates (app me hi edit hote hain)
create table if not exists public.app_settings (
  id text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- 7) Sirf login wale ko access (naye tables)
do $$
declare t text;
begin
  foreach t in array array['sub_agents','agent_payments','endorsements','claims','service_records','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "login only" on public.%I', t);
    execute format('create policy "login only" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 8) Files (PDF/photo) ke liye private storage
insert into storage.buckets (id, name, public) values ('policy-files','policy-files', false)
on conflict (id) do nothing;

drop policy if exists "policy files login only" on storage.objects;
create policy "policy files login only" on storage.objects
  for all to authenticated
  using (bucket_id = 'policy-files') with check (bucket_id = 'policy-files');
