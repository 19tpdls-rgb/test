import { NextResponse } from "next/server";
import { z } from "zod";

import { getNextPickupNumberFromLists } from "@/lib/reservations/pickup-number";
import { createClient } from "@/lib/supabase/server";

const pickupNumberRequestSchema = z.object({
  reservationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const parsedDate = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === value
      );
    }),
  productId: z.string().uuid(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "픽업번호 요청 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const parsedBody = pickupNumberRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "픽업번호 요청 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { reservationDate, productId } = parsedBody.data;

  const {
    data: pickupNumbers,
    error: pickupNumbersError,
  } = await supabase
    .from("pickup_numbers")
    .select("id, number, sort_order")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("number", { ascending: true });

  if (pickupNumbersError) {
    return NextResponse.json(
      { error: "픽업번호를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select("pickup_number")
    .eq("reservation_date", reservationDate);

  if (reservationsError) {
    return NextResponse.json(
      { error: "예약 픽업번호를 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  const allocation = getNextPickupNumberFromLists(
    pickupNumbers ?? [],
    (reservations ?? []).map((reservation) => reservation.pickup_number),
  );

  if (!allocation) {
    return NextResponse.json(
      { error: "선택한 날짜에 사용 가능한 픽업번호가 없습니다." },
      { status: 409 },
    );
  }

  return NextResponse.json(allocation);
}
