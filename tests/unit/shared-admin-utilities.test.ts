import { describe, expect, it } from "vitest";

import { formatKrw, formatPhone, normalizePhone } from "@/lib/format";
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUSES,
  SMS_TEMPLATE_TYPE_LABELS,
  SMS_TEMPLATE_TYPES,
} from "@/lib/reservations/status";
import {
  refundInputSchema,
  reservationInputSchema,
  smsPreviewSchema,
  smsSendSchema,
  smsTemplateUpdateSchema,
} from "@/lib/validators";

describe("shared admin status constants", () => {
  it("exposes reservation statuses and Korean labels", () => {
    expect(RESERVATION_STATUSES).toEqual([
      "reserved",
      "guide_sms_sent",
      "in_use",
      "return_photo_pending",
      "returned",
      "review_photo_pending",
      "deposit_refunded",
      "completed",
    ]);
    expect(RESERVATION_STATUS_LABELS.reserved).toBe("예약완료");
    expect(RESERVATION_STATUS_LABELS.completed).toBe("완료");
  });

  it("exposes SMS template types and Korean labels", () => {
    expect(SMS_TEMPLATE_TYPES).toEqual([
      "reservation_guide",
      "return_request",
      "review_request",
      "deposit_refunded",
    ]);
    expect(SMS_TEMPLATE_TYPE_LABELS.reservation_guide).toBe("예약 안내 문자");
    expect(SMS_TEMPLATE_TYPE_LABELS.deposit_refunded).toBe(
      "보증금 환불 완료 문자",
    );
  });
});

describe("shared admin formatting helpers", () => {
  it("formats KRW without fraction digits", () => {
    expect(formatKrw(12345)).toBe("₩12,345");
  });

  it("formats mobile, Seoul, and non-Seoul Korean phone numbers", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone("0212345678")).toBe("02-1234-5678");
    expect(formatPhone("021234567")).toBe("02-123-4567");
    expect(formatPhone("0311234567")).toBe("031-123-4567");
  });

  it("returns the original phone value when digit count is unsupported", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("abc")).toBe("abc");
  });

  it("normalizes phone numbers to digits only", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
  });
});

describe("shared admin validators", () => {
  it("parses reservation input with planned defaults", () => {
    const parsed = reservationInputSchema.parse({
      customerName: "홍길동",
      customerPhone: "010-1234-5678",
      reservationDate: "2026-06-17",
      reservationTime: "14:30",
      productId: "11111111-1111-4111-8111-111111111111",
      paymentAmount: "30000",
      pickupNumber: "7",
    });

    expect(parsed).toMatchObject({
      depositAmount: 10000,
      depositIncluded: true,
      paymentAmount: 30000,
      pickupNumber: 7,
      reviewEventParticipated: false,
      status: "reserved",
    });
  });

  it("parses explicit boolean API and form values", () => {
    const baseReservationInput = {
      customerName: "홍길동",
      customerPhone: "010-1234-5678",
      reservationDate: "2026-06-17",
      reservationTime: "14:30",
      productId: "11111111-1111-4111-8111-111111111111",
      paymentAmount: "30000",
      pickupNumber: "7",
    };

    expect(
      reservationInputSchema.parse({
        ...baseReservationInput,
        depositIncluded: "false",
        reviewEventParticipated: "0",
      }),
    ).toMatchObject({
      depositIncluded: false,
      reviewEventParticipated: false,
    });

    expect(
      reservationInputSchema.parse({
        ...baseReservationInput,
        depositIncluded: "1",
        reviewEventParticipated: "on",
      }),
    ).toMatchObject({
      depositIncluded: true,
      reviewEventParticipated: true,
    });

    expect(
      refundInputSchema.parse({
        isRefunded: "false",
      }),
    ).toMatchObject({
      isRefunded: false,
    });

    expect(
      refundInputSchema.parse({
        isRefunded: true,
      }),
    ).toMatchObject({
      isRefunded: true,
    });
  });

  it("rejects impossible reservation dates and times", () => {
    const baseReservationInput = {
      customerName: "홍길동",
      customerPhone: "010-1234-5678",
      productId: "11111111-1111-4111-8111-111111111111",
      paymentAmount: "30000",
      pickupNumber: "7",
    };

    expect(() =>
      reservationInputSchema.parse({
        ...baseReservationInput,
        reservationDate: "2026-99-99",
        reservationTime: "14:30",
      }),
    ).toThrow();

    expect(() =>
      reservationInputSchema.parse({
        ...baseReservationInput,
        reservationDate: "2026-06-17",
        reservationTime: "99:99",
      }),
    ).toThrow();
  });

  it("parses refund input with planned defaults", () => {
    const parsed = refundInputSchema.parse({});

    expect(parsed).toMatchObject({
      refundAmount: 10000,
      isRefunded: false,
    });
  });

  it("validates SMS preview, send, and template update inputs", () => {
    const input = {
      reservationId: "22222222-2222-4222-8222-222222222222",
      templateType: "reservation_guide",
    };

    expect(smsPreviewSchema.parse(input)).toEqual(input);
    expect(smsSendSchema.parse(input)).toEqual(input);
    expect(smsTemplateUpdateSchema.parse({ body: "안녕하세요" })).toEqual({
      body: "안녕하세요",
    });
  });
});
