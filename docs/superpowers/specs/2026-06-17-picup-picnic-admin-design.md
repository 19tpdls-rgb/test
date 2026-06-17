# PICUP PICNIC Admin System Design

Date: 2026-06-17
Status: Ready for user review

## Goal

Build a practical first version of the PICUP PICNIC web admin system for daily reservation operations. The MVP should let an operator manually register Naver Reservation bookings, assign pickup numbers, send and log SMS messages, manage deposits, and view a simple operations dashboard.

The first version prioritizes reliable manual operation. Naver Reservation crawling/API import, automatic scheduled SMS jobs, and automatic image verification are designed as extension points but are not implemented in the first build.

## Recommended Approach

Use a single Next.js App Router application with TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

Supabase owns authentication, relational data, and RLS. Next.js owns the admin UI and server-side API routes. SMS delivery is hidden behind a provider interface so the app can start with a mock provider, then switch to Solapi, and later support NHN Cloud SMS without changing the UI flow.

This approach is recommended because it keeps the first production-ready version small enough to build and verify, while leaving clear extension points for later automation.

## Initial Scope

Included in MVP:

- Supabase Auth based admin login
- Admin-only access control
- Reservation list, detail, create, edit, and delete
- Manual entry of Naver Reservation data
- Product seed data for A set, B set, NIGHT set, and value set
- Pickup number allocation using configurable pickup-number inventory
- SMS template management with variables
- SMS preview modal before send
- Mock SMS provider first, with Solapi provider next
- SMS send logs with success/failure details
- Deposit refund account and refund status management
- Dashboard metrics for today's operations
- Mobile-responsive admin UI

Designed for later:

- Naver Reservation crawling/API importer
- Scheduled return request SMS near the expected return time
- KakaoTalk/SMS inbound image tracking
- Supabase Storage upload for return and review proof images
- NHN Cloud SMS provider

## Product and Pickup Number Rules

The pickup number is not product-prefixed. It represents a real pickup inventory number.

Current number allocation:

- 1-16: NIGHT SET
- 17-19: B set
- 20-24: A set
- 25-26: Value set

The allocation must be configurable because the number range may expand or change later.

When a reservation is created, the system finds the lowest available pickup number allowed for that product on the selected reservation date. For NIGHT SET, this means the first eligible booking receives 1, then 2, then 3, up to 16. For B set, the first eligible booking receives 17, then 18, then 19. A set and value set follow their configured ranges the same way. Operators can override the pickup number manually if needed, but the database prevents duplicate pickup numbers on the same reservation date.

If all eligible numbers for the selected product/date are taken, the UI shows a clear error and allows the operator to either change the date/product or manually override after changing the pickup-number configuration.

## Folder Structure

```txt
picup_picnic/
  app/
    (auth)/
      login/page.tsx
    (admin)/
      layout.tsx
      dashboard/page.tsx
      reservations/page.tsx
      reservations/new/page.tsx
      reservations/[id]/page.tsx
      sms-templates/page.tsx
      sms-logs/page.tsx
      refunds/page.tsx
    api/
      reservations/route.ts
      reservations/[id]/route.ts
      sms/preview/route.ts
      sms/send/route.ts
      pickup-number/route.ts
      refunds/[reservationId]/route.ts
  components/
    app-sidebar.tsx
    dashboard-cards.tsx
    refund-panel.tsx
    reservation-form.tsx
    reservation-table.tsx
    sms-preview-dialog.tsx
    sms-template-form.tsx
    status-badge.tsx
  lib/
    reservations/
      pickup-number.ts
      status.ts
    sms/
      mock-provider.ts
      nhn-provider.ts
      provider.ts
      render-template.ts
      solapi-provider.ts
    supabase/
      client.ts
      middleware.ts
      server.ts
  supabase/
    migrations/
      0001_initial_schema.sql
      0002_rls_policies.sql
      0003_seed_products_templates.sql
  types/
    database.types.ts
```

## Database Schema

### Enums

```sql
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
```

### products

```sql
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
```

Seed:

```sql
insert into public.products (code, name, deposit_amount, sort_order) values
('NIGHT', 'NIGHT SET', 10000, 1),
('B', 'B set', 10000, 2),
('A', 'A set', 10000, 3),
('VALUE', '실속 set', 10000, 4);
```

### pickup_numbers

```sql
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
```

Initial seed maps numbers to product availability:

- 1-16 -> NIGHT SET
- 17-19 -> B set
- 20-24 -> A set
- 25-26 -> Value set

The application allocates by `sort_order`, then `number`.

### admins

```sql
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'admin' check (role in ('admin', 'owner')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### reservations

```sql
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

create index reservations_date_idx on public.reservations (reservation_date);
create index reservations_status_idx on public.reservations (status);
create index reservations_customer_phone_idx on public.reservations (customer_phone);
```

`pickup_number` is stored directly for easy display and historical safety. `pickup_number_id` points to the configured inventory item when the number came from the automatic allocator.

### refund_accounts

```sql
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
```

### sms_templates

```sql
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
```

Default variables:

```txt
{{customerName}}
{{customerPhone}}
{{reservationDate}}
{{reservationTime}}
{{productName}}
{{pickupNumber}}
{{depositAmount}}
{{paymentAmount}}
{{expectedReturnAt}}
```

### sms_logs

```sql
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

create index sms_logs_reservation_id_idx on public.sms_logs (reservation_id);
create index sms_logs_sent_at_idx on public.sms_logs (sent_at desc);
```

## RLS Policy Design

Admin checks are centralized in a helper function:

```sql
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
```

Enable RLS:

```sql
alter table public.products enable row level security;
alter table public.pickup_numbers enable row level security;
alter table public.admins enable row level security;
alter table public.reservations enable row level security;
alter table public.refund_accounts enable row level security;
alter table public.sms_templates enable row level security;
alter table public.sms_logs enable row level security;
```

Policies:

```sql
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
```

Admin creation is handled manually in Supabase during setup: create an Auth user, then insert the user's UUID into `public.admins`.

## Reservation Status Flow

Korean labels map to database values:

```txt
예약완료 -> reserved
안내문자발송완료 -> guide_sms_sent
이용중 -> in_use
반납사진확인대기 -> return_photo_pending
반납완료 -> returned
리뷰인증확인대기 -> review_photo_pending
보증금환불완료 -> deposit_refunded
완료 -> completed
```

Default flow:

```txt
reserved
guide_sms_sent
in_use
return_photo_pending
returned
deposit_refunded
completed
```

If `review_event_participated` is true:

```txt
returned
review_photo_pending
deposit_refunded
completed
```

The UI allows manual status changes because real operations may not always follow the ideal order.

## API Routes

```txt
GET    /api/reservations
POST   /api/reservations
GET    /api/reservations/:id
PATCH  /api/reservations/:id
DELETE /api/reservations/:id

POST   /api/pickup-number
POST   /api/sms/preview
POST   /api/sms/send
PATCH  /api/refunds/:reservationId
```

### /api/pickup-number

Input:

```json
{
  "reservationDate": "2026-06-17",
  "productId": "uuid"
}
```

Output:

```json
{
  "pickupNumberId": "uuid",
  "pickupNumber": 1
}
```

Behavior:

- Reads active `pickup_numbers` for the selected product
- Excludes numbers already used in `reservations` for the selected date
- Returns the lowest available number
- Returns a clear error if no number is available

### /api/sms/preview

Renders a selected template with reservation data. It does not send SMS or write logs.

### /api/sms/send

Renders the selected template, sends through the configured provider, writes `sms_logs`, and optionally advances reservation status:

- `reservation_guide` success -> `guide_sms_sent`
- `deposit_refunded` success -> `deposit_refunded`
- `return_request` success -> no automatic status change in MVP
- `review_request` success -> no automatic status change in MVP

## SMS Provider Design

```ts
export type SmsSendInput = {
  to: string
  text: string
}

export type SmsSendResult = {
  ok: boolean
  providerMessageId?: string
  failureReason?: string
}

export interface SmsProvider {
  send(input: SmsSendInput): Promise<SmsSendResult>
}
```

The first implementation uses `mock-provider.ts` so the whole workflow can be tested without sending real SMS. Solapi is then added behind the same interface.

Environment variables:

```env
SMS_PROVIDER=mock
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=
NHN_SMS_APP_KEY=
NHN_SMS_SECRET_KEY=
NHN_SMS_SENDER=
```

## UI Design

The admin UI should be simple and operational rather than marketing-like.

Main navigation:

- Dashboard
- Reservations
- Refunds
- SMS Templates
- SMS Logs

Dashboard:

- Today's reservation count
- Today's return-pending count
- Pending deposit refund count
- Completed reservation count
- Recent SMS success/failure list

Reservations list:

- Customer name
- Customer phone
- Reservation date
- Reservation time
- Product
- Payment amount
- Deposit included
- Pickup number
- Status badge
- Quick actions

Reservation detail:

- Reservation form
- Current status badge
- SMS send panel with preview modal
- Refund account panel
- SMS history for that reservation
- Memo field

Mobile behavior:

- Tables collapse to card lists
- Primary actions remain visible
- Status badges use short Korean labels
- Destructive actions require confirmation

## Error Handling

- Login failures show a concise message and keep the user on the login page.
- Non-admin users are redirected away from admin pages.
- Pickup number exhaustion shows a product/date-specific error.
- Duplicate pickup numbers are blocked by the database unique constraint and surfaced clearly in the form.
- SMS failures are stored in `sms_logs.failure_reason`.
- Template rendering leaves unknown variables visibly unchanged in preview so mistakes are easy to spot before sending.

## Testing Plan

Manual MVP verification:

- Admin login succeeds for a seeded admin.
- Non-admin authenticated users cannot access admin pages.
- Reservation creation allocates the expected pickup number for each product.
- Duplicate pickup number on the same date is rejected.
- Reservation list and detail show Korean status badges.
- SMS preview renders variables correctly.
- Mock SMS send writes a success log.
- Forced mock SMS failure writes a failure log.
- Refund account data can be saved.
- Deposit refunded SMS can be sent from the refund panel.
- Dashboard counts update after reservation/status changes.
- Mobile viewport remains usable.

Later automated tests:

- Unit tests for template rendering
- Unit tests for pickup number allocation
- API route tests for reservation creation and SMS logging
- Browser tests for the create reservation and SMS preview/send flow

## Implementation Sequence

1. Project initial setup
2. Supabase schema, RLS, and seed migrations
3. Supabase Auth admin login
4. Reservation CRUD
5. Pickup number allocation
6. SMS template management
7. SMS preview and mock provider send flow
8. SMS log persistence
9. Deposit refund management
10. Dashboard
11. Solapi provider
12. End-to-end verification

This order keeps the operational data model stable before adding provider-specific SMS behavior.
