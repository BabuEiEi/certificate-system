"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { showAppAlert } from "@/lib/sweetAlert";

function getLoginErrorMessage(error) {
  if (error?.code === "auth/too-many-requests") {
    return "มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่";
  }

  if (error?.code === "auth/configuration-not-found") {
    return "ยังไม่ได้เปิด Email/Password ใน Firebase Authentication";
  }

  return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
}

export default function LoginForm({ configured, externalError = "" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (externalError) {
      void showAppAlert({ status: "error", message: externalError });
    }
  }, [externalError]);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      void showAppAlert({
        status: "warning",
        message: "กรุณาระบุอีเมลและรหัสผ่านให้ครบถ้วน",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      void showAppAlert({ status: "warning", message: "กรุณาระบุอีเมลให้ถูกต้อง" });
      return;
    }

    setPending(true);

    try {
      const auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const result = await response.json();

      await signOut(auth);

      if (!response.ok) {
        await showAppAlert({
          status: "error",
          message: result.error || "ไม่สามารถเข้าสู่ระบบได้",
        });
        return;
      }

      router.replace("/admin/dashboard");
      router.refresh();
    } catch (loginError) {
      await showAppAlert({ status: "error", message: getLoginErrorMessage(loginError) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      <label className="block text-sm font-semibold text-slate-700">
        อีเมล
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!configured || pending}
          placeholder="อีเมลผู้ดูแลระบบ"
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-700">
        รหัสผ่าน
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!configured || pending}
          placeholder="รหัสผ่าน"
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <button
        type="submit"
        disabled={!configured || pending}
        className="h-12 w-full rounded-xl bg-brand font-semibold text-white transition hover:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-500"
      >
        {pending ? "กำลังตรวจสอบ…" : configured ? "เข้าสู่ระบบ" : "รอการตั้งค่า Firebase"}
      </button>
    </form>
  );
}
