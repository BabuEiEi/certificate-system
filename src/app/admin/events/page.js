import EventManager from "@/components/admin/EventManager";
import { requireAdmin } from "@/lib/auth";
import { getEvents } from "@/lib/data/events";

export const metadata = { title: "กิจกรรม" };

export default async function EventsPage() {
  await requireAdmin();
  const events = await getEvents();

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Event Management</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">กิจกรรม</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          สร้างและกำหนดสถานะกิจกรรมซึ่งเป็นข้อมูลตั้งต้นของผู้รับ Template และเกียรติบัตร
        </p>
      </div>
      <EventManager events={events} />
    </section>
  );
}
