import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

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
});
