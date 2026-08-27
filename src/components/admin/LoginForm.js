"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/login/actions";

const initialState = { error: "" };

export default function LoginForm({ configured, externalError = "" }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const error = state?.error || externalError;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

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
        {pending ? "กำลังตรวจสอบ…" : configured ? "เข้าสู่ระบบ" : "รอการตั้งค่า Supabase"}
      </button>
    </form>
  );
}
