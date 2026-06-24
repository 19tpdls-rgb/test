import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNextPickupNumberFromLists } from "@/lib/reservations/pickup-number";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("getNextPickupNumberFromLists", () => {
  it("returns the lowest available pickup number from candidates sorted by sort_order then number", () => {
    const candidates = [
      { id: "pickup-9", number: 9, sort_order: 2 },
      { id: "pickup-3", number: 3, sort_order: 1 },
      { id: "pickup-2", number: 2, sort_order: 1 },
      { id: "pickup-1", number: 1, sort_order: 0 },
    ];

    const result = getNextPickupNumberFromLists(candidates, [1, 2]);

    expect(result).toEqual({
      pickupNumberId: "pickup-3",
      pickupNumber: 3,
    });
  });

  it("returns null when every eligible number is used", () => {
    const candidates = [
      { id: "pickup-1", number: 1, sort_order: 0 },
      { id: "pickup-2", number: 2, sort_order: 1 },
    ];

    expect(getNextPickupNumberFromLists(candidates, [1, 2])).toBeNull();
  });

  it("does not mutate input arrays", () => {
    const candidates = [
      { id: "pickup-3", number: 3, sort_order: 2 },
      { id: "pickup-1", number: 1, sort_order: 0 },
      { id: "pickup-2", number: 2, sort_order: 1 },
    ];
    const usedNumbers = [1];
    const originalCandidates = structuredClone(candidates);
    const originalUsedNumbers = [...usedNumbers];

    getNextPickupNumberFromLists(candidates, usedNumbers);

    expect(candidates).toEqual(originalCandidates);
    expect(usedNumbers).toEqual(originalUsedNumbers);
  });

  it("handles PICUP PICNIC NIGHT and B pickup number ranges", () => {
    const nightCandidates = [
      { id: "night-1", number: 1, sort_order: 1 },
      { id: "night-2", number: 2, sort_order: 2 },
      { id: "night-3", number: 3, sort_order: 3 },
    ];
    const bCandidates = [
      { id: "b-17", number: 17, sort_order: 17 },
      { id: "b-18", number: 18, sort_order: 18 },
      { id: "b-19", number: 19, sort_order: 19 },
    ];

    expect(getNextPickupNumberFromLists(nightCandidates, [1])).toEqual({
      pickupNumberId: "night-2",
      pickupNumber: 2,
    });
    expect(getNextPickupNumberFromLists(bCandidates, [])).toEqual({
      pickupNumberId: "b-17",
      pickupNumber: 17,
    });
  });
});

describe("POST /api/pickup-number", () => {
  const validRequestBody = {
    reservationDate: "2026-06-17",
    productId: "11111111-1111-4111-8111-111111111111",
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when the requester is unauthenticated", async () => {
    mocks.createClient.mockResolvedValue(
      createPickupNumberSupabaseMock({
        user: null,
        admin: null,
        pickupNumbers: [{ id: "pickup-1", number: 1, sort_order: 1 }],
        reservations: [],
      }),
    );

    const { POST } = await import("@/app/api/pickup-number/route");
    const response = await POST(createJsonRequest(validRequestBody));

    await expectJsonResponse(response, 401, {
      error: "로그인이 필요합니다.",
    });
  });

  it("returns 403 when the requester is not an active admin", async () => {
    mocks.createClient.mockResolvedValue(
      createPickupNumberSupabaseMock({
        user: { id: "user-1", email: "user@example.com" },
        admin: null,
        pickupNumbers: [{ id: "pickup-1", number: 1, sort_order: 1 }],
        reservations: [],
      }),
    );

    const { POST } = await import("@/app/api/pickup-number/route");
    const response = await POST(createJsonRequest(validRequestBody));

    await expectJsonResponse(response, 403, {
      error: "관리자 권한이 필요합니다.",
    });
  });

  it("returns 500 when admin lookup fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const adminLookupError = new Error("admins unavailable");
    mocks.createClient.mockResolvedValue(
      createPickupNumberSupabaseMock({
        user: { id: "user-1", email: "admin@example.com" },
        admin: null,
        adminError: adminLookupError,
        pickupNumbers: [{ id: "pickup-1", number: 1, sort_order: 1 }],
        reservations: [],
      }),
    );

    const { POST } = await import("@/app/api/pickup-number/route");
    const response = await POST(createJsonRequest(validRequestBody));

    await expectJsonResponse(response, 500, {
      error: "관리자 권한 확인 중 오류가 발생했습니다.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to verify pickup number API admin access",
      expect.objectContaining({ error: adminLookupError }),
    );

    consoleError.mockRestore();
  });

  it("allows an active admin to receive the next pickup number recommendation", async () => {
    mocks.createClient.mockResolvedValue(
      createPickupNumberSupabaseMock({
        user: { id: "user-1", email: "admin@example.com" },
        admin: {
          user_id: "user-1",
          name: "PICUP Admin",
          role: "admin",
          is_active: true,
        },
        pickupNumbers: [
          { id: "pickup-2", number: 2, sort_order: 2 },
          { id: "pickup-1", number: 1, sort_order: 1 },
        ],
        reservations: [{ pickup_number: 1 }],
      }),
    );

    const { POST } = await import("@/app/api/pickup-number/route");
    const response = await POST(createJsonRequest(validRequestBody));

    await expectJsonResponse(response, 200, {
      pickupNumberId: "pickup-2",
      pickupNumber: 2,
    });
  });
});

function createJsonRequest(body: unknown) {
  return new Request("https://picup.example/api/pickup-number", {
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

type PickupNumberSupabaseMockOptions = {
  user: { id: string; email?: string } | null;
  admin: {
    user_id: string;
    name: string;
    role: string;
    is_active: boolean;
  } | null;
  adminError?: Error;
  pickupNumbers: { id: string; number: number; sort_order: number }[];
  reservations: { pickup_number: number }[];
};

function createPickupNumberSupabaseMock({
  user,
  admin,
  adminError = undefined,
  pickupNumbers,
  reservations,
}: PickupNumberSupabaseMockOptions) {
  const adminQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: admin, error: adminError })),
  };
  const pickupNumbersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
  };
  pickupNumbersQuery.order
    .mockReturnValueOnce(pickupNumbersQuery)
    .mockResolvedValueOnce({ data: pickupNumbers, error: null });

  const reservationsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(async () => ({ data: reservations, error: null })),
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === "admins") {
        return adminQuery;
      }

      if (table === "pickup_numbers") {
        return pickupNumbersQuery;
      }

      if (table === "reservations") {
        return reservationsQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}
