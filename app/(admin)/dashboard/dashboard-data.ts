import { type ReservationStatus } from "@/lib/reservations/status";

export type SeoulDayRange = {
  today: string;
  startIso: string;
  endIso: string;
};

export type RecentReservationRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  product_name_snapshot: string;
  pickup_number: number;
  status: ReservationStatus;
  created_at: string;
};

export type SmsLogStatus = "success" | "failed";

export type SmsSummaryLogRow = {
  id: string;
  status: SmsLogStatus;
  sent_at: string;
};

export type RecentSmsLogRow = SmsSummaryLogRow & {
  recipient_name: string;
  recipient_phone: string;
  provider: string;
  failure_reason: string | null;
};

export type DashboardData = {
  today: string;
  metrics: {
    todayReservations: number;
    returnWaiting: number;
    refundPending: number;
    completedReservations: number;
    smsSuccessToday: number;
    smsFailedToday: number;
  };
  recentReservations: RecentReservationRow[];
  recentSmsLogs: RecentSmsLogRow[];
  errors: string[];
};

type QueryResult<T> = {
  data?: T[] | null;
  count?: number | null;
  error?: { message?: string } | null;
};

export type SupabaseLike = {
  rpc?(fn: string): PromiseLike<unknown>;
  from(table: string): {
    select(
      columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): SupabaseQueryBuilder;
  };
};

type SupabaseQueryBuilder = PromiseLike<unknown> & {
  eq(column: string, value: string): SupabaseQueryBuilder;
  gte(column: string, value: string): SupabaseQueryBuilder;
  lte(column: string, value: string): SupabaseQueryBuilder;
  lt(column: string, value: string): SupabaseQueryBuilder;
  or(filters: string): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  limit(count: number): PromiseLike<unknown>;
};

export async function getDashboardData(
  supabase: SupabaseLike,
  now = new Date(),
): Promise<DashboardData> {
  const range = getSeoulDayRange(now);
  const errors: string[] = [];

  const [
    todayReservations,
    returnWaiting,
    refundPending,
    completedReservations,
    smsTodayLogs,
    recentReservations,
    recentSmsLogs,
  ] = await Promise.all([
    countTodayReservations(supabase, range.today),
    countReturnWaiting(supabase, range),
    countPendingRefunds(supabase),
    countCompletedReservations(supabase),
    listTodaySmsLogs(supabase, range),
    listRecentReservations(supabase),
    listRecentSmsLogs(supabase),
  ]);

  for (const result of [
    todayReservations,
    returnWaiting,
    refundPending,
    completedReservations,
    smsTodayLogs,
    recentReservations,
    recentSmsLogs,
  ]) {
    if (result.errorLabel) {
      errors.push(result.errorLabel);
    }
  }

  const smsSummary = summarizeSmsLogs(smsTodayLogs.value);

  return {
    today: range.today,
    metrics: {
      todayReservations: todayReservations.value,
      returnWaiting: returnWaiting.value,
      refundPending: refundPending.value,
      completedReservations: completedReservations.value,
      smsSuccessToday: smsSummary.success,
      smsFailedToday: smsSummary.failed,
    },
    recentReservations: recentReservations.value,
    recentSmsLogs: recentSmsLogs.value,
    errors,
  };
}

export function getSeoulDayRange(now = new Date()): SeoulDayRange {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${today}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    today,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function summarizeSmsLogs(logs: SmsSummaryLogRow[]) {
  return logs.reduce(
    (summary, log) => {
      summary[log.status] += 1;

      return summary;
    },
    { success: 0, failed: 0 } satisfies Record<SmsLogStatus, number>,
  );
}

async function countTodayReservations(
  supabase: SupabaseLike,
  today: string,
) {
  const result = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("reservation_date", today);

  return countResult(result, "오늘 예약 수");
}

async function countReturnWaiting(supabase: SupabaseLike, range: SeoulDayRange) {
  const result = await supabase
    .from("reservations")
    .select("id, expected_return_at", { count: "exact", head: true })
    .or(
      `and(status.eq.return_photo_pending,reservation_date.eq.${range.today}),and(status.eq.in_use,expected_return_at.gte.${range.startIso},expected_return_at.lt.${range.endIso})`,
    );

  return countResult(result, "오늘 반납 대기 수");
}

async function countPendingRefunds(supabase: SupabaseLike) {
  if (!supabase.rpc) {
    return { value: 0, errorLabel: "보증금 환불 대기 수" };
  }

  const result = await supabase.rpc("count_pending_refunds");
  const { data, error } = result as {
    data?: number | null;
    error?: { message?: string } | null;
  };

  return {
    value: error ? 0 : (data ?? 0),
    errorLabel: error ? "보증금 환불 대기 수" : null,
  };
}

async function countCompletedReservations(supabase: SupabaseLike) {
  const result = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  return countResult(result, "완료된 예약 수");
}

async function listTodaySmsLogs(supabase: SupabaseLike, range: SeoulDayRange) {
  const result = await supabase
    .from("sms_logs")
    .select("id, status, sent_at")
    .gte("sent_at", range.startIso)
    .lt("sent_at", range.endIso);

  return listResult<SmsSummaryLogRow>(result, "문자 발송 성공/실패 내역");
}

async function listRecentReservations(supabase: SupabaseLike) {
  const result = await supabase
    .from("reservations")
    .select(
      [
        "id",
        "customer_name",
        "customer_phone",
        "reservation_date",
        "reservation_time",
        "product_name_snapshot",
        "pickup_number",
        "status",
        "created_at",
      ].join(", "),
    )
    .order("created_at", { ascending: false })
    .limit(8);

  return listResult<RecentReservationRow>(result, "최근 예약");
}

async function listRecentSmsLogs(supabase: SupabaseLike) {
  const result = await supabase
    .from("sms_logs")
    .select(
      [
        "id",
        "recipient_name",
        "recipient_phone",
        "status",
        "provider",
        "failure_reason",
        "sent_at",
      ].join(", "),
    )
    .order("sent_at", { ascending: false })
    .limit(10);

  return listResult<RecentSmsLogRow>(result, "최근 문자 로그");
}

function countResult(result: unknown, label: string) {
  const { count, error } = result as QueryResult<never>;

  return {
    value: error ? 0 : (count ?? 0),
    errorLabel: error ? label : null,
  };
}

function listResult<T>(result: unknown, label: string) {
  const { data, error } = result as QueryResult<T>;

  return {
    value: error ? [] : ((data ?? []) as T[]),
    errorLabel: error ? label : null,
  };
}
