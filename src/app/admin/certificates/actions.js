"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import { createSearchTerms } from "@/lib/firebase/search";
import { formatCertificateNumber } from "@/lib/certificateNumber";
import { composeCertificateImage, buildCertificatePdf } from "@/lib/certificate/render";
import {
  normalizeCertificateFontFamily,
  normalizeCertificateFontWeight,
} from "@/lib/certificateFonts";
import {
  getMissingRequiredCertificatePlacements,
  getTemplateFieldLabel,
  normalizePlacements,
} from "@/lib/templateFields";

const documentIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const issueSchema = z.object({
  eventId: documentIdSchema,
  participantIds: z.array(documentIdSchema).min(1, "กรุณาเลือกผู้เข้าร่วมอย่างน้อย 1 รายการ"),
  outputFormat: z.enum(["PNG", "PDF"], { message: "กรุณาเลือกรูปแบบไฟล์เกียรติบัตร" }),
});
const revokeSchema = z.object({
  certificateId: documentIdSchema,
  reason: z.string().trim().max(500).optional().default(""),
});
const repairSchema = z.object({ certificateId: documentIdSchema });
const deleteSchema = z.object({ certificateId: documentIdSchema });

function actionState(status, message, errors = {}) {
  return { status, message, errors, submittedAt: Date.now() };
}

function revalidateCertificateViews() {
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/logs");
}

function formatIssuedDate(date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function getRenderablePlacements(rawPlacements) {
  const placements = normalizePlacements(rawPlacements);
  const missingFields = getMissingRequiredCertificatePlacements(placements);

  if (missingFields.length) {
    const error = new Error(
      `แม่แบบยังไม่ได้กำหนดตำแหน่งฟิลด์ที่จำเป็น: ${missingFields.map(getTemplateFieldLabel).join(", ")}`,
    );
    error.code = "TEMPLATE_MISSING_REQUIRED_PLACEMENTS";
    throw error;
  }

  return placements;
}

function firestoreTimestampToDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveTemplateForParticipant(db, eventId, certificateType, templateCache) {
  if (certificateType) {
    if (!templateCache.has(certificateType)) {
      const snapshot = await db
        .collection("templates")
        .doc(`${eventId}__${certificateType}`)
        .get();
      templateCache.set(certificateType, snapshot.exists ? snapshot : null);
    }
    return templateCache.get(certificateType);
  }

  // "" (follow template) is only unambiguous when the event has a single
  // template configured; otherwise we cannot guess which design to use.
  if (!templateCache.has("__ALL__")) {
    const snapshot = await db.collection("templates").where("event_id", "==", eventId).get();
    templateCache.set("__ALL__", snapshot.docs);
  }
  const allTemplates = templateCache.get("__ALL__");
  return allTemplates.length === 1 ? allTemplates[0] : null;
}

async function loadSignerImageBuffers(db, storage, eventId) {
  const snapshot = await db
    .collection("signers")
    .where("event_id", "==", eventId)
    .limit(3)
    .get();

  const buffers = {};
  const signers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  await Promise.all(
    signers.map(async (signer) => {
      if (!signer.image_path) return;
      try {
        const [buffer] = await storage.bucket().file(signer.image_path).download();
        buffers[signer.order] = buffer;
      } catch {
        // Missing/unreadable signature file: leave that placement blank.
      }
    }),
  );

  return { signers, imageBuffers: buffers };
}

function buildPlacementValues({ certificateNumber, participant, event, signers, imageBuffers, issuedDate }) {
  const textValues = {
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    event_name: event.name,
    issued_date: formatIssuedDate(issuedDate),
  };
  const imageValues = {};

  signers.forEach((signer) => {
    const order = Number(signer.order);
    if (![1, 2, 3].includes(order)) return;
    textValues[`signer_${order}_name`] = signer.name ?? "";
    textValues[`signer_${order}_position`] = signer.position ?? "";
    if (imageBuffers[signer.order]) {
      imageValues[`signer_${order}_image`] = imageBuffers[signer.order];
    }
  });

  return { textValues, imageValues };
}

export async function issueCertificatesAction(_previousState, formData) {
  const actor = await requireStaff();
  const parsed = issueSchema.safeParse({
    eventId: formData.get("eventId"),
    participantIds: formData.getAll("participantIds"),
    outputFormat: formData.get("outputFormat"),
  });

  if (!parsed.success) {
    return actionState(
      "error",
      parsed.error.issues[0]?.message || "กรุณาตรวจสอบข้อมูลที่เลือก",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { eventId, participantIds, outputFormat } = parsed.data;
  const db = getFirebaseAdminDb();
  const storage = getFirebaseAdminStorage();

  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) {
    return actionState("error", "ไม่พบกิจกรรมที่ต้องการออกเกียรติบัตร");
  }
  const event = eventSnapshot.data();

  const participantSnapshots = await Promise.all(
    participantIds.map((participantId) => db.collection("participants").doc(participantId).get()),
  );

  const eligibleParticipants = [];
  for (const [index, snapshot] of participantSnapshots.entries()) {
    if (!snapshot.exists) continue;
    const data = snapshot.data();
    if (data.event_id !== eventId || data.status !== "ELIGIBLE") continue;
    eligibleParticipants.push({ id: participantIds[index], ...data });
  }

  if (!eligibleParticipants.length) {
    return actionState("error", "ไม่พบผู้เข้าร่วมที่มีสิทธิ์ได้รับเกียรติบัตรในรายการที่เลือก");
  }

  // A REVOKED certificate doesn't block reissuing -- only a still-live
  // PUBLISHED one does. Reissuing creates a brand new certificate doc
  // (see issueSingleCertificate) rather than touching the revoked one, so
  // the revoked record stays around as audit history -- but it reuses that
  // revoked certificate's own number rather than consuming a new one, since
  // this is a correction of the same certificate, not a new one.
  const existingCertificateSnapshots = await Promise.all(
    eligibleParticipants.map((participant) =>
      db.collection("certificates").where("participant_id", "==", participant.id).get(),
    ),
  );
  const reuseCertificateNumberByParticipantId = {};
  existingCertificateSnapshots.forEach((snapshot, index) => {
    const revokedDocs = snapshot.docs
      .map((doc) => doc.data())
      .filter((data) => data.status === "REVOKED")
      .sort((left, right) => (right.revoked_at?.toMillis?.() ?? 0) - (left.revoked_at?.toMillis?.() ?? 0));
    // Only reuse a number that actually looks properly formatted (has a
    // prefix/label in it, e.g. "เลขที่ สทศ.๐๐๐๗/๒๕๖๙") -- some legacy
    // certificates were issued before per-event numbering existed and ended
    // up with a bare "0012/" (no prefix, no year). Reusing that verbatim
    // would just perpetuate the old formatting bug forever, so those fall
    // through to getting a fresh, correctly formatted number instead.
    const candidateNumber = revokedDocs[0]?.certificate_number ?? "";
    if (/[ก-๙a-zA-Z]/.test(candidateNumber)) {
      reuseCertificateNumberByParticipantId[eligibleParticipants[index].id] = candidateNumber;
    }
  });
  const participantsToIssue = eligibleParticipants.filter(
    (_, index) => !existingCertificateSnapshots[index].docs.some((doc) => doc.data().status === "PUBLISHED"),
  );

  if (!participantsToIssue.length) {
    return actionState("error", "ผู้เข้าร่วมที่เลือกได้รับเกียรติบัตรไปแล้วทั้งหมด");
  }

  const templateCache = new Map();
  const { signers, imageBuffers } = await loadSignerImageBuffers(db, storage, eventId);

  let issuedCount = 0;
  const failures = [];
  const templateErrors = new Set();

  for (const participant of participantsToIssue) {
    // Sequential on purpose: each iteration performs a transactional
    // read-increment-write against the shared certificate number counter, so
    // running them concurrently would risk duplicate numbers under retry.
     
    const template = await resolveTemplateForParticipant(
      db,
      eventId,
      participant.certificate_type || "",
      templateCache,
    );

    if (!template) {
      failures.push(participant.full_name || participant.id);
       
      continue;
    }

    const templateData = template.data();

    try {
       
      await issueSingleCertificate({
        db,
        storage,
        actor,
        event: { id: eventId, name: event.name, issuerName: event.issuer_name || "" },
        participant,
        template: { id: template.id, ...templateData },
        signers,
        imageBuffers,
        outputFormat,
        reuseCertificateNumber: reuseCertificateNumberByParticipantId[participant.id],
      });
      issuedCount += 1;
    } catch (error) {
      console.error("Certificate issuance failed", {
        eventId,
        participantId: participant.id,
        error,
      });
      if (error?.code === "TEMPLATE_MISSING_REQUIRED_PLACEMENTS") {
        templateErrors.add(error.message);
      }
      failures.push(participant.full_name || participant.id);
    }
  }

  revalidateCertificateViews();

  if (!issuedCount) {
    return actionState(
      "error",
      templateErrors.size
        ? [...templateErrors].join("\n")
        : "ไม่สามารถออกเกียรติบัตรได้ กรุณาตรวจสอบแม่แบบและลองใหม่",
    );
  }

  if (failures.length) {
    return actionState(
      "warning",
      `ออกเกียรติบัตรสำเร็จ ${issuedCount} ฉบับ แต่ไม่สำเร็จสำหรับ: ${failures.join(", ")}`,
    );
  }

  return actionState("success", `ออกเกียรติบัตรสำเร็จ ${issuedCount} ฉบับ`);
}

async function issueSingleCertificate({ db, storage, actor, event, participant, template, signers, imageBuffers, outputFormat, reuseCertificateNumber }) {
  // Firestore stores placements as an array, while the renderer intentionally
  // accepts only a field-id keyed map. Normalize at this boundary before a
  // certificate number is consumed or a file is created.
  const placements = getRenderablePlacements(template.placements);
  const fontFamily = normalizeCertificateFontFamily(template.font_family);
  const fontWeight = normalizeCertificateFontWeight(template.font_weight);
  const eventReference = db.collection("events").doc(event.id);
  // Events created before per-event numbering existed have no `next_number`
  // field yet, so they keep sharing this legacy global counter exactly as
  // before -- only an event whose admin has explicitly set its own numbering
  // (giving it a `next_number`) switches over to counting independently.
  const legacySettingsReference = db.collection("certificateSettings").doc("default");
  const certificateReference = db.collection("certificates").doc();
  const publishedReference = db.collection("publishedCertificates").doc(certificateReference.id);
  const auditReference = db.collection("auditLogs").doc();
  const verificationToken = randomUUID();
  const issuedDate = new Date();

  // Reissuing a previously revoked certificate keeps its original number --
  // that participant already "owns" it, so no new number is consumed from
  // the counter.
  const certificateNumber =
    reuseCertificateNumber ??
    (await db.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventReference);
      const eventData = eventSnapshot.data() ?? {};
      const hasOwnNumbering = eventData.next_number !== undefined;

      let settings = eventData;
      if (!hasOwnNumbering) {
        const legacySnapshot = await transaction.get(legacySettingsReference);
        settings = legacySnapshot.data() ?? {};
      }

      const nextNumber = Number(settings.next_number ?? 1);
      const numberDigits = Number(settings.number_digits ?? 4);
      const runningNumber = String(nextNumber).padStart(numberDigits, "0");

      const formattedNumber = formatCertificateNumber({
        displayPrefix: settings.display_prefix ?? "",
        prefix: settings.prefix ?? "",
        runningNumber,
        year: settings.year ?? "",
        separator: settings.separator ?? "/",
        numberFormat: settings.number_format ?? "ARABIC",
      });

      const counterReference = hasOwnNumbering ? eventReference : legacySettingsReference;
      transaction.set(
        counterReference,
        { next_number: nextNumber + 1, updated_at: FieldValue.serverTimestamp(), updated_by: actor.id },
        { merge: true },
      );

      return formattedNumber;
    }));

  const { textValues, imageValues } = buildPlacementValues({
    certificateNumber,
    participant,
    event,
    signers,
    imageBuffers,
    issuedDate,
  });

  const bucket = storage.bucket();
  const [templateBuffer] = await bucket.file(template.file_path).download();

  const { pngBuffer, width, height } = await composeCertificateImage({
    templateBuffer,
    templateContentType: template.file_content_type,
    placements,
    textValues,
    imageValues,
    fontFamily,
    fontWeight,
  });

  // Only the format the admin chose is rendered, uploaded, and stored --
  // generating both regardless of choice was pure wasted storage/compute.
  let pngPath = "";
  let pdfPath = "";

  if (outputFormat === "PDF") {
    const pdfBuffer = await buildCertificatePdf({ pngBuffer, width, height });
    pdfPath = `certificates/${event.id}/${certificateReference.id}.pdf`;
    await bucket.file(pdfPath).save(pdfBuffer, {
      resumable: false,
      metadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
    });
  } else {
    pngPath = `certificates/${event.id}/${certificateReference.id}.png`;
    await bucket.file(pngPath).save(pngBuffer, {
      resumable: false,
      metadata: { contentType: "image/png", cacheControl: "private, no-store" },
    });
  }

  const batch = db.batch();
  batch.set(certificateReference, {
    event_id: event.id,
    participant_id: participant.id,
    certificate_type: participant.certificate_type || template.certificate_type,
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    font_family: fontFamily,
    font_weight: fontWeight,
    status: "PUBLISHED",
    verification_token: verificationToken,
    png_path: pngPath,
    pdf_path: pdfPath,
    revoke_reason: "",
    issued_at: FieldValue.serverTimestamp(),
    published_at: FieldValue.serverTimestamp(),
    revoked_at: null,
    created_at: FieldValue.serverTimestamp(),
    created_by: actor.id,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor.id,
  });

  batch.set(publishedReference, {
    certificate_id: certificateReference.id,
    verification_token: verificationToken,
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    event_name: event.name,
    issuer_name: event.issuerName,
    status: "PUBLISHED",
    revoke_reason: "",
    has_png: Boolean(pngPath),
    has_pdf: Boolean(pdfPath),
    search_terms: createSearchTerms(participant.full_name, certificateNumber),
    issued_at: FieldValue.serverTimestamp(),
    published_at: FieldValue.serverTimestamp(),
    revoked_at: null,
  });

  batch.set(
    auditReference,
    createAuditLogData({
      action: "CERTIFICATE_ISSUED",
      actor,
      entityId: certificateReference.id,
      entityType: "CERTIFICATE",
      metadata: {
        event_id: event.id,
        participant_id: participant.id,
        certificate_number: certificateNumber,
      },
    }),
  );

  await batch.commit();
}

export async function repairCertificateFileAction(_previousState, formData) {
  const actor = await requireStaff();
  const parsed = repairSchema.safeParse({ certificateId: formData.get("certificateId") });

  if (!parsed.success) {
    return actionState("error", "ข้อมูลเกียรติบัตรที่ต้องการซ่อมไม่ถูกต้อง");
  }

  const { certificateId } = parsed.data;
  const db = getFirebaseAdminDb();
  const storage = getFirebaseAdminStorage();
  const certificateReference = db.collection("certificates").doc(certificateId);
  const publishedReference = db.collection("publishedCertificates").doc(certificateId);

  try {
    const [certificateSnapshot, publishedSnapshot] = await Promise.all([
      certificateReference.get(),
      publishedReference.get(),
    ]);

    if (!certificateSnapshot.exists || !publishedSnapshot.exists) {
      return actionState("error", "ไม่พบข้อมูลเกียรติบัตรที่ต้องการซ่อม");
    }

    const certificateData = certificateSnapshot.data();
    const publishedData = publishedSnapshot.data();

    if (certificateData.status !== "PUBLISHED" || publishedData.status !== "PUBLISHED") {
      return actionState("error", "ซ่อมได้เฉพาะเกียรติบัตรที่กำลังเผยแพร่เท่านั้น");
    }

    if (!certificateData.certificate_number || !certificateData.recipient_name) {
      return actionState("error", "ข้อมูลเลขที่เกียรติบัตรหรือชื่อผู้รับเดิมไม่ครบถ้วน");
    }

    const outputPaths = [certificateData.png_path, certificateData.pdf_path].filter(Boolean);
    if (!outputPaths.length) {
      return actionState("error", "เกียรติบัตรนี้ไม่มีตำแหน่งไฟล์เดิมสำหรับซ่อม");
    }

    const templateId = `${certificateData.event_id}__${certificateData.certificate_type}`;
    const [eventSnapshot, templateSnapshot, signerData] = await Promise.all([
      db.collection("events").doc(certificateData.event_id).get(),
      db.collection("templates").doc(templateId).get(),
      loadSignerImageBuffers(db, storage, certificateData.event_id),
    ]);

    if (!eventSnapshot.exists || !templateSnapshot.exists) {
      return actionState("error", "ไม่พบกิจกรรมหรือแม่แบบที่ใช้สร้างเกียรติบัตรนี้");
    }

    const issuedDate = firestoreTimestampToDate(certificateData.issued_at);
    if (!issuedDate) {
      return actionState("error", "ไม่พบวันที่ออกเดิม จึงไม่สามารถซ่อมไฟล์โดยคงข้อมูลเดิมได้");
    }

    const templateData = templateSnapshot.data();
    const placements = getRenderablePlacements(templateData.placements);
    const fontFamily = normalizeCertificateFontFamily(templateData.font_family);
    const fontWeight = normalizeCertificateFontWeight(templateData.font_weight);
    const eventData = eventSnapshot.data();
    const { textValues, imageValues } = buildPlacementValues({
      certificateNumber: certificateData.certificate_number,
      participant: { full_name: certificateData.recipient_name },
      event: { name: publishedData.event_name || eventData.name || "" },
      signers: signerData.signers,
      imageBuffers: signerData.imageBuffers,
      issuedDate,
    });

    const bucket = storage.bucket();
    const [templateBuffer] = await bucket.file(templateData.file_path).download();
    const { pngBuffer, width, height } = await composeCertificateImage({
      templateBuffer,
      templateContentType: templateData.file_content_type,
      placements,
      textValues,
      imageValues,
      fontFamily,
      fontWeight,
    });

    const uploads = [];
    if (certificateData.png_path) {
      uploads.push(
        bucket.file(certificateData.png_path).save(pngBuffer, {
          resumable: false,
          metadata: { contentType: "image/png", cacheControl: "private, no-store" },
        }),
      );
    }
    if (certificateData.pdf_path) {
      const pdfBuffer = await buildCertificatePdf({ pngBuffer, width, height });
      uploads.push(
        bucket.file(certificateData.pdf_path).save(pdfBuffer, {
          resumable: false,
          metadata: { contentType: "application/pdf", cacheControl: "private, no-store" },
        }),
      );
    }
    await Promise.all(uploads);

    const batch = db.batch();
    batch.set(
      certificateReference,
      {
        repaired_at: FieldValue.serverTimestamp(),
        font_family: fontFamily,
        font_weight: fontWeight,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: actor.id,
      },
      { merge: true },
    );
    batch.set(
      publishedReference,
      {
        has_png: Boolean(certificateData.png_path),
        has_pdf: Boolean(certificateData.pdf_path),
        repaired_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "CERTIFICATE_FILE_REPAIRED",
        actor,
        entityId: certificateId,
        entityType: "CERTIFICATE",
        metadata: {
          event_id: certificateData.event_id,
          participant_id: certificateData.participant_id,
          certificate_number: certificateData.certificate_number,
        },
      }),
    );
    await batch.commit();
  } catch (error) {
    console.error("Certificate file repair failed", { certificateId, error });
    return actionState(
      "error",
      error?.code === "TEMPLATE_MISSING_REQUIRED_PLACEMENTS"
        ? error.message
        : "ไม่สามารถซ่อมไฟล์เกียรติบัตรได้ กรุณาตรวจสอบแม่แบบและลองใหม่",
    );
  }

  revalidateCertificateViews();
  return actionState(
    "success",
    "ซ่อมไฟล์เกียรติบัตรเรียบร้อยแล้ว โดยคงเลขที่ วันออก และลิงก์ตรวจสอบเดิม",
  );
}

export async function revokeCertificateAction(_previousState, formData) {
  const actor = await requireStaff();
  const parsed = revokeSchema.safeParse({
    certificateId: formData.get("certificateId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return actionState("error", "กรุณาตรวจสอบข้อมูลที่ต้องการยกเลิก", parsed.error.flatten().fieldErrors);
  }

  const { certificateId, reason } = parsed.data;
  const db = getFirebaseAdminDb();
  const certificateReference = db.collection("certificates").doc(certificateId);
  const publishedReference = db.collection("publishedCertificates").doc(certificateId);
  const auditReference = db.collection("auditLogs").doc();

  let filePathsToDelete = [];

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(certificateReference);
      if (!snapshot.exists) throw new Error("CERTIFICATE_NOT_FOUND");

      const data = snapshot.data();
      filePathsToDelete = [data.png_path, data.pdf_path].filter(Boolean);

      transaction.set(
        certificateReference,
        {
          status: "REVOKED",
          revoke_reason: reason,
          // The files are deleted from storage right after this transaction
          // commits -- clear the paths here so the record doesn't keep
          // pointing at bytes that no longer exist.
          png_path: "",
          pdf_path: "",
          revoked_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actor.id,
        },
        { merge: true },
      );
      transaction.set(
        publishedReference,
        {
          status: "REVOKED",
          revoke_reason: reason,
          has_png: false,
          has_pdf: false,
          revoked_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "CERTIFICATE_REVOKED",
          actor,
          entityId: certificateId,
          entityType: "CERTIFICATE",
          metadata: { reason },
        }),
      );
    });
  } catch {
    return actionState("error", "ไม่สามารถยกเลิกเกียรติบัตรได้ กรุณาลองใหม่");
  }

  if (filePathsToDelete.length) {
    const bucket = getFirebaseAdminStorage().bucket();
    await Promise.all(
      filePathsToDelete.map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => {})),
    );
  }

  revalidateCertificateViews();

  return actionState("success", "ยกเลิกเกียรติบัตรเรียบร้อยแล้ว");
}

// ADMIN-only, and only for a certificate that isn't the live PUBLISHED one --
// this permanently removes a stale duplicate left behind by a
// revoke-then-reissue cycle (see issueCertificatesAction), not the audit
// trail of the certificate currently in effect.
export async function deleteCertificateAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = deleteSchema.safeParse({ certificateId: formData.get("certificateId") });

  if (!parsed.success) {
    return actionState("error", "ข้อมูลเกียรติบัตรที่ต้องการลบไม่ถูกต้อง");
  }

  const { certificateId } = parsed.data;
  const db = getFirebaseAdminDb();
  const certificateReference = db.collection("certificates").doc(certificateId);
  const publishedReference = db.collection("publishedCertificates").doc(certificateId);

  try {
    const certificateSnapshot = await certificateReference.get();
    if (!certificateSnapshot.exists) {
      return actionState("error", "ไม่พบเกียรติบัตรที่ต้องการลบ");
    }

    const data = certificateSnapshot.data();
    if (data.status === "PUBLISHED") {
      return actionState("error", "ลบไม่ได้เนื่องจากเป็นเกียรติบัตรที่กำลังเผยแพร่อยู่ กรุณายกเลิกก่อน");
    }

    const filePathsToDelete = [data.png_path, data.pdf_path].filter(Boolean);
    if (filePathsToDelete.length) {
      const bucket = getFirebaseAdminStorage().bucket();
      await Promise.all(
        filePathsToDelete.map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => {})),
      );
    }

    const batch = db.batch();
    batch.delete(certificateReference);
    batch.delete(publishedReference);
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "CERTIFICATE_DELETED",
        actor,
        entityId: certificateId,
        entityType: "CERTIFICATE",
        metadata: {
          event_id: data.event_id,
          participant_id: data.participant_id,
          certificate_number: data.certificate_number,
        },
      }),
    );
    await batch.commit();
  } catch (error) {
    console.error("Certificate deletion failed", { certificateId, error });
    return actionState("error", "ไม่สามารถลบเกียรติบัตรได้ กรุณาลองใหม่");
  }

  revalidateCertificateViews();
  return actionState("success", "ลบเกียรติบัตรเรียบร้อยแล้ว");
}
