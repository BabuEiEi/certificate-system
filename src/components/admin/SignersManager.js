"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  deleteSignerAction,
  saveSignerAction,
} from "@/app/admin/signers/actions";
import {
  confirmAppAction,
  showAppAlert,
  useActionAlert,
} from "@/lib/sweetAlert";

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;
const acceptedSignatureTypes = ["image/png", "image/jpeg", "image/webp"];
const initialActionState = { status: "idle", message: "", errors: {}, submittedAt: 0 };

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

function FieldErrors({ errors }) {
  const messages = ["name", "position", "signature"]
    .flatMap((field) => errors?.[field] ?? [])
    .filter(Boolean);

  if (!messages.length) return null;

  return (
    <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
      {messages.map((message) => <li key={message}>• {message}</li>)}
    </ul>
  );
}

function SignerSlot({ eventId, order, signer }) {
  const [saveState, saveAction, savePending] = useActionState(
    saveSignerAction,
    initialActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSignerAction,
    initialActionState,
  );
  const [previewSelection, setPreviewSelection] = useState({ url: "", resetVersion: 0 });
  const fileInputReference = useRef(null);
  const deleteConfirmationGranted = useRef(false);
  useActionAlert(saveState);
  useActionAlert(deleteState);
  const resetVersion = saveState.status === "success" ? saveState.submittedAt : 0;
  const preview = previewSelection.resetVersion === resetVersion ? previewSelection.url : "";

  function handleFile(file) {
    setPreviewSelection({ url: "", resetVersion });
    if (!file) return;

    if (!acceptedSignatureTypes.includes(file.type)) {
      if (fileInputReference.current) fileInputReference.current.value = "";
      void showAppAlert({
        status: "error",
        message: "รองรับเฉพาะไฟล์ลายเซ็น PNG, JPEG หรือ WebP",
      });
      return;
    }

    if (file.size > MAX_SIGNATURE_SIZE) {
      if (fileInputReference.current) fileInputReference.current.value = "";
      void showAppAlert({ status: "error", message: "ไฟล์ลายเซ็นต้องมีขนาดไม่เกิน 2 MB" });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setPreviewSelection({ url: String(reader.result ?? ""), resetVersion });
    });
    reader.addEventListener("error", () => {
      if (fileInputReference.current) fileInputReference.current.value = "";
      void showAppAlert({ status: "error", message: "ไม่สามารถอ่านไฟล์ลายเซ็นได้" });
    });
    reader.readAsDataURL(file);
  }

  async function confirmDelete(event) {
    if (deleteConfirmationGranted.current) {
      deleteConfirmationGranted.current = false;
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    const confirmed = await confirmAppAction({
      title: `ลบผู้ลงนามลำดับที่ ${order}`,
      message: `ต้องการลบข้อมูลและไฟล์ลายเซ็นของ “${signer?.name ?? "ผู้ลงนาม"}” หรือไม่`,
      confirmButtonText: "ลบผู้ลงนาม",
    });

    if (confirmed) {
      deleteConfirmationGranted.current = true;
      form.requestSubmit();
    }
  }

  const previewSource = preview || signer?.imageUrl || "";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
            {order}
          </span>
          <div>
            <h2 className="font-bold text-slate-800">ผู้ลงนามลำดับที่ {order}</h2>
            <p className="text-xs text-slate-400">ลำดับนี้จะใช้จัดวางบนเกียรติบัตร</p>
          </div>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${signer ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {signer ? "บันทึกแล้ว" : "ยังไม่มีข้อมูล"}
        </span>
      </header>

      <form action={saveAction} noValidate className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="order" value={order} />

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              ชื่อ–นามสกุล <span className="text-rose-500">*</span>
              <input
                className={inputClassName}
                name="name"
                defaultValue={signer?.name ?? ""}
                maxLength={160}
                required
                placeholder="ระบุชื่อผู้ลงนาม"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              ตำแหน่ง <span className="text-rose-500">*</span>
              <input
                className={inputClassName}
                name="position"
                defaultValue={signer?.position ?? ""}
                maxLength={160}
                required
                placeholder="เช่น ผู้อำนวยการสถานศึกษา"
              />
            </label>
          </div>

          <label className="block rounded-xl border-2 border-dashed border-slate-200 p-5 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
            <span className="block text-sm font-semibold text-slate-700">
              {signer?.imageUrl ? "เลือกไฟล์ใหม่เพื่อแทนที่ลายเซ็น" : "เลือกไฟล์ลายเซ็น *"}
            </span>
            <span className="mt-1 block text-xs text-slate-400">PNG, JPEG หรือ WebP · ไม่เกิน 2 MB</span>
            <input
              key={resetVersion}
              ref={fileInputReference}
              type="file"
              name="signature"
              accept="image/png,image/jpeg,image/webp"
              className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>

          <FieldErrors errors={saveState.errors} />

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-400">
              ไฟล์ถูกเก็บแบบ Private และอ่านได้เฉพาะผู้ดูแลระบบ
            </p>
            <button
              type="submit"
              disabled={savePending || deletePending}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
            >
              {savePending ? "กำลังบันทึก..." : signer ? "บันทึกการแก้ไข" : "บันทึกผู้ลงนาม"}
            </button>
          </div>
        </div>

        <aside className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Signature Preview</p>
            <span className={`h-2.5 w-2.5 rounded-full ${previewSource ? "bg-emerald-400" : "bg-slate-300"}`} />
          </div>
          <div className="relative mt-4 min-h-44 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {previewSource ? (
              <Image
                src={previewSource}
                alt={`ตัวอย่างลายเซ็นผู้ลงนามลำดับที่ ${order}`}
                fill
                unoptimized
                sizes="320px"
                className="object-contain p-4"
              />
            ) : (
              <div className="flex h-full min-h-44 items-center justify-center p-4">
                <p className="text-center text-xs leading-5 text-slate-400">ยังไม่มีภาพลายเซ็น</p>
              </div>
            )}
          </div>
          {preview ? (
            <p className="mt-3 text-center text-xs font-semibold text-amber-700">ตัวอย่างไฟล์ใหม่ที่ยังไม่ได้บันทึก</p>
          ) : null}
        </aside>
      </form>

      {signer ? (
        <form
          action={deleteAction}
          onSubmit={confirmDelete}
          className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-7"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="order" value={order} />
          <button
            type="submit"
            disabled={savePending || deletePending}
            className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
          >
            {deletePending ? "กำลังลบ..." : "ลบผู้ลงนามและไฟล์ลายเซ็น"}
          </button>
        </form>
      ) : null}
    </article>
  );
}

export default function SignersManager({ events, signers, selectedEventId }) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="font-bold text-slate-800">ต้องสร้างกิจกรรมก่อนกำหนดผู้ลงนาม</h2>
        <Link href="/admin/events" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
          ไปที่เมนูกิจกรรม
        </Link>
      </div>
    );
  }

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const signerCount = selectedEvent?.signerCount ?? 3;
  const signerOrders = Array.from({ length: signerCount }, (_, index) => index + 1);

  return (
    <div className="space-y-6">
      <form method="get" className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex sm:items-end sm:gap-4">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          กิจกรรมที่กำลังกำหนดผู้ลงนาม
          <select className={inputClassName} name="event" defaultValue={selectedEventId}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <button type="submit" className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white sm:mt-0">
          แสดงผู้ลงนาม
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-800">{selectedEvent?.name ?? "—"}</span>
        <span className="mx-2 text-slate-300">•</span>
        บันทึกแล้ว {signers.filter((item) => item.order <= signerCount).length.toLocaleString("th-TH")} จาก {signerCount.toLocaleString("th-TH")} คน
        <span className="mx-2 text-slate-300">•</span>
        กำหนดจำนวนผู้ลงนามได้ที่เมนู{" "}
        <Link href="/admin/events" className="font-semibold text-brand hover:underline">กิจกรรม</Link>
      </div>

      {signerOrders.map((order) => (
        <SignerSlot
          key={order}
          eventId={selectedEventId}
          order={order}
          signer={signers.find((item) => item.order === order)}
        />
      ))}
    </div>
  );
}
