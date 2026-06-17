import { afterEach, describe, expect, it, vi } from "vitest";

import { MockSmsProvider } from "@/lib/sms/mock-provider";
import { NhnSmsProvider } from "@/lib/sms/nhn-provider";
import { SolapiSmsProvider } from "@/lib/sms/solapi-provider";
import {
  createSmsProvider,
  getSmsProviderName,
} from "@/lib/sms/server-provider";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getSmsProviderName", () => {
  it("defaults to mock", () => {
    delete process.env.SMS_PROVIDER;

    expect(getSmsProviderName()).toBe("mock");
  });

  it.each(["mock", "solapi", "nhn"] as const)(
    "accepts %s",
    (providerName) => {
      process.env.SMS_PROVIDER = providerName;

      expect(getSmsProviderName()).toBe(providerName);
    },
  );
});

describe("createSmsProvider", () => {
  it.each([
    ["mock", MockSmsProvider],
    ["solapi", SolapiSmsProvider],
    ["nhn", NhnSmsProvider],
  ] as const)("returns %s provider", (providerName, ProviderClass) => {
    process.env.SMS_PROVIDER = providerName;

    expect(createSmsProvider()).toBeInstanceOf(ProviderClass);
  });
});

describe("MockSmsProvider", () => {
  it("succeeds deterministically", async () => {
    const provider = new MockSmsProvider();
    const input = {
      to: "01012345678",
      text: "픽업 안내",
    };
    const firstResult = await provider.send(input);
    const secondResult = await provider.send(input);

    expect(firstResult).toMatchObject({ ok: true });
    expect(firstResult).toEqual(secondResult);
  });

  it("fails numbers ending in 0000", async () => {
    await expect(
      new MockSmsProvider().send({
        to: "01012340000",
        text: "픽업 안내",
      }),
    ).resolves.toMatchObject({
      ok: false,
      failureReason: "Mock provider forced failure for numbers ending in 0000.",
    });
  });
});

describe("SolapiSmsProvider", () => {
  it("returns a Korean env failure when config is missing", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    delete process.env.SOLAPI_API_SECRET;
    process.env.SOLAPI_SENDER = "010-9999-8888";

    await expect(
      new SolapiSmsProvider().send({
        to: "010-1234-5678",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: false,
      failureReason: "Solapi 환경변수가 설정되지 않았습니다.",
    });
  });

  it("rejects invalid recipient numbers before fetch", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    process.env.SOLAPI_API_SECRET = "test-api-secret";
    process.env.SOLAPI_SENDER = "010-9999-8888";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new SolapiSmsProvider().send({
        to: "---",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: false,
      failureReason: "문자 수신 번호를 확인해 주세요.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid sender numbers before fetch", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    process.env.SOLAPI_API_SECRET = "test-api-secret";
    process.env.SOLAPI_SENDER = "---";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new SolapiSmsProvider().send({
        to: "010-1234-5678",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: false,
      failureReason: "문자 발신 번호를 확인해 주세요.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes hyphenated to and from numbers before sending", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    process.env.SOLAPI_API_SECRET = "test-api-secret";
    process.env.SOLAPI_SENDER = "010-9999-8888";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ messageId: "solapi-message-id" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new SolapiSmsProvider().send({
        to: "010-1234-5678",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: true,
      providerMessageId: "solapi-message-id",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.solapi.com/messages/v4/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining(
            "HMAC-SHA256 apiKey=test-api-key",
          ),
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: {
            to: "01012345678",
            from: "01099998888",
            text: "픽업 안내",
          },
        }),
      }),
    );
  });

  it("maps Solapi non-OK JSON errors to failureReason", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    process.env.SOLAPI_API_SECRET = "test-api-secret";
    process.env.SOLAPI_SENDER = "01099998888";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ errorMessage: "잔액 부족" }),
      }),
    );

    await expect(
      new SolapiSmsProvider().send({
        to: "01012345678",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: false,
      failureReason: "잔액 부족",
    });
  });

  it("returns a generic failure when fetch fails", async () => {
    process.env.SOLAPI_API_KEY = "test-api-key";
    process.env.SOLAPI_API_SECRET = "test-api-secret";
    process.env.SOLAPI_SENDER = "01099998888";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(
      new SolapiSmsProvider().send({
        to: "01012345678",
        text: "픽업 안내",
      }),
    ).resolves.toEqual({
      ok: false,
      failureReason: "Solapi 발송 실패",
    });
  });
});
