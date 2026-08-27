import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const getAdminUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims;

  if (!claims?.sub) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profileError || profile?.role !== "ADMIN" || !profile.is_active) {
    return null;
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    email: typeof claims.email === "string" ? claims.email : "",
    role: profile.role,
  };
});

export async function requireAdmin() {
  const user = await getAdminUser();

  if (!user) {
    const reason = isSupabaseConfigured() ? "not-authorized" : "not-configured";
    redirect(`/login?error=${reason}`);
  }

  return user;
}
