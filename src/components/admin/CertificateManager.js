"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { issueCertificatesAction, revokeCertificateAction } from "@/app/admin/certificates/actions";
import { CERTIFICATE_FILE_RETENTION_DAYS } from "@/lib/certificate/retention";
import { confirmAppAction, useActionAlert } from "@/lib/sweetAlert";
import { getCertificateTypeLabel } from "@/lib/participant";

const initialActionState = { status: "idle", message: "", errors: {}, submittedAt: 0 };

const selectClassName =
  "h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

function statusBadge(status) {
  if (status === "PUBLISHED") {
    return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">เผยแพร่แล้ว</span>;
  }
  if (status === "REVOKED") {
    return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">ยกเลิกแล้ว</span>;
  }
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">ยังไม่ออก</span>;
}

function IssueButton({ eventId, selectedIds }) {
  const [state, formAction, pending] = useActionState(issueCertificatesAction, initialActionState);
  const [outputFormat, setOutputFormat] = useState("PNG");
  useActionAlert(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="participantIds" value={id} />
      ))}
      <label className="text-sm font-semibold text-slate-700">
        รูปแบบไฟล์
        <select
          className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100"
          name="outputFormat"
          value={outputFormat}
          onChange={(event) => setOutputFormat(event.target.value)}
        >
          <option value="PNG">PNG</option>
          <option value="PDF">PDF</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || !selectedIds.length}
        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "กำลังออกเกียรติบัตร…" : `ออกเกียรติบัตร (${selectedIds.length})`}
      </button>
    </form>
  );
}

function RevokeControl({ certificateId }) {
  const [state, formAction, pending] = useActionState(revokeCertificateAction, initialActionState);
  useActionAlert(state);

  async function handleSubmit(event) {
    event.preventDefault();
    const confirmed = await confirmAppAction({
      title: "ยืนยันการยกเลิกเกียรติบัตร",
      message: "เกียรติบัตรนี้จะถูกทำเครื่องหมายว่ายกเลิก และแสดงสถานะนี้ในหน้าตรวจสอบสาธารณะ",
      confirmButtonText: "ยกเลิกเกียรติบัตร",
    });
    if (!confirmed) return;

    const reason = window.prompt("เหตุผลการยกเลิก (ไม่บังคับ)", "") ?? "";
    const formData = new FormData(event.currentTarget);
    formData.set("reason", reason);
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="certificateId" value={certificateId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "กำลังยกเลิก…" : "ยกเลิก"}
      </button>
    </form>
  );
}

export default function CertificateManager({ events, selectedEventId, participants, certificatesByParticipantId }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const eligibleParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "ELIGIBLE"),
    [participants],
  );

  function toggleEvent(eventId) {
    const url = new URL(window.location.href);
    url.searchParams.set("event", eventId);
    window.location.assign(url.toString());
  }

  function toggleParticipant(participantId, checked) {
    setSelectedIds((current) =>
      checked ? [...current, participantId] : current.filter((id) => id !== participantId),
    );
  }

  function toggleAllUnissued(checked) {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(
      eligibleParticipants
        .filter((participant) => !certificatesByParticipantId[participant.id])
        .map((participant) => participant.id),
    );
  }

  const unissuedCount = eligibleParticipants.filter(
    (participant) => !certificatesByParticipantId[participant.id],
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm font-semibold text-slate-700">
          กิจกรรม
          <select
            className={selectClassName}
            value={selectedEventId}
            onChange={(event) => toggleEvent(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <IssueButton eventId={selectedEventId} selectedIds={selectedIds} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={unissuedCount > 0 && selectedIds.length === unissuedCount}
                  onChange={(event) => toggleAllUnissued(event.target.checked)}
                  disabled={!unissuedCount}
                />
              </th>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">ประเภทเกียรติบัตร</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เลขที่เกียรติบัตร</th>
              <th className="px-4 py-3 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eligibleParticipants.map((participant) => {
              const certificate = certificatesByParticipantId[participant.id];
              return (
                <tr key={participant.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(participant.id)}
                      disabled={Boolean(certificate)}
                      onChange={(event) => toggleParticipant(participant.id, event.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{participant.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {getCertificateTypeLabel(participant.certificateType)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(certificate?.status)}</td>
                  <td className="px-4 py-3 text-slate-500">{certificate?.certificateNumber || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {certificate ? (
                        <>
                          {certificate.filesExpired ? (
                            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">
                              ไฟล์หมดอายุ (เกิน {CERTIFICATE_FILE_RETENTION_DAYS} วัน)
                            </span>
                          ) : (
                            <>
                              {certificate.hasPng ? (
                                <Link
                                  href={certificate.fileUrl}
                                  target="_blank"
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  ดูตัวอย่าง
                                </Link>
                              ) : null}
                              {certificate.hasPdf ? (
                                <Link
                                  href={certificate.pdfUrl}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  PDF
                                </Link>
                              ) : null}
                            </>
                          )}
                          {certificate.status === "PUBLISHED" ? (
                            <RevokeControl certificateId={certificate.id} />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!eligibleParticipants.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  ไม่พบผู้เข้าร่วมที่มีสิทธิ์ได้รับเกียรติบัตรในกิจกรรมนี้
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
