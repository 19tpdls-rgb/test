"use server";

import { redirect } from "next/navigation";

import { resolveLoginEmail } from "@/lib/auth/login-identifier";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const identifier = String(
    formData.get("identifier") ?? formData.get("email") ?? "",
  );
  const email = resolveLoginEmail(identifier);
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect("/dashboard");
}
