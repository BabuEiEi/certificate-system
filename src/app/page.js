import Link from "next/link";
import Image from "next/image";
import SearchForm from "@/components/public/SearchForm";
import { getPublicEvents } from "@/lib/data/publicCertificates";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await getPublicEvents();
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-slate-50">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-dark via-brand to-gold" />
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 bottom-0 h-96 w-96 rounded-full bg-amber-100/60 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1 shadow-md shadow-blue-900/15">
              <Image
                src="https://cdn.jsdelivr.net/gh/BabuEiEi/images/obec.png"
                alt="ตราสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"
                width={40}
                height={40}
                priority
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">ระบบเกียรติบัตรออนไลน์</p>
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Certificate System</p>
            </div>
          </div>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-brand hover:shadow-sm sm:text-sm"
          >
            เข้าสู่ระบบ Admin
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-16 sm:py-24">
          <div className="w-full max-w-3xl text-center">
            <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-white bg-white/80 text-4xl shadow-xl shadow-slate-900/8 backdrop-blur">
              ◇
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-gold sm:text-sm">
              Certificate Management System
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              ระบบเกียรติบัตรออนไลน์
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
              ค้นหาและตรวจสอบเกียรติบัตรด้วยชื่อ–นามสกุล หรือเลขที่เกียรติบัตร
            </p>

            <div className="mt-10 rounded-3xl border border-white/80 bg-white/90 p-4 text-left shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-6">
              <SearchForm events={events} />
              <p className="mt-4 text-center text-xs text-slate-400">
                ระบบแสดงเฉพาะเกียรติบัตรที่เผยแพร่ในทะเบียนสาธารณะ
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200/70 pt-5 text-center text-xs text-slate-400">
          พัฒนาโดย © 2026 | นายภัทรพล แก้วเสนา ศึกษานิเทศก์ สพม.พิษณุโลก อุตรดิตถ์
        </footer>
      </div>
    </main>
  );
}
