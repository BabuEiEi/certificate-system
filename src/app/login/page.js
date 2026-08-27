import Link from "next/link";

export const metadata = {
  title: "เข้าสู่ระบบผู้ดูแล",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/8 sm:p-9">
        <Link href="/" className="text-sm font-semibold text-brand">← หน้าค้นหา</Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Administrator</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ระบบยืนยันตัวตนจะเปิดใช้งานใน Phase 2
          </p>
        </div>
        <form className="mt-8 space-y-5">
          <label className="block text-sm font-semibold text-slate-700">
            อีเมล
            <input
              type="email"
              disabled
              placeholder="อีเมลผู้ดูแลระบบ"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 outline-none"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            รหัสผ่าน
            <input
              type="password"
              disabled
              placeholder="รหัสผ่าน"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-500 outline-none"
            />
          </label>
          <button
            type="button"
            disabled
            className="h-12 w-full rounded-xl bg-slate-200 font-semibold text-slate-500"
          >
            ยังไม่เปิดใช้งาน
          </button>
        </form>
      </section>
    </main>
  );
}
