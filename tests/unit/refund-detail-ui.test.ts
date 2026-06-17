// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

import { RefundAccountForm } from "@/components/refund-account-form";
import { SmsPreviewButton } from "@/components/sms-preview-button";

describe("reservation detail client controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("previews SMS content before sending after confirmation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          renderedBody: "홍길동님, 예약 안내입니다.",
          template: { name: "예약 안내 문자" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: { ok: true },
          renderedBody: "홍길동님, 예약 안내입니다.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      createElement(SmsPreviewButton, {
        reservationId,
        templateType: "reservation_guide",
        label: "예약 안내 문자",
      }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "예약 안내 문자" }));

    expect(await screen.findByText("홍길동님, 예약 안내입니다.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sms/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reservationId,
          templateType: "reservation_guide",
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "문자 발송" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/sms/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reservationId,
          templateType: "reservation_guide",
        }),
      }),
    );
    expect(await screen.findByText("문자를 발송했습니다.")).toBeTruthy();
  });

  it("submits refund account changes and refreshes the page", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ refundAccount: { reservation_id: reservationId } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      createElement(RefundAccountForm, {
        reservationId,
        defaultRefundAmount: 10000,
        refundAccount: null,
      }),
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("은행"), "국민은행");
    await user.type(screen.getByLabelText("계좌번호"), "110123456789");
    await user.type(screen.getByLabelText("예금주"), "홍길동");
    await user.click(screen.getByRole("checkbox", { name: "환불 완료" }));
    await user.click(screen.getByRole("button", { name: "환불 정보 저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/refunds/${reservationId}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          bankName: "국민은행",
          accountNumber: "110123456789",
          accountHolder: "홍길동",
          refundAmount: 10000,
          isRefunded: true,
          refundedAt: null,
          refundMemo: "",
        }),
      }),
    );
    expect(await screen.findByText("환불 정보를 저장했습니다.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

const reservationId = "33333333-3333-4333-8333-333333333333";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
