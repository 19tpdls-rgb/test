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

describe("GET /api/reservations", () => {
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

    const { GET } = await import("@/app/api/reservations/route");
    const response = await GET();

    await expectJsonResponse(response, 401, { error: "로그인이 필요합니다." });
  });

  it("returns reservations ordered by newest date and time", async () => {
    const reservations = [
      {
        id: reservationId,
        reservation_date: "2026-06-17",
        reservation_time: "14:30",
        products: { name: "PICUP PICNIC NIGHT", code: "NIGHT" },
        refund_accounts: { is_refunded: false },
      },
    ];
    const supabase = createReservationsSupabaseMock({
      listReservations: reservations,
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { GET } = await import("@/app/api/reservations/route");
    const response = await GET();

    await expectJsonResponse(response, 200, { reservations });
    const listQuery = supabase.tableQueries.reservations[0];
    expect(listQuery.select).toHaveBeenCalledWith(
      "*, products(name, code), refund_accounts(is_refunded)",
    );
    expect(listQuery.order).toHaveBeenNthCalledWith(1, "reservation_date", {
      ascending: false,
    });
    expect(listQuery.order).toHaveBeenNthCalledWith(2, "reservation_time", {
      ascending: false,
    });
  });
});

describe("POST /api/reservations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("creates a manual reservation with automatic pickup allocation and refund account", async () => {
    const supabase = createReservationsSupabaseMock({
      product,
      pickupNumbers: [
        { id: pickupOneId, number: 1, sort_order: 1 },
        { id: pickupTwoId, number: 2, sort_order: 2 },
      ],
      usedReservations: [{ pickup_number: 1 }],
      insertedReservation,
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { POST } = await import("@/app/api/reservations/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/reservations", {
        ...validReservationInput,
        pickupNumberId: null,
        pickupNumber: 1,
      }),
    );

    await expectJsonResponse(response, 200, { reservation: insertedReservation });
    const reservationsInsertQuery = supabase.tableQueries.reservations[1];
    expect(reservationsInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "manual",
        customer_name: "홍길동",
        customer_phone: "01012345678",
        product_id: product.id,
        product_name_snapshot: product.name,
        pickup_number_id: pickupTwoId,
        pickup_number: 2,
        created_by: adminUser.id,
      }),
    );
    const refundQuery = supabase.tableQueries.refund_accounts[0];
    expect(refundQuery.insert).toHaveBeenCalledWith({
      reservation_id: insertedReservation.id,
      refund_amount: validReservationInput.depositAmount,
    });
  });

  it("maps duplicate pickup number insert conflicts to a clear 409 response", async () => {
    const supabase = createReservationsSupabaseMock({
      product,
      pickupNumbers: [{ id: pickupTwoId, number: 2, sort_order: 2 }],
      usedReservations: [],
      insertReservationError: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "reservations_reservation_date_pickup_number_key"',
      },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { POST } = await import("@/app/api/reservations/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/reservations", {
        ...validReservationInput,
        pickupNumberId: pickupTwoId,
        pickupNumber: 2,
      }),
    );

    await expectJsonResponse(response, 409, {
      error: "이미 사용 중인 픽업번호입니다. 다른 번호를 선택해 주세요.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to create reservation",
      expect.objectContaining({
        error: expect.objectContaining({ code: "23505" }),
      }),
    );

    consoleError.mockRestore();
  });
});

describe("GET /api/reservations/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("returns 400 for an invalid reservation ID", async () => {
    const { GET } = await import("@/app/api/reservations/[id]/route");
    const response = await GET(new Request("https://picup.example"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    await expectJsonResponse(response, 400, { error: "예약 ID를 확인하세요." });
  });
});

describe("PATCH /api/reservations/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("returns 400 when the selected product is missing", async () => {
    const supabase = createReservationsSupabaseMock({
      product: null,
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("@/app/api/reservations/[id]/route");
    const response = await PATCH(
      createJsonRequest("https://picup.example/api/reservations/id", {
        ...validReservationInput,
        pickupNumberId: pickupTwoId,
        pickupNumber: 2,
      }),
      { params: Promise.resolve({ id: reservationId }) },
    );

    await expectJsonResponse(response, 400, {
      error: "상품을 찾을 수 없습니다.",
    });
  });
});

describe("DELETE /api/reservations/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("deletes a reservation", async () => {
    const supabase = createReservationsSupabaseMock({});
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { DELETE } = await import("@/app/api/reservations/[id]/route");
    const response = await DELETE(new Request("https://picup.example"), {
      params: Promise.resolve({ id: reservationId }),
    });

    await expectJsonResponse(response, 200, { ok: true });
    const deleteQuery = supabase.tableQueries.reservations[0];
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", reservationId);
  });
});

const adminUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@example.com",
};
const productId = "11111111-1111-4111-8111-111111111111";
const pickupOneId = "22222222-2222-4222-8222-222222222221";
const pickupTwoId = "22222222-2222-4222-8222-222222222222";
const reservationId = "33333333-3333-4333-8333-333333333333";
const product = {
  id: productId,
  name: "PICUP PICNIC NIGHT",
  code: "NIGHT",
  deposit_amount: 10000,
};
const validReservationInput = {
  customerName: "홍길동",
  customerPhone: "010-1234-5678",
  reservationDate: "2026-06-17",
  reservationTime: "14:30",
  expectedReturnAt: null,
  productId,
  paymentAmount: 30000,
  depositAmount: 10000,
  depositIncluded: true,
  pickupNumberId: pickupTwoId,
  pickupNumber: 2,
  status: "reserved",
  reviewEventParticipated: false,
  memo: "테스트 예약",
};
const insertedReservation = {
  id: reservationId,
  source: "manual",
  customer_name: "홍길동",
  customer_phone: "01012345678",
  reservation_date: "2026-06-17",
  reservation_time: "14:30",
  product_id: productId,
  product_name_snapshot: product.name,
  pickup_number_id: pickupTwoId,
  pickup_number: 2,
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

function createJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
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
  neq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

type ReservationsSupabaseMockOptions = {
  listReservations?: unknown[];
  product?: typeof product | null;
  pickupNumbers?: { id: string; number: number; sort_order: number }[];
  usedReservations?: { pickup_number: number }[];
  insertedReservation?: unknown;
  insertReservationError?: { code?: string; message: string };
};

function createReservationsSupabaseMock({
  listReservations = [],
  product: productResult = product,
  pickupNumbers = [],
  usedReservations = [],
  insertedReservation: reservationResult = insertedReservation,
  insertReservationError = undefined,
}: ReservationsSupabaseMockOptions) {
  const tableQueries: Record<string, QueryMock[]> = {
    reservations: [],
    products: [],
    pickup_numbers: [],
    refund_accounts: [],
  };

  return {
    tableQueries,
    from: vi.fn((table: string) => {
      const query = createQueryMock({
        table,
        listReservations,
        productResult,
        pickupNumbers,
        usedReservations,
        reservationResult,
        insertReservationError,
      });
      tableQueries[table] ??= [];
      tableQueries[table].push(query);

      return query;
    }),
  };
}

function createQueryMock({
  table,
  listReservations,
  productResult,
  pickupNumbers,
  usedReservations,
  reservationResult,
  insertReservationError,
}: {
  table: string;
  listReservations: unknown[];
  productResult: typeof product | null;
  pickupNumbers: { id: string; number: number; sort_order: number }[];
  usedReservations: { pickup_number: number }[];
  reservationResult: unknown;
  insertReservationError?: { code?: string; message: string };
}): QueryMock {
  const query = {
    result: { data: null, error: null },
    select: vi.fn((columns?: string) => {
      if (table === "reservations" && columns?.includes("products(name")) {
        query.result = { data: listReservations, error: null };
      } else if (
        table === "reservations" &&
        columns?.includes("pickup_number")
      ) {
        query.result = { data: usedReservations, error: null };
      } else if (table === "reservations" && columns === "id") {
        query.result = { data: [], error: null };
      } else if (table === "pickup_numbers") {
        query.result = { data: pickupNumbers, error: null };
      }

      return query;
    }),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => query.result),
    single: vi.fn(async () => {
      if (table === "products") {
        return {
          data: productResult,
          error: productResult ? null : { message: "not found" },
        };
      }

      return query.result;
    }),
    insert: vi.fn((value?: unknown) => {
      if (table === "reservations") {
        query.result = {
          data: reservationResult,
          error: insertReservationError ?? null,
        };
      } else if (table === "refund_accounts") {
        query.result = { data: value, error: null };
      }

      return query;
    }),
    update: vi.fn(() => {
      query.result = { data: reservationResult, error: null };

      return query;
    }),
    delete: vi.fn(() => {
      query.result = { data: null, error: null };

      return query;
    }),
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) {
      return Promise.resolve(query.result).then(onfulfilled, onrejected);
    },
  };

  if (table === "products") {
    query.result = {
      data: productResult,
      error: productResult ? null : { message: "not found" },
    };
  }

  return query;
}
