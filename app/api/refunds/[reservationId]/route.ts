import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAdminLookupError, requireApiAdmin } from "@/lib/auth/api-admin";
import { createClient } from "@/lib/supabase/server";
import { refundInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ reservationId: z.string().uuid() });

type RouteContext = {
  params: Promise<{ reservationId: string }> | { reservationId: string };
};

type ParsedRefundInput = ReturnType<typeof refundInputSchema.parse>;

export async function PATCH(request: Request, context: RouteContext) {
  const adminResponse = await requireActiveAdmin("update refund account");

  if (adminResponse instanceof NextResponse) {
    return adminResponse;
  }

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return NextResponse.json(
      { error: "예약 ID를 확인하세요." },
      { status: 400 },
    );
  }

  let parsed: ParsedRefundInput;

  try {
    parsed = refundInputSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "환불 계좌 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const refundedAt = normalizeRefundedAt(parsed);
  if (refundedAt instanceof NextResponse) {
    return refundedAt;
  }

  const supabase = await createClient();
  const { data: refundAccount, error } = await supabase.rpc(
    "upsert_refund_account",
    {
      p_reservation_id: params.data.reservationId,
      p_bank_name: blankToNull(parsed.bankName),
      p_account_number: blankToNull(parsed.accountNumber),
      p_account_holder: blankToNull(parsed.accountHolder),
      p_refund_amount: parsed.refundAmount,
      p_is_refunded: parsed.isRefunded,
      p_refunded_at: refundedAt,
      p_refund_memo: blankToNull(parsed.refundMemo),
    },
  );

  if (error) {
    console.error("Failed to upsert refund account", {
      reservationId: params.data.reservationId,
      error,
    });

    return NextResponse.json(
      { error: "환불 계좌 정보를 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ refundAccount });
}

async function requireActiveAdmin(action: string) {
  try {
    const adminGuard = await requireApiAdmin();

    if (!adminGuard.ok) {
      return NextResponse.json(
        {
          error:
            adminGuard.code === "unauthenticated"
              ? "로그인이 필요합니다."
              : "관리자 권한이 필요합니다.",
        },
        { status: adminGuard.status },
      );
    }

    return adminGuard;
  } catch (error) {
    if (error instanceof ApiAdminLookupError) {
      console.error(`Failed to verify ${action} API admin access`, {
        userId: error.userId,
        error: error.cause,
      });
    } else {
      console.error(`Unexpected ${action} API admin guard failure`, { error });
    }

    return NextResponse.json(
      { error: "관리자 권한 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function normalizeRefundedAt(parsed: ParsedRefundInput) {
  if (!parsed.isRefunded) {
    return null;
  }

  const providedValue = blankToNull(parsed.refundedAt);

  if (!providedValue) {
    return new Date().toISOString();
  }

  const date = new Date(providedValue);

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json(
      { error: "환불 일시를 확인해 주세요." },
      { status: 400 },
    );
  }

  return date.toISOString();
}

function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
