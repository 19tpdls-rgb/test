import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id, name, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!admin) {
    redirect("/login?error=not_admin");
  }

  return { user, admin };
}
