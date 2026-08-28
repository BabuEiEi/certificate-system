import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/config";
import { getSessionCookie } from "@/lib/firebase/session";

export const getAdminUser = cache(async () => {
  if (!isFirebaseAdminConfigured()) return null;

  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) return null;

  try {
    const claims = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const profileSnapshot = await getFirebaseAdminDb()
      .collection("profiles")
      .doc(claims.uid)
      .get();
    const profile = profileSnapshot.data();

    if (!profileSnapshot.exists || profile?.role !== "ADMIN" || !profile?.is_active) {
      return null;
    }

    return {
      id: claims.uid,
      displayName: profile.display_name || claims.name || claims.email || "ผู้ดูแลระบบ",
      email: claims.email ?? "",
      role: profile.role,
    };
  } catch {
    return null;
  }
});

export async function requireAdmin() {
  const user = await getAdminUser();

  if (!user) {
    const reason = isFirebaseAdminConfigured() ? "not-authorized" : "not-configured";
    redirect(`/login?error=${reason}`);
  }

  return user;
}
