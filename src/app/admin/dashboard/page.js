import { getDashboardStats } from "@/lib/data/dashboard";

const kpis = [
  { key: "events", label: "จำนวนกิจกรรม", tone: "bg-blue-50 text-blue-700" },
  { key: "participants", label: "จำนวนผู้รับ", tone: "bg-violet-50 text-violet-700" },
  { key: "certificates", label: "จำนวนเกียรติบัตร", tone: "bg-amber-50 text-amber-700" },
  { key: "published", label: "เผยแพร่แล้ว", tone: "bg-emerald-50 text-emerald-700" },
  { key: "revoked", label: "ยกเลิก", tone: "bg-slate-100 text-slate-600" },
  { key: "errors", label: "ผิดพลาด", tone: "bg-rose-50 text-rose-700" },
];

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Overview</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">ภาพรวมการออกและเผยแพร่เกียรติบัตร</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-800">
                  {stats[kpi.key].toLocaleString("th-TH")}
                </p>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${kpi.tone}`}>KPI</span>
            </div>
            <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
              อัปเดตจากฐานข้อมูล Supabase
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
