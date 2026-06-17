import crypto from "crypto";

import type {
  SmsProvider,
  SmsSendInput,
  SmsSendResult,
} from "@/lib/sms/provider";

export class SolapiSmsProvider implements SmsProvider {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from = process.env.SOLAPI_SENDER;

    if (!apiKey || !apiSecret || !from) {
      return {
        ok: false,
        failureReason: "Solapi 환경변수가 설정되지 않았습니다.",
      };
    }

    const date = new Date().toISOString();
    const salt = crypto.randomUUID();
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(date + salt)
      .digest("hex");

    try {
      const response = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            to: input.to,
            from,
            text: input.text,
          },
        }),
      });

      const body: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          failureReason: getSolapiErrorMessage(body),
        };
      }

      return {
        ok: true,
        providerMessageId: getSolapiMessageId(body),
      };
    } catch {
      return {
        ok: false,
        failureReason: "Solapi 발송 실패",
      };
    }
  }
}

function getSolapiErrorMessage(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "errorMessage" in body &&
    typeof body.errorMessage === "string"
  ) {
    return body.errorMessage;
  }

  return "Solapi 발송 실패";
}

function getSolapiMessageId(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "messageId" in body &&
    typeof body.messageId === "string"
  ) {
    return body.messageId;
  }

  return undefined;
}
