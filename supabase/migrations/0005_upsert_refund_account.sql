create or replace function public.upsert_refund_account(
  p_reservation_id uuid,
  p_bank_name text,
  p_account_number text,
  p_account_holder text,
  p_refund_amount integer,
  p_is_refunded boolean,
  p_refunded_at timestamptz,
  p_refund_memo text
)
returns public.refund_accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_refund_account public.refund_accounts;
begin
  insert into public.refund_accounts (
    reservation_id,
    bank_name,
    account_number,
    account_holder,
    refund_amount,
    is_refunded,
    refunded_at,
    refund_memo
  )
  values (
    p_reservation_id,
    p_bank_name,
    p_account_number,
    p_account_holder,
    p_refund_amount,
    p_is_refunded,
    p_refunded_at,
    p_refund_memo
  )
  on conflict (reservation_id) do update set
    bank_name = excluded.bank_name,
    account_number = excluded.account_number,
    account_holder = excluded.account_holder,
    refund_amount = excluded.refund_amount,
    is_refunded = excluded.is_refunded,
    refunded_at = excluded.refunded_at,
    refund_memo = excluded.refund_memo
  returning * into v_refund_account;

  if p_is_refunded then
    update public.reservations
    set status = 'deposit_refunded'
    where id = p_reservation_id
      and status <> 'completed';
  else
    update public.reservations
    set status = 'returned'
    where id = p_reservation_id
      and status = 'deposit_refunded';
  end if;

  return v_refund_account;
end;
$$;

revoke all on function public.upsert_refund_account(
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  timestamptz,
  text
) from public;
grant execute on function public.upsert_refund_account(
  uuid,
  text,
  text,
  text,
  integer,
  boolean,
  timestamptz,
  text
) to authenticated;
