# PICUP PICNIC Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-usable MVP admin system for PICUP PICNIC reservations, pickup numbers, SMS templates/logs, refunds, and dashboard operations.

**Architecture:** Create a Next.js App Router application using Supabase Auth, Supabase Postgres with RLS, Tailwind CSS, and shadcn/ui. Keep SMS delivery behind a provider interface so the MVP can use a mock provider first and then switch to Solapi without changing UI flows.

**Tech Stack:** Next.js, TypeScript, React, Supabase JS, Supabase SSR helpers, Tailwind CSS, shadcn/ui, Zod, React Hook Form, Vitest, Playwright.

---

## File Structure Map

- `package.json`: scripts and dependencies for Next.js, Supabase, testing, and UI.
- `app/layout.tsx`: root HTML shell and global providers.
- `app/page.tsx`: redirect entrypoint to dashboard or login.
- `app/(auth)/login/page.tsx`: Supabase email/password login screen.
- `app/(admin)/layout.tsx`: protected admin layout with sidebar and auth guard.
- `app/(admin)/dashboard/page.tsx`: operational metrics and recent SMS status.
- `app/(admin)/reservations/page.tsx`: reservation list.
- `app/(admin)/reservations/new/page.tsx`: create reservation.
- `app/(admin)/reservations/[id]/page.tsx`: edit reservation, SMS actions, refund panel, SMS history.
- `app/(admin)/sms-templates/page.tsx`: editable SMS templates.
- `app/(admin)/sms-logs/page.tsx`: SMS log list.
- `app/(admin)/refunds/page.tsx`: refund queue.
- `app/api/reservations/route.ts`: reservation list/create API.
- `app/api/reservations/[id]/route.ts`: reservation detail/update/delete API.
- `app/api/pickup-number/route.ts`: pickup number allocation preview API.
- `app/api/sms/preview/route.ts`: render template preview.
- `app/api/sms/send/route.ts`: send SMS and write log.
- `app/api/sms-templates/[id]/route.ts`: update editable SMS template body.
- `app/api/refunds/[reservationId]/route.ts`: update refund account/status.
- `components/app-sidebar.tsx`: admin navigation.
- `components/status-badge.tsx`: Korean status labels and badge colors.
- `components/reservation-form.tsx`: reservation create/edit form.
- `components/reservation-table.tsx`: responsive reservation list.
- `components/sms-preview-dialog.tsx`: preview-before-send modal.
- `components/sms-template-form.tsx`: template edit form.
- `components/refund-panel.tsx`: refund account/status UI.
- `components/dashboard-cards.tsx`: metric cards.
- `lib/supabase/client.ts`: browser Supabase client.
- `lib/supabase/server.ts`: server Supabase client.
- `lib/supabase/middleware.ts`: session middleware helper.
- `lib/auth/admin.ts`: admin access helpers.
- `lib/reservations/status.ts`: status constants, labels, and transitions.
- `lib/reservations/pickup-number.ts`: pickup number allocator.
- `lib/sms/provider.ts`: provider interface and provider selection.
- `lib/sms/mock-provider.ts`: deterministic mock SMS provider.
- `lib/sms/solapi-provider.ts`: Solapi provider.
- `lib/sms/nhn-provider.ts`: NHN interface stub that returns a clear configuration error until implemented.
- `lib/sms/render-template.ts`: template renderer.
- `lib/format.ts`: phone, date, time, and KRW formatting helpers.
- `lib/validators.ts`: Zod schemas shared by forms and API routes.
- `middleware.ts`: Supabase auth session refresh and admin route protection.
- `supabase/migrations/0001_initial_schema.sql`: tables, enums, indexes, triggers.
- `supabase/migrations/0002_rls_policies.sql`: RLS function and policies.
- `supabase/migrations/0003_seed_products_pickup_templates.sql`: product, pickup number, template seeds.
- `types/database.types.ts`: generated Supabase types.
- `tests/unit/render-template.test.ts`: SMS template rendering tests.
- `tests/unit/pickup-number.test.ts`: pickup allocator tests with pure fixtures.
- `tests/e2e/admin-flow.spec.ts`: browser smoke flow for login, create reservation, preview/send SMS.

## Task 1: Scaffold the Next.js Project

**Files:**
- Create: `package.json`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `components.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create the app skeleton**

Run:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir false --import-alias "@/*"
```

Expected: command completes and creates a Next.js App Router project in the current directory.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```bash
npm install @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers lucide-react clsx tailwind-merge class-variance-authority date-fns
npm install -D vitest @vitejs/plugin-react jsdom playwright @playwright/test
```

Expected: `package-lock.json` updates and `npm install` exits with code 0.

- [ ] **Step 3: Add shadcn/ui base components**

Run:

```bash
npx shadcn@latest init --yes
npx shadcn@latest add button input label textarea select checkbox badge card table dialog dropdown-menu separator sheet toast form
```

Expected: `components/ui/*` files exist and `components.json` is configured.

- [ ] **Step 4: Add environment example**

Create `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMS_PROVIDER=mock
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=
NHN_SMS_APP_KEY=
NHN_SMS_SECRET_KEY=
NHN_SMS_SENDER=
```

- [ ] **Step 5: Add scripts**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 7: Commit scaffold**

Run:

```bash
git add package.json package-lock.json app next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs components.json components .env.example .gitignore
git commit -m "chore: scaffold Next.js admin app"
```

Expected: commit succeeds.

## Task 2: Add Supabase Schema, RLS, and Seed Data

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `supabase/migrations/0003_seed_products_pickup_templates.sql`

- [ ] **Step 1: Write initial schema migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
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
```

- [ ] **Step 2: Write RLS migration**

Create `supabase/migrations/0002_rls_policies.sql`:

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
```

- [ ] **Step 3: Write seed migration**

Create `supabase/migrations/0003_seed_products_pickup_templates.sql`:

```sql
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
```

- [ ] **Step 4: Verify migrations locally**

Run:

```bash
npx supabase start
npx supabase db reset
```

Expected: local Supabase starts and all migrations apply without SQL errors.

- [ ] **Step 5: Commit database migrations**

Run:

```bash
git add supabase/migrations
git commit -m "feat: add Supabase schema and seed data"
```

Expected: commit succeeds.

## Task 3: Add Shared Types, Validators, and Utilities

**Files:**
- Create: `lib/reservations/status.ts`
- Create: `lib/format.ts`
- Create: `lib/validators.ts`
- Create: `tests/unit/render-template.test.ts`
- Create: `tests/unit/pickup-number.test.ts`

- [ ] **Step 1: Add status constants**

Create `lib/reservations/status.ts`:

```ts
export const RESERVATION_STATUSES = [
  'reserved',
  'guide_sms_sent',
  'in_use',
  'return_photo_pending',
  'returned',
  'review_photo_pending',
  'deposit_refunded',
  'completed',
] as const

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  reserved: '예약완료',
  guide_sms_sent: '안내문자발송완료',
  in_use: '이용중',
  return_photo_pending: '반납사진확인대기',
  returned: '반납완료',
  review_photo_pending: '리뷰인증확인대기',
  deposit_refunded: '보증금환불완료',
  completed: '완료',
}

export const SMS_TEMPLATE_TYPES = [
  'reservation_guide',
  'return_request',
  'review_request',
  'deposit_refunded',
] as const

export type SmsTemplateType = (typeof SMS_TEMPLATE_TYPES)[number]

export const SMS_TEMPLATE_TYPE_LABELS: Record<SmsTemplateType, string> = {
  reservation_guide: '예약 안내 문자',
  return_request: '반납 요청 문자',
  review_request: '리뷰 요청 문자',
  deposit_refunded: '보증금 환불 완료 문자',
}
```

- [ ] **Step 2: Add formatting helpers**

Create `lib/format.ts`:

```ts
export function formatKrw(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '')

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return value
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}
```

- [ ] **Step 3: Add validators**

Create `lib/validators.ts`:

```ts
import { z } from 'zod'

import { RESERVATION_STATUSES, SMS_TEMPLATE_TYPES } from '@/lib/reservations/status'

export const reservationInputSchema = z.object({
  customerName: z.string().min(1, '고객 이름을 입력하세요.'),
  customerPhone: z.string().min(9, '고객 전화번호를 입력하세요.'),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '예약 날짜를 선택하세요.'),
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/, '예약 시간을 선택하세요.'),
  expectedReturnAt: z.string().optional().nullable(),
  productId: z.string().uuid('상품을 선택하세요.'),
  paymentAmount: z.coerce.number().int().min(0, '결제 금액은 0원 이상이어야 합니다.'),
  depositAmount: z.coerce.number().int().min(0).default(10000),
  depositIncluded: z.coerce.boolean().default(true),
  pickupNumberId: z.string().uuid().optional().nullable(),
  pickupNumber: z.coerce.number().int().positive('픽업번호를 입력하세요.'),
  status: z.enum(RESERVATION_STATUSES).default('reserved'),
  reviewEventParticipated: z.coerce.boolean().default(false),
  memo: z.string().optional().nullable(),
})

export const refundInputSchema = z.object({
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
  refundAmount: z.coerce.number().int().min(0).default(10000),
  isRefunded: z.coerce.boolean().default(false),
  refundedAt: z.string().optional().nullable(),
  refundMemo: z.string().optional().nullable(),
})

export const smsPreviewSchema = z.object({
  reservationId: z.string().uuid(),
  templateType: z.enum(SMS_TEMPLATE_TYPES),
})

export const smsSendSchema = smsPreviewSchema

export const smsTemplateUpdateSchema = z.object({
  body: z.string().min(1, '문자 내용을 입력하세요.'),
})
```

- [ ] **Step 4: Commit shared utilities**

Run:

```bash
git add lib/reservations/status.ts lib/format.ts lib/validators.ts
git commit -m "feat: add shared admin utilities"
```

Expected: commit succeeds.

## Task 4: Add Supabase Clients and Admin Auth Guard

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/auth/admin.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Add browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: Add server client**

Create `lib/supabase/server.ts`:

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Components cannot set cookies. Middleware refreshes sessions.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 3: Add middleware client**

Create `lib/supabase/middleware.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  await supabase.auth.getUser()

  return response
}
```

- [ ] **Step 4: Add admin helper**

Create `lib/auth/admin.ts`:

```ts
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('user_id, name, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!admin) {
    redirect('/login?error=not_admin')
  }

  return { user, admin }
}
```

- [ ] **Step 5: Add middleware**

Create `middleware.ts`:

```ts
import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 6: Commit Supabase auth helpers**

Run:

```bash
git add lib/supabase lib/auth middleware.ts
git commit -m "feat: add Supabase admin auth helpers"
```

Expected: commit succeeds.

## Task 5: Build Login and Protected Admin Layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/actions.ts`
- Create: `app/(admin)/layout.tsx`
- Create: `components/app-sidebar.tsx`

- [ ] **Step 1: Implement login server action**

Create `app/(auth)/login/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Implement login page**

Create `app/(auth)/login/page.tsx`:

```tsx
import { login } from './actions'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>PICUP PICNIC 관리자</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <LoginError searchParams={searchParams} />
            <Button type="submit" className="w-full">로그인</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  if (!params.error) {
    return null
  }

  const message =
    params.error === 'not_admin'
      ? '관리자 권한이 없는 계정입니다.'
      : '이메일 또는 비밀번호를 확인하세요.'

  return <p className="text-sm text-red-600">{message}</p>
}
```

- [ ] **Step 3: Implement sidebar**

Create `components/app-sidebar.tsx`:

```tsx
import Link from 'next/link'
import { BarChart3, ClipboardList, FileText, MessageSquareText, WalletCards } from 'lucide-react'

const items = [
  { href: '/dashboard', label: '대시보드', icon: BarChart3 },
  { href: '/reservations', label: '예약 관리', icon: ClipboardList },
  { href: '/refunds', label: '환불 관리', icon: WalletCards },
  { href: '/sms-templates', label: '문자 템플릿', icon: FileText },
  { href: '/sms-logs', label: '문자 로그', icon: MessageSquareText },
]

export function AppSidebar() {
  return (
    <aside className="border-b bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="px-4 py-4">
        <p className="text-lg font-semibold">PICUP PICNIC</p>
        <p className="text-sm text-zinc-500">운영 관리자</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:space-y-1 md:overflow-visible">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Implement protected layout**

Create `app/(admin)/layout.tsx`:

```tsx
import { AppSidebar } from '@/components/app-sidebar'
import { requireAdmin } from '@/lib/auth/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-zinc-50 md:flex">
      <AppSidebar />
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Redirect root**

Create `app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
```

- [ ] **Step 6: Verify login build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 7: Commit login layout**

Run:

```bash
git add app components/app-sidebar.tsx
git commit -m "feat: add admin login and protected layout"
```

Expected: commit succeeds.

## Task 6: Implement Pickup Number Allocation

**Files:**
- Create: `lib/reservations/pickup-number.ts`
- Create: `app/api/pickup-number/route.ts`
- Create: `tests/unit/pickup-number.test.ts`

- [ ] **Step 1: Write pickup allocation unit tests**

Create `tests/unit/pickup-number.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { getNextPickupNumberFromLists } from '@/lib/reservations/pickup-number'

describe('getNextPickupNumberFromLists', () => {
  it('returns the lowest available pickup number', () => {
    const result = getNextPickupNumberFromLists(
      [
        { id: 'p1', number: 1, sort_order: 1 },
        { id: 'p2', number: 2, sort_order: 2 },
        { id: 'p3', number: 3, sort_order: 3 },
      ],
      [1, 2],
    )

    expect(result).toEqual({ pickupNumberId: 'p3', pickupNumber: 3 })
  })

  it('returns null when every eligible number is used', () => {
    const result = getNextPickupNumberFromLists(
      [
        { id: 'p1', number: 1, sort_order: 1 },
        { id: 'p2', number: 2, sort_order: 2 },
      ],
      [1, 2],
    )

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/unit/pickup-number.test.ts
```

Expected: FAIL because `lib/reservations/pickup-number.ts` does not exist.

- [ ] **Step 3: Implement pickup allocator**

Create `lib/reservations/pickup-number.ts`:

```ts
type PickupNumberCandidate = {
  id: string
  number: number
  sort_order: number
}

export function getNextPickupNumberFromLists(
  candidates: PickupNumberCandidate[],
  usedNumbers: number[],
) {
  const used = new Set(usedNumbers)
  const sorted = [...candidates].sort((a, b) => a.sort_order - b.sort_order || a.number - b.number)
  const next = sorted.find((candidate) => !used.has(candidate.number))

  if (!next) {
    return null
  }

  return {
    pickupNumberId: next.id,
    pickupNumber: next.number,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- tests/unit/pickup-number.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implement pickup API**

Create `app/api/pickup-number/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getNextPickupNumberFromLists } from '@/lib/reservations/pickup-number'
import { createClient } from '@/lib/supabase/server'

const inputSchema = z.object({
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  productId: z.string().uuid(),
})

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json())

  if (!input.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: candidates, error: candidatesError } = await supabase
    .from('pickup_numbers')
    .select('id, number, sort_order')
    .eq('product_id', input.data.productId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('number', { ascending: true })

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 })
  }

  const { data: usedRows, error: usedError } = await supabase
    .from('reservations')
    .select('pickup_number')
    .eq('reservation_date', input.data.reservationDate)

  if (usedError) {
    return NextResponse.json({ error: usedError.message }, { status: 500 })
  }

  const next = getNextPickupNumberFromLists(
    candidates ?? [],
    (usedRows ?? []).map((row) => row.pickup_number),
  )

  if (!next) {
    return NextResponse.json({ error: '선택한 날짜와 상품에 배정 가능한 픽업번호가 없습니다.' }, { status: 409 })
  }

  return NextResponse.json(next)
}
```

- [ ] **Step 6: Commit pickup allocation**

Run:

```bash
git add lib/reservations/pickup-number.ts app/api/pickup-number/route.ts tests/unit/pickup-number.test.ts
git commit -m "feat: add pickup number allocation"
```

Expected: commit succeeds.

## Task 7: Implement SMS Template Rendering and Providers

**Files:**
- Create: `lib/sms/render-template.ts`
- Create: `lib/sms/provider.ts`
- Create: `lib/sms/mock-provider.ts`
- Create: `lib/sms/solapi-provider.ts`
- Create: `lib/sms/nhn-provider.ts`
- Create: `tests/unit/render-template.test.ts`

- [ ] **Step 1: Write template rendering tests**

Create `tests/unit/render-template.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { renderSmsTemplate } from '@/lib/sms/render-template'

describe('renderSmsTemplate', () => {
  it('replaces known variables', () => {
    const result = renderSmsTemplate('안녕하세요 {{customerName}}님, 번호는 {{pickupNumber}}입니다.', {
      customerName: '김민지',
      pickupNumber: '7',
    })

    expect(result).toBe('안녕하세요 김민지님, 번호는 7입니다.')
  })

  it('keeps unknown variables visible', () => {
    const result = renderSmsTemplate('{{customerName}} {{unknownValue}}', {
      customerName: '김민지',
    })

    expect(result).toBe('김민지 {{unknownValue}}')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- tests/unit/render-template.test.ts
```

Expected: FAIL because `lib/sms/render-template.ts` does not exist.

- [ ] **Step 3: Implement renderer**

Create `lib/sms/render-template.ts`:

```ts
export type SmsTemplateVariables = Record<string, string | number | null | undefined>

export function renderSmsTemplate(template: string, variables: SmsTemplateVariables) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key]

    if (value === null || value === undefined) {
      return match
    }

    return String(value)
  })
}
```

- [ ] **Step 4: Implement provider interface**

Create `lib/sms/provider.ts`:

```ts
import { MockSmsProvider } from '@/lib/sms/mock-provider'
import { NhnSmsProvider } from '@/lib/sms/nhn-provider'
import { SolapiSmsProvider } from '@/lib/sms/solapi-provider'

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

export type SmsProviderName = 'mock' | 'solapi' | 'nhn'

export function getSmsProviderName(): SmsProviderName {
  const value = process.env.SMS_PROVIDER

  if (value === 'solapi' || value === 'nhn' || value === 'mock') {
    return value
  }

  return 'mock'
}

export function createSmsProvider(): SmsProvider {
  const provider = getSmsProviderName()

  if (provider === 'solapi') {
    return new SolapiSmsProvider()
  }

  if (provider === 'nhn') {
    return new NhnSmsProvider()
  }

  return new MockSmsProvider()
}
```

- [ ] **Step 5: Implement mock provider**

Create `lib/sms/mock-provider.ts`:

```ts
import type { SmsProvider, SmsSendInput, SmsSendResult } from '@/lib/sms/provider'

export class MockSmsProvider implements SmsProvider {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (input.to.endsWith('0000')) {
      return {
        ok: false,
        failureReason: 'Mock provider forced failure for numbers ending in 0000.',
      }
    }

    return {
      ok: true,
      providerMessageId: `mock_${Date.now()}`,
    }
  }
}
```

- [ ] **Step 6: Implement Solapi provider**

Create `lib/sms/solapi-provider.ts`:

```ts
import crypto from 'crypto'

import type { SmsProvider, SmsSendInput, SmsSendResult } from '@/lib/sms/provider'

export class SolapiSmsProvider implements SmsProvider {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const apiKey = process.env.SOLAPI_API_KEY
    const apiSecret = process.env.SOLAPI_API_SECRET
    const from = process.env.SOLAPI_SENDER

    if (!apiKey || !apiSecret || !from) {
      return { ok: false, failureReason: 'Solapi 환경변수가 설정되지 않았습니다.' }
    }

    const date = new Date().toISOString()
    const salt = crypto.randomUUID()
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(date + salt)
      .digest('hex')

    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: input.to,
          from,
          text: input.text,
        },
      }),
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        failureReason: typeof body?.errorMessage === 'string' ? body.errorMessage : 'Solapi 발송 실패',
      }
    }

    return {
      ok: true,
      providerMessageId: typeof body?.messageId === 'string' ? body.messageId : undefined,
    }
  }
}
```

- [ ] **Step 7: Implement NHN provider stub with explicit failure**

Create `lib/sms/nhn-provider.ts`:

```ts
import type { SmsProvider, SmsSendInput, SmsSendResult } from '@/lib/sms/provider'

export class NhnSmsProvider implements SmsProvider {
  async send(_input: SmsSendInput): Promise<SmsSendResult> {
    return {
      ok: false,
      failureReason: 'NHN Cloud SMS provider is not enabled in this MVP. Set SMS_PROVIDER=mock or SMS_PROVIDER=solapi.',
    }
  }
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 9: Commit SMS base**

Run:

```bash
git add lib/sms tests/unit/render-template.test.ts
git commit -m "feat: add SMS template rendering and providers"
```

Expected: commit succeeds.

## Task 8: Implement Reservation APIs

**Files:**
- Create: `app/api/reservations/route.ts`
- Create: `app/api/reservations/[id]/route.ts`

- [ ] **Step 1: Implement list/create route**

Create `app/api/reservations/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { getNextPickupNumberFromLists } from '@/lib/reservations/pickup-number'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/format'
import { reservationInputSchema } from '@/lib/validators'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('*, products(name, code), refund_accounts(is_refunded)')
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reservations: data ?? [] })
}

export async function POST(request: Request) {
  const parsed = reservationInputSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, deposit_amount')
    .eq('id', parsed.data.productId)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 400 })
  }

  let pickupNumberId = parsed.data.pickupNumberId
  let pickupNumber = parsed.data.pickupNumber

  if (!pickupNumberId) {
    const { data: candidates, error: candidatesError } = await supabase
      .from('pickup_numbers')
      .select('id, number, sort_order')
      .eq('product_id', parsed.data.productId)
      .eq('is_active', true)

    if (candidatesError) {
      return NextResponse.json({ error: candidatesError.message }, { status: 500 })
    }

    const { data: usedRows, error: usedError } = await supabase
      .from('reservations')
      .select('pickup_number')
      .eq('reservation_date', parsed.data.reservationDate)

    if (usedError) {
      return NextResponse.json({ error: usedError.message }, { status: 500 })
    }

    const next = getNextPickupNumberFromLists(
      candidates ?? [],
      (usedRows ?? []).map((row) => row.pickup_number),
    )

    if (!next) {
      return NextResponse.json({ error: '배정 가능한 픽업번호가 없습니다.' }, { status: 409 })
    }

    pickupNumberId = next.pickupNumberId
    pickupNumber = next.pickupNumber
  }

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      source: 'manual',
      customer_name: parsed.data.customerName,
      customer_phone: normalizePhone(parsed.data.customerPhone),
      reservation_date: parsed.data.reservationDate,
      reservation_time: parsed.data.reservationTime,
      expected_return_at: parsed.data.expectedReturnAt || null,
      product_id: parsed.data.productId,
      product_name_snapshot: product.name,
      payment_amount: parsed.data.paymentAmount,
      deposit_amount: parsed.data.depositAmount,
      deposit_included: parsed.data.depositIncluded,
      pickup_number_id: pickupNumberId,
      pickup_number: pickupNumber,
      status: parsed.data.status,
      review_event_participated: parsed.data.reviewEventParticipated,
      memo: parsed.data.memo,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('refund_accounts').insert({
    reservation_id: data.id,
    refund_amount: parsed.data.depositAmount,
  })

  return NextResponse.json({ reservation: data })
}
```

- [ ] **Step 2: Implement detail/update/delete route**

Create `app/api/reservations/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { normalizePhone } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { reservationInputSchema } from '@/lib/validators'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = paramsSchema.safeParse(await context.params)

  if (!params.success) {
    return NextResponse.json({ error: '예약 ID를 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('*, products(*), refund_accounts(*), sms_logs(*)')
    .eq('id', params.data.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ reservation: data })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = paramsSchema.safeParse(await context.params)
  const parsed = reservationInputSchema.safeParse(await request.json())

  if (!params.success || !parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', parsed.data.productId)
    .single()

  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({
      customer_name: parsed.data.customerName,
      customer_phone: normalizePhone(parsed.data.customerPhone),
      reservation_date: parsed.data.reservationDate,
      reservation_time: parsed.data.reservationTime,
      expected_return_at: parsed.data.expectedReturnAt || null,
      product_id: parsed.data.productId,
      product_name_snapshot: product.name,
      payment_amount: parsed.data.paymentAmount,
      deposit_amount: parsed.data.depositAmount,
      deposit_included: parsed.data.depositIncluded,
      pickup_number_id: parsed.data.pickupNumberId,
      pickup_number: parsed.data.pickupNumber,
      status: parsed.data.status,
      review_event_participated: parsed.data.reviewEventParticipated,
      memo: parsed.data.memo,
    })
    .eq('id', params.data.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reservation: data })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = paramsSchema.safeParse(await context.params)

  if (!params.success) {
    return NextResponse.json({ error: '예약 ID를 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('reservations').delete().eq('id', params.data.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify API build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit reservation APIs**

Run:

```bash
git add app/api/reservations
git commit -m "feat: add reservation APIs"
```

Expected: commit succeeds.

## Task 9: Build Reservation UI

**Files:**
- Create: `components/status-badge.tsx`
- Create: `components/reservation-table.tsx`
- Create: `components/reservation-form.tsx`
- Create: `app/(admin)/reservations/page.tsx`
- Create: `app/(admin)/reservations/new/page.tsx`

- [ ] **Step 1: Implement status badge**

Create `components/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import { RESERVATION_STATUS_LABELS, type ReservationStatus } from '@/lib/reservations/status'

const variants: Record<ReservationStatus, string> = {
  reserved: 'bg-sky-100 text-sky-800 hover:bg-sky-100',
  guide_sms_sent: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
  in_use: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  return_photo_pending: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  returned: 'bg-lime-100 text-lime-800 hover:bg-lime-100',
  review_photo_pending: 'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100',
  deposit_refunded: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  completed: 'bg-zinc-200 text-zinc-800 hover:bg-zinc-200',
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge className={variants[status]}>{RESERVATION_STATUS_LABELS[status]}</Badge>
}
```

- [ ] **Step 2: Implement reservation list page**

Create `app/(admin)/reservations/page.tsx`:

```tsx
import Link from 'next/link'

import { ReservationTable } from '@/components/reservation-table'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function ReservationsPage() {
  const supabase = await createClient()
  const { data: reservations } = await supabase
    .from('reservations')
    .select('*, products(name, code)')
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">예약 관리</h1>
          <p className="text-sm text-zinc-500">네이버 예약 정보를 등록하고 운영 상태를 관리합니다.</p>
        </div>
        <Button asChild>
          <Link href="/reservations/new">예약 등록</Link>
        </Button>
      </div>
      <ReservationTable reservations={reservations ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Implement reservation table**

Create `components/reservation-table.tsx`:

```tsx
import Link from 'next/link'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKrw, formatPhone } from '@/lib/format'
import type { ReservationStatus } from '@/lib/reservations/status'

type ReservationRow = {
  id: string
  customer_name: string
  customer_phone: string
  reservation_date: string
  reservation_time: string
  product_name_snapshot: string
  payment_amount: number
  deposit_included: boolean
  pickup_number: number
  status: ReservationStatus
}

export function ReservationTable({ reservations }: { reservations: ReservationRow[] }) {
  if (reservations.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-zinc-500">등록된 예약이 없습니다.</CardContent></Card>
  }

  return (
    <>
      <div className="hidden rounded-md border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>상품</TableHead>
              <TableHead>픽업번호</TableHead>
              <TableHead>결제금액</TableHead>
              <TableHead>보증금</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>{reservation.reservation_date} {reservation.reservation_time.slice(0, 5)}</TableCell>
                <TableCell>
                  <div className="font-medium">{reservation.customer_name}</div>
                  <div className="text-xs text-zinc-500">{formatPhone(reservation.customer_phone)}</div>
                </TableCell>
                <TableCell>{reservation.product_name_snapshot}</TableCell>
                <TableCell>{reservation.pickup_number}</TableCell>
                <TableCell>{formatKrw(reservation.payment_amount)}</TableCell>
                <TableCell>{reservation.deposit_included ? '포함' : '미포함'}</TableCell>
                <TableCell><StatusBadge status={reservation.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/reservations/${reservation.id}`}>상세</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {reservations.map((reservation) => (
          <Card key={reservation.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{reservation.customer_name}</p>
                  <p className="text-sm text-zinc-500">{formatPhone(reservation.customer_phone)}</p>
                </div>
                <StatusBadge status={reservation.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>{reservation.reservation_date}</p>
                <p>{reservation.reservation_time.slice(0, 5)}</p>
                <p>{reservation.product_name_snapshot}</p>
                <p>픽업 {reservation.pickup_number}</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/reservations/${reservation.id}`}>상세 보기</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Implement minimal reservation form**

Create `components/reservation-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Product = { id: string; name: string; deposit_amount: number }

export function ReservationForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [reservationDate, setReservationDate] = useState('')
  const [pickupNumber, setPickupNumber] = useState('')
  const [pickupNumberId, setPickupNumberId] = useState('')
  const [reviewEventParticipated, setReviewEventParticipated] = useState(false)

  useEffect(() => {
    async function loadPickupNumber() {
      if (!productId || !reservationDate) return

      const response = await fetch('/api/pickup-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, reservationDate }),
      })
      const data = await response.json()

      if (response.ok) {
        setPickupNumber(String(data.pickupNumber))
        setPickupNumberId(data.pickupNumberId)
      }
    }

    loadPickupNumber()
  }, [productId, reservationDate])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    const body = {
      customerName: formData.get('customerName'),
      customerPhone: formData.get('customerPhone'),
      reservationDate,
      reservationTime: formData.get('reservationTime'),
      expectedReturnAt: formData.get('expectedReturnAt') || null,
      productId,
      paymentAmount: formData.get('paymentAmount'),
      depositAmount: formData.get('depositAmount'),
      depositIncluded: formData.get('depositIncluded') === 'on',
      pickupNumberId,
      pickupNumber,
      status: 'reserved',
      reviewEventParticipated,
      memo: formData.get('memo'),
    }

    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      router.push('/reservations')
      router.refresh()
      return
    }

    const data = await response.json()
    alert(typeof data.error === 'string' ? data.error : '예약 저장에 실패했습니다.')
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-md border bg-white p-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="customerName">고객 이름</Label>
        <Input id="customerName" name="customerName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerPhone">고객 전화번호</Label>
        <Input id="customerPhone" name="customerPhone" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reservationDate">예약 날짜</Label>
        <Input id="reservationDate" type="date" value={reservationDate} onChange={(event) => setReservationDate(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reservationTime">예약 시간</Label>
        <Input id="reservationTime" name="reservationTime" type="time" required />
      </div>
      <div className="space-y-2">
        <Label>상품</Label>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger><SelectValue placeholder="상품 선택" /></SelectTrigger>
          <SelectContent>
            {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pickupNumber">픽업번호</Label>
        <Input id="pickupNumber" value={pickupNumber} onChange={(event) => { setPickupNumber(event.target.value); setPickupNumberId('') }} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymentAmount">결제 금액</Label>
        <Input id="paymentAmount" name="paymentAmount" type="number" min="0" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="depositAmount">보증금</Label>
        <Input id="depositAmount" name="depositAmount" type="number" min="0" defaultValue="10000" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="depositIncluded" name="depositIncluded" defaultChecked />
        <Label htmlFor="depositIncluded">결제 금액에 보증금 포함</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="reviewEventParticipated" checked={reviewEventParticipated} onCheckedChange={(checked) => setReviewEventParticipated(Boolean(checked))} />
        <Label htmlFor="reviewEventParticipated">리뷰 이벤트 참여</Label>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="expectedReturnAt">예상 반납 시각</Label>
        <Input id="expectedReturnAt" name="expectedReturnAt" type="datetime-local" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="memo">메모</Label>
        <Textarea id="memo" name="memo" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">예약 저장</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Implement new reservation page**

Create `app/(admin)/reservations/new/page.tsx`:

```tsx
import { ReservationForm } from '@/components/reservation-form'
import { createClient } from '@/lib/supabase/server'

export default async function NewReservationPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, deposit_amount')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">예약 등록</h1>
        <p className="text-sm text-zinc-500">네이버 예약 정보를 수동으로 입력합니다.</p>
      </div>
      <ReservationForm products={products ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Verify reservation UI**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 7: Commit reservation UI**

Run:

```bash
git add components/status-badge.tsx components/reservation-table.tsx components/reservation-form.tsx app/'(admin)'/reservations
git commit -m "feat: add reservation management UI"
```

Expected: commit succeeds.

## Task 10: Implement SMS Preview, Send, Templates, and Logs UI

**Files:**
- Create: `app/api/sms/preview/route.ts`
- Create: `app/api/sms/send/route.ts`
- Create: `app/api/sms-templates/[id]/route.ts`
- Create: `components/sms-preview-dialog.tsx`
- Create: `components/sms-template-form.tsx`
- Create: `app/(admin)/sms-templates/page.tsx`
- Create: `app/(admin)/sms-logs/page.tsx`

- [ ] **Step 1: Implement SMS preview API**

Create `app/api/sms/preview/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { formatKrw } from '@/lib/format'
import { renderSmsTemplate } from '@/lib/sms/render-template'
import { createClient } from '@/lib/supabase/server'
import { smsPreviewSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const parsed = smsPreviewSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: reservation } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', parsed.data.reservationId)
    .single()
  const { data: template } = await supabase
    .from('sms_templates')
    .select('*')
    .eq('type', parsed.data.templateType)
    .eq('is_active', true)
    .single()

  if (!reservation || !template) {
    return NextResponse.json({ error: '예약 또는 템플릿을 찾을 수 없습니다.' }, { status: 404 })
  }

  const renderedBody = renderSmsTemplate(template.body, {
    customerName: reservation.customer_name,
    customerPhone: reservation.customer_phone,
    reservationDate: reservation.reservation_date,
    reservationTime: reservation.reservation_time.slice(0, 5),
    productName: reservation.product_name_snapshot,
    pickupNumber: reservation.pickup_number,
    depositAmount: formatKrw(reservation.deposit_amount),
    paymentAmount: formatKrw(reservation.payment_amount),
    expectedReturnAt: reservation.expected_return_at ?? '',
  })

  return NextResponse.json({ renderedBody, template })
}
```

- [ ] **Step 2: Implement SMS send API**

Create `app/api/sms/send/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { formatKrw } from '@/lib/format'
import { createSmsProvider, getSmsProviderName } from '@/lib/sms/provider'
import { renderSmsTemplate } from '@/lib/sms/render-template'
import { createClient } from '@/lib/supabase/server'
import { smsSendSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const parsed = smsSendSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', parsed.data.reservationId)
    .single()
  const { data: template } = await supabase
    .from('sms_templates')
    .select('*')
    .eq('type', parsed.data.templateType)
    .eq('is_active', true)
    .single()

  if (!reservation || !template) {
    return NextResponse.json({ error: '예약 또는 템플릿을 찾을 수 없습니다.' }, { status: 404 })
  }

  const renderedBody = renderSmsTemplate(template.body, {
    customerName: reservation.customer_name,
    customerPhone: reservation.customer_phone,
    reservationDate: reservation.reservation_date,
    reservationTime: reservation.reservation_time.slice(0, 5),
    productName: reservation.product_name_snapshot,
    pickupNumber: reservation.pickup_number,
    depositAmount: formatKrw(reservation.deposit_amount),
    paymentAmount: formatKrw(reservation.payment_amount),
    expectedReturnAt: reservation.expected_return_at ?? '',
  })

  const provider = createSmsProvider()
  const providerName = getSmsProviderName()
  const result = await provider.send({ to: reservation.customer_phone, text: renderedBody })

  await supabase.from('sms_logs').insert({
    reservation_id: reservation.id,
    template_id: template.id,
    template_type: template.type,
    provider: providerName,
    recipient_name: reservation.customer_name,
    recipient_phone: reservation.customer_phone,
    rendered_body: renderedBody,
    status: result.ok ? 'success' : 'failed',
    provider_message_id: result.providerMessageId,
    failure_reason: result.failureReason,
    sent_by: user?.id ?? null,
  })

  if (result.ok && template.type === 'reservation_guide') {
    await supabase.from('reservations').update({ status: 'guide_sms_sent' }).eq('id', reservation.id)
  }

  if (result.ok && template.type === 'deposit_refunded') {
    await supabase.from('reservations').update({ status: 'deposit_refunded' }).eq('id', reservation.id)
  }

  return NextResponse.json({ result, renderedBody })
}
```

- [ ] **Step 3: Implement template management page**

Create `app/(admin)/sms-templates/page.tsx`:

```tsx
import { SmsTemplateForm } from '@/components/sms-template-form'
import { createClient } from '@/lib/supabase/server'

export default async function SmsTemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('sms_templates')
    .select('*')
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">문자 템플릿</h1>
        <p className="text-sm text-zinc-500">발송 전 미리보기에 사용되는 문자 내용을 관리합니다.</p>
      </div>
      <div className="grid gap-4">
        {(templates ?? []).map((template) => (
          <SmsTemplateForm key={template.id} template={template} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement template form**

Create `components/sms-template-form.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { SMS_TEMPLATE_TYPE_LABELS, type SmsTemplateType } from '@/lib/reservations/status'

type Template = {
  id: string
  type: SmsTemplateType
  name: string
  body: string
  variables: string[]
}

export function SmsTemplateForm({ template }: { template: Template }) {
  const router = useRouter()
  const [body, setBody] = useState(template.body)

  async function save() {
    const response = await fetch(`/api/sms-templates/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })

    if (response.ok) {
      router.refresh()
      return
    }

    alert('템플릿 저장에 실패했습니다.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{SMS_TEMPLATE_TYPE_LABELS[template.type]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} />
        <p className="text-xs text-zinc-500">사용 가능 변수: {template.variables.map((name) => `{{${name}}}`).join(', ')}</p>
        <Button type="button" onClick={save}>저장</Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Add missing template update API before using the form**

Create `app/api/sms-templates/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { smsTemplateUpdateSchema } from '@/lib/validators'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = paramsSchema.safeParse(await context.params)
  const parsed = smsTemplateUpdateSchema.safeParse(await request.json())

  if (!params.success || !parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('sms_templates')
    .update({ body: parsed.data.body, updated_by: user?.id ?? null })
    .eq('id', params.data.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}
```

- [ ] **Step 6: Implement logs page**

Create `app/(admin)/sms-logs/page.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function SmsLogsPage() {
  const supabase = await createClient()
  const { data: logs } = await supabase
    .from('sms_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">문자 발송 로그</h1>
        <p className="text-sm text-zinc-500">최근 문자 발송 성공과 실패 내역입니다.</p>
      </div>
      <div className="space-y-3">
        {(logs ?? []).map((log) => (
          <Card key={log.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{log.recipient_name}</p>
                  <p className="text-sm text-zinc-500">{log.recipient_phone}</p>
                </div>
                <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                  {log.status === 'success' ? '성공' : '실패'}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm">{log.rendered_body}</p>
              {log.failure_reason ? <p className="text-sm text-red-600">{log.failure_reason}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit SMS routes and UI**

Run:

```bash
git add app/api/sms app/api/sms-templates app/'(admin)'/sms-templates app/'(admin)'/sms-logs components/sms-template-form.tsx
git commit -m "feat: add SMS templates and logs"
```

Expected: commit succeeds.

## Task 11: Implement Reservation Detail, SMS Preview Dialog, and Refunds

**Files:**
- Create: `components/sms-preview-dialog.tsx`
- Create: `components/refund-panel.tsx`
- Create: `app/api/refunds/[reservationId]/route.ts`
- Create: `app/(admin)/reservations/[id]/page.tsx`
- Create: `app/(admin)/refunds/page.tsx`

- [ ] **Step 1: Implement SMS preview dialog**

Create `components/sms-preview-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SMS_TEMPLATE_TYPE_LABELS, type SmsTemplateType } from '@/lib/reservations/status'

export function SmsPreviewDialog({
  reservationId,
  templateType,
}: {
  reservationId: string
  templateType: SmsTemplateType
}) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function preview() {
    setOpen(true)
    const response = await fetch('/api/sms/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, templateType }),
    })
    const data = await response.json()
    setBody(response.ok ? data.renderedBody : '미리보기를 불러오지 못했습니다.')
  }

  async function send() {
    setSending(true)
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, templateType }),
    })
    setSending(false)

    if (response.ok) {
      setOpen(false)
      window.location.reload()
      return
    }

    alert('문자 발송에 실패했습니다. 문자 로그를 확인하세요.')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" onClick={preview}>
          <Send className="mr-2 h-4 w-4" />
          {SMS_TEMPLATE_TYPE_LABELS[templateType]}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>문자 미리보기</DialogTitle>
        </DialogHeader>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-4 text-sm">{body}</pre>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button type="button" onClick={send} disabled={sending}>{sending ? '발송 중' : '발송'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Implement refund API**

Create `app/api/refunds/[reservationId]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { refundInputSchema } from '@/lib/validators'

const paramsSchema = z.object({ reservationId: z.string().uuid() })

export async function PATCH(request: Request, context: { params: Promise<{ reservationId: string }> }) {
  const params = paramsSchema.safeParse(await context.params)
  const parsed = refundInputSchema.safeParse(await request.json())

  if (!params.success || !parsed.success) {
    return NextResponse.json({ error: '입력값을 확인하세요.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refund_accounts')
    .upsert({
      reservation_id: params.data.reservationId,
      bank_name: parsed.data.bankName,
      account_number: parsed.data.accountNumber,
      account_holder: parsed.data.accountHolder,
      refund_amount: parsed.data.refundAmount,
      is_refunded: parsed.data.isRefunded,
      refunded_at: parsed.data.isRefunded ? parsed.data.refundedAt || new Date().toISOString() : null,
      refund_memo: parsed.data.refundMemo,
    }, { onConflict: 'reservation_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.isRefunded) {
    await supabase.from('reservations').update({ status: 'deposit_refunded' }).eq('id', params.data.reservationId)
  }

  return NextResponse.json({ refund: data })
}
```

- [ ] **Step 3: Implement refund panel**

Create `components/refund-panel.tsx`:

```tsx
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Refund = {
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  refund_amount: number
  is_refunded: boolean
  refunded_at: string | null
  refund_memo: string | null
} | null

export function RefundPanel({ reservationId, refund }: { reservationId: string; refund: Refund }) {
  const [isRefunded, setIsRefunded] = useState(refund?.is_refunded ?? false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const response = await fetch(`/api/refunds/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: formData.get('bankName'),
        accountNumber: formData.get('accountNumber'),
        accountHolder: formData.get('accountHolder'),
        refundAmount: formData.get('refundAmount'),
        isRefunded,
        refundedAt: formData.get('refundedAt') || null,
        refundMemo: formData.get('refundMemo'),
      }),
    })

    if (!response.ok) {
      alert('환불 정보 저장에 실패했습니다.')
      return
    }

    window.location.reload()
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-md border bg-white p-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="bankName">은행명</Label>
        <Input id="bankName" name="bankName" defaultValue={refund?.bank_name ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountHolder">예금주</Label>
        <Input id="accountHolder" name="accountHolder" defaultValue={refund?.account_holder ?? ''} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="accountNumber">계좌번호</Label>
        <Input id="accountNumber" name="accountNumber" defaultValue={refund?.account_number ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="refundAmount">환불 금액</Label>
        <Input id="refundAmount" name="refundAmount" type="number" defaultValue={refund?.refund_amount ?? 10000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="refundedAt">환불 완료일</Label>
        <Input id="refundedAt" name="refundedAt" type="datetime-local" defaultValue={refund?.refunded_at?.slice(0, 16) ?? ''} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="isRefunded" checked={isRefunded} onCheckedChange={(checked) => setIsRefunded(Boolean(checked))} />
        <Label htmlFor="isRefunded">환불 완료</Label>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="refundMemo">환불 메모</Label>
        <Textarea id="refundMemo" name="refundMemo" defaultValue={refund?.refund_memo ?? ''} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">환불 정보 저장</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Implement reservation detail page**

Create `app/(admin)/reservations/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'

import { RefundPanel } from '@/components/refund-panel'
import { SmsPreviewDialog } from '@/components/sms-preview-dialog'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKrw, formatPhone } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, refund_accounts(*), sms_logs(*)')
    .eq('id', id)
    .single()

  if (!reservation) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{reservation.customer_name}</h1>
          <p className="text-sm text-zinc-500">{formatPhone(reservation.customer_phone)}</p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      <Card>
        <CardHeader><CardTitle>예약 정보</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>날짜: {reservation.reservation_date}</p>
          <p>시간: {reservation.reservation_time.slice(0, 5)}</p>
          <p>상품: {reservation.product_name_snapshot}</p>
          <p>픽업번호: {reservation.pickup_number}</p>
          <p>결제금액: {formatKrw(reservation.payment_amount)}</p>
          <p>보증금: {formatKrw(reservation.deposit_amount)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>문자 발송</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <SmsPreviewDialog reservationId={reservation.id} templateType="reservation_guide" />
          <SmsPreviewDialog reservationId={reservation.id} templateType="return_request" />
          <SmsPreviewDialog reservationId={reservation.id} templateType="review_request" />
          <SmsPreviewDialog reservationId={reservation.id} templateType="deposit_refunded" />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">보증금 환불</h2>
        <RefundPanel reservationId={reservation.id} refund={reservation.refund_accounts} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Implement refund queue page**

Create `app/(admin)/refunds/page.tsx`:

```tsx
import Link from 'next/link'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatKrw } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export default async function RefundsPage() {
  const supabase = await createClient()
  const { data: reservations } = await supabase
    .from('reservations')
    .select('*, refund_accounts(*)')
    .neq('status', 'completed')
    .order('reservation_date', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">환불 관리</h1>
        <p className="text-sm text-zinc-500">보증금 환불 대기와 완료 상태를 확인합니다.</p>
      </div>
      <div className="space-y-3">
        {(reservations ?? []).map((reservation) => (
          <Card key={reservation.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{reservation.customer_name}</p>
                <p className="text-sm text-zinc-500">
                  {reservation.reservation_date} · 픽업 {reservation.pickup_number} · {formatKrw(reservation.deposit_amount)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={reservation.status} />
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/reservations/${reservation.id}`}>관리</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit detail and refund features**

Run:

```bash
git add components/sms-preview-dialog.tsx components/refund-panel.tsx app/api/refunds app/'(admin)'/reservations/'[id]' app/'(admin)'/refunds
git commit -m "feat: add reservation detail and refunds"
```

Expected: commit succeeds.

## Task 12: Implement Dashboard

**Files:**
- Create: `components/dashboard-cards.tsx`
- Create: `app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Implement dashboard cards**

Create `components/dashboard-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardCards({
  todayReservations,
  returnPending,
  refundPending,
  completed,
}: {
  todayReservations: number
  returnPending: number
  refundPending: number
  completed: number
}) {
  const cards = [
    { label: '오늘 예약 수', value: todayReservations },
    { label: '오늘 반납 대기', value: returnPending },
    { label: '보증금 환불 대기', value: refundPending },
    { label: '완료된 예약 수', value: completed },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement dashboard page**

Create `app/(admin)/dashboard/page.tsx`:

```tsx
import { DashboardCards } from '@/components/dashboard-cards'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    todayReservations,
    returnPending,
    refundPending,
    completed,
    logs,
  ] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('reservation_date', today),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).in('status', ['return_photo_pending', 'in_use']),
    supabase.from('refund_accounts').select('id', { count: 'exact', head: true }).eq('is_refunded', false),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('sms_logs').select('*').order('sent_at', { ascending: false }).limit(10),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <p className="text-sm text-zinc-500">오늘 운영에 필요한 핵심 지표입니다.</p>
      </div>
      <DashboardCards
        todayReservations={todayReservations.count ?? 0}
        returnPending={returnPending.count ?? 0}
        refundPending={refundPending.count ?? 0}
        completed={completed.count ?? 0}
      />
      <Card>
        <CardHeader><CardTitle>최근 문자 발송</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(logs.data ?? []).map((log) => (
            <div key={log.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium">{log.recipient_name}</p>
                <p className="text-sm text-zinc-500">{log.template_type}</p>
              </div>
              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                {log.status === 'success' ? '성공' : '실패'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit dashboard**

Run:

```bash
git add components/dashboard-cards.tsx app/'(admin)'/dashboard
git commit -m "feat: add operations dashboard"
```

Expected: commit succeeds.

## Task 13: Final Verification and Browser Smoke Test

**Files:**
- Create: `tests/e2e/admin-flow.spec.ts`
- Modify: files discovered during verification fixes

- [ ] **Step 1: Run static verification**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Start dev server**

Run:

```bash
npm run dev
```

Expected: Next.js starts on `http://localhost:3000` or prints the selected port.

- [ ] **Step 3: Manually verify UI in browser**

Open the local URL and verify:

- Login page renders.
- After Supabase admin setup, admin can log in.
- Dashboard renders without visual overlap.
- Reservation list renders empty state.
- Reservation create page renders product dropdown and pickup number field.
- SMS templates page renders editable templates.
- SMS logs page renders empty state or existing logs.
- Refund page renders without layout breakage.
- Mobile viewport at 390px width remains usable.

- [ ] **Step 4: Add E2E smoke test after admin test credentials exist**

Create `tests/e2e/admin-flow.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('admin login page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await expect(page.getByText('PICUP PICNIC 관리자')).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
})
```

- [ ] **Step 5: Run E2E smoke test**

Run:

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Commit verification test**

Run:

```bash
git add tests/e2e/admin-flow.spec.ts
git commit -m "test: add admin smoke test"
```

Expected: commit succeeds.

## Task 14: Deployment Setup Notes

**Files:**
- Create: `docs/setup.md`

- [ ] **Step 1: Write setup guide**

Create `docs/setup.md`:

```md
# PICUP PICNIC Admin Setup

## Environment

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMS_PROVIDER`

Use `SMS_PROVIDER=mock` for testing. Use `SMS_PROVIDER=solapi` after Solapi credentials are ready.

## Supabase Admin User

1. Create a user in Supabase Auth.
2. Copy the user UUID.
3. Insert it into `public.admins`.

```sql
insert into public.admins (user_id, name, role)
values ('AUTH_USER_UUID', 'PICUP PICNIC 관리자', 'owner');
```

## Local Commands

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
```

## SMS

Mock provider records logs without sending real SMS. Solapi sends real SMS when these are configured:

- `SMS_PROVIDER=solapi`
- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_SENDER`
```

- [ ] **Step 2: Commit setup docs**

Run:

```bash
git add docs/setup.md
git commit -m "docs: add setup guide"
```

Expected: commit succeeds.

## Final Acceptance Checklist

- [ ] Admin-only pages redirect unauthenticated users to `/login`.
- [ ] Products are seeded as NIGHT SET, B set, A set, and 실속 set.
- [ ] Pickup numbers are seeded as 1-16 NIGHT, 17-19 B, 20-24 A, 25-26 실속.
- [ ] Creating a NIGHT SET reservation on a fresh date auto-assigns pickup number 1.
- [ ] Creating the second NIGHT SET reservation on the same date auto-assigns pickup number 2.
- [ ] Creating a B set reservation on a fresh date auto-assigns pickup number 17.
- [ ] Duplicate pickup numbers on the same date are rejected.
- [ ] Reservation status appears as a Korean badge.
- [ ] SMS preview modal appears before every send action.
- [ ] Mock SMS success writes an `sms_logs` row.
- [ ] Mock SMS failure for phone numbers ending in `0000` writes a failed `sms_logs` row.
- [ ] Deposit refund account data saves.
- [ ] Deposit refunded SMS can be sent after preview.
- [ ] Dashboard counts update after creating reservations and changing refund status.
- [ ] `npm run lint`, `npm run test`, and `npm run build` pass.
