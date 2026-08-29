"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  deleteTemplateAction,
  saveTemplateAction,
} from "@/app/admin/templates/actions";
import {
  confirmAppAction,
  showAppAlert,
  useActionAlert,
} from "@/lib/sweetAlert";
import {
  TEMPLATE_CERTIFICATE_TYPES,
  TEMPLATE_PLACEMENT_FIELDS,
  TEXT_ALIGN_OPTIONS,
  defaultPlacementFor,
} from "@/lib/templateFields";

const MAX_TEMPLATE_FILE_SIZE = 5 * 1024 * 1024;
const acceptedTemplateTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const initialActionState = { status: "idle", message: "", errors: {}, submittedAt: 0 };
// A4 landscape is the most common certificate proportion; used only until the
// real template dimensions are known so the preview box doesn't jump around.
const FALLBACK_ASPECT_RATIO = "1.414 / 1";

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";
const smallInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100";

function FieldErrors({ errors }) {
  const messages = ["certificateType", "file"]
    .flatMap((field) => errors?.[field] ?? [])
    .filter(Boolean);

  if (!messages.length) return null;

  return (
    <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
      {messages.map((message) => <li key={message}>• {message}</li>)}
    </ul>
  );
}

function TemplateImagePreview({ source, altText, onSize }) {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    // Each Strict Mode dev invocation of this effect creates and revokes its
    // own object URL (setup -> cleanup -> setup again), so the final URL
    // that ends up in state always stays valid for as long as this effect
    // instance is mounted. Deriving the URL outside the effect (e.g. with
    // useMemo) would let Strict Mode's simulated cleanup revoke it while the
    // <img> element is still loading it.
    if (!(source instanceof Blob)) {
      // Sync this component's src with the (possibly external) source prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setObjectUrl(source || "");
      return undefined;
    }

    const url = URL.createObjectURL(source);
    // Sync the freshly created Blob URL's lifecycle with this effect.
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  if (!objectUrl) return null;

  return (
    <Image
      src={objectUrl}
      alt={altText}
      fill
      unoptimized
      sizes="640px"
      className="object-contain"
      onLoad={(event) => onSize({
        width: event.currentTarget.naturalWidth,
        height: event.currentTarget.naturalHeight,
      })}
    />
  );
}

function TemplatePdfPreview({ source, onSize }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    async function render() {
      setError("");
      try {
        const pdfjsLib = await import("pdfjs-dist/webpack.mjs");
        const data = source instanceof Blob
          ? new Uint8Array(await source.arrayBuffer())
          : new Uint8Array(await (await fetch(source, { cache: "no-store" })).arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) onSize({ width: viewport.width, height: viewport.height });
      } catch {
        if (!cancelled) setError("ไม่สามารถแสดงตัวอย่างไฟล์ PDF ได้");
      }
    }

    if (source) render();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [source, onSize]);

  if (error) {
    return (
      <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-rose-600">
        {error}
      </p>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />;
}

function PlacementMarker({ field, placement, onDrag, onDragEnd }) {
  function handlePointerDown(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (event.buttons === 0) return;
    onDrag(field.id, event.clientX, event.clientY);
  }

  function handlePointerUp(event) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDragEnd();
  }

  const isImage = field.type === "image";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`ลากเพื่อวางตำแหน่ง ${field.label}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ left: `${placement.xPercent}%`, top: `${placement.yPercent}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none whitespace-nowrap rounded-full border-2 border-white px-2.5 py-1 text-[10px] font-bold text-white shadow-lg active:cursor-grabbing ${
        isImage ? "bg-gold" : "bg-brand"
      }`}
    >
      {field.label}
    </div>
  );
}

function TemplateSlot({ eventId, certificateType, typeLabel, template }) {
  const [saveState, saveAction, savePending] = useActionState(saveTemplateAction, initialActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTemplateAction, initialActionState);
  useActionAlert(saveState);
  useActionAlert(deleteState);

  const fileInputReference = useRef(null);
  const containerReference = useRef(null);
  const deleteConfirmationGranted = useRef(false);

  const [pendingFile, setPendingFile] = useState({ file: null, resetVersion: 0 });
  const [naturalSize, setNaturalSize] = useState(null);
  const [placements, setPlacements] = useState(() => ({ ...(template?.placements ?? {}) }));

  const resetVersion = saveState.status === "success" ? saveState.submittedAt : 0;
  const selectedFile = pendingFile.resetVersion === resetVersion ? pendingFile.file : null;

  function handleFile(file) {
    setNaturalSize(null);
    setPendingFile({ file: null, resetVersion });
    if (!file) return;

    if (!acceptedTemplateTypes.includes(file.type)) {
      if (fileInputReference.current) fileInputReference.current.value = "";
      void showAppAlert({ status: "error", message: "รองรับเฉพาะไฟล์แม่แบบ PNG, JPEG, WebP หรือ PDF" });
      return;
    }

    if (file.size > MAX_TEMPLATE_FILE_SIZE) {
      if (fileInputReference.current) fileInputReference.current.value = "";
      void showAppAlert({ status: "error", message: "ไฟล์แม่แบบต้องมีขนาดไม่เกิน 5 MB" });
      return;
    }

    setPendingFile({ file, resetVersion });
  }

  function toggleField(fieldId, checked) {
    setPlacements((current) => {
      const next = { ...current };
      if (checked) {
        next[fieldId] = defaultPlacementFor(fieldId);
      } else {
        delete next[fieldId];
      }
      return next;
    });
  }

  function updatePlacement(fieldId, patch) {
    setPlacements((current) => (
      current[fieldId] ? { ...current, [fieldId]: { ...current[fieldId], ...patch } } : current
    ));
  }

  function handleDrag(fieldId, clientX, clientY) {
    const rect = containerReference.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    const xPercent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    updatePlacement(fieldId, { xPercent, yPercent });
  }

  async function confirmDelete(event) {
    if (deleteConfirmationGranted.current) {
      deleteConfirmationGranted.current = false;
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    const confirmed = await confirmAppAction({
      title: `ลบแม่แบบ “${typeLabel}”`,
      message: "ต้องการลบไฟล์แม่แบบและตำแหน่งที่กำหนดไว้ทั้งหมดหรือไม่",
      confirmButtonText: "ลบแม่แบบ",
    });

    if (confirmed) {
      deleteConfirmationGranted.current = true;
      form.requestSubmit();
    }
  }

  const previewKind = selectedFile
    ? (selectedFile.type === "application/pdf" ? "pdf" : "image")
    : template?.fileKind ?? "";
  const previewSource = selectedFile ?? (previewKind ? template?.fileUrl : "");
  const hasPreview = Boolean(previewSource);
  const aspectRatio = naturalSize ? `${naturalSize.width} / ${naturalSize.height}` : FALLBACK_ASPECT_RATIO;
  const enabledFields = TEMPLATE_PLACEMENT_FIELDS.filter((field) => placements[field.id]);
  const placementsPayload = JSON.stringify(
    TEMPLATE_PLACEMENT_FIELDS
      .filter((field) => placements[field.id])
      .map((field) => ({ field: field.id, ...placements[field.id] })),
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
        <div>
          <h2 className="font-bold text-slate-800">แม่แบบ: {typeLabel}</h2>
          <p className="text-xs text-slate-400">ไฟล์ภาพหรือ PDF ที่ใช้พิมพ์เกียรติบัตรประเภทนี้</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${template ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {template ? "บันทึกแล้ว" : "ยังไม่มีข้อมูล"}
        </span>
      </header>

      <form action={saveAction} noValidate className="space-y-6 p-5 sm:p-7">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="certificateType" value={certificateType} />
        <input type="hidden" name="placements" value={placementsPayload} readOnly />

        <label className="block rounded-xl border-2 border-dashed border-slate-200 p-5 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
          <span className="block text-sm font-semibold text-slate-700">
            {template?.fileUrl ? "เลือกไฟล์ใหม่เพื่อแทนที่แม่แบบ" : "เลือกไฟล์แม่แบบ *"}
          </span>
          <span className="mt-1 block text-xs text-slate-400">PNG, JPEG, WebP หรือ PDF · ไม่เกิน 5 MB</span>
          <input
            key={resetVersion}
            ref={fileInputReference}
            type="file"
            name="template"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        <FieldErrors errors={saveState.errors} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              ตัวอย่างแม่แบบ · ลากป้ายชื่อเพื่อกำหนดตำแหน่ง
            </p>
            <div
              ref={containerReference}
              style={{ aspectRatio }}
              className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              {hasPreview ? (
                previewKind === "pdf" ? (
                  <TemplatePdfPreview source={previewSource} onSize={setNaturalSize} />
                ) : (
                  <TemplateImagePreview
                    source={previewSource}
                    altText={`ตัวอย่างแม่แบบ ${typeLabel}`}
                    onSize={setNaturalSize}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <p className="text-center text-xs leading-5 text-slate-400">ยังไม่มีไฟล์แม่แบบ</p>
                </div>
              )}

              {hasPreview && enabledFields.map((field) => (
                <PlacementMarker
                  key={field.id}
                  field={field}
                  placement={placements[field.id]}
                  onDrag={handleDrag}
                  onDragEnd={() => {}}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">ตำแหน่งข้อความ / ลายเซ็น</p>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {TEMPLATE_PLACEMENT_FIELDS.map((field) => {
                const placement = placements[field.id];
                return (
                  <div key={field.id} className="rounded-xl border border-slate-200 p-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(placement)}
                        onChange={(event) => toggleField(field.id, event.target.checked)}
                      />
                      {field.label}
                    </label>

                    {placement ? (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] text-slate-500">
                            X (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className={smallInputClassName}
                              value={Math.round(placement.xPercent * 10) / 10}
                              onChange={(event) => updatePlacement(field.id, { xPercent: Number(event.target.value) })}
                            />
                          </label>
                          <label className="text-[11px] text-slate-500">
                            Y (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className={smallInputClassName}
                              value={Math.round(placement.yPercent * 10) / 10}
                              onChange={(event) => updatePlacement(field.id, { yPercent: Number(event.target.value) })}
                            />
                          </label>
                        </div>

                        {field.type === "text" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-500">
                              ขนาดตัวอักษร
                              <input
                                type="number"
                                min="6"
                                max="200"
                                className={smallInputClassName}
                                value={placement.fontSize}
                                onChange={(event) => updatePlacement(field.id, { fontSize: Number(event.target.value) })}
                              />
                            </label>
                            <label className="text-[11px] text-slate-500">
                              การจัดวาง
                              <select
                                className={smallInputClassName}
                                value={placement.align}
                                onChange={(event) => updatePlacement(field.id, { align: event.target.value })}
                              >
                                {TEXT_ALIGN_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-500">
                              กว้าง (%)
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="0.1"
                                className={smallInputClassName}
                                value={placement.widthPercent}
                                onChange={(event) => updatePlacement(field.id, { widthPercent: Number(event.target.value) })}
                              />
                            </label>
                            <label className="text-[11px] text-slate-500">
                              สูง (%)
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="0.1"
                                className={smallInputClassName}
                                value={placement.heightPercent}
                                onChange={(event) => updatePlacement(field.id, { heightPercent: Number(event.target.value) })}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            ไฟล์ถูกเก็บแบบ Private และอ่านได้เฉพาะผู้ดูแลระบบ
          </p>
          <button
            type="submit"
            disabled={savePending || deletePending}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
          >
            {savePending ? "กำลังบันทึก..." : template ? "บันทึกการแก้ไข" : "บันทึกแม่แบบ"}
          </button>
        </div>
      </form>

      {template ? (
        <form
          action={deleteAction}
          onSubmit={confirmDelete}
          className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-7"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="certificateType" value={certificateType} />
          <button
            type="submit"
            disabled={savePending || deletePending}
            className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
          >
            {deletePending ? "กำลังลบ..." : "ลบแม่แบบนี้"}
          </button>
        </form>
      ) : null}
    </article>
  );
}

export default function TemplateManager({ events, templates, selectedEventId }) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="font-bold text-slate-800">ต้องสร้างกิจกรรมก่อนกำหนดแม่แบบ</h2>
        <Link href="/admin/events" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
          ไปที่เมนูกิจกรรม
        </Link>
      </div>
    );
  }

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  return (
    <div className="space-y-6">
      <form method="get" className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex sm:items-end sm:gap-4">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          กิจกรรมที่กำลังกำหนดแม่แบบ
          <select className={inputClassName} name="event" defaultValue={selectedEventId}>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
        <button type="submit" className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white sm:mt-0">
          แสดงแม่แบบ
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-800">{selectedEvent?.name ?? "—"}</span>
        <span className="mx-2 text-slate-300">•</span>
        บันทึกแล้ว {templates.length.toLocaleString("th-TH")} จาก {TEMPLATE_CERTIFICATE_TYPES.length.toLocaleString("th-TH")} แบบ
      </div>

      <div className="grid gap-6">
        {TEMPLATE_CERTIFICATE_TYPES.map((type) => (
          <TemplateSlot
            key={type.value}
            eventId={selectedEventId}
            certificateType={type.value}
            typeLabel={type.label}
            template={templates.find((item) => item.certificateType === type.value)}
          />
        ))}
      </div>
    </div>
  );
}
