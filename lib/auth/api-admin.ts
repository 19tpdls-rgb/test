import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export type ApiAdmin = {
  user_id: string;
  name: string | null;
  role: string;
  is_active: boolean;
};

export type ApiAdminGuardResult =
  | {
      ok: true;
      user: User;
      admin: ApiAdmin;
    }
  | {
      ok: false;
      status: 401 | 403;
      code: "unauthenticated" | "forbidden";
    };

export class ApiAdminLookupError extends Error {
  constructor(
    message: string,
    options: {
      cause: unknown;
      userId: string;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiAdminLookupError";
    this.userId = options.userId;
  }

  userId: string;
}

export async function requireApiAdmin(): Promise<ApiAdminGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
    };
  }

  const { data: admin, error } = await supabase
    .from("admins")
    .select("user_id, name, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new ApiAdminLookupError("Failed to look up active admin", {
      cause: error,
      userId: user.id,
    });
  }

  if (!admin) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
    };
  }

  return {
    ok: true,
    user,
    admin,
  };
}
