insert into public.products (code, name, deposit_amount, sort_order)
values
  ('NIGHT', 'NIGHT SET', 10000, 1),
  ('B', 'B set', 10000, 2),
  ('A', 'A set', 10000, 3),
  ('VALUE', '실속 set', 10000, 4)
on conflict (code) do update set
  name = excluded.name,
  deposit_amount = excluded.deposit_amount,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.pickup_numbers (number, label, product_id, sort_order)
select n, n::text, p.id, n
from generate_series(1, 16) n
join public.products p on p.code = 'NIGHT'
on conflict (number) do update set
  product_id = excluded.product_id,
  sort_order = excluded.sort_order,
  label = excluded.label,
  is_active = true;

insert into public.pickup_numbers (number, label, product_id, sort_order)
select n, n::text, p.id, n
from generate_series(17, 19) n
join public.products p on p.code = 'B'
on conflict (number) do update set
  product_id = excluded.product_id,
  sort_order = excluded.sort_order,
  label = excluded.label,
  is_active = true;

insert into public.pickup_numbers (number, label, product_id, sort_order)
select n, n::text, p.id, n
from generate_series(20, 24) n
join public.products p on p.code = 'A'
on conflict (number) do update set
  product_id = excluded.product_id,
  sort_order = excluded.sort_order,
  label = excluded.label,
  is_active = true;

insert into public.pickup_numbers (number, label, product_id, sort_order)
select n, n::text, p.id, n
from generate_series(25, 26) n
join public.products p on p.code = 'VALUE'
on conflict (number) do update set
  product_id = excluded.product_id,
  sort_order = excluded.sort_order,
  label = excluded.label,
  is_active = true;

insert into public.sms_templates (type, name, body, variables)
values
  (
    'reservation_guide',
    '예약 안내 문자',
    '[PICUP PICNIC]\n{{customerName}}님 예약 안내드립니다.\n날짜: {{reservationDate}}\n시간: {{reservationTime}}\n상품: {{productName}}\n픽업번호: {{pickupNumber}}\n\n이용 후 반납 인증샷을 문자 또는 카톡으로 보내주세요.\n보증금 {{depositAmount}}원은 물품 확인 후 환불됩니다.',
    array['customerName','reservationDate','reservationTime','productName','pickupNumber','depositAmount']
  ),
  (
    'return_request',
    '반납 요청 문자',
    '[PICUP PICNIC]\n{{customerName}}님 이용 종료 시간이 가까워졌습니다.\n반납 후 인증샷을 문자 또는 카톡으로 보내주세요.\n픽업번호: {{pickupNumber}}',
    array['customerName','pickupNumber']
  ),
  (
    'review_request',
    '리뷰 요청 문자',
    '[PICUP PICNIC]\n{{customerName}}님 리뷰 이벤트 참여 확인을 위해 리뷰 인증샷을 보내주세요.\n감사합니다.',
    array['customerName']
  ),
  (
    'deposit_refunded',
    '보증금 환불 완료 문자',
    '[PICUP PICNIC]\n{{customerName}}님 보증금 {{depositAmount}}원 환불이 완료되었습니다.\n이용해주셔서 감사합니다.',
    array['customerName','depositAmount']
  )
on conflict (type) do update set
  name = excluded.name,
  body = excluded.body,
  variables = excluded.variables,
  is_active = true;
