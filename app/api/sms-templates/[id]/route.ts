import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAdminLookupError, requireApiAdmin } from "@/lib/auth/api-admin";
import { createClient } from "@/lib/supabase/server";
import { smsTemplateUpdateSchema } from "@/lib/validators";

const paramsSchema = z.object({ id: z.string().uuid() });

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const adminResponse = await requireActiveAdmin("update SMS template");

  if (adminResponse instanceof NextResponse) {
    return adminResponse;
  }

  const params = paramsSchema.safeParse(await context.params);
  const parsed = smsTemplateUpdateSchema.safeParse(await readJson(request));

  if (!params.success || !parsed.success) {
    return NextResponse.json(
      { error: "문자 템플릿 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("sms_templates")
    .update({
      body: parsed.data.body,
      updated_by: adminResponse.user.id,
    })
    .eq("id", params.data.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update SMS template", {
      templateId: params.data.id,
      error,
    });

    return NextResponse.json(
      { error: "문자 템플릿을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ template });
}

async function requireActiveAdmin(action: string) {
  try {
    const adminGuard = await requireApiAdmin();

    if (!adminGuard.ok) {
      return NextResponse.json(
        {
          error:
            adminGuard.code === "unauthenticated"
              ? "로그인이 필요합니다."
              : "관리자 권한이 필요합니다.",
        },
        { status: adminGuard.status },
      );
    }

    return adminGuard;
  } catch (error) {
    if (error instanceof ApiAdminLookupError) {
      console.error(`Failed to verify ${action} API admin access`, {
        userId: error.userId,
        error: error.cause,
      });
    } else {
      console.error(`Unexpected ${action} API admin guard failure`, { error });
    }

    return NextResponse.json(
      { error: "관리자 권한 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
