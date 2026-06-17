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
