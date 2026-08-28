"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ImportManager from "@/components/admin/ImportManager";
import {
  createParticipantAction,
  deleteParticipantAction,
  updateParticipantAction,
} from "@/app/admin/participants/actions";
import { exportParticipantsToExcel } from "@/lib/excel";
import {
  certificateTypeOptions,
  getCertificateTypeLabel,
  normalizeParticipantText,
  participantStatusOptions,
} from "@/lib/participant";
import { joinClassNames } from "@/lib/utils";

const initialActionState = {
  status: "idle",
  message: "",
  errors: {},
  requiresNameConfirmation: false,
  confirmationNameKey: "",
  submittedAt: 0,
};

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

const statusStyles = {
  ELIGIBLE: "bg-emerald-50 text-emerald-700",
  EXCLUDED: "bg-rose-50 text-rose-700",
};

function ActionMessage({ state }) {
  if (!state.message) return null;

  return (
    <p
      className={joinClassNames(
        "rounded-xl px-4 py-3 text-sm",
        state.status === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : state.status === "warning"
            ? "border border-amber-200 bg-amber-50 text-amber-800"
            : "border border-rose-200 bg-rose-50 text-rose-700",
      )}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

function FormErrors({ errors }) {
  const names = ["fullName", "certificateType", "email", "organization", "recipientCode", "status"];
  const visibleErrors = names.filter((name) => errors?.[name]?.[0]);
  if (!visibleErrors.length) return null;

  return (
    <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
      {visibleErrors.map((name) => (
        <li key={name}>• {errors[name][0]}</li>
      ))}
    </ul>
  );
}

function ParticipantFields({ participant }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          ชื่อ–นามสกุล <span className="text-rose-500">*</span>
          <input
            className={fieldClassName}
            name="fullName"
            defaultValue={participant?.fullName ?? ""}
            maxLength={160}
            required
            placeholder="เช่น นายสมชาย ใจดี"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          ประเภทข้อความบนเกียรติบัตร
          <select
            className={fieldClassName}
            name="certificateType"
            defaultValue={participant?.certificateType ?? ""}
          >
            {certificateTypeOptions.map((option) => (
              <option key={option.value || "TEMPLATE"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">
            เว้นเป็น “กำหนดตาม Template” เมื่อแยก Template ตามประเภทแล้ว
          </span>
        </label>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/70">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-600">
          ข้อมูลเพิ่มเติม (ไม่บังคับ)
        </summary>
        <div className="grid gap-5 border-t border-slate-200 p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            อีเมล
            <input className={fieldClassName} name="email" type="email" defaultValue={participant?.email ?? ""} maxLength={254} placeholder="name@example.com" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            รหัสผู้รับ
            <input className={fieldClassName} name="recipientCode" defaultValue={participant?.recipientCode ?? ""} maxLength={80} placeholder="เช่น STU-001" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            หน่วยงาน / สถานศึกษา
            <input className={fieldClassName} name="organization" defaultValue={participant?.organization ?? ""} maxLength={160} placeholder="ระบุหน่วยงาน (ถ้ามี)" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            สถานะสิทธิ์
            <select className={fieldClassName} name="status" defaultValue={participant?.status ?? "ELIGIBLE"}>
              {participantStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

function CreateParticipantForm({ eventId }) {
  const [state, formAction, pending] = useActionState(
    createParticipantAction,
    initialActionState,
  );
  const formReference = useRef(null);

  useEffect(() => {
    if (state.status === "success") formReference.current?.reset();
  }, [state.status, state.submittedAt]);

  return (
    <form
      ref={formReference}
      action={formAction}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input
        type="hidden"
        name="allowNameDuplicate"
        value={state.requiresNameConfirmation ? "true" : "false"}
      />
      <div className="border-b border-slate-100 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">New Recipient</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">เพิ่มผู้รับเกียรติบัตร</h2>
        <p className="mt-1 text-sm text-slate-500">
          ระบุชื่อ–นามสกุล และเลือกประเภทเฉพาะกรณีใช้ Template เดียวกับผู้รับหลายประเภท
        </p>
      </div>
      <ParticipantFields />
      <FormErrors errors={state.errors} />
      <ActionMessage state={state} />
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? "กำลังบันทึก..."
            : state.requiresNameConfirmation
              ? "ยืนยันเพิ่มชื่อซ้ำ"
              : "เพิ่มผู้รับ"}
        </button>
      </div>
    </form>
  );
}

function EditParticipantForm({ eventId, participant }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateParticipantAction,
    initialActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteParticipantAction,
    initialActionState,
  );

  function confirmDelete(event) {
    if (!window.confirm(`ยืนยันลบ “${participant.fullName}” ออกจากกิจกรรมนี้หรือไม่`)) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-5 border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
      <form action={updateAction} className="space-y-5">
        <input type="hidden" name="participantId" value={participant.id} />
        <input type="hidden" name="eventId" value={eventId} />
        <input
          type="hidden"
          name="allowNameDuplicate"
          value={updateState.requiresNameConfirmation ? "true" : "false"}
        />
        <ParticipantFields participant={participant} />
        <FormErrors errors={updateState.errors} />
        <ActionMessage state={updateState} />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
          >
            {updatePending
              ? "กำลังบันทึก..."
              : updateState.requiresNameConfirmation
                ? "ยืนยันบันทึกชื่อซ้ำ"
                : "บันทึกการแก้ไข"}
          </button>
        </div>
      </form>
      <form
        action={deleteAction}
        onSubmit={confirmDelete}
        className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="participantId" value={participant.id} />
        <ActionMessage state={deleteState} />
        <button
          type="submit"
          disabled={deletePending}
          className="self-end rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
        >
          {deletePending ? "กำลังลบ..." : "ลบผู้รับ"}
        </button>
      </form>
    </div>
  );
}

function ParticipantList({ eventId, participants, searchText }) {
  const normalizedSearch = normalizeParticipantText(searchText);
  const filteredParticipants = useMemo(() => {
    if (!normalizedSearch) return participants;

    return participants.filter((participant) =>
      [
        participant.fullName,
        participant.email,
        participant.organization,
        participant.recipientCode,
      ].some((value) => normalizeParticipantText(value).includes(normalizedSearch)),
    );
  }, [normalizedSearch, participants]);

  if (!participants.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 h-2 w-12 rounded-full bg-gold" />
        <h2 className="font-bold text-slate-800">ยังไม่มีผู้รับในกิจกรรมนี้</h2>
        <p className="mt-2 text-sm text-slate-500">เลือกเพิ่มทีละรายการหรือนำเข้าหลายรายการจากด้านบน</p>
      </div>
    );
  }

  if (!filteredParticipants.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-semibold text-slate-700">ไม่พบรายชื่อที่ตรงกับคำค้น</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredParticipants.map((participant) => {
        const status = participantStatusOptions.find(
          (option) => option.value === participant.status,
        );

        return (
          <details
            key={participant.id}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="cursor-pointer list-none p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={joinClassNames(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusStyles[participant.status],
                      )}
                    >
                      {status?.label ?? participant.status}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand">
                      {getCertificateTypeLabel(participant.certificateType)}
                    </span>
                    {participant.recipientCode ? (
                      <span className="text-xs font-semibold text-slate-400">
                        {participant.recipientCode}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 truncate text-lg font-bold text-slate-900">
                    {participant.fullName}
                  </h3>
                  {(participant.organization || participant.email) ? (
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {[participant.organization, participant.email].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-brand group-open:hidden">
                  แก้ไข ↓
                </span>
                <span className="hidden shrink-0 text-xs font-semibold text-brand group-open:inline">
                  ปิด ↑
                </span>
              </div>
            </summary>
            <EditParticipantForm eventId={eventId} participant={participant} />
          </details>
        );
      })}
    </div>
  );
}

function ExportParticipantsButton({ event, participants }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      await exportParticipantsToExcel({ event, participants });
    } catch {
      setExportError("ไม่สามารถสร้างไฟล์ Excel ได้ กรุณาลองใหม่");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleExport}
        disabled={!participants.length || exporting}
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting ? "กำลังสร้าง Excel..." : "ส่งออกรายชื่อ Excel"}
      </button>
      {exportError ? <span className="text-xs text-rose-600">{exportError}</span> : null}
    </div>
  );
}

function EntryModeSelector({ entryMode, selectedEventId }) {
  const modes = [
    {
      value: "single",
      mark: "1",
      title: "นำเข้าทีละรายการ",
      description: "กรอกชื่อและข้อมูลผู้รับโดยตรง เหมาะกับรายชื่อจำนวนน้อย",
    },
    {
      value: "bulk",
      mark: "X",
      title: "นำเข้าหลายรายการ",
      description: "ดาวน์โหลด Template แล้วนำเข้ารายชื่อด้วยไฟล์ Excel",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Import Method</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">เลือกวิธีนำเข้ารายชื่อผู้รับ</h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {modes.map((mode) => {
          const active = entryMode === mode.value;

          return (
            <Link
              key={mode.value}
              href={{
                pathname: "/admin/participants",
                query: { event: selectedEventId, mode: mode.value },
              }}
              aria-current={active ? "page" : undefined}
              className={joinClassNames(
                "flex gap-4 rounded-2xl border p-4 text-left transition",
                active
                  ? "border-brand bg-blue-50 ring-2 ring-blue-100"
                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50",
              )}
            >
              <span
                className={joinClassNames(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  active ? "bg-brand text-white" : "bg-slate-100 text-slate-500",
                )}
              >
                {mode.mark}
              </span>
              <span>
                <span className="block font-bold text-slate-800">{mode.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {mode.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function ParticipantManager({
  events,
  participants,
  selectedEventId,
  entryMode,
}) {
  const [searchText, setSearchText] = useState("");
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="font-bold text-slate-800">ต้องสร้างกิจกรรมก่อนเพิ่มผู้รับ</h2>
        <Link href="/admin/events" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
          ไปที่เมนูกิจกรรม
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form
        method="get"
        className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex sm:items-end sm:gap-4"
      >
        <input type="hidden" name="mode" value={entryMode} />
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          กิจกรรมที่กำลังจัดการ
          <select className={fieldClassName} name="event" defaultValue={selectedEventId}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white sm:mt-0">
          แสดงรายชื่อ
        </button>
      </form>

      {selectedEvent ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-800">{selectedEvent.name}</span>
          <span className="mx-2 text-slate-300">•</span>
          {selectedEvent.issuerName}
        </div>
      ) : null}

      <EntryModeSelector entryMode={entryMode} selectedEventId={selectedEventId} />

      {entryMode === "bulk" ? (
        <ImportManager
          key={selectedEventId}
          events={events}
          initialEventId={selectedEventId}
          lockEvent
        />
      ) : (
        <CreateParticipantForm eventId={selectedEventId} />
      )}

      <section aria-labelledby="participant-list-heading">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Recipient Registry</p>
            <h2 id="participant-list-heading" className="mt-1 text-xl font-bold text-slate-900">
              รายชื่อผู้รับ
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-sm font-semibold text-slate-500">
                {participants.length.toLocaleString("th-TH")} รายการ
              </span>
              <ExportParticipantsButton
                event={selectedEvent}
                participants={participants}
              />
            </div>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-blue-100 sm:w-72"
              placeholder="ค้นหาชื่อหรือข้อมูลเพิ่มเติม"
              aria-label="ค้นหาผู้รับเกียรติบัตร"
            />
          </div>
        </div>
        <ParticipantList
          eventId={selectedEventId}
          participants={participants}
          searchText={searchText}
        />
      </section>
    </div>
  );
}
