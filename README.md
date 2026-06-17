# PICUP PICNIC Admin

PICUP PICNIC 예약, 문자, 보증금 환불 운영을 관리하는 Next.js 관리자 시스템입니다.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth, Postgres, RLS
- Tailwind CSS
- shadcn/ui
- Solapi 또는 NHN Cloud SMS provider 구조

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에는 Supabase 프로젝트 값과 사용할 SMS provider 값을 입력합니다.

```bash
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

`SMS_PROVIDER`는 `mock`, `solapi`, `nhn` 중 하나를 사용합니다. 로컬 개발에서는 `mock`을 권장합니다.

## Supabase

마이그레이션은 `supabase/migrations` 아래에 있습니다.

적용 순서:

1. `0001_initial_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_seed_products_pickup_templates.sql`
4. `0004_create_reservation_with_refund.sql`
5. `0005_upsert_refund_account.sql`
6. `0006_dashboard_refund_pending_count.sql`

관리자 접근은 `auth.users` 사용자와 `public.admins` 행이 모두 있어야 가능합니다. 운영자 계정을 Supabase Auth에 만든 뒤, 해당 `user_id`를 `admins` 테이블에 추가하세요.

## Features

- 관리자 로그인 및 보호된 관리자 레이아웃
- 예약 목록, 등록, 상세 조회
- 날짜별 픽업번호 자동 제안 및 수동 수정
- 문자 템플릿 수정
- 문자 미리보기 후 발송
- 문자 발송 로그
- 보증금 환불 계좌 및 환불 완료 관리
- 오늘 운영 요약 대시보드

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

E2E smoke:

```bash
npm run test:e2e
```

Next.js 16에서는 현재 `middleware.ts` 파일 convention에 대해 `proxy` 이전 경고가 표시될 수 있습니다. 빌드에는 영향을 주지 않는 경고입니다.
