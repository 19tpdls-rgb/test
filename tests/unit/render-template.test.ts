import { describe, expect, it } from "vitest";

import { renderSmsTemplate } from "@/lib/sms/render-template";

describe("renderSmsTemplate", () => {
  it("replaces known variable values", () => {
    expect(
      renderSmsTemplate("안녕하세요 {{customerName}}님", {
        customerName: "홍길동",
      }),
    ).toBe("안녕하세요 홍길동님");
  });

  it("keeps unknown variables visibly unchanged", () => {
    expect(
      renderSmsTemplate("예약번호: {{pickupNumber}} / {{missingValue}}", {
        pickupNumber: "7",
      }),
    ).toBe("예약번호: 7 / {{missingValue}}");
  });

  it("allows whitespace inside braces", () => {
    expect(
      renderSmsTemplate("{{ customerName }}님의 예약", {
        customerName: "홍길동",
      }),
    ).toBe("홍길동님의 예약");
  });

  it("renders number values", () => {
    expect(
      renderSmsTemplate("픽업번호 {{pickupNumber}}", {
        pickupNumber: 12,
      }),
    ).toBe("픽업번호 12");
  });

  it("keeps null and undefined variables unchanged", () => {
    expect(
      renderSmsTemplate("{{customerName}} / {{ pickupNumber }}", {
        customerName: null,
        pickupNumber: undefined,
      }),
    ).toBe("{{customerName}} / {{ pickupNumber }}");
  });

  it("replaces repeated variables", () => {
    expect(
      renderSmsTemplate("{{customerName}}님, 다시 한번 {{customerName}}님", {
        customerName: "홍길동",
      }),
    ).toBe("홍길동님, 다시 한번 홍길동님");
  });
});
