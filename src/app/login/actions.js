"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const loginSchema = z.object({
  email: z.email("กรุณาระบุอีเมลให้ถูกต้อง").trim(),
  password: z.string().min(1, "กรุณาระบุรหัสผ่าน"),
});

export async function loginAction(_previousState, formData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase ใน .env.local" };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !authData.user) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "ADMIN" || !profile.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแลระบบ" };
  }

  revalidatePath("/", "layout");
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
