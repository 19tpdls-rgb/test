create or replace function public.create_reservation_with_refund(
  p_reservation jsonb,
  p_refund_amount integer
)
returns public.reservations
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation public.reservations;
begin
  insert into public.reservations (
    source,
    external_reservation_id,
    customer_name,
    customer_phone,
    reservation_date,
    reservation_time,
    expected_return_at,
    product_id,
    product_name_snapshot,
    payment_amount,
    deposit_amount,
    deposit_included,
    pickup_number_id,
    pickup_number,
    status,
    review_event_participated,
    memo,
    created_by
  )
  values (
    coalesce(p_reservation->>'source', 'manual'),
    nullif(p_reservation->>'external_reservation_id', ''),
    p_reservation->>'customer_name',
    p_reservation->>'customer_phone',
    (p_reservation->>'reservation_date')::date,
    (p_reservation->>'reservation_time')::time,
    nullif(p_reservation->>'expected_return_at', '')::timestamptz,
    (p_reservation->>'product_id')::uuid,
    p_reservation->>'product_name_snapshot',
    (p_reservation->>'payment_amount')::integer,
    (p_reservation->>'deposit_amount')::integer,
    (p_reservation->>'deposit_included')::boolean,
    nullif(p_reservation->>'pickup_number_id', '')::uuid,
    (p_reservation->>'pickup_number')::integer,
    (p_reservation->>'status')::public.reservation_status,
    (p_reservation->>'review_event_participated')::boolean,
    nullif(p_reservation->>'memo', ''),
    nullif(p_reservation->>'created_by', '')::uuid
  )
  returning * into v_reservation;

  insert into public.refund_accounts (
    reservation_id,
    refund_amount
  )
  values (
    v_reservation.id,
    p_refund_amount
  );

  return v_reservation;
end;
$$;

revoke all on function public.create_reservation_with_refund(jsonb, integer) from public;
grant execute on function public.create_reservation_with_refund(jsonb, integer) to authenticated;
