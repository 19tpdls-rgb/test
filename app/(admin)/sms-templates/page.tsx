import {
  SmsTemplateForm,
  type SmsTemplateFormTemplate,
} from "@/components/sms-template-form";
import { createClient } from "@/lib/supabase/server";

export default async function SmsTemplatesPage() {
  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("sms_templates")
    .select("id, type, name, body, variables")
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">문자 템플릿</h1>
        <p className="text-sm text-muted-foreground">
          고객에게 보내는 문자 내용을 수정합니다. 중괄호 변수는 그대로 두면
          예약 정보로 자동 채워집니다.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          문자 템플릿을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {!error && (templates ?? []).length === 0 ? (
        <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
          등록된 문자 템플릿이 없습니다.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {((templates ?? []) as SmsTemplateFormTemplate[]).map((template) => (
          <SmsTemplateForm key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
