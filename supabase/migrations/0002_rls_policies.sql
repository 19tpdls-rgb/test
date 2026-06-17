create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
      and is_active = true
  );
$$;

alter table public.products enable row level security;
alter table public.pickup_numbers enable row level security;
alter table public.admins enable row level security;
alter table public.reservations enable row level security;
alter table public.refund_accounts enable row level security;
alter table public.sms_templates enable row level security;
alter table public.sms_logs enable row level security;

create policy "admins can read products"
on public.products for select
to authenticated
using (public.is_admin());

create policy "admins can manage pickup numbers"
on public.pickup_numbers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can read admins"
on public.admins for select
to authenticated
using (public.is_admin());

create policy "admins can manage reservations"
on public.reservations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage refunds"
on public.refund_accounts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage sms templates"
on public.sms_templates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can read sms logs"
on public.sms_logs for select
to authenticated
using (public.is_admin());

create policy "admins can insert sms logs"
on public.sms_logs for insert
to authenticated
with check (public.is_admin());
