import TemplateManager from "@/components/admin/TemplateManager";
import { getEvents } from "@/lib/data/events";
import { getTemplates } from "@/lib/data/templates";

export const metadata = { title: "Template" };

export default async function TemplatesPage({ searchParams }) {
  const events = await getEvents();
  const query = await searchParams;
  const selectedEventId = events.some((event) => event.id === query.event)
    ? query.event
    : events[0]?.id ?? "";
  const templates = await getTemplates(selectedEventId);

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Certificate Templates</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Template</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          จัดการแม่แบบสำหรับสร้างเกียรติบัตรของแต่ละกิจกรรม แยกตามประเภท &ldquo;ผ่านการอบรม&rdquo; และ &ldquo;เข้าร่วม&rdquo;
          พร้อมกำหนดตำแหน่งข้อความและลายเซ็นบนแม่แบบ
        </p>
      </div>
      <TemplateManager
        events={events}
        templates={templates}
        selectedEventId={selectedEventId}
      />
    </section>
  );
}
