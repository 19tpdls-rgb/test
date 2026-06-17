import { z } from "zod";

import {
  RESERVATION_STATUSES,
  SMS_TEMPLATE_TYPES,
} from "@/lib/reservations/status";

const booleanInputSchema = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();

      if (["true", "1", "on"].includes(normalizedValue)) {
        return true;
      }

      if (["false", "0"].includes(normalizedValue)) {
        return false;
      }
    }

    return value;
  }, z.boolean().default(defaultValue));

const reservationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "예약 날짜를 선택하세요.")
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === value
    );
  }, "예약 날짜를 선택하세요.");

export const reservationInputSchema = z.object({
  customerName: z.string().min(1, "고객 이름을 입력하세요."),
  customerPhone: z.string().min(9, "고객 전화번호를 입력하세요."),
  reservationDate: reservationDateSchema,
  reservationTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "예약 시간을 선택하세요."),
  expectedReturnAt: z.string().optional().nullable(),
  productId: z.string().uuid("상품을 선택하세요."),
  paymentAmount: z.coerce
    .number()
    .int()
    .min(0, "결제 금액은 0원 이상이어야 합니다."),
  depositAmount: z.coerce.number().int().min(0).default(10000),
  depositIncluded: booleanInputSchema(true),
  pickupNumberId: z.string().uuid().optional().nullable(),
  pickupNumber: z.coerce.number().int().positive("픽업번호를 입력하세요."),
  status: z.enum(RESERVATION_STATUSES).default("reserved"),
  reviewEventParticipated: booleanInputSchema(false),
  memo: z.string().optional().nullable(),
});

export const refundInputSchema = z.object({
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
  refundAmount: z.coerce.number().int().min(0).default(10000),
  isRefunded: booleanInputSchema(false),
  refundedAt: z.string().optional().nullable(),
  refundMemo: z.string().optional().nullable(),
});

export const smsPreviewSchema = z.object({
  reservationId: z.string().uuid(),
  templateType: z.enum(SMS_TEMPLATE_TYPES),
});

export const smsSendSchema = smsPreviewSchema;

export const smsTemplateUpdateSchema = z.object({
  body: z.string().min(1, "문자 내용을 입력하세요."),
});
