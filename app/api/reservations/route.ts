import { NextResponse } from "next/server";

import { ApiAdminLookupError, requireApiAdmin } from "@/lib/auth/api-admin";
import { normalizePhone } from "@/lib/format";
import { getNextPickupNumberFromLists } from "@/lib/reservations/pickup-number";
import { createClient } from "@/lib/supabase/server";
import { reservationInputSchema } from "@/lib/validators";

const duplicatePickupMessage =
  "이미 사용 중인 픽업번호입니다. 다른 번호를 선택해 주세요.";
const duplicatePickupConstraint =
  "reservations_reservation_date_pickup_number_key";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  constraint?: string;
};

type ProductSnapshot = {
  id: string;
  name: string;
  code?: string;
  deposit_amount?: number;
};

type PickupNumberRow = {
  id: string;
  number: number;
  sort_order: number;
};

type ParsedReservationInput = ReturnType<typeof reservationInputSchema.parse>;

export async function GET() {
  const adminResponse = await requireActiveAdmin("list reservations");

  if (adminResponse instanceof NextResponse) {
    return adminResponse;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*, products(name, code), refund_accounts(is_refunded)")
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });

  if (error) {
    console.error("Failed to list reservations", { error });

    return NextResponse.json(
      { error: "예약 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ reservations: data ?? [] });
}

export async function POST(request: Request) {
  const adminResponse = await requireActiveAdmin("create reservation");

  if (adminResponse instanceof NextResponse) {
    return adminResponse;
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
  const productResult = await loadProductSnapshot(supabase, parsed.productId);

  if (productResult instanceof NextResponse) {
    return productResult;
  }

  const pickupResult = await resolvePickupNumber(supabase, parsed);

  if (pickupResult instanceof NextResponse) {
    return pickupResult;
  }

  const reservationInput = {
    source: "manual",
    customer_name: parsed.customerName,
    customer_phone: normalizePhone(parsed.customerPhone),
    reservation_date: parsed.reservationDate,
    reservation_time: parsed.reservationTime,
    expected_return_at: parsed.expectedReturnAt || null,
    product_id: parsed.productId,
    product_name_snapshot: productResult.name,
    payment_amount: parsed.paymentAmount,
    deposit_amount: parsed.depositAmount,
    deposit_included: parsed.depositIncluded,
    pickup_number_id: pickupResult.pickupNumberId,
    pickup_number: pickupResult.pickupNumber,
    status: parsed.status,
    review_event_participated: parsed.reviewEventParticipated,
    memo: parsed.memo || null,
    created_by: adminResponse.user.id,
  };

  const { data: reservation, error } = await supabase.rpc(
    "create_reservation_with_refund",
    {
      p_reservation: reservationInput,
      p_refund_amount: parsed.depositAmount,
    },
  );

  if (error) {
    console.error("Failed to create reservation with refund", {
      reservationDate: parsed.reservationDate,
      pickupNumber: pickupResult.pickupNumber,
      error,
    });

    if (isDuplicatePickupError(error)) {
      return NextResponse.json(
        { error: duplicatePickupMessage },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "예약을 등록하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ reservation });
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

async function loadProductSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<ProductSnapshot | NextResponse> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, code, deposit_amount")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load reservation product", {
      productId,
      error,
    });

    return NextResponse.json(
      { error: "상품 정보를 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  if (!product) {
    return NextResponse.json(
      { error: "상품을 찾을 수 없습니다." },
      { status: 400 },
    );
  }

  return product;
}

async function resolvePickupNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parsed: ParsedReservationInput,
) {
  const { data: candidates, error: candidatesError } = await supabase
    .from("pickup_numbers")
    .select("id, number, sort_order")
    .eq("product_id", parsed.productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("number", { ascending: true });

  if (candidatesError) {
    console.error("Failed to load pickup numbers for reservation", {
      productId: parsed.productId,
      error: candidatesError,
    });

    return NextResponse.json(
      { error: "픽업번호를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const { data: usedRows, error: usedError } = await supabase
    .from("reservations")
    .select("pickup_number")
    .eq("reservation_date", parsed.reservationDate);

  if (usedError) {
    console.error("Failed to check pickup number availability", {
      reservationDate: parsed.reservationDate,
      error: usedError,
    });

    return NextResponse.json(
      { error: "픽업번호 사용 여부를 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  const usedNumbers = (usedRows ?? []).map(
    (reservation: { pickup_number: number }) => reservation.pickup_number,
  );

  if (parsed.pickupNumberId) {
    const requestedCandidate = (candidates ?? []).find(
      (candidate: PickupNumberRow) =>
        candidate.id === parsed.pickupNumberId &&
        candidate.number === parsed.pickupNumber,
    );

    if (!requestedCandidate) {
      return NextResponse.json(
        { error: "선택한 픽업번호를 사용할 수 없습니다." },
        { status: 400 },
      );
    }

    if (usedNumbers.includes(parsed.pickupNumber)) {
      return NextResponse.json(
        { error: duplicatePickupMessage },
        { status: 409 },
      );
    }

    return {
      pickupNumberId: parsed.pickupNumberId,
      pickupNumber: parsed.pickupNumber,
    };
  }

  const allocation = getNextPickupNumberFromLists(candidates ?? [], usedNumbers);

  if (!allocation) {
    return NextResponse.json(
      { error: "선택한 날짜에 사용 가능한 픽업번호가 없습니다." },
      { status: 409 },
    );
  }

  return allocation;
}

function isDuplicatePickupError(error: SupabaseErrorLike) {
  const errorText = [
    error.constraint,
    error.message,
    error.details,
    error.hint,
  ].filter(Boolean);

  return (
    error.code === "23505" &&
    errorText.some((value) => value?.includes(duplicatePickupConstraint))
  );
}
