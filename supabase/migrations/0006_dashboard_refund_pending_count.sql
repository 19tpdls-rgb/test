create or replace function public.count_pending_refunds()
returns integer
language sql
security invoker
set search_path = public
stable
as $$
  select count(*)::integer
  from public.reservations as r
  left join public.refund_accounts as ra
    on ra.reservation_id = r.id
  where (
    r.deposit_included
    and r.status not in ('deposit_refunded', 'completed')
    and coalesce(ra.is_refunded, false) is not true
  )
  or ra.is_refunded is false;
$$;

revoke all on function public.count_pending_refunds() from public;
grant execute on function public.count_pending_refunds() to authenticated;
