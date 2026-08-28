import { NextResponse } from "next/server";
import { z } from "zod";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/config";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/firebase/constants";
import { setSessionCookie } from "@/lib/firebase/session";

const bodySchema = z.object({
  idToken: z.string().min(100),
});

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Firebase ยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }

  let payload;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const auth = getFirebaseAdminAuth();
    const claims = await auth.verifyIdToken(payload.idToken, true);
    const authAgeSeconds = Math.floor(Date.now() / 1000) - claims.auth_time;

    if (authAgeSeconds > 5 * 60) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
    }

    const profileSnapshot = await getFirebaseAdminDb()
      .collection("profiles")
      .doc(claims.uid)
      .get();
    const profile = profileSnapshot.data();

    if (!profileSnapshot.exists || profile?.role !== "ADMIN" || !profile?.is_active) {
      return NextResponse.json(
        { error: "บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแลระบบ" },
        { status: 403 },
      );
    }

    const sessionCookie = await auth.createSessionCookie(payload.idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
    await setSessionCookie(sessionCookie);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
}
