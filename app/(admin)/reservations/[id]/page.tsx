import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import {
  RefundAccountForm,
  type RefundAccountFormValue,
} from "@/components/refund-account-form";
import { SmsPreviewButton } from "@/components/sms-preview-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatKrw, formatPhone } from "@/lib/format";
import {
  SMS_TEMPLATE_TYPE_LABELS,
  type ReservationStatus,
  type SmsTemplateType,
} from "@/lib/reservations/status";
import { createClient } from "@/lib/supabase/server";

type ReservationDetail = {
  id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  expected_return_at: string | null;
  product_name_snapshot: string;
  payment_amount: number;
  deposit_amount: number;
  deposit_included: boolean;
  pickup_number: number;
  status: ReservationStatus;
  review_event_participated: boolean;
  memo: string | null;
  products?: {
    name: string | null;
    code: string | null;
  } | null;
  refund_accounts?: RefundAccountFormValue | RefundAccountFormValue[] | null;
  sms_logs?: SmsLog[] | null;
};

type SmsLog = {
  id: string;
  template_type: SmsTemplateType;
  recipient_phone: string;
  rendered_body: string;
  status: "success" | "failed";
  failure_reason: string | null;
  created_at: string;
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*, products(*), refund_accounts(*), sms_logs(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <BackButton />
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          예약 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  if (!reservation) {
    notFound();
  }

  const detail = reservation as ReservationDetail;
  const refundAccount = normalizeRefundAccount(detail.refund_accounts);
  const smsLogs = [...(detail.sms_logs ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">
              {detail.customer_name} 예약 상세
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.reservation_date} {formatTime(detail.reservation_time)} ·
            픽업번호 {detail.pickup_number}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>예약 정보</CardTitle>
              <CardDescription>
                고객, 상품, 결제와 이용 정보를 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="고객명" value={detail.customer_name} />
                <InfoItem
                  label="연락처"
                  value={formatPhone(detail.customer_phone)}
                />
                <InfoItem
                  label="예약 일시"
                  value={`${detail.reservation_date} ${formatTime(detail.reservation_time)}`}
                />
                <InfoItem
                  label="상품"
                  value={detail.products?.name ?? detail.product_name_snapshot}
                  description={detail.products?.code ?? undefined}
                />
                <InfoItem label="픽업번호" value={String(detail.pickup_number)} />
                <InfoItem
                  label="예상 반납"
                  value={formatDateTime(detail.expected_return_at)}
                />
                <InfoItem
                  label="결제금액"
                  value={formatKrw(detail.payment_amount)}
                />
                <InfoItem
                  label="보증금"
                  value={
                    detail.deposit_included
                      ? formatKrw(detail.deposit_amount)
                      : "미포함"
                  }
                />
                <InfoItem
                  label="리뷰 이벤트"
                  value={detail.review_event_participated ? "참여" : "미참여"}
                />
              </dl>
              <div className="mt-5 flex flex-col gap-2">
                <h2 className="text-sm font-medium">메모</h2>
                <p className="min-h-16 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {detail.memo ?? "등록된 메모가 없습니다."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>환불 계좌</CardTitle>
              <CardDescription>
                보증금 환불 계좌와 처리 상태를 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RefundAccountForm
                reservationId={detail.id}
                defaultRefundAmount={detail.deposit_amount}
                refundAccount={refundAccount}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최근 문자 기록</CardTitle>
              <CardDescription>
                최근 발송된 문자 5건을 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {smsLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  발송된 문자 기록이 없습니다.
                </p>
              ) : (
                <div className="flex flex-col divide-y">
                  {smsLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {SMS_TEMPLATE_TYPE_LABELS[log.template_type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.created_at)} ·{" "}
                          {log.status === "success" ? "성공" : "실패"}
                        </span>
                      </div>
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {log.rendered_body}
                      </p>
                      {log.failure_reason ? (
                        <p className="text-xs text-destructive">
                          {log.failure_reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>문자 발송</CardTitle>
            <CardDescription>
              미리보기 확인 후 고객에게 문자를 발송합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SmsPreviewButton
              reservationId={detail.id}
              templateType="reservation_guide"
              label="예약 안내 문자"
            />
            <SmsPreviewButton
              reservationId={detail.id}
              templateType="return_request"
              label="반납 요청 문자"
            />
            {detail.review_event_participated ? (
              <SmsPreviewButton
                reservationId={detail.id}
                templateType="review_request"
                label="리뷰 요청 문자"
              />
            ) : null}
            <SmsPreviewButton
              reservationId={detail.id}
              templateType="deposit_refunded"
              label="보증금 환불 완료 문자"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <div>
      <Button variant="outline" render={<Link href="/reservations" />}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
        목록으로
      </Button>
    </div>
  );
}

function InfoItem({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {description ? (
        <dd className="text-xs text-muted-foreground">{description}</dd>
      ) : null}
    </div>
  );
}

function normalizeRefundAccount(
  value: ReservationDetail["refund_accounts"],
): RefundAccountFormValue | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
