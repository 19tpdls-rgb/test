import { z } from "zod";

import {
  RESERVATION_STATUSES,
  SMS_TEMPLATE_TYPES,
} from "@/lib/reservations/status";

export const reservationInputSchema = z.object({
  customerName: z.string().min(1, "고객 이름을 입력하세요."),
  customerPhone: z.string().min(9, "고객 전화번호를 입력하세요."),
  reservationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "예약 날짜를 선택하세요."),
  reservationTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "예약 시간을 선택하세요."),
  expectedReturnAt: z.string().optional().nullable(),
  productId: z.string().uuid("상품을 선택하세요."),
  paymentAmount: z.coerce
    .number()
    .int()
    .min(0, "결제 금액은 0원 이상이어야 합니다."),
  depositAmount: z.coerce.number().int().min(0).default(10000),
  depositIncluded: z.coerce.boolean().default(true),
  pickupNumberId: z.string().uuid().optional().nullable(),
  pickupNumber: z.coerce.number().int().positive("픽업번호를 입력하세요."),
  status: z.enum(RESERVATION_STATUSES).default("reserved"),
  reviewEventParticipated: z.coerce.boolean().default(false),
  memo: z.string().optional().nullable(),
});

export const refundInputSchema = z.object({
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
  refundAmount: z.coerce.number().int().min(0).default(10000),
  isRefunded: z.coerce.boolean().default(false),
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
