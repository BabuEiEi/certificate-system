import Link from "next/link";

export const metadata = {
  title: "ตรวจสอบเกียรติบัตร",
};

const certificateFields = [
  "สถานะเกียรติบัตร",
  "เลขที่เกียรติบัตร",
  "ชื่อผู้ได้รับ",
  "ชื่อกิจกรรม",
  "วันที่ออก",
  "หน่วยงานผู้ออก",
];

export default async function VerifyPage({ params }) {
  await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" className="mb-6 inline-flex text-sm font-semibold text-brand hover:text-brand-dark">
          ← กลับหน้าค้นหา
        </Link>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/8">
          <div className="bg-brand px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
              Certificate Verification
            </p>
            <h1 className="mt-2 text-3xl font-bold">ตรวจสอบเกียรติบัตร</h1>
            <p className="mt-3 text-sm text-blue-100">
              กำลังรอการเชื่อมต่อระบบตรวจสอบเกียรติบัตร
            </p>
          </div>
          <dl className="grid gap-px bg-slate-200 sm:grid-cols-2">
            {certificateFields.map((field) => (
              <div key={field} className="bg-white px-6 py-5 sm:px-8">
                <dt className="text-xs font-medium text-slate-400">{field}</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-500">—</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
