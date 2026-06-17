"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type RefundAccountFormValue = {
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  refund_amount: number | null;
  is_refunded: boolean;
  refunded_at: string | null;
  refund_memo: string | null;
};

type RefundAccountFormProps = {
  reservationId: string;
  defaultRefundAmount: number;
  refundAccount: RefundAccountFormValue | null;
};

type FormState = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  refundAmount: string;
  isRefunded: boolean;
  refundedAt: string;
  refundMemo: string;
};

export function RefundAccountForm({
  reservationId,
  defaultRefundAmount,
  refundAccount,
}: RefundAccountFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({
    bankName: refundAccount?.bank_name ?? "",
    accountNumber: refundAccount?.account_number ?? "",
    accountHolder: refundAccount?.account_holder ?? "",
    refundAmount: String(refundAccount?.refund_amount ?? defaultRefundAmount),
    isRefunded: refundAccount?.is_refunded ?? false,
    refundedAt: toDateTimeLocalValue(refundAccount?.refunded_at ?? null),
    refundMemo: refundAccount?.refund_memo ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    const body = {
      bankName: formState.bankName.trim(),
      accountNumber: formState.accountNumber.trim(),
      accountHolder: formState.accountHolder.trim(),
      refundAmount: Number(formState.refundAmount || 0),
      isRefunded: formState.isRefunded,
      refundedAt: formState.refundedAt
        ? new Date(formState.refundedAt).toISOString()
        : null,
      refundMemo: formState.refundMemo.trim(),
    };

    try {
      const response = await fetch(`/api/refunds/${reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "환불 정보를 저장하지 못했습니다.");
      }

      setMessage("환불 정보를 저장했습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "환불 정보를 저장하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="은행" htmlFor="refund-bank">
          <Input
            id="refund-bank"
            value={formState.bankName}
            onChange={(event) => updateField("bankName", event.target.value)}
          />
        </Field>
        <Field label="계좌번호" htmlFor="refund-account-number">
          <Input
            id="refund-account-number"
            value={formState.accountNumber}
            onChange={(event) =>
              updateField("accountNumber", event.target.value)
            }
          />
        </Field>
        <Field label="예금주" htmlFor="refund-account-holder">
          <Input
            id="refund-account-holder"
            value={formState.accountHolder}
            onChange={(event) =>
              updateField("accountHolder", event.target.value)
            }
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="환불 금액" htmlFor="refund-amount">
          <Input
            id="refund-amount"
            type="number"
            min={0}
            value={formState.refundAmount}
            onChange={(event) => updateField("refundAmount", event.target.value)}
          />
        </Field>
        <Field label="환불 일시" htmlFor="refunded-at">
          <Input
            id="refunded-at"
            type="datetime-local"
            value={formState.refundedAt}
            onChange={(event) => updateField("refundedAt", event.target.value)}
            disabled={!formState.isRefunded}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="refund-complete"
          checked={formState.isRefunded}
          onCheckedChange={(checked) =>
            updateField("isRefunded", checked === true)
          }
        />
        <Label htmlFor="refund-complete">환불 완료</Label>
      </div>

      <Field label="환불 메모" htmlFor="refund-memo">
        <Textarea
          id="refund-memo"
          value={formState.refundMemo}
          onChange={(event) => updateField("refundMemo", event.target.value)}
          rows={3}
        />
      </Field>

      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2Icon
              data-icon="inline-start"
              aria-hidden="true"
              className="animate-spin"
            />
          ) : (
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
          )}
          환불 정보 저장
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}
