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

import { SmsTemplateForm } from "@/components/sms-template-form";

const template = {
  id: "44444444-4444-4444-8444-444444444444",
  type: "reservation_guide" as const,
  name: "예약 안내 문자",
  body: "안녕하세요 {{customerName}}님",
  variables: ["customerName", "pickupNumber"],
};

describe("SmsTemplateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a visible success message after saving", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ template }));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(SmsTemplateForm, { template }));

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("문자 내용"));
    await user.type(screen.getByLabelText("문자 내용"), "새 문자 내용");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("템플릿을 저장했습니다.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/sms-templates/${template.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ body: "새 문자 내용" }),
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows a visible Korean error when saving fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "템플릿을 저장하지 못했습니다." }, 500),
      ),
    );

    render(createElement(SmsTemplateForm, { template }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "템플릿을 저장하지 못했습니다.",
      ),
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
    status,
  };
}
