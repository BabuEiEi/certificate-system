import { requireAdmin } from "@/lib/auth";
import { getAuditLogs } from "@/lib/data/auditLogs";

export const metadata = { title: "Logs" };

const actionLabels = {
  EVENT_CREATED: "สร้างกิจกรรม",
  EVENT_UPDATED: "แก้ไขกิจกรรม",
  EVENT_PURGED: "ลบกิจกรรมและข้อมูลทั้งหมด",
  PARTICIPANT_CREATED: "เพิ่มผู้รับเกียรติบัตร",
  PARTICIPANT_UPDATED: "แก้ไขผู้รับเกียรติบัตร",
  PARTICIPANT_DELETED: "ลบผู้รับเกียรติบัตร",
  PARTICIPANT_PURGED: "ลบผู้รับและข้อมูลทั้งหมด",
  PARTICIPANTS_IMPORTED: "นำเข้ารายชื่อผู้รับ",
  SIGNER_CREATED: "เพิ่มผู้ลงนาม",
  SIGNER_UPDATED: "แก้ไขผู้ลงนาม",
  SIGNER_DELETED: "ลบผู้ลงนาม",
  TEMPLATE_CREATED: "เพิ่มแม่แบบเกียรติบัตร",
  TEMPLATE_UPDATED: "แก้ไขแม่แบบเกียรติบัตร",
  TEMPLATE_DELETED: "ลบแม่แบบเกียรติบัตร",
  CERTIFICATE_ISSUED: "ออกเกียรติบัตร",
  CERTIFICATE_FILE_REPAIRED: "ซ่อมไฟล์เกียรติบัตร",
  CERTIFICATE_REVOKED: "ยกเลิกเกียรติบัตร",
  CERTIFICATES_REVOKED: "ยกเลิกเกียรติบัตรที่เลือก",
  CERTIFICATE_DELETED: "ลบเกียรติบัตรถาวร",
  CERTIFICATES_DELETED: "ลบเกียรติบัตรถาวรหลายฉบับ",
  SETTINGS_UPDATED: "แก้ไขการตั้งค่าเลขเกียรติบัตร",
  USER_CREATED: "เพิ่มบัญชีผู้ใช้งาน",
  USER_ROLE_UPDATED: "แก้ไขบทบาทผู้ใช้งาน",
  USER_ACTIVE_UPDATED: "แก้ไขสถานะผู้ใช้งาน",
};

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function describeLog(log) {
  if (log.action === "PARTICIPANTS_IMPORTED") {
    const importedCount = Number(log.metadata?.importedCount ?? 0).toLocaleString("th-TH");
    const skippedCount = Number(log.metadata?.skippedCount ?? 0);
    return `${log.metadata?.name || "กิจกรรม"}: นำเข้า ${importedCount} รายการ${
      skippedCount ? `, ข้าม ${skippedCount.toLocaleString("th-TH")} รายการ` : ""
    }`;
  }
  if (log.metadata?.name) return log.metadata.name;
  if (log.metadata?.prefix || log.metadata?.year) {
    return `${log.metadata.prefix || ""} ปี ${log.metadata.year || "—"}`.trim();
  }
  return log.entityId;
}

export default async function LogsPage() {
  await requireAdmin();
  const logs = await getAuditLogs();

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Audit Trail</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Logs</h1>
        <p className="mt-2 text-sm text-slate-500">ประวัติการสร้างและแก้ไขข้อมูลสำคัญ 100 รายการล่าสุด</p>
      </div>

      {logs.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">วันเวลา</th>
                  <th className="px-5 py-4 font-semibold">รายการ</th>
                  <th className="px-5 py-4 font-semibold">ข้อมูล</th>
                  <th className="px-5 py-4 font-semibold">ผู้ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{formatDateTime(log.createdAt)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{actionLabels[log.action] ?? log.action}</td>
                    <td className="max-w-sm px-5 py-4">{describeLog(log)}</td>
                    <td className="px-5 py-4 text-xs">{log.actorEmail || "ผู้ดูแลระบบ"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gold" />
          <h2 className="font-bold text-slate-800">ยังไม่มีประวัติการทำรายการ</h2>
          <p className="mt-2 text-sm text-slate-500">ระบบจะบันทึกประวัติเมื่อสร้างหรือแก้ไขข้อมูลสำคัญ</p>
        </div>
      )}
    </section>
  );
}
