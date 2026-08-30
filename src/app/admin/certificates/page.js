import CertificateManager from "@/components/admin/CertificateManager";
import { getEvents } from "@/lib/data/events";
import { getParticipants } from "@/lib/data/participants";
import { getCertificatesByParticipantId } from "@/lib/data/certificates";

export const metadata = { title: "ออกเกียรติบัตร" };

export default async function CertificatesPage({ searchParams }) {
  const events = await getEvents();
  const query = await searchParams;
  const selectedEventId = events.some((event) => event.id === query.event)
    ? query.event
    : events[0]?.id ?? "";

  const participants = await getParticipants(selectedEventId);
  const { current: certificatesByParticipantId, history: certificateHistoryByParticipantId } =
    await getCertificatesByParticipantId(participants.map((participant) => participant.id));

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Issue Certificates</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">ออกเกียรติบัตร</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          เลือกผู้เข้าร่วมที่มีสิทธิ์ได้รับเกียรติบัตรเพื่อออกเกียรติบัตรแบบเลือกได้หลายรายการ
          ระบบจะสร้างไฟล์ตามรูปแบบที่เลือกและเผยแพร่สู่หน้าตรวจสอบสาธารณะโดยอัตโนมัติ
        </p>
      </div>
      <CertificateManager
        events={events}
        selectedEventId={selectedEventId}
        participants={participants}
        certificatesByParticipantId={certificatesByParticipantId}
        certificateHistoryByParticipantId={certificateHistoryByParticipantId}
      />
    </section>
  );
}
