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

export type ReservationTableRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  product_name_snapshot: string;
  pickup_number: number;
  payment_amount: number;
  deposit_amount: number;
  status: ReservationStatus;
  products?: {
    name: string | null;
    code: string | null;
  } | null;
};

type ReservationTableProps = {
  reservations: ReservationTableRow[];
};

export function ReservationTable({ reservations }: ReservationTableProps) {
  if (reservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>등록된 예약이 없습니다</CardTitle>
          <CardDescription>
            새 예약을 등록하면 이곳에서 날짜순으로 확인할 수 있습니다.
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
              <TableHead>상품</TableHead>
              <TableHead className="text-right">픽업번호</TableHead>
              <TableHead className="text-right">결제금액</TableHead>
              <TableHead className="text-right">보증금</TableHead>
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
                      {formatReservationTime(reservation.reservation_time)}
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
                <TableCell>{getProductName(reservation)}</TableCell>
                <TableCell className="text-right font-medium">
                  {reservation.pickup_number}
                </TableCell>
                <TableCell className="text-right">
                  {formatKrw(reservation.payment_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatKrw(reservation.deposit_amount)}
                </TableCell>
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
                {formatReservationTime(reservation.reservation_time)} ·{" "}
                {formatPhone(reservation.customer_phone)}
              </CardDescription>
              <CardAction>
                <StatusBadge status={reservation.status} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">상품</dt>
                  <dd className="font-medium">{getProductName(reservation)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">픽업번호</dt>
                  <dd className="font-medium">{reservation.pickup_number}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">결제금액</dt>
                  <dd className="font-medium">
                    {formatKrw(reservation.payment_amount)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">보증금</dt>
                  <dd className="font-medium">
                    {formatKrw(reservation.deposit_amount)}
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

function getProductName(reservation: ReservationTableRow) {
  return reservation.products?.name ?? reservation.product_name_snapshot;
}

function formatReservationTime(value: string) {
  return value.slice(0, 5);
}
