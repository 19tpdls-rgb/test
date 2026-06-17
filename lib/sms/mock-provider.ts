import type {
  SmsProvider,
  SmsSendInput,
  SmsSendResult,
} from "@/lib/sms/provider";

export class MockSmsProvider implements SmsProvider {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (input.to.endsWith("0000")) {
      return {
        ok: false,
        failureReason:
          "Mock provider forced failure for numbers ending in 0000.",
      };
    }

    return {
      ok: true,
      providerMessageId: `mock_${createMockMessageId(input)}`,
    };
  }
}

function createMockMessageId(input: SmsSendInput) {
  const source = `${input.to}:${input.text}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}
