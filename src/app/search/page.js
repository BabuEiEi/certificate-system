import Link from "next/link";
import SearchForm from "@/components/public/SearchForm";
import EmptyState from "@/components/ui/EmptyState";
import { searchPublishedCertificates } from "@/lib/data/publicCertificates";

export const metadata = {
  title: "ค้นหาเกียรติบัตร",
};

export default async function SearchPage({ searchParams }) {
  const { q = "" } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  const hasQuery = Boolean(query.trim());
  const result = await searchPublishedCertificates(query);

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
            {result.status === "success" ? (
              <span className="text-xs text-slate-400">
                {result.items.length.toLocaleString("th-TH")} รายการ
              </span>
            ) : null}
          </div>
          {result.items.length ? (
            <div className="grid gap-4">
              {result.items.map((certificate) => (
                <article key={certificate.certificate_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-semibold text-brand">{certificate.certificate_number}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{certificate.recipient_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{certificate.event_name}</p>
                    </div>
                    <Link
                      href={`/verify/${certificate.verification_token}`}
                      className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-dark"
                    >
                      ตรวจสอบรายละเอียด
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                hasQuery
                  ? result.status === "success"
                    ? "ไม่พบเกียรติบัตรที่ตรงกับคำค้น"
                    : "ยังไม่สามารถค้นหาข้อมูลได้"
                  : "กรุณาระบุชื่อ–นามสกุล หรือเลขที่เกียรติบัตรเพื่อค้นหา"
              }
              description={
                hasQuery
                  ? result.message || "ลองตรวจสอบการสะกดหรือใช้เลขที่เกียรติบัตร"
                  : "กรอกข้อมูลในช่องค้นหาด้านบน แล้วกดปุ่มค้นหา"
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
