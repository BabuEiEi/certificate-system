export default function AdminSectionPage({ title, description }) {
  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Administration
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gold" />
        <p className="text-sm text-slate-500">
          ส่วนจัดการข้อมูลจะเปิดใช้งานใน Phase 2B บนฐานข้อมูลและ RLS ที่เตรียมไว้แล้ว
        </p>
      </div>
    </section>
  );
}
