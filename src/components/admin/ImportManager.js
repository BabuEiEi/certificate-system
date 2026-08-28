"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { readSheet } from "read-excel-file/browser";
import { importParticipantsAction } from "@/app/admin/participants/actions";
import { downloadParticipantExcelTemplate } from "@/lib/excel";
import {
  buildParticipantNameKey,
  buildParticipantStrongDedupeKeys,
  getCertificateTypeLabel,
  parseCertificateType,
  parseParticipantStatus,
} from "@/lib/participant";
import { showAppAlert, showAppToast, useActionAlert } from "@/lib/sweetAlert";

const initialActionState = {
  status: "idle",
  message: "",
  importedCount: 0,
  skippedCount: 0,
  duplicateNameCount: 0,
  duplicateNames: [],
  requiresNameConfirmation: false,
  importToken: "",
  eventId: "",
  submittedAt: 0,
};

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

const headerAliases = {
  fullName: ["fullname", "full name", "name", "ชื่อ-นามสกุล", "ชื่อ นามสกุล", "ชื่อผู้รับ", "ชื่อผู้รับเกียรติบัตร"],
  prefix: ["prefix", "title", "คำนำหน้า"],
  firstName: ["firstname", "first name", "ชื่อ"],
  lastName: ["lastname", "last name", "นามสกุล"],
  email: ["email", "e-mail", "อีเมล"],
  organization: [
    "organization",
    "school",
    "department",
    "หน่วยงาน",
    "สถานศึกษา",
    "โรงเรียน",
    "หน่วยงาน / สถานศึกษา",
  ],
  recipientCode: ["recipientcode", "recipient code", "code", "รหัสผู้รับ", "รหัส", "รหัสประจำตัว"],
  certificateType: [
    "certificatetype",
    "certificate type",
    "type",
    "ประเภท",
    "ประเภทเกียรติบัตร",
    "ประเภทผู้รับ",
  ],
  status: ["status", "สถานะ", "สถานะสิทธิ์"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/[_()]/g, " ")
    .replace(/\s+/g, " ");
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function findColumn(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function parseParticipantRows(sourceRows) {
  if (sourceRows.length < 2) {
    return { rows: [], fileError: "ไฟล์ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 รายการ" };
  }

  const headers = sourceRows[0].map(normalizeHeader);
  const columns = Object.fromEntries(
    Object.entries(headerAliases).map(([key, aliases]) => [key, findColumn(headers, aliases)]),
  );

  const hasCombinedName = columns.fullName >= 0;
  const hasSeparatedName = columns.firstName >= 0 || columns.lastName >= 0;
  if (!hasCombinedName && !hasSeparatedName) {
    return {
      rows: [],
      fileError: "ไม่พบคอลัมน์ชื่อ กรุณาใช้ ‘ชื่อ-นามสกุล’ หรือคอลัมน์ ‘ชื่อ’ และ ‘นามสกุล’",
    };
  }
  if (columns.certificateType < 0) {
    return {
      rows: [],
      fileError: "ไม่พบคอลัมน์ ‘ประเภท’ ซึ่งเป็นข้อมูลบังคับ กรุณาดาวน์โหลด Excel Template ล่าสุด",
    };
  }

  const rows = sourceRows.slice(1).flatMap((sourceRow, index) => {
    if (!sourceRow.some((value) => cellText(value))) return [];

    const valueAt = (column) => (column >= 0 ? cellText(sourceRow[column]) : "");
    const fullName = hasCombinedName
      ? valueAt(columns.fullName)
      : [valueAt(columns.prefix), valueAt(columns.firstName), valueAt(columns.lastName)]
          .filter(Boolean)
          .join(" ");
    const certificateTypeText = valueAt(columns.certificateType);
    const certificateType = parseCertificateType(certificateTypeText);
    const status = parseParticipantStatus(valueAt(columns.status));
    const row = {
      sourceRow: index + 2,
      fullName,
      email: valueAt(columns.email),
      organization: valueAt(columns.organization),
      recipientCode: valueAt(columns.recipientCode),
      certificateType: certificateType.value,
      status: status.value,
      errors: [],
      warnings: [],
    };

    if (row.fullName.length < 2) row.errors.push("ไม่มีชื่อ–นามสกุล");
    if (row.fullName.length > 160) row.errors.push("ชื่อยาวเกิน 160 ตัวอักษร");
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      row.errors.push("อีเมลไม่ถูกต้อง");
    }
    if (row.email.length > 254) row.errors.push("อีเมลยาวเกินไป");
    if (row.organization.length > 160) row.errors.push("ชื่อหน่วยงานยาวเกินไป");
    if (row.recipientCode.length > 80) row.errors.push("รหัสผู้รับยาวเกินไป");
    if (!certificateTypeText || !certificateType.value) {
      row.errors.push("ประเภทต้องเป็น ‘ผ่านการอบรม’ หรือ ‘เข้าร่วม’");
    } else if (certificateType.error) {
      row.errors.push(certificateType.error);
    }
    if (status.error) row.errors.push(status.error);
    return [row];
  });

  if (!rows.length) return { rows: [], fileError: "ไม่พบข้อมูลผู้รับในไฟล์" };
  if (rows.length > 200) {
    return { rows: [], fileError: "นำเข้าได้สูงสุดครั้งละ 200 รายการ กรุณาแบ่งไฟล์" };
  }

  const firstStrongRowByKey = new Map();
  const firstNameRowByKey = new Map();
  rows.forEach((row) => {
    const strongKeys = buildParticipantStrongDedupeKeys(row);
    strongKeys.forEach((strongKey) => {
      if (firstStrongRowByKey.has(strongKey)) {
        row.errors.push(`อีเมลหรือรหัสผู้รับซ้ำกับแถว ${firstStrongRowByKey.get(strongKey)}`);
      } else {
        firstStrongRowByKey.set(strongKey, row.sourceRow);
      }
    });

    const nameKey = buildParticipantNameKey(row);
    if (firstNameRowByKey.has(nameKey)) {
      row.warnings.push(`ชื่อซ้ำกับแถว ${firstNameRowByKey.get(nameKey)}`);
    } else {
      firstNameRowByKey.set(nameKey, row.sourceRow);
    }
  });

  return { rows, fileError: "" };
}

export default function ImportManager({
  events,
  initialEventId = "",
  lockEvent = false,
}) {
  const resolvedInitialEventId = events.some((event) => event.id === initialEventId)
    ? initialEventId
    : events[0]?.id ?? "";
  const [selectedEventId, setSelectedEventId] = useState(resolvedInitialEventId);
  const [rows, setRows] = useState([]);
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  const [importToken, setImportToken] = useState("");
  const [parsing, setParsing] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [state, formAction, pending] = useActionState(
    importParticipantsAction,
    initialActionState,
  );
  useActionAlert(state);
  const fileInputReference = useRef(null);
  const invalidCount = useMemo(
    () => rows.filter((row) => row.errors.length).length,
    [rows],
  );
  const warningCount = useMemo(
    () => rows.filter((row) => row.warnings.length).length,
    [rows],
  );
  const duplicateNameGroups = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = buildParticipantNameKey(row);
      if (!key || row.fullName.length < 2) return;
      const group = groups.get(key) ?? { fullName: row.fullName, sourceRows: [] };
      group.sourceRows.push(row.sourceRow);
      groups.set(key, group);
    });
    return [...groups.values()]
      .filter((group) => group.sourceRows.length > 1)
      .map((group) => ({
        ...group,
        sourceRows: group.sourceRows.sort((left, right) => left - right),
      }));
  }, [rows]);
  const activeNameConfirmation =
    state.requiresNameConfirmation === true
    && state.importToken === importToken
    && state.eventId === selectedEventId;
  const canImport = Boolean(selectedEventId && rows.length && !invalidCount && !fileError);
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  function reportFileError(message) {
    setFileError(message);
    void showAppAlert({ status: "error", message });
  }

  async function handleFile(file) {
    setRows([]);
    setFileError("");
    setFileName(file?.name ?? "");
    setImportToken("");
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      reportFileError("ไฟล์ต้องมีขนาดไม่เกิน 2 MB");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      reportFileError("รองรับเฉพาะไฟล์ Excel .xlsx");
      return;
    }

    setParsing(true);
    try {
      const sourceRows = await readSheet(file);
      const result = parseParticipantRows(sourceRows);
      setRows(result.rows);
      if (result.fileError) {
        reportFileError(result.fileError);
      } else {
        setFileError("");
        setImportToken(`${file.name}:${file.size}:${file.lastModified}:${Date.now()}`);
      }
    } catch {
      reportFileError("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย");
    } finally {
      setParsing(false);
    }
  }

  async function handleTemplateDownload() {
    setTemplateDownloading(true);
    setFileError("");
    try {
      await downloadParticipantExcelTemplate();
      void showAppToast({ message: "ดาวน์โหลด Excel Template เรียบร้อยแล้ว" });
    } catch {
      reportFileError("ไม่สามารถสร้างไฟล์ Excel ตัวอย่างได้ กรุณาลองใหม่");
    } finally {
      setTemplateDownloading(false);
    }
  }

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="font-bold text-slate-800">ต้องสร้างกิจกรรมก่อนนำเข้ารายชื่อ</h2>
        <Link href="/admin/events" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
          ไปที่เมนูกิจกรรม
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Step 1</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {lockEvent ? "ดาวน์โหลด Template และเลือกไฟล์ Excel" : "เลือกกิจกรรมและไฟล์ข้อมูล"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">ระบบจะยังไม่บันทึกจนกว่าคุณจะตรวจ preview และกดยืนยัน</p>
          </div>
          <button
            type="button"
            onClick={handleTemplateDownload}
            disabled={templateDownloading}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-blue-100"
          >
            {templateDownloading ? "กำลังสร้างไฟล์..." : "ดาวน์โหลด Excel Template"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {lockEvent ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <span className="block text-xs font-semibold text-slate-500">กิจกรรมปลายทาง</span>
              <span className="mt-2 block font-semibold leading-6 text-slate-800">
                {selectedEvent?.name ?? "—"}
              </span>
            </div>
          ) : (
            <label className="text-sm font-semibold text-slate-700">
              กิจกรรมปลายทาง
              <select
                className={fieldClassName}
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm transition hover:border-blue-300 hover:bg-blue-50/40">
            <span className="block font-semibold text-slate-700">เลือกไฟล์ Excel</span>
            <span className="mt-1 block text-xs text-slate-400">สูงสุด 200 รายการ และไม่เกิน 2 MB</span>
            <input
              ref={fileInputReference}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {fileName ? <span className="mt-2 block truncate text-xs text-brand">{fileName}</span> : null}
          </label>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
          ต้องระบุ <strong className="text-slate-700">ชื่อ-นามสกุล</strong> และ
          <strong className="text-slate-700"> ประเภท</strong> โดยประเภทต้องเป็น “ผ่านการอบรม” หรือ “เข้าร่วม”
          ส่วนอีเมล รหัสผู้รับ หน่วยงาน / สถานศึกษา และสถานะสิทธิ์เป็นข้อมูลเสริม
        </div>
        {parsing ? <p className="mt-4 text-sm font-semibold text-brand">กำลังอ่านและตรวจไฟล์...</p> : null}
      </section>

      {rows.length ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Step 2</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">ตรวจสอบก่อนนำเข้า</h2>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{rows.length.toLocaleString("th-TH")} รายการ</span>
              {invalidCount ? (
                <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">
                  ผิดพลาด {invalidCount.toLocaleString("th-TH")}
                </span>
              ) : warningCount ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                  เตือนชื่อซ้ำ {warningCount.toLocaleString("th-TH")}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  ข้อมูลพร้อมนำเข้า
                </span>
              )}
            </div>
          </div>
          {duplicateNameGroups.length ? (
            <aside className="border-b border-amber-200 bg-amber-50/70 px-5 py-4 sm:px-7" aria-label="รายละเอียดชื่อซ้ำในไฟล์">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="text-sm font-bold text-amber-900">รายละเอียดชื่อซ้ำในไฟล์ Excel</p>
                <p className="text-xs text-amber-700">
                  {duplicateNameGroups.length.toLocaleString("th-TH")} ชื่อ · ซ้ำ {warningCount.toLocaleString("th-TH")} รายการ
                </p>
              </div>
              <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                {duplicateNameGroups.map((group) => (
                  <li key={buildParticipantNameKey(group)} className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                    <span className="block font-semibold text-slate-800">{group.fullName}</span>
                    <span className="mt-1 block text-xs text-amber-700">
                      พบในแถว Excel: {group.sourceRows.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-5 text-amber-800">
                หากเป็นบุคคลเดียวกันควรลบแถวที่ซ้ำออกก่อนนำเข้า แต่หากเป็นคนละคนสามารถตรวจสอบแล้วกดยืนยันได้
              </p>
            </aside>
          ) : null}
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">แถว</th>
                  <th className="px-4 py-3 font-semibold">ชื่อ–นามสกุล</th>
                  <th className="px-4 py-3 font-semibold">ประเภท</th>
                  <th className="px-4 py-3 font-semibold">ผลตรวจ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {rows.map((row) => (
                  <tr
                    key={row.sourceRow}
                    className={row.errors.length ? "bg-rose-50/40" : row.warnings.length ? "bg-amber-50/40" : ""}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400">{row.sourceRow}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.fullName || "—"}</td>
                    <td className="px-4 py-3 text-xs">{getCertificateTypeLabel(row.certificateType)}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.errors.length ? (
                        <span className="text-rose-600">{row.errors.join(", ")}</span>
                      ) : row.warnings.length ? (
                        <span className="text-amber-700">{row.warnings.join(", ")}</span>
                      ) : (
                        <span className="text-emerald-700">พร้อม</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={formAction} className="space-y-4 border-t border-slate-100 p-5 sm:p-7">
            <input type="hidden" name="eventId" value={selectedEventId} />
            <input type="hidden" name="importToken" value={importToken} />
            <input
              type="hidden"
              name="allowNameDuplicates"
              value={activeNameConfirmation ? "true" : "false"}
            />
            <input
              type="hidden"
              name="rowsJson"
              value={JSON.stringify(rows.map(({
                sourceRow,
                fullName,
                email,
                organization,
                recipientCode,
                certificateType,
                status,
              }) => ({
                sourceRow,
                eventId: selectedEventId,
                fullName,
                email,
                organization,
                recipientCode,
                certificateType,
                status,
              })))}
            />
            {activeNameConfirmation && state.duplicateNames?.length ? (
              <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="รายชื่อที่ต้องยืนยันว่าซ้ำ">
                <p className="text-sm font-bold text-amber-900">รายชื่อที่ต้องตรวจสอบก่อนยืนยัน</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {state.duplicateNames.map((detail) => (
                    <li key={`${detail.fullName}:${detail.sourceRows.join("-")}`} className="rounded-lg bg-white px-3 py-2">
                      <span className="font-semibold">{detail.fullName}</span>
                      <span className="ml-2 text-xs text-amber-700">
                        {detail.matchesExisting ? "ซ้ำกับรายชื่อที่มีอยู่แล้ว" : "ซ้ำภายในไฟล์"}
                        {detail.sourceRows.length ? ` · แถว Excel ${detail.sourceRows.join(", ")}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-slate-400">
                อีเมลหรือรหัสผู้รับที่มีอยู่แล้วจะถูกข้าม ส่วนชื่อซ้ำจะให้ตรวจสอบและยืนยันอีกครั้ง
              </p>
              <button
                type="submit"
                disabled={!canImport || pending}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? "กำลังนำเข้า..."
                  : activeNameConfirmation
                    ? `ยืนยันนำเข้าชื่อซ้ำ ${state.duplicateNameCount.toLocaleString("th-TH")} รายการ`
                    : `ยืนยันนำเข้า ${rows.length.toLocaleString("th-TH")} รายการ`}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
