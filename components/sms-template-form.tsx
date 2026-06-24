"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SaveIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SMS_TEMPLATE_TYPE_LABELS,
  type SmsTemplateType,
} from "@/lib/reservations/status";

export type SmsTemplateFormTemplate = {
  id: string;
  type: SmsTemplateType;
  name: string;
  body: string;
  variables: string[];
};

type SmsTemplateFormProps = {
  template: SmsTemplateFormTemplate;
};

export function SmsTemplateForm({ template }: SmsTemplateFormProps) {
  const router = useRouter();
  const [body, setBody] = useState(template.body);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/sms-templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "템플릿을 저장하지 못했습니다.");
      }

      setSuccessMessage("템플릿을 저장했습니다.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "템플릿을 저장하지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{SMS_TEMPLATE_TYPE_LABELS[template.type]}</CardTitle>
        <CardDescription>{template.name} 내용을 수정합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="문자 내용" htmlFor={`sms-template-body-${template.id}`}>
            <Textarea
              id={`sms-template-body-${template.id}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={9}
              aria-invalid={Boolean(errorMessage)}
            />
          </Field>

          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">사용 가능 변수</p>
            <p className="break-words text-muted-foreground">
              {template.variables.length > 0
                ? template.variables.map((name) => `{{${name}}}`).join(", ")
                : "등록된 변수가 없습니다."}
            </p>
          </div>

          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-muted-foreground">{successMessage}</p>
          ) : null}

          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2Icon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <SaveIcon data-icon="inline-start" aria-hidden="true" />
              )}
              저장
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
