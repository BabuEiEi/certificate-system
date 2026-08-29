import SignersManager from "@/components/admin/SignersManager";
import { requireAdmin } from "@/lib/auth";
import { getEvents } from "@/lib/data/events";
import { getSigners } from "@/lib/data/signers";

export const metadata = {
  title: "ผู้ลงนาม",
};

export default async function SignersPage({ searchParams }) {
  await requireAdmin();
  const events = await getEvents();
  const query = await searchParams;
  const selectedEventId = events.some((event) => event.id === query.event)
    ? query.event
    : events[0]?.id ?? "";
  const signers = await getSigners(selectedEventId);

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Certificate Signatures</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">ผู้ลงนาม</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          เตรียมข้อมูลผู้ลงนามและภาพลายเซ็นได้สูงสุด 3 คนต่อกิจกรรม
        </p>
      </div>
      <SignersManager
        events={events}
        signers={signers}
        selectedEventId={selectedEventId}
      />
    </section>
  );
}
