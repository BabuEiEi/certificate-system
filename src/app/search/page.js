import Link from "next/link";
import SearchForm from "@/components/public/SearchForm";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "ค้นหาเกียรติบัตร",
};

export default async function SearchPage({ searchParams }) {
  const { q = "" } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  const hasQuery = Boolean(query.trim());

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-bold text-slate-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">C</span>
            <span className="hidden sm:inline">ระบบเกียรติบัตรออนไลน์</span>
          </Link>
          <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-brand">
            Admin
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Certificate Search</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">ค้นหาเกียรติบัตร</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <SearchForm defaultValue={query} compact />
        </div>

        <section className="mt-10" aria-labelledby="search-results-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="search-results-heading" className="text-xl font-bold text-slate-900">
              ผลการค้นหา
            </h2>
            {hasQuery ? <span className="text-xs text-slate-400">ยังไม่มีข้อมูล</span> : null}
          </div>
          <EmptyState
            title={
              hasQuery
                ? "ยังไม่สามารถค้นหาข้อมูลได้"
                : "กรุณาระบุชื่อ–นามสกุล หรือเลขที่เกียรติบัตรเพื่อค้นหา"
            }
            description={
              hasQuery
                ? "ระบบกำลังรอการเชื่อมต่อฐานข้อมูลเกียรติบัตร"
                : "กรอกข้อมูลในช่องค้นหาด้านบน แล้วกดปุ่มค้นหา"
            }
          />
        </section>
      </div>
    </main>
  );
}
