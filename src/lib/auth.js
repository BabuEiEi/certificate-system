import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/config";
import { getSessionCookie } from "@/lib/firebase/session";

const ADMIN_CONSOLE_ROLES = new Set(["ADMIN", "STAFF"]);

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

    if (!profileSnapshot.exists || !ADMIN_CONSOLE_ROLES.has(profile?.role) || !profile?.is_active) {
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

function redirectUnauthorized() {
  const reason = isFirebaseAdminConfigured() ? "not-authorized" : "not-configured";
  redirect(`/login?error=${reason}`);
}

// ADMIN-only: events, signers, and user-account management.
export async function requireAdmin() {
  const user = await getAdminUser();

  if (!user || user.role !== "ADMIN") {
    redirectUnauthorized();
  }

  return user;
}

// ADMIN or STAFF: participants, templates, and issuing/revoking certificates.
export async function requireStaff() {
  const user = await getAdminUser();

  if (!user) {
    redirectUnauthorized();
  }

  return user;
}
