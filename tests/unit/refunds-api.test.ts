import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireApiAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/api-admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/api-admin")>(
    "@/lib/auth/api-admin",
  );

  return {
    ...actual,
    requireApiAdmin: mocks.requireApiAdmin,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("PATCH /api/refunds/[reservationId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("returns 401 when the requester is unauthenticated", async () => {
    mocks.requireApiAdmin.mockResolvedValueOnce({
      ok: false,
      status: 401,
      code: "unauthenticated",
    });

    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(createJsonRequest({}), {
      params: Promise.resolve({ reservationId }),
    });

    await expectJsonResponse(response, 401, { error: "로그인이 필요합니다." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid reservation ID", async () => {
    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(createJsonRequest(validRefundInput), {
      params: Promise.resolve({ reservationId: "not-a-uuid" }),
    });

    await expectJsonResponse(response, 400, {
      error: "예약 ID를 확인하세요.",
    });
  });

  it("returns 400 for an invalid refunded date", async () => {
    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(
      createJsonRequest({
        ...validRefundInput,
        isRefunded: true,
        refundedAt: "not-a-date",
      }),
      { params: Promise.resolve({ reservationId }) },
    );

    await expectJsonResponse(response, 400, {
      error: "환불 일시를 확인해 주세요.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("normalizes blank account fields and upserts refund data", async () => {
    const refundAccount = {
      id: "refund-1",
      reservation_id: reservationId,
      bank_name: null,
      account_number: "110123456789",
      account_holder: null,
      refund_amount: 10000,
      is_refunded: false,
      refunded_at: null,
      refund_memo: null,
    };
    const supabase = createRefundsSupabaseMock({
      upsertRefundAccount: refundAccount,
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(
      createJsonRequest({
        bankName: "   ",
        accountNumber: " 110123456789 ",
        accountHolder: "",
        refundAmount: 10000,
        isRefunded: false,
        refundedAt: "2026-06-17T10:00:00.000Z",
        refundMemo: " ",
      }),
      { params: Promise.resolve({ reservationId }) },
    );

    await expectJsonResponse(response, 200, { refundAccount });
    const upsertQuery = supabase.tableQueries.refund_accounts[0];
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      {
        reservation_id: reservationId,
        bank_name: null,
        account_number: "110123456789",
        account_holder: null,
        refund_amount: 10000,
        is_refunded: false,
        refunded_at: null,
        refund_memo: null,
      },
      { onConflict: "reservation_id" },
    );
    expect(supabase.tableQueries.reservations).toHaveLength(0);
  });

  it("sets refunded_at and advances reservation status when refund is complete", async () => {
    const now = new Date("2026-06-17T03:00:00.000Z");
    vi.setSystemTime(now);
    const refundAccount = {
      id: "refund-1",
      reservation_id: reservationId,
      is_refunded: true,
      refunded_at: now.toISOString(),
    };
    const supabase = createRefundsSupabaseMock({
      upsertRefundAccount: refundAccount,
      updateReservation: { id: reservationId, status: "deposit_refunded" },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(
      createJsonRequest({
        ...validRefundInput,
        isRefunded: true,
        refundedAt: null,
      }),
      { params: Promise.resolve({ reservationId }) },
    );

    await expectJsonResponse(response, 200, { refundAccount });
    expect(supabase.tableQueries.refund_accounts[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_refunded: true,
        refunded_at: now.toISOString(),
      }),
      { onConflict: "reservation_id" },
    );
    expect(supabase.tableQueries.reservations[0].update).toHaveBeenCalledWith({
      status: "deposit_refunded",
    });
    expect(supabase.tableQueries.reservations[0].eq).toHaveBeenCalledWith(
      "id",
      reservationId,
    );
    vi.useRealTimers();
  });

  it("returns a safe Korean error when upsert fails", async () => {
    const upsertError = { message: "duplicate key detail" };
    const supabase = createRefundsSupabaseMock({ upsertError });
    mocks.createClient.mockResolvedValueOnce(supabase);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(createJsonRequest(validRefundInput), {
      params: Promise.resolve({ reservationId }),
    });

    await expectJsonResponse(response, 500, {
      error: "환불 계좌 정보를 저장하지 못했습니다.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to upsert refund account",
      expect.objectContaining({ error: upsertError }),
    );
    consoleError.mockRestore();
  });
});

const adminUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@example.com",
};
const reservationId = "33333333-3333-4333-8333-333333333333";
const validRefundInput = {
  bankName: "국민은행",
  accountNumber: "110123456789",
  accountHolder: "홍길동",
  refundAmount: 10000,
  isRefunded: false,
  refundedAt: null,
  refundMemo: "확인 완료",
};

function mockActiveAdmin() {
  mocks.requireApiAdmin.mockResolvedValue({
    ok: true,
    user: adminUser,
    admin: {
      user_id: adminUser.id,
      name: "PICUP Admin",
      role: "admin",
      is_active: true,
    },
  });
}

function createJsonRequest(body: unknown) {
  return new Request("https://picup.example/api/refunds/reservation", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function expectJsonResponse(
  response: Response,
  status: number,
  body: unknown,
) {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual(body);
}

type QueryMock = {
  result: unknown;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

type SupabaseError = {
  message?: string;
};

function createRefundsSupabaseMock({
  upsertRefundAccount = null,
  upsertError = null,
  updateReservation = null,
  updateError = null,
}: {
  upsertRefundAccount?: unknown;
  upsertError?: SupabaseError | null;
  updateReservation?: unknown;
  updateError?: SupabaseError | null;
}) {
  const tableQueries: Record<string, QueryMock[]> = {
    refund_accounts: [],
    reservations: [],
  };

  return {
    tableQueries,
    from: vi.fn((table: string) => {
      const query: QueryMock = {
        result: { data: null, error: null },
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => query.result),
        upsert: vi.fn(() => {
          query.result = { data: upsertRefundAccount, error: upsertError };

          return query;
        }),
        update: vi.fn(() => {
          query.result = { data: updateReservation, error: updateError };

          return query;
        }),
      };

      tableQueries[table] ??= [];
      tableQueries[table].push(query);

      return query;
    }),
  };
}
