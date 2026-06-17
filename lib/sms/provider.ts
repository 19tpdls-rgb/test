import { MockSmsProvider } from "@/lib/sms/mock-provider";
import { NhnSmsProvider } from "@/lib/sms/nhn-provider";
import { SolapiSmsProvider } from "@/lib/sms/solapi-provider";

export type SmsSendInput = {
  to: string;
  text: string;
};

export type SmsSendResult = {
  ok: boolean;
  providerMessageId?: string;
  failureReason?: string;
};

export interface SmsProvider {
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

export type SmsProviderName = "mock" | "solapi" | "nhn";

export function getSmsProviderName(): SmsProviderName {
  const value = process.env.SMS_PROVIDER;

  if (value === "mock" || value === "solapi" || value === "nhn") {
    return value;
  }

  return "mock";
}

export function createSmsProvider(): SmsProvider {
  const providerName = getSmsProviderName();

  if (providerName === "solapi") {
    return new SolapiSmsProvider();
  }

  if (providerName === "nhn") {
    return new NhnSmsProvider();
  }

  return new MockSmsProvider();
}
