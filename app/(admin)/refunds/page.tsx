import Link from "next/link";
import { EyeIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKrw, formatPhone } from "@/lib/format";
import { type ReservationStatus } from "@/lib/reservations/status";
import { createClient } from "@/lib/supabase/server";

type RefundRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  pickup_number: number;
  deposit_amount: number;
  deposit_included: boolean;
  status: ReservationStatus;
  refund_accounts?: RefundAccount | RefundAccount[] | null;
};

type RefundAccount = {
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  refund_amount: number | null;
  is_refunded: boolean;
  refunded_at: string | null;
};

export default function RefundsPage() {
  return <RefundsList />;
}

async function RefundsList() {
  const supabase = await createClient();
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("*, refund_accounts(*)")
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });
  const pendingRefunds = ((reservations ?? []) as RefundRow[]).filter(
    isRefundPending,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">환불 관리</h1>
        <p className="text-sm text-muted-foreground">
          보증금 환불이 남아 있는 예약을 확인합니다.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          환불 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <RefundsTable reservations={pendingRefunds} />
      )}
    </div>
  );
}

function RefundsTable({ reservations }: { reservations: RefundRow[] }) {
  if (reservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>대기 중인 환불이 없습니다</CardTitle>
          <CardDescription>
            보증금 환불 대상 예약이 생기면 이곳에 표시됩니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>고객</TableHead>
              <TableHead className="text-right">픽업번호</TableHead>
              <TableHead className="text-right">보증금</TableHead>
              <TableHead>환불 계좌</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {reservation.reservation_date}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(reservation.reservation_time)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {reservation.customer_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPhone(reservation.customer_phone)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {reservation.pickup_number}
                </TableCell>
                <TableCell className="text-right">
                  {formatKrw(reservation.deposit_amount)}
                </TableCell>
                <TableCell>{formatAccountSummary(reservation)}</TableCell>
                <TableCell>
                  <StatusBadge status={reservation.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/reservations/${reservation.id}`} />}
                  >
                    <EyeIcon data-icon="inline-start" aria-hidden="true" />
                    상세
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {reservations.map((reservation) => (
          <Card key={reservation.id} size="sm">
            <CardHeader>
              <CardTitle>{reservation.customer_name}</CardTitle>
              <CardDescription>
                {reservation.reservation_date}{" "}
                {formatTime(reservation.reservation_time)} ·{" "}
                {formatPhone(reservation.customer_phone)}
              </CardDescription>
              <CardAction>
                <StatusBadge status={reservation.status} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">픽업번호</dt>
                  <dd className="font-medium">{reservation.pickup_number}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">보증금</dt>
                  <dd className="font-medium">
                    {formatKrw(reservation.deposit_amount)}
                  </dd>
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <dt className="text-muted-foreground">환불 계좌</dt>
                  <dd className="font-medium">
                    {formatAccountSummary(reservation)}
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline"
                className="mt-4 w-full"
                render={<Link href={`/reservations/${reservation.id}`} />}
              >
                <EyeIcon data-icon="inline-start" aria-hidden="true" />
                상세 보기
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function isRefundPending(reservation: RefundRow) {
  const refundAccount = normalizeRefundAccount(reservation.refund_accounts);
  const statusNeedsRefund =
    reservation.status !== "deposit_refunded" &&
    reservation.status !== "completed";

  return (
    (reservation.deposit_included && statusNeedsRefund) ||
    refundAccount?.is_refunded === false
  );
}

function normalizeRefundAccount(value: RefundRow["refund_accounts"]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatAccountSummary(reservation: RefundRow) {
  const refundAccount = normalizeRefundAccount(reservation.refund_accounts);

  if (!refundAccount) {
    return "계좌 미등록";
  }

  const parts = [
    refundAccount.bank_name,
    refundAccount.account_number,
    refundAccount.account_holder,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "계좌 미등록";
}

function formatTime(value: string) {
  return value.slice(0, 5);
}
