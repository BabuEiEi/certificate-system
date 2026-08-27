import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "เข้าสู่ระบบผู้ดูแล",
};

const errorMessages = {
  "authentication-required": "กรุณาเข้าสู่ระบบก่อนใช้งานส่วนผู้ดูแล",
  "not-authorized": "บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแลระบบ",
  "not-configured": "ยังไม่ได้ตั้งค่า Supabase สำหรับโปรเจกต์นี้",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  const adminUser = await getAdminUser();
  if (adminUser) redirect("/admin/dashboard");

  const { error = "" } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;
  const externalError = errorMessages[errorCode] ?? "";
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/8 sm:p-9">
        <Link href="/" className="text-sm font-semibold text-brand">← หน้าค้นหา</Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Administrator</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            สำหรับผู้ดูแลระบบที่ได้รับสิทธิ์เท่านั้น
          </p>
        </div>
        <LoginForm configured={configured} externalError={externalError} />
      </section>
    </main>
  );
}
