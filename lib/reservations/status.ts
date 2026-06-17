export const RESERVATION_STATUSES = [
  "reserved",
  "guide_sms_sent",
  "in_use",
  "return_photo_pending",
  "returned",
  "review_photo_pending",
  "deposit_refunded",
  "completed",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  reserved: "예약완료",
  guide_sms_sent: "안내문자발송완료",
  in_use: "이용중",
  return_photo_pending: "반납사진확인대기",
  returned: "반납완료",
  review_photo_pending: "리뷰인증확인대기",
  deposit_refunded: "보증금환불완료",
  completed: "완료",
};

export const SMS_TEMPLATE_TYPES = [
  "reservation_guide",
  "return_request",
  "review_request",
  "deposit_refunded",
] as const;

export type SmsTemplateType = (typeof SMS_TEMPLATE_TYPES)[number];

export const SMS_TEMPLATE_TYPE_LABELS: Record<SmsTemplateType, string> = {
  reservation_guide: "예약 안내 문자",
  return_request: "반납 요청 문자",
  review_request: "리뷰 요청 문자",
  deposit_refunded: "보증금 환불 완료 문자",
};
