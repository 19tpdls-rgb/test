// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  return {
    Select: ({
      items = [],
      onValueChange,
      value,
    }: {
      items?: { label: string; value: string | null }[];
      onValueChange?: (value: string | null) => void;
      value?: string | null;
    }) =>
      React.createElement(
        "select",
        {
          id: "productId",
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange?.(event.currentTarget.value || null),
          value: value ?? "",
        },
        items.map((item) =>
          React.createElement(
            "option",
            {
              key: item.value ?? "empty",
              value: item.value ?? "",
            },
            item.label,
          ),
        ),
      ),
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectGroup: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement(React.Fragment, null, placeholder),
  };
});

import { ReservationForm } from "@/components/reservation-form";
import { ReservationTable } from "@/components/reservation-table";
import { StatusBadge } from "@/components/status-badge";

const reservation = {
  id: "11111111-1111-4111-8111-111111111111",
  customer_name: "홍길동",
  customer_phone: "01012345678",
  reservation_date: "2026-06-17",
  reservation_time: "14:30:00",
  product_name_snapshot: "피크닉 세트",
  pickup_number: 7,
  payment_amount: 30000,
  deposit_amount: 10000,
  status: "reserved" as const,
  products: {
    name: "피크닉 세트",
    code: "PICNIC",
  },
};

const product = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "피크닉 세트",
  code: "PICNIC",
  base_price: 30000,
  deposit_amount: 10000,
};

describe("reservation UI components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders reservation status labels in Korean", () => {
    const html = renderToStaticMarkup(
      createElement(StatusBadge, { status: "reserved" }),
    );

    expect(html).toContain("예약완료");
  });

  it("renders an empty reservation table state", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationTable, { reservations: [] }),
    );

    expect(html).toContain("등록된 예약이 없습니다");
  });

  it("renders reservation rows with formatted values and detail links", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationTable, { reservations: [reservation] }),
    );

    expect(html).toContain("홍길동");
    expect(html).toContain("010-1234-5678");
    expect(html).toContain("₩30,000");
    expect(html).toContain("₩10,000");
    expect(html).toContain("/reservations/11111111-1111-4111-8111-111111111111");
  });

  it("renders reservation detail data and actions", async () => {
    mocks.createClient.mockResolvedValueOnce(createDetailSupabaseMock());

    const { default: ReservationDetailPage } = await import(
      "@/app/(admin)/reservations/[id]/page"
    );
    const html = renderToStaticMarkup(
      await ReservationDetailPage({
        params: Promise.resolve({ id: reservation.id }),
      }),
    );

    expect(html).toContain("홍길동 예약 상세");
    expect(html).toContain("010-1234-5678");
    expect(html).toContain("피크닉 세트");
    expect(html).toContain("예약 안내 문자");
    expect(html).toContain("환불 계좌");
    expect(html).toContain("/reservations");
  });

  it("renders the create reservation form fields", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationForm, { products: [product] }),
    );

    expect(html).toContain("고객 이름");
    expect(html).toContain("고객 전화번호");
    expect(html).toContain("상품");
    expect(html).toContain("픽업번호");
    expect(html).toContain("예약 등록");
  });

  it("auto-fills the pickup number returned by the pickup API", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ pickupNumberId: "pickup-7", pickupNumber: 7 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ReservationForm, { products: [product] }));

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("상품"), product.id);
    await user.type(screen.getByLabelText("예약 날짜"), "2026-06-17");

    await waitFor(() =>
      expect(getInputValue("픽업번호")).toBe("7"),
    );
    expect(
      screen.getByText("사용 가능한 픽업번호를 자동으로 넣었습니다."),
    ).toBeTruthy();
  });

  it("clears the pickup ID when the pickup number is edited manually", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ pickupNumberId: "pickup-7", pickupNumber: 7 }),
      )
      .mockResolvedValueOnce(jsonResponse({ reservation: { id: "reservation-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ReservationForm, { products: [product] }));

    const user = userEvent.setup();
    await fillRequiredFormFields(user);
    await waitFor(() =>
      expect(getInputValue("픽업번호")).toBe("7"),
    );

    await user.clear(screen.getByLabelText("픽업번호"));
    await user.type(screen.getByLabelText("픽업번호"), "9");
    await user.click(screen.getByRole("button", { name: "예약 등록" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, postInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(postInit.body))).toEqual(
      expect.objectContaining({
        pickupNumber: 9,
        pickupNumberId: null,
      }),
    );
  });

  it("shows a Korean message when pickup number lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "픽업번호를 자동으로 가져오지 못했습니다." }, 500),
      ),
    );

    render(createElement(ReservationForm, { products: [product] }));

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("상품"), product.id);
    await user.type(screen.getByLabelText("예약 날짜"), "2026-06-17");

    expect(
      await screen.findByText("픽업번호를 자동으로 가져오지 못했습니다."),
    ).toBeTruthy();
  });

  it("shows a Korean error when reservation creation fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ pickupNumberId: "pickup-7", pickupNumber: 7 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: "예약을 등록하지 못했습니다." }, 500),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ReservationForm, { products: [product] }));

    const user = userEvent.setup();
    await fillRequiredFormFields(user);
    await waitFor(() =>
      expect(getInputValue("픽업번호")).toBe("7"),
    );
    await user.click(screen.getByRole("button", { name: "예약 등록" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "예약을 등록하지 못했습니다.",
    );
  });
});

async function fillRequiredFormFields(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText("고객 이름"), "홍길동");
  await user.type(screen.getByLabelText("고객 전화번호"), "010-1234-5678");
  await user.type(screen.getByLabelText("예약 날짜"), "2026-06-17");
  await user.type(screen.getByLabelText("예약 시간"), "14:30");
  await user.selectOptions(screen.getByLabelText("상품"), product.id);
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
    status,
  };
}

function createDetailSupabaseMock() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: {
        ...reservation,
        expected_return_at: "2026-06-17T09:30:00.000Z",
        deposit_included: true,
        review_event_participated: true,
        memo: "우천 시 연락",
        refund_accounts: {
          bank_name: "국민은행",
          account_number: "110123456789",
          account_holder: "홍길동",
          refund_amount: 10000,
          is_refunded: false,
          refunded_at: null,
          refund_memo: null,
        },
        sms_logs: [
          {
            id: "sms-1",
            template_type: "reservation_guide",
            recipient_phone: "01012345678",
            rendered_body: "예약 안내입니다.",
            status: "success",
            failure_reason: null,
            sent_at: "2026-06-17T00:00:00.000Z",
          },
        ],
      },
      error: null,
    })),
  };

  return {
    from: vi.fn(() => query),
  };
}

function getInputValue(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}
