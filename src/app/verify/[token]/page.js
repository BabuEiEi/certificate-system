import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { getPublishedCertificateByToken } from "@/lib/data/publicCertificates";

export const metadata = {
  title: "ตรวจสอบเกียรติบัตร",
};

function formatThaiDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(value));
}

export default async function VerifyPage({ params }) {
  const { token } = await params;
  const certificate = await getPublishedCertificateByToken(token);

  const certificateFields = certificate
    ? [
        ["สถานะเกียรติบัตร", certificate.status === "PUBLISHED" ? "เผยแพร่แล้ว" : "ยกเลิกแล้ว"],
        ["เลขที่เกียรติบัตร", certificate.certificate_number],
        ["ชื่อผู้ได้รับ", certificate.recipient_name],
        ["ชื่อกิจกรรม", certificate.event_name],
        ["วันที่ออก", formatThaiDate(certificate.issued_at)],
        ["หน่วยงานผู้ออก", certificate.issuer_name],
      ]
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" className="mb-6 inline-flex text-sm font-semibold text-brand hover:text-brand-dark">
          ← กลับหน้าค้นหา
        </Link>
        {certificate ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/8">
          <div className="bg-brand px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
              Certificate Verification
            </p>
            <h1 className="mt-2 text-3xl font-bold">ตรวจสอบเกียรติบัตร</h1>
            <p className="mt-3 text-sm text-blue-100">
              พบข้อมูลเกียรติบัตรในทะเบียนสาธารณะ
            </p>
          </div>
          {certificate.status === "REVOKED" ? (
            <div className="border-b border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 sm:px-10">
              เกียรติบัตรนี้ถูกยกเลิก{certificate.revoke_reason ? `: ${certificate.revoke_reason}` : ""}
            </div>
          ) : null}
          <dl className="grid gap-px bg-slate-200 sm:grid-cols-2">
            {certificateFields.map(([label, value]) => (
              <div key={label} className="bg-white px-6 py-5 sm:px-8">
                <dt className="text-xs font-medium text-slate-400">{label}</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        ) : (
          <EmptyState
            title="ไม่พบข้อมูลเกียรติบัตร"
            description="ลิงก์ตรวจสอบอาจไม่ถูกต้อง หรือเกียรติบัตรยังไม่ได้เผยแพร่"
          />
        )}
      </div>
    </main>
  );
}
