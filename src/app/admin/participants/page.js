import ParticipantManager from "@/components/admin/ParticipantManager";
import { getEvents } from "@/lib/data/events";
import { getParticipants } from "@/lib/data/participants";

export const metadata = { title: "ผู้รับเกียรติบัตร" };

export default async function ParticipantsPage({ searchParams }) {
  const events = await getEvents();
  const query = await searchParams;
  const requestedEventId = query.event;
  const selectedEventId = events.some((event) => event.id === requestedEventId)
    ? requestedEventId
    : events[0]?.id ?? "";
  const entryMode = query.mode === "bulk" ? "bulk" : "single";
  const participants = await getParticipants(selectedEventId);

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Recipient Management</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">ผู้รับเกียรติบัตร</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          จัดการรายชื่อ ตรวจข้อมูลซ้ำ และกำหนดสิทธิ์ของผู้รับแยกตามกิจกรรม
        </p>
      </div>
      <ParticipantManager
        events={events}
        participants={participants}
        selectedEventId={selectedEventId}
        entryMode={entryMode}
      />
    </section>
  );
}
