import "server-only";

import { MockSmsProvider } from "@/lib/sms/mock-provider";
import { NhnSmsProvider } from "@/lib/sms/nhn-provider";
import { SolapiSmsProvider } from "@/lib/sms/solapi-provider";
import type { SmsProvider, SmsProviderName } from "@/lib/sms/provider";

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
