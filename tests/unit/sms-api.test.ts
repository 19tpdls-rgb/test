import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSmsProvider: vi.fn(),
  getSmsProviderName: vi.fn(),
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

vi.mock("@/lib/sms/server-provider", () => ({
  createSmsProvider: mocks.createSmsProvider,
  getSmsProviderName: mocks.getSmsProviderName,
}));

describe("POST /api/sms/preview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("renders an active template with reservation variables", async () => {
    const supabase = createSmsSupabaseMock({
      reservation,
      template: {
        ...template,
        body:
          "{{customerName}}님 {{reservationDate}} {{reservationTime}} " +
          "{{productName}} {{pickupNumber}}번 보증금 {{depositAmount}} 결제 {{paymentAmount}}",
      },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { POST } = await import("@/app/api/sms/preview/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/sms/preview", {
        reservationId,
        templateType: "reservation_guide",
      }),
    );

    await expectJsonResponse(response, 200, {
      renderedBody:
        "홍길동님 2026-06-17 14:30 PICUP PICNIC NIGHT 7번 보증금 ₩10,000 결제 ₩30,000",
      template: expect.objectContaining({ id: templateId }),
    });
    expect(supabase.tableQueries.reservations[0].eq).toHaveBeenCalledWith(
      "id",
      reservationId,
    );
    expect(supabase.tableQueries.sms_templates[0].eq).toHaveBeenCalledWith(
      "is_active",
      true,
    );
  });
});

describe("POST /api/sms/send", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
    mocks.getSmsProviderName.mockReturnValue("mock");
  });

  it("blocks unresolved template variables before sending", async () => {
    const provider = { send: vi.fn() };
    const supabase = createSmsSupabaseMock({
      reservation,
      template: {
        ...template,
        body: "안녕하세요 {{customerName}}님 {{unknownVariable}}",
      },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);
    mocks.createSmsProvider.mockReturnValue(provider);

    const { POST } = await import("@/app/api/sms/send/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/sms/send", {
        reservationId,
        templateType: "reservation_guide",
      }),
    );

    await expectJsonResponse(response, 400, {
      error:
        "문자 내용에 알 수 없는 변수가 남아 있습니다: {{unknownVariable}}",
    });
    expect(provider.send).not.toHaveBeenCalled();
    expect(supabase.tableQueries.sms_logs).toHaveLength(0);
  });

  it("writes a success log and advances reservation guide status", async () => {
    const provider = {
      send: vi.fn(async () => ({
        ok: true,
        providerMessageId: "mock-message-1",
      })),
    };
    const supabase = createSmsSupabaseMock({
      reservation,
      template: {
        ...template,
        body: "안녕하세요 {{customerName}}님, 픽업번호는 {{pickupNumber}}번입니다.",
      },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);
    mocks.createSmsProvider.mockReturnValue(provider);

    const { POST } = await import("@/app/api/sms/send/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/sms/send", {
        reservationId,
        templateType: "reservation_guide",
      }),
    );

    await expectJsonResponse(response, 200, {
      result: { ok: true, providerMessageId: "mock-message-1" },
      renderedBody: "안녕하세요 홍길동님, 픽업번호는 7번입니다.",
    });
    expect(provider.send).toHaveBeenCalledWith({
      to: "01012345678",
      text: "안녕하세요 홍길동님, 픽업번호는 7번입니다.",
    });
    expect(supabase.tableQueries.sms_logs[0].insert).toHaveBeenCalledWith({
      reservation_id: reservationId,
      template_id: templateId,
      template_type: "reservation_guide",
      provider: "mock",
      recipient_name: "홍길동",
      recipient_phone: "01012345678",
      rendered_body: "안녕하세요 홍길동님, 픽업번호는 7번입니다.",
      status: "success",
      provider_message_id: "mock-message-1",
      failure_reason: null,
      sent_by: adminUser.id,
    });
    expect(supabase.tableQueries.reservations[1].update).toHaveBeenCalledWith({
      status: "guide_sms_sent",
    });
    expect(supabase.tableQueries.reservations[1].eq).toHaveBeenCalledWith(
      "id",
      reservationId,
    );
  });

  it("writes a failed log and returns provider failure result", async () => {
    const provider = {
      send: vi.fn(async () => ({
        ok: false,
        failureReason: "수신번호 오류",
      })),
    };
    const supabase = createSmsSupabaseMock({
      reservation,
      template: {
        ...template,
        body: "안녕하세요 {{customerName}}님",
      },
    });
    mocks.createClient.mockResolvedValueOnce(supabase);
    mocks.createSmsProvider.mockReturnValue(provider);

    const { POST } = await import("@/app/api/sms/send/route");
    const response = await POST(
      createJsonRequest("https://picup.example/api/sms/send", {
        reservationId,
        templateType: "reservation_guide",
      }),
    );

    await expectJsonResponse(response, 200, {
      result: { ok: false, failureReason: "수신번호 오류" },
      renderedBody: "안녕하세요 홍길동님",
    });
    expect(supabase.tableQueries.sms_logs[0].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        provider_message_id: null,
        failure_reason: "수신번호 오류",
      }),
    );
    expect(supabase.tableQueries.reservations).toHaveLength(1);
  });
});

describe("PATCH /api/sms-templates/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("updates the template body and records the admin user", async () => {
    const updatedTemplate = {
      ...template,
      body: "수정된 문자 내용",
      updated_by: adminUser.id,
    };
    const supabase = createSmsSupabaseMock({
      templateUpdate: updatedTemplate,
    });
    mocks.createClient.mockResolvedValueOnce(supabase);

    const { PATCH } = await import("@/app/api/sms-templates/[id]/route");
    const response = await PATCH(
      createJsonRequest("https://picup.example/api/sms-templates/id", {
        body: "수정된 문자 내용",
      }),
      { params: Promise.resolve({ id: templateId }) },
    );

    await expectJsonResponse(response, 200, { template: updatedTemplate });
    expect(supabase.tableQueries.sms_templates[0].update).toHaveBeenCalledWith({
      body: "수정된 문자 내용",
      updated_by: adminUser.id,
    });
    expect(supabase.tableQueries.sms_templates[0].eq).toHaveBeenCalledWith(
      "id",
      templateId,
    );
  });

  it("returns a Korean auth error when the admin is not active", async () => {
    mocks.requireApiAdmin.mockResolvedValueOnce({
      ok: false,
      status: 403,
      code: "forbidden",
    });

    const { PATCH } = await import("@/app/api/sms-templates/[id]/route");
    const response = await PATCH(
      createJsonRequest("https://picup.example/api/sms-templates/id", {
        body: "수정된 문자 내용",
      }),
      { params: Promise.resolve({ id: templateId }) },
    );

    await expectJsonResponse(response, 403, {
      error: "관리자 권한이 필요합니다.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

const adminUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "admin@example.com",
};
const reservationId = "33333333-3333-4333-8333-333333333333";
const templateId = "44444444-4444-4444-8444-444444444444";
const reservation = {
  id: reservationId,
  customer_name: "홍길동",
  customer_phone: "01012345678",
  reservation_date: "2026-06-17",
  reservation_time: "14:30:00",
  expected_return_at: "2026-06-17T18:30:00+09:00",
  product_name_snapshot: "PICUP PICNIC NIGHT",
  pickup_number: 7,
  deposit_amount: 10000,
  payment_amount: 30000,
  status: "reserved",
};
const template = {
  id: templateId,
  type: "reservation_guide",
  name: "예약 안내 문자",
  body: "안녕하세요 {{customerName}}님",
  variables: ["customerName"],
  is_active: true,
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
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  then: Promise<unknown>["then"];
};

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function createSmsSupabaseMock({
  reservation: reservationResult = reservation,
  reservationError = null,
  template: templateResult = template,
  templateError = null,
  logError = null,
  updateError = null,
  templateUpdate = templateResult,
  templateUpdateError = null,
}: {
  reservation?: unknown;
  reservationError?: SupabaseError | null;
  template?: unknown;
  templateError?: SupabaseError | null;
  logError?: SupabaseError | null;
  updateError?: SupabaseError | null;
  templateUpdate?: unknown;
  templateUpdateError?: SupabaseError | null;
} = {}) {
  const tableQueries: Record<string, QueryMock[]> = {
    reservations: [],
    sms_logs: [],
    sms_templates: [],
  };

  return {
    tableQueries,
    from: vi.fn((table: string) => {
      const query = createQueryMock({
        table,
        reservationResult,
        reservationError,
        templateResult,
        templateError,
        logError,
        updateError,
        templateUpdate,
        templateUpdateError,
      });
      tableQueries[table] ??= [];
      tableQueries[table].push(query);

      return query;
    }),
  };
}

function createQueryMock({
  table,
  reservationResult,
  reservationError,
  templateResult,
  templateError,
  logError,
  updateError,
  templateUpdate,
  templateUpdateError,
}: {
  table: string;
  reservationResult: unknown;
  reservationError: SupabaseError | null;
  templateResult: unknown;
  templateError: SupabaseError | null;
  logError: SupabaseError | null;
  updateError: SupabaseError | null;
  templateUpdate: unknown;
  templateUpdateError: SupabaseError | null;
}): QueryMock {
  const query: QueryMock = {
    result: { data: null, error: null },
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (table === "reservations") {
        return { data: reservationResult, error: reservationError };
      }

      if (table === "sms_templates") {
        return { data: templateResult, error: templateError };
      }

      return query.result;
    }),
    single: vi.fn(async () => {
      if (table === "sms_templates") {
        return { data: templateUpdate, error: templateUpdateError };
      }

      return query.result;
    }),
    insert: vi.fn(() => {
      query.result = { data: null, error: logError };

      return query;
    }),
    update: vi.fn(() => {
      if (table === "sms_templates") {
        query.result = { data: templateUpdate, error: templateUpdateError };
      } else {
        query.result = { data: null, error: updateError };
      }

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

  return query;
}
