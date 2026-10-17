-- Fluxentiq · 0003 — employees (HR directory)

create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  department        text,
  role              text,
  title             text,
  employment_status employment_status not null default 'active',
  start_date        date,
  location          text,
  manager_id        uuid references public.employees (id) on delete set null,
  source_tag        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, email)
);

-- The original schema uses `work_email` and a richer employee model. Since
-- this migration may run after that table already exists, reconcile the
-- application-facing columns before creating indexes that depend on them.
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists role text;
alter table public.employees add column if not exists title text;
alter table public.employees add column if not exists location text;
alter table public.employees add column if not exists source_tag text;
alter table public.employees add column if not exists employment_status text not null default 'active';

-- Preserve existing work email addresses when backfilling the app-facing alias.
update public.employees
set email = work_email::text
where email is null and work_email is not null;

alter table public.employees alter column email set not null;

create unique index if not exists employees_org_email_unique
  on public.employees (organization_id, email);
create index if not exists idx_employees_org on public.employees (organization_id);
create index if not exists idx_employees_email on public.employees (email);

alter table public.employees enable row level security;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select using (public.is_org_member(organization_id));
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert with check (public.is_org_member(organization_id));
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update using (public.is_org_member(organization_id));
drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees
  for delete using (public.current_org_role(organization_id) in ('owner', 'admin'));

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at
  before update on public.employees
  for each row execute procedure public.set_updated_at();
