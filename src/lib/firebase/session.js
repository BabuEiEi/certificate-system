import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants";

export async function getSessionCookie() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "";
}

export async function setSessionCookie(value) {
  (await cookies()).set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    priority: "high",
  });
}

export async function deleteSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
