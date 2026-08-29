"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createEventAction,
  updateEventAction,
} from "@/app/admin/events/actions";
import { DEFAULT_CERTIFICATE_SETTINGS } from "@/lib/certificateSettings";
import { useActionAlert } from "@/lib/sweetAlert";
import { joinClassNames } from "@/lib/utils";

const initialActionState = {
  status: "idle",
  message: "",
  errors: {},
  submittedAt: 0,
};

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

const statusOptions = [
  { value: "DRAFT", label: "ฉบับร่าง" },
  { value: "ACTIVE", label: "เปิดใช้งาน" },
  { value: "CLOSED", label: "ปิดกิจกรรม" },
];

const statusStyles = {
  DRAFT: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-amber-50 text-amber-700",
};

function EventFormFields({ event }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        ชื่อกิจกรรม
        <input
          className={fieldClassName}
          name="name"
          defaultValue={event?.name ?? ""}
          maxLength={160}
          required
          placeholder="เช่น การอบรมเชิงปฏิบัติการประจำปี 2569"
        />
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        หน่วยงานผู้ออกเกียรติบัตร
        <input
          className={fieldClassName}
          name="issuerName"
          defaultValue={event?.issuerName ?? ""}
          maxLength={160}
          required
          placeholder="ระบุชื่อสถานศึกษา หน่วยงาน หรือโครงการ"
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        วันที่เริ่ม
        <input
          className={fieldClassName}
          name="startDate"
          type="date"
          defaultValue={event?.startDate ?? ""}
          required
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        วันที่สิ้นสุด
        <input
          className={fieldClassName}
          name="endDate"
          type="date"
          defaultValue={event?.endDate ?? ""}
          required
        />
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        สถานะ
        <select
          className={fieldClassName}
          name="status"
          defaultValue={event?.status ?? "DRAFT"}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        รายละเอียดเพิ่มเติม
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
          name="description"
          defaultValue={event?.description ?? ""}
          maxLength={1000}
          placeholder="รายละเอียด วัตถุประสงค์ หรือหมายเหตุของกิจกรรม"
        />
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        จำนวนผู้ลงนาม
        <select
          className={fieldClassName}
          name="signerCount"
          defaultValue={String(event?.signerCount ?? 3)}
        >
          <option value="1">1 คน</option>
          <option value="2">2 คน</option>
          <option value="3">3 คน</option>
        </select>
      </label>

      <div className="sm:col-span-2">
        <p className="mb-1 text-sm font-bold text-slate-800">เลขที่เกียรติบัตรของกิจกรรมนี้</p>
        <p className="mb-4 text-xs text-slate-400">
          กำหนดรูปแบบและเลขเริ่มต้นเฉพาะกิจกรรมนี้ แยกจากกิจกรรมอื่น
        </p>
      </div>
      <label className="text-sm font-semibold text-slate-700">
        ข้อความนำหน้า
        <input
          className={fieldClassName}
          name="certDisplayPrefix"
          defaultValue={event?.certificateNumber?.displayPrefix ?? DEFAULT_CERTIFICATE_SETTINGS.displayPrefix}
          maxLength={40}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Prefix
        <input
          className={fieldClassName}
          name="certPrefix"
          defaultValue={event?.certificateNumber?.prefix ?? DEFAULT_CERTIFICATE_SETTINGS.prefix}
          maxLength={40}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        เลขเริ่มต้น
        {event?.hasCustomCertNumbering ? (
          <input type="hidden" name="certRunningNumberOriginal" value={event.certificateNumber?.runningNumber ?? ""} />
        ) : null}
        <input
          className={fieldClassName}
          name="certRunningNumber"
          type="number"
          min="1"
          defaultValue={event?.certificateNumber?.runningNumber ?? DEFAULT_CERTIFICATE_SETTINGS.runningNumber}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        จำนวนหลัก
        <input
          className={fieldClassName}
          name="certNumberDigits"
          type="number"
          min="1"
          max="12"
          defaultValue={event?.certificateNumber?.numberDigits ?? DEFAULT_CERTIFICATE_SETTINGS.numberDigits}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        ตัวคั่น
        <input
          className={fieldClassName}
          name="certSeparator"
          maxLength={3}
          defaultValue={event?.certificateNumber?.separator ?? DEFAULT_CERTIFICATE_SETTINGS.separator}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        ปี
        <input
          className={fieldClassName}
          name="certYear"
          inputMode="numeric"
          defaultValue={event?.certificateNumber?.year ?? DEFAULT_CERTIFICATE_SETTINGS.year}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
        รูปแบบตัวเลข
        <select
          className={fieldClassName}
          name="certNumberFormat"
          defaultValue={event?.certificateNumber?.numberFormat ?? DEFAULT_CERTIFICATE_SETTINGS.numberFormat}
        >
          <option value="THAI">เลขไทย</option>
          <option value="ARABIC">เลขอารบิก</option>
        </select>
      </label>
    </div>
  );
}

function FormErrors({ errors }) {
  const fieldNames = [
    "name",
    "issuerName",
    "startDate",
    "endDate",
    "status",
    "description",
    "signerCount",
    "certDisplayPrefix",
    "certPrefix",
    "certRunningNumber",
    "certNumberDigits",
    "certSeparator",
    "certYear",
    "certNumberFormat",
  ];
  const visibleErrors = fieldNames.filter((name) => errors?.[name]?.[0]);

  if (!visibleErrors.length) return null;

  return (
    <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
      {visibleErrors.map((name) => (
        <li key={name}>• {errors[name][0]}</li>
      ))}
    </ul>
  );
}

function CreateEventForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initialActionState);
  const formReference = useRef(null);
  useActionAlert(state);

  useEffect(() => {
    if (state.status === "success") formReference.current?.reset();
  }, [state.status, state.submittedAt]);

  return (
    <form
      ref={formReference}
      action={formAction}
      noValidate
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="border-b border-slate-100 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">New Event</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">สร้างกิจกรรม</h2>
        <p className="mt-1 text-sm text-slate-500">กิจกรรมใหม่จะเริ่มต้นเป็นฉบับร่างโดยอัตโนมัติ</p>
      </div>
      <EventFormFields />
      <FormErrors errors={state.errors} />
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "สร้างกิจกรรม"}
        </button>
      </div>
    </form>
  );
}

function EditEventForm({ event }) {
  const [state, formAction, pending] = useActionState(updateEventAction, initialActionState);
  useActionAlert(state);

  return (
    <form action={formAction} noValidate className="space-y-5 border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
      <input type="hidden" name="eventId" value={event.id} />
      <EventFormFields event={event} />
      <FormErrors errors={state.errors} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
      </div>
    </form>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00+07:00`),
  );
}

function EventList({ events }) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gold" />
        <h2 className="font-bold text-slate-800">ยังไม่มีกิจกรรม</h2>
        <p className="mt-2 text-sm text-slate-500">สร้างกิจกรรมแรกจากแบบฟอร์มด้านบนได้เลย</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const status = statusOptions.find((option) => option.value === event.status);

        return (
          <details key={event.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer list-none p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={joinClassNames("rounded-full px-2.5 py-1 text-xs font-semibold", statusStyles[event.status])}>
                      {status?.label ?? event.status}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
                  </div>
                  <h2 className="mt-3 truncate text-lg font-bold text-slate-900">{event.name}</h2>
                  <p className="mt-1 truncate text-sm text-slate-500">{event.issuerName}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-brand group-open:hidden">แก้ไขกิจกรรม ↓</span>
                <span className="hidden shrink-0 text-xs font-semibold text-brand group-open:inline">ปิดแบบฟอร์ม ↑</span>
              </div>
            </summary>
            <EditEventForm event={event} />
          </details>
        );
      })}
    </div>
  );
}

export default function EventManager({ events }) {
  return (
    <div className="space-y-8">
      <CreateEventForm />
      <section aria-labelledby="event-list-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Event Registry</p>
            <h2 id="event-list-heading" className="mt-1 text-xl font-bold text-slate-900">รายการกิจกรรม</h2>
          </div>
          <span className="text-sm font-semibold text-slate-500">{events.length.toLocaleString("th-TH")} รายการ</span>
        </div>
        <EventList events={events} />
      </section>
    </div>
  );
}
