import { NextResponse } from "next/server";

import { ApiAdminLookupError, requireApiAdmin } from "@/lib/auth/api-admin";
import { formatKrw } from "@/lib/format";
import { createSmsProvider, getSmsProviderName } from "@/lib/sms/server-provider";
import type { SmsSendResult } from "@/lib/sms/provider";
import { renderSmsTemplate } from "@/lib/sms/render-template";
import { createClient } from "@/lib/supabase/server";
import { smsSendSchema } from "@/lib/validators";

type ReservationSmsRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  expected_return_at: string | null;
  product_name_snapshot: string;
  pickup_number: number;
  deposit_amount: number;
  payment_amount: number;
};

type SmsTemplateRow = {
  id: string;
  type:
    | "reservation_guide"
    | "return_request"
    | "review_request"
    | "deposit_refunded";
  name: string;
  body: string;
  variables: string[];
  is_active: boolean;
};

const unresolvedVariablePattern = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g;

export async function POST(request: Request) {
  const adminResponse = await requireActiveAdmin("send SMS");

  if (adminResponse instanceof NextResponse) {
    return adminResponse;
  }

  const parsed = smsSendSchema.safeParse(await readJson(request));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "문자 발송 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const reservationResult = await loadReservation(
    supabase,
    parsed.data.reservationId,
    "send SMS",
  );

  if (reservationResult instanceof NextResponse) {
    return reservationResult;
  }

  const templateResult = await loadTemplate(
    supabase,
    parsed.data.templateType,
    "send SMS",
  );

  if (templateResult instanceof NextResponse) {
    return templateResult;
  }

  const renderedBody = renderSmsTemplate(
    templateResult.body,
    buildSmsVariables(reservationResult),
  );
  const unresolvedVariables = findUnresolvedVariables(renderedBody);

  if (unresolvedVariables.length > 0) {
    return NextResponse.json(
      {
        error: `문자 내용에 알 수 없는 변수가 남아 있습니다: ${unresolvedVariables.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const providerName = getSmsProviderName();
  const result = await sendSms({
    providerName,
    renderedBody,
    reservation: reservationResult,
  });

  const logResult = await supabase.from("sms_logs").insert({
    reservation_id: reservationResult.id,
    template_id: templateResult.id,
    template_type: templateResult.type,
    provider: providerName,
    recipient_name: reservationResult.customer_name,
    recipient_phone: reservationResult.customer_phone,
    rendered_body: renderedBody,
    status: result.ok ? "success" : "failed",
    provider_message_id: result.providerMessageId ?? null,
    failure_reason: result.failureReason ?? null,
    sent_by: adminResponse.user.id,
  });

  if (logResult.error) {
    console.error("Failed to insert SMS audit log", {
      reservationId: reservationResult.id,
      templateId: templateResult.id,
      providerName,
      result,
      error: logResult.error,
    });

    return NextResponse.json(
      { error: "문자 발송 기록을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  if (result.ok) {
    await advanceReservationStatus(supabase, reservationResult, templateResult);
  }

  return NextResponse.json({ result, renderedBody });
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

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function loadReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservationId: string,
  action: string,
): Promise<ReservationSmsRow | NextResponse> {
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(
      [
        "id",
        "customer_name",
        "customer_phone",
        "reservation_date",
        "reservation_time",
        "expected_return_at",
        "product_name_snapshot",
        "pickup_number",
        "deposit_amount",
        "payment_amount",
      ].join(", "),
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to load reservation for ${action}`, {
      reservationId,
      error,
    });

    return NextResponse.json(
      { error: "예약 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  if (!reservation) {
    return NextResponse.json(
      { error: "예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return reservation as unknown as ReservationSmsRow;
}

async function loadTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateType: string,
  action: string,
): Promise<SmsTemplateRow | NextResponse> {
  const { data: template, error } = await supabase
    .from("sms_templates")
    .select("id, type, name, body, variables, is_active")
    .eq("type", templateType)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(`Failed to load SMS template for ${action}`, {
      templateType,
      error,
    });

    return NextResponse.json(
      { error: "문자 템플릿을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  if (!template) {
    return NextResponse.json(
      { error: "사용 가능한 문자 템플릿을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return template as SmsTemplateRow;
}

function buildSmsVariables(reservation: ReservationSmsRow) {
  return {
    customerName: reservation.customer_name,
    customerPhone: reservation.customer_phone,
    reservationDate: reservation.reservation_date,
    reservationTime: reservation.reservation_time.slice(0, 5),
    productName: reservation.product_name_snapshot,
    pickupNumber: reservation.pickup_number,
    depositAmount: formatKrw(reservation.deposit_amount),
    paymentAmount: formatKrw(reservation.payment_amount),
    expectedReturnAt: reservation.expected_return_at ?? "",
  };
}

function findUnresolvedVariables(renderedBody: string) {
  return Array.from(new Set(renderedBody.match(unresolvedVariablePattern) ?? []));
}

async function sendSms({
  providerName,
  renderedBody,
  reservation,
}: {
  providerName: string;
  renderedBody: string;
  reservation: ReservationSmsRow;
}): Promise<SmsSendResult> {
  try {
    const provider = createSmsProvider();

    return await provider.send({
      to: reservation.customer_phone,
      text: renderedBody,
    });
  } catch (error) {
    console.error("SMS provider failed", {
      reservationId: reservation.id,
      providerName,
      error,
    });

    return {
      ok: false,
      failureReason: "문자 발송 중 오류가 발생했습니다.",
    };
  }
}

async function advanceReservationStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reservation: ReservationSmsRow,
  template: SmsTemplateRow,
) {
  const nextStatus =
    template.type === "reservation_guide"
      ? "guide_sms_sent"
      : template.type === "deposit_refunded"
        ? "deposit_refunded"
        : null;

  if (!nextStatus) {
    return;
  }

  const { error } = await supabase
    .from("reservations")
    .update({ status: nextStatus })
    .eq("id", reservation.id);

  if (error) {
    console.error("Failed to advance reservation status after SMS send", {
      reservationId: reservation.id,
      templateType: template.type,
      nextStatus,
      error,
    });
  }
}
