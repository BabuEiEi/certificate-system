"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import { createSearchTerms } from "@/lib/firebase/search";
import { formatCertificateNumber } from "@/lib/certificateNumber";
import { composeCertificateImage, buildCertificatePdf } from "@/lib/certificate/render";

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

function actionState(status, message, errors = {}) {
  return { status, message, errors, submittedAt: Date.now() };
}

function revalidateCertificateViews() {
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/logs");
}

function formatIssuedDate(date) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(date);
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
    if (revokedDocs[0]?.certificate_number) {
      reuseCertificateNumberByParticipantId[eligibleParticipants[index].id] = revokedDocs[0].certificate_number;
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
    } catch {
      failures.push(participant.full_name || participant.id);
    }
  }

  revalidateCertificateViews();

  if (!issuedCount) {
    return actionState("error", "ไม่สามารถออกเกียรติบัตรได้ กรุณาตรวจสอบแม่แบบและลองใหม่");
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
    placements: template.placements,
    textValues,
    imageValues,
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
