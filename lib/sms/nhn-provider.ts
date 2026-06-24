import type {
  SmsProvider,
  SmsSendResult,
} from "@/lib/sms/provider";

export class NhnSmsProvider implements SmsProvider {
  async send(): Promise<SmsSendResult> {
    return {
      ok: false,
      failureReason:
        "NHN Cloud SMS provider is not enabled in this MVP. Set SMS_PROVIDER=mock or SMS_PROVIDER=solapi.",
    };
  }
}
