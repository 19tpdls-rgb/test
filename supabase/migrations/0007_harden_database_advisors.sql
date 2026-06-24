create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists reservations_created_by_idx
on public.reservations (created_by);

create index if not exists reservations_pickup_number_id_idx
on public.reservations (pickup_number_id);

create index if not exists reservations_product_id_idx
on public.reservations (product_id);

create index if not exists sms_logs_sent_by_idx
on public.sms_logs (sent_by);

create index if not exists sms_logs_template_id_idx
on public.sms_logs (template_id);

create index if not exists sms_templates_updated_by_idx
on public.sms_templates (updated_by);
