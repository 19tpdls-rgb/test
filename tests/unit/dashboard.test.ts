// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("dashboard helpers", () => {
  it("uses the Asia/Seoul calendar day for today boundaries", async () => {
    const { getSeoulDayRange } = await import(
      "@/app/(admin)/dashboard/dashboard-data"
    );

    const range = getSeoulDayRange(new Date("2026-06-16T15:30:00.000Z"));

    expect(range.today).toBe("2026-06-17");
    expect(range.startIso).toBe("2026-06-16T15:00:00.000Z");
    expect(range.endIso).toBe("2026-06-17T15:00:00.000Z");
  });

  it("summarizes SMS logs by today success and failure", async () => {
    const { summarizeSmsLogs } = await import(
      "@/app/(admin)/dashboard/dashboard-data"
    );

    expect(
      summarizeSmsLogs(
        [
          { id: "1", status: "success", sent_at: "2026-06-16T16:00:00.000Z" },
          { id: "2", status: "failed", sent_at: "2026-06-17T03:00:00.000Z" },
          { id: "3", status: "success", sent_at: "2026-06-15T12:00:00.000Z" },
        ],
      ),
    ).toEqual({ success: 2, failed: 1 });
  });
});

describe("dashboard page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("queries dashboard data and renders Korean operations summary", async () => {
    const supabase = createDashboardSupabaseMock();
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { default: DashboardPage } = await import(
      "@/app/(admin)/dashboard/page"
    );
    const html = renderToStaticMarkup(
      await DashboardPage({ now: new Date("2026-06-17T01:00:00.000Z") }),
    );

    expect(html).toContain("오늘 예약 수");
    expect(html).toContain("오늘 반납 대기 수");
    expect(html).toContain("보증금 환불 대기 수");
    expect(html).toContain("완료된 예약 수");
    expect(html).toContain("문자 성공");
    expect(html).toContain("문자 실패");
    expect(html).toContain("최근 예약");
    expect(html).toContain("최근 문자 로그");
    expect(html).toContain("홍길동");
    expect(html).toContain("문자 발송 실패");

    expect(supabase.calls).toContainEqual({
      table: "reservations",
      method: "eq",
      args: ["reservation_date", "2026-06-17"],
    });
    expect(supabase.calls).toContainEqual({
      table: "sms_logs",
      method: "gte",
      args: ["sent_at", "2026-06-16T15:00:00.000Z"],
    });
    expect(supabase.calls).toContainEqual({
      table: "sms_logs",
      method: "lt",
      args: ["sent_at", "2026-06-17T15:00:00.000Z"],
    });
    expect(supabase.calls).toContainEqual({
      table: "reservations",
      method: "or",
      args: [
        "and(status.eq.return_photo_pending,reservation_date.eq.2026-06-17),and(status.eq.in_use,expected_return_at.gte.2026-06-16T15:00:00.000Z,expected_return_at.lt.2026-06-17T15:00:00.000Z)",
      ],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("count_pending_refunds");
  });
});

function createDashboardSupabaseMock() {
  const responses: Record<string, unknown> = {
    "reservations:count-today": { count: 3, error: null },
    "reservations:count-return": { count: 2, error: null },
    "refunds:pending": { data: 1, error: null },
    "reservations:completed": { count: 8, error: null },
    "sms_logs:today": {
      data: [
        { id: "sms-1", status: "success", sent_at: "2026-06-16T16:00:00.000Z" },
        { id: "sms-2", status: "failed", sent_at: "2026-06-16T17:00:00.000Z" },
      ],
      error: null,
    },
    "reservations:recent": {
      data: [
        {
          id: "reservation-1",
          customer_name: "홍길동",
          customer_phone: "01012345678",
          reservation_date: "2026-06-17",
          reservation_time: "14:00:00",
          product_name_snapshot: "피크닉 세트",
          pickup_number: 7,
          status: "reserved",
          created_at: "2026-06-17T00:00:00.000Z",
        },
      ],
      error: null,
    },
    "sms_logs:recent": {
      data: [
        {
          id: "sms-2",
          recipient_name: "김실패",
          recipient_phone: "01098765432",
          status: "failed",
          provider: "mock",
          failure_reason: "문자 발송 실패",
          sent_at: "2026-06-16T17:00:00.000Z",
        },
      ],
      error: null,
    },
  };

  const supabase = {
    calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
    rpc: vi.fn(() => Promise.resolve(responses["refunds:pending"])),
    from(table: string) {
      const state = { table, select: "" };
      const builder = {
        select(columns: string) {
          state.select = columns;
          return builder;
        },
        eq(...args: unknown[]) {
          supabase.calls.push({ table, method: "eq", args });
          return builder;
        },
        lte(...args: unknown[]) {
          supabase.calls.push({ table, method: "lte", args });
          return builder;
        },
        gte(...args: unknown[]) {
          supabase.calls.push({ table, method: "gte", args });
          return builder;
        },
        lt(...args: unknown[]) {
          supabase.calls.push({ table, method: "lt", args });
          return builder;
        },
        or(...args: unknown[]) {
          supabase.calls.push({ table, method: "or", args });
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          if (state.table === "reservations" && state.select.includes("created_at")) {
            return Promise.resolve(responses["reservations:recent"]);
          }
          if (state.table === "sms_logs" && state.select.includes("recipient_name")) {
            return Promise.resolve(responses["sms_logs:recent"]);
          }
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          resolve(resolveResponse(state, responses));
        },
      };
      return builder;
    },
  };

  return supabase;
}

function resolveResponse(
  state: { table: string; select: string },
  responses: Record<string, unknown>,
) {
  if (state.table === "reservations" && state.select === "id") {
    return responses["reservations:count-today"];
  }
  if (state.table === "reservations" && state.select === "id, expected_return_at") {
    return responses["reservations:count-return"];
  }
  if (state.table === "reservations") {
    return responses["reservations:completed"];
  }
  return responses["sms_logs:today"];
}
