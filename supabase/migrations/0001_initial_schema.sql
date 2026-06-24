create extension if not exists pgcrypto;

create type public.reservation_status as enum (
  'reserved',
  'guide_sms_sent',
  'in_use',
  'return_photo_pending',
  'returned',
  'review_photo_pending',
  'deposit_refunded',
  'completed'
);

create type public.sms_template_type as enum (
  'reservation_guide',
  'return_request',
  'review_request',
  'deposit_refunded'
);

create type public.sms_provider as enum ('mock', 'solapi', 'nhn');
create type public.sms_send_status as enum ('success', 'failed');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_price integer not null default 0,
  deposit_amount integer not null default 10000,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pickup_numbers (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number > 0),
  label text not null,
  product_id uuid not null references public.products(id),
  is_active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'admin' check (role in ('admin', 'owner')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual' check (source in ('manual', 'naver_api', 'naver_crawl')),
  external_reservation_id text,
  customer_name text not null,
  customer_phone text not null,
  reservation_date date not null,
  reservation_time time not null,
  expected_return_at timestamptz,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  payment_amount integer not null,
  deposit_amount integer not null default 10000,
  deposit_included boolean not null default true,
  pickup_number_id uuid references public.pickup_numbers(id),
  pickup_number integer not null,
  status public.reservation_status not null default 'reserved',
  review_event_participated boolean not null default false,
  memo text,
  created_by uuid references public.admins(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_date, pickup_number)
);

create table public.refund_accounts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  bank_name text,
  account_number text,
  account_holder text,
  refund_amount integer not null default 10000,
  is_refunded boolean not null default false,
  refunded_at timestamptz,
  refund_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  type public.sms_template_type not null unique,
  name text not null,
  body text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  updated_by uuid references public.admins(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete set null,
  template_id uuid references public.sms_templates(id) on delete set null,
  template_type public.sms_template_type not null,
  provider public.sms_provider not null,
  recipient_name text not null,
  recipient_phone text not null,
  rendered_body text not null,
  status public.sms_send_status not null,
  provider_message_id text,
  failure_reason text,
  sent_by uuid references public.admins(user_id),
  sent_at timestamptz not null default now()
);

create index reservations_date_idx on public.reservations (reservation_date);
create index reservations_status_idx on public.reservations (status);
create index reservations_customer_phone_idx on public.reservations (customer_phone);
create index pickup_numbers_product_idx on public.pickup_numbers (product_id, is_active, sort_order, number);
create index sms_logs_reservation_id_idx on public.sms_logs (reservation_id);
create index sms_logs_sent_at_idx on public.sms_logs (sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

create trigger pickup_numbers_set_updated_at before update on public.pickup_numbers
for each row execute function public.set_updated_at();

create trigger admins_set_updated_at before update on public.admins
for each row execute function public.set_updated_at();

create trigger reservations_set_updated_at before update on public.reservations
for each row execute function public.set_updated_at();

create trigger refund_accounts_set_updated_at before update on public.refund_accounts
for each row execute function public.set_updated_at();

create trigger sms_templates_set_updated_at before update on public.sms_templates
for each row execute function public.set_updated_at();
