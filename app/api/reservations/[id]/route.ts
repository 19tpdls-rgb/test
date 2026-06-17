import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAdminLookupError, requireApiAdmin } from "@/lib/auth/api-admin";
import { normalizePhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { reservationInputSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().uuid() });
const duplicatePickupMessage =
  "이미 사용 중인 픽업번호입니다. 다른 번호를 선택해 주세요.";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type PickupNumberRow = {
  id: string;
  number: number;
};

type ParsedReservationInput = ReturnType<typeof reservationInputSchema.parse>;

export async function GET(_request: Request, context: RouteContext) {
  const adminResponse = await requireActiveAdmin("get reservation");

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

  const supabase = await createClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*, products(*), refund_accounts(*), sms_logs(*)")
    .eq("id", params.data.id)
    .single();

  if (error || !reservation) {
    return NextResponse.json(
      { error: "예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ reservation });
}

export async function PATCH(request: Request, context: RouteContext) {
  const adminResponse = await requireActiveAdmin("update reservation");

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

  let parsed: ParsedReservationInput;

  try {
    parsed = reservationInputSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "예약 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, code, deposit_amount")
    .eq("id", parsed.productId)
    .single();

  if (productError || !product) {
    return NextResponse.json(
      { error: "상품을 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  const availabilityResponse = await validatePatchPickupNumber(
    supabase,
    params.data.id,
    parsed,
  );

  if (availabilityResponse instanceof NextResponse) {
    return availabilityResponse;
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .update({
      customer_name: parsed.customerName,
      customer_phone: normalizePhone(parsed.customerPhone),
      reservation_date: parsed.reservationDate,
      reservation_time: parsed.reservationTime,
      expected_return_at: parsed.expectedReturnAt || null,
      product_id: parsed.productId,
      product_name_snapshot: product.name,
      payment_amount: parsed.paymentAmount,
      deposit_amount: parsed.depositAmount,
      deposit_included: parsed.depositIncluded,
      pickup_number_id: parsed.pickupNumberId,
      pickup_number: parsed.pickupNumber,
      status: parsed.status,
      review_event_participated: parsed.reviewEventParticipated,
      memo: parsed.memo || null,
    })
    .eq("id", params.data.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update reservation", {
      reservationId: params.data.id,
      error,
    });

    if (isDuplicatePickupError(error)) {
      return NextResponse.json(
        { error: duplicatePickupMessage },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "예약을 수정하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ reservation });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const adminResponse = await requireActiveAdmin("delete reservation");

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", params.data.id);

  if (error) {
    console.error("Failed to delete reservation", {
      reservationId: params.data.id,
      error,
    });

    return NextResponse.json(
      { error: "예약을 삭제하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
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

async function validatePatchPickupNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservationId: string,
  parsed: ParsedReservationInput,
) {
  if (parsed.pickupNumberId) {
    const { data: pickupNumbers, error: pickupNumbersError } = await supabase
      .from("pickup_numbers")
      .select("id, number")
      .eq("product_id", parsed.productId)
      .eq("is_active", true);

    if (pickupNumbersError) {
      console.error("Failed to load pickup numbers for reservation update", {
        productId: parsed.productId,
        error: pickupNumbersError,
      });

      return NextResponse.json(
        { error: "픽업번호를 불러오지 못했습니다." },
        { status: 500 },
      );
    }

    const requestedPickupNumber = (pickupNumbers ?? []).find(
      (candidate: PickupNumberRow) =>
        candidate.id === parsed.pickupNumberId &&
        candidate.number === parsed.pickupNumber,
    );

    if (!requestedPickupNumber) {
      return NextResponse.json(
        { error: "선택한 픽업번호를 사용할 수 없습니다." },
        { status: 400 },
      );
    }
  }

  const { data: duplicateRows, error: duplicateCheckError } = await supabase
    .from("reservations")
    .select("id")
    .eq("reservation_date", parsed.reservationDate)
    .eq("pickup_number", parsed.pickupNumber)
    .neq("id", reservationId);

  if (duplicateCheckError) {
    console.error("Failed to check pickup number for reservation update", {
      reservationId,
      reservationDate: parsed.reservationDate,
      pickupNumber: parsed.pickupNumber,
      error: duplicateCheckError,
    });

    return NextResponse.json(
      { error: "픽업번호 사용 여부를 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  if ((duplicateRows ?? []).length > 0) {
    return NextResponse.json({ error: duplicatePickupMessage }, { status: 409 });
  }

  return null;
}

function isDuplicatePickupError(error: SupabaseErrorLike) {
  return (
    error.code === "23505" &&
    (error.message?.includes("pickup_number") ||
      error.message?.includes("reservation_date"))
  );
}
