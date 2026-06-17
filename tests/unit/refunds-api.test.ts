import { readFile } from "node:fs/promises";
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
    vi.useRealTimers();
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

  it("normalizes blank account fields and delegates the atomic upsert", async () => {
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
    const supabase = createRefundsSupabaseMock({ refundAccount });
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
    expect(supabase.rpc).toHaveBeenCalledWith("upsert_refund_account", {
      p_reservation_id: reservationId,
      p_bank_name: null,
      p_account_number: "110123456789",
      p_account_holder: null,
      p_refund_amount: 10000,
      p_is_refunded: false,
      p_refunded_at: null,
      p_refund_memo: null,
    });
  });

  it("sets refunded_at through the transactional RPC when refund is complete", async () => {
    const now = new Date("2026-06-17T03:00:00.000Z");
    vi.setSystemTime(now);
    const refundAccount = {
      id: "refund-1",
      reservation_id: reservationId,
      is_refunded: true,
      refunded_at: now.toISOString(),
    };
    const supabase = createRefundsSupabaseMock({ refundAccount });
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
    expect(supabase.rpc).toHaveBeenCalledWith(
      "upsert_refund_account",
      expect.objectContaining({
        p_is_refunded: true,
        p_refunded_at: now.toISOString(),
      }),
    );
  });

  it("delegates refund reversal to the transactional RPC", async () => {
    const refundAccount = {
      id: "refund-1",
      reservation_id: reservationId,
      is_refunded: false,
      refunded_at: null,
    };
    const supabase = createRefundsSupabaseMock({ refundAccount });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("@/app/api/refunds/[reservationId]/route");
    const response = await PATCH(
      createJsonRequest({
        ...validRefundInput,
        isRefunded: false,
        refundedAt: "2026-06-17T10:00:00.000Z",
      }),
      { params: Promise.resolve({ reservationId }) },
    );

    await expectJsonResponse(response, 200, { refundAccount });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "upsert_refund_account",
      expect.objectContaining({
        p_is_refunded: false,
        p_refunded_at: null,
      }),
    );
  });

  it("returns a safe Korean error when the transactional RPC fails", async () => {
    const rpcError = { message: "foreign key detail" };
    const supabase = createRefundsSupabaseMock({ rpcError });
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
      expect.objectContaining({ error: rpcError }),
    );
    consoleError.mockRestore();
  });
});

describe("upsert_refund_account migration", () => {
  it("keeps refund and reservation status changes in one function", async () => {
    const migration = await readFile(
      `${process.cwd()}/supabase/migrations/0005_upsert_refund_account.sql`,
      "utf8",
    );

    expect(migration).toContain(
      "create or replace function public.upsert_refund_account",
    );
    expect(migration).toContain("on conflict (reservation_id) do update");
    expect(migration).toContain("set status = 'deposit_refunded'");
    expect(migration).toContain("set status = 'returned'");
    expect(migration).toContain("security invoker");
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

type SupabaseError = {
  message?: string;
};

function createRefundsSupabaseMock({
  refundAccount = null,
  rpcError = null,
}: {
  refundAccount?: unknown;
  rpcError?: SupabaseError | null;
}) {
  return {
    rpc: vi.fn(async () => ({ data: refundAccount, error: rpcError })),
  };
}
