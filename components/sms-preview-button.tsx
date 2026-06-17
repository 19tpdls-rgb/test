"use client";

import { useState } from "react";
import { Loader2Icon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type SmsTemplateType } from "@/lib/reservations/status";

type SmsPreviewButtonProps = {
  reservationId: string;
  templateType: SmsTemplateType;
  label: string;
  disabled?: boolean;
};

export function SmsPreviewButton({
  reservationId,
  templateType,
  label,
  disabled = false,
}: SmsPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderedBody, setRenderedBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handlePreview() {
    setMessage(null);
    setErrorMessage(null);
    setIsPreviewing(true);

    try {
      const response = await fetch("/api/sms/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reservationId, templateType }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        renderedBody?: string;
        error?: string;
      };

      if (!response.ok || !result.renderedBody) {
        throw new Error(result.error ?? "문자 미리보기를 불러오지 못했습니다.");
      }

      setRenderedBody(result.renderedBody);
      setIsOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "문자 미리보기를 불러오지 못했습니다.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSend() {
    setMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reservationId, templateType }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        result?: { ok?: boolean; failureReason?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "문자를 발송하지 못했습니다.");
      }

      if (!result.result?.ok) {
        throw new Error(result.result?.failureReason ?? "문자 발송에 실패했습니다.");
      }

      setMessage("문자를 발송했습니다.");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "문자를 발송하지 못했습니다.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handlePreview}
        disabled={disabled || isPreviewing}
      >
        {isPreviewing ? (
          <Loader2Icon
            data-icon="inline-start"
            aria-hidden="true"
            className="animate-spin"
          />
        ) : (
          <SendIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {label}
      </Button>
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              아래 내용을 확인한 뒤 문자 발송을 눌러 주세요.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-72 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm leading-6">
            {renderedBody}
          </pre>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSending}
            >
              취소
            </Button>
            <Button type="button" onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader2Icon
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin"
                />
              ) : (
                <SendIcon data-icon="inline-start" aria-hidden="true" />
              )}
              문자 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
