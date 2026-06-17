import Link from "next/link";
import { EyeIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { formatPhone } from "@/lib/format";
import {
  getDashboardData,
  type DashboardData,
  type RecentReservationRow,
  type RecentSmsLogRow,
  type SupabaseLike,
} from "./dashboard-data";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  now?: Date;
};

export default async function DashboardPage({ now }: DashboardPageProps = {}) {
  const supabase = await createClient();
  const dashboard = await getDashboardData(
    supabase as unknown as SupabaseLike,
    now,
  );

  return <DashboardView dashboard={dashboard} />;
}

function DashboardView({ dashboard }: { dashboard: DashboardData }) {
  const metricCards = [
    {
      label: "오늘 예약 수",
      value: dashboard.metrics.todayReservations,
      description: `${dashboard.today} 예약`,
    },
    {
      label: "오늘 반납 대기 수",
      value: dashboard.metrics.returnWaiting,
      description: "반납 사진 대기 및 반납 예정 초과",
    },
    {
      label: "보증금 환불 대기 수",
      value: dashboard.metrics.refundPending,
      description: "환불 처리 확인 필요",
    },
    {
      label: "완료된 예약 수",
      value: dashboard.metrics.completedReservations,
      description: "전체 완료 상태 예약",
    },
    {
      label: "문자 성공",
      value: dashboard.metrics.smsSuccessToday,
      description: "오늘 발송 성공",
    },
    {
      label: "문자 실패",
      value: dashboard.metrics.smsFailedToday,
      description: "오늘 발송 실패",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          오늘 운영 상황과 최근 예약, 문자 발송 내역을 확인합니다.
        </p>
      </div>

      {dashboard.errors.length > 0 ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          일부 대시보드 데이터를 불러오지 못했습니다:{" "}
          {dashboard.errors.join(", ")}. 표시된 정보는 조회 가능한 데이터 기준입니다.
        </p>
      ) : null}

      <section
        aria-label="운영 요약"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {metricCards.map((metric) => (
          <Card key={metric.label} className="rounded-lg" size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-3">
              <p className="font-heading text-3xl font-semibold tabular-nums">
                {metric.value}
              </p>
              <p className="text-right text-xs leading-5 text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <RecentReservations reservations={dashboard.recentReservations} />
        <RecentSmsLogs logs={dashboard.recentSmsLogs} />
      </section>
    </div>
  );
}

function RecentReservations({
  reservations,
}: {
  reservations: RecentReservationRow[];
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>최근 예약</CardTitle>
        <CardDescription>최근 등록된 예약 8건</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/reservations" />}>
            전체 보기
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
            최근 예약이 없습니다.
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>예약</TableHead>
                    <TableHead>고객</TableHead>
                    <TableHead>상품</TableHead>
                    <TableHead className="text-right">픽업번호</TableHead>
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
                      <TableCell>{reservation.product_name_snapshot}</TableCell>
                      <TableCell className="text-right font-medium">
                        {reservation.pickup_number}
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
                <Card key={reservation.id} className="rounded-lg" size="sm">
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
                  <CardContent className="flex flex-col gap-3">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">상품</dt>
                        <dd className="font-medium">
                          {reservation.product_name_snapshot}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">픽업번호</dt>
                        <dd className="font-medium">
                          {reservation.pickup_number}
                        </dd>
                      </div>
                    </dl>
                    <Button
                      variant="outline"
                      className="w-full"
                      render={<Link href={`/reservations/${reservation.id}`} />}
                    >
                      <EyeIcon data-icon="inline-start" aria-hidden="true" />
                      상세 보기
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSmsLogs({ logs }: { logs: RecentSmsLogRow[] }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>최근 문자 로그</CardTitle>
        <CardDescription>최근 발송된 문자 10건</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/sms-logs" />}>
            전체 보기
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
            최근 문자 발송 기록이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{log.recipient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPhone(log.recipient_phone)} · {log.provider}
                    </p>
                  </div>
                  <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                    {log.status === "success" ? "성공" : "실패"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(log.sent_at)}
                </p>
                {log.failure_reason ? (
                  <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    {log.failure_reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}
