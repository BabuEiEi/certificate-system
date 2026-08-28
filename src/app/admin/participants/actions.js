"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  buildParticipantNameKey,
  buildParticipantStrongDedupeKey,
  buildParticipantStrongDedupeKeys,
  normalizeParticipantText,
} from "@/lib/participant";

const documentIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

const participantSchema = z.object({
  sourceRow: z.number().int().min(2).max(201).optional(),
  eventId: documentIdSchema,
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ–นามสกุล").max(160, "ชื่อยาวเกินไป"),
  email: z
    .string()
    .trim()
    .max(254, "อีเมลยาวเกินไป")
    .refine((value) => !value || z.email().safeParse(value).success, "รูปแบบอีเมลไม่ถูกต้อง"),
  organization: z.string().trim().max(160, "ชื่อหน่วยงานยาวเกินไป"),
  recipientCode: z.string().trim().max(80, "รหัสผู้รับยาวเกินไป"),
  certificateType: z.union([
    z.literal(""),
    z.enum(["PASSED_TRAINING", "PARTICIPATED"]),
  ]),
  status: z.enum(["ELIGIBLE", "EXCLUDED"], { message: "สถานะผู้รับไม่ถูกต้อง" }),
});

const importParticipantSchema = participantSchema.extend({
  certificateType: z.enum(["PASSED_TRAINING", "PARTICIPATED"]),
});

const importSchema = z.array(importParticipantSchema).min(1).max(200);

function parseParticipantForm(formData) {
  return participantSchema.safeParse({
    eventId: formData.get("eventId"),
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    organization: formData.get("organization") ?? "",
    recipientCode: formData.get("recipientCode") ?? "",
    certificateType: formData.get("certificateType") ?? "",
    status: formData.get("status") ?? "ELIGIBLE",
  });
}

function validationState(error) {
  return {
    status: "error",
    message: "กรุณาตรวจสอบข้อมูลที่ระบุ",
    errors: error.flatten().fieldErrors,
    submittedAt: Date.now(),
  };
}

function participantDocumentData(data, actor, { creating = false } = {}) {
  const document = {
    event_id: data.eventId,
    full_name: data.fullName,
    email: data.email,
    organization: data.organization,
    recipient_code: data.recipientCode,
    certificate_type: data.certificateType || null,
    status: data.status,
    normalized_name: normalizeParticipantText(data.fullName),
    normalized_email: normalizeParticipantText(data.email),
    normalized_recipient_code: normalizeParticipantText(data.recipientCode),
    dedupe_key: buildParticipantStrongDedupeKey(data),
    dedupe_keys: buildParticipantStrongDedupeKeys(data),
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor.id,
  };

  if (creating) {
    document.created_at = FieldValue.serverTimestamp();
    document.created_by = actor.id;
  }

  return document;
}

function revalidateParticipantViews() {
  revalidatePath("/admin/participants");
  revalidatePath("/admin/import");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/logs");
}

function hasStrongDuplicate(snapshot, data, excludedDocumentId = "") {
  const dedupeKeys = new Set(buildParticipantStrongDedupeKeys(data));
  if (!dedupeKeys.size) return false;

  return snapshot.docs.some((document) => {
    if (document.id === excludedDocumentId) return false;
    const documentData = document.data();
    const documentKeys = buildParticipantStrongDedupeKeys({
      email: documentData.email,
      recipientCode: documentData.recipient_code,
    });
    return documentKeys.some((key) => dedupeKeys.has(key));
  });
}

function hasNameDuplicate(snapshot, data, excludedDocumentId = "") {
  const nameKey = buildParticipantNameKey(data);
  return snapshot.docs.some((document) => {
    if (document.id === excludedDocumentId) return false;
    const documentData = document.data();
    return (documentData.normalized_name || normalizeParticipantText(documentData.full_name)) === nameKey;
  });
}

function duplicateNameState(message, confirmationNameKey) {
  return {
    status: "warning",
    message,
    errors: {},
    requiresNameConfirmation: true,
    confirmationNameKey,
    submittedAt: Date.now(),
  };
}

export async function createParticipantAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = parseParticipantForm(formData);

  if (!parsed.success) return validationState(parsed.error);

  const confirmationNameKey = buildParticipantNameKey(parsed.data);
  const allowNameDuplicate =
    formData.get("allowNameDuplicate") === "true"
    && _previousState?.requiresNameConfirmation === true
    && _previousState?.confirmationNameKey === confirmationNameKey;

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc(parsed.data.eventId);
    const participantReference = db.collection("participants").doc();
    const participantQuery = db
      .collection("participants")
      .where("event_id", "==", parsed.data.eventId);
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const [eventSnapshot, participantsSnapshot] = await Promise.all([
        transaction.get(eventReference),
        transaction.get(participantQuery),
      ]);

      if (!eventSnapshot.exists) throw new Error("EVENT_NOT_FOUND");

      if (hasStrongDuplicate(participantsSnapshot, parsed.data)) {
        throw new Error("PARTICIPANT_DUPLICATE");
      }
      if (!allowNameDuplicate && hasNameDuplicate(participantsSnapshot, parsed.data)) {
        throw new Error("PARTICIPANT_NAME_DUPLICATE");
      }

      transaction.set(
        participantReference,
        participantDocumentData(parsed.data, actor, { creating: true }),
      );
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "PARTICIPANT_CREATED",
          actor,
          entityId: participantReference.id,
          entityType: "PARTICIPANT",
          metadata: {
            name: parsed.data.fullName,
            eventId: parsed.data.eventId,
            certificateType: parsed.data.certificateType,
          },
        }),
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PARTICIPANT_NAME_DUPLICATE") {
      return duplicateNameState(
        "พบชื่อ–นามสกุลเหมือนกับผู้รับที่มีอยู่แล้ว หากเป็นคนละคนให้กดยืนยันเพิ่มชื่อซ้ำ",
        confirmationNameKey,
      );
    }
    return {
      status: "error",
      message:
        message === "EVENT_NOT_FOUND"
          ? "ไม่พบกิจกรรมที่เลือก"
          : message === "PARTICIPANT_DUPLICATE"
            ? "รหัสผู้รับหรืออีเมลนี้มีอยู่ในกิจกรรมแล้ว"
            : "ไม่สามารถเพิ่มผู้รับได้ กรุณาลองใหม่",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidateParticipantViews();
  return {
    status: "success",
    message: "เพิ่มผู้รับเกียรติบัตรเรียบร้อยแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}

export async function updateParticipantAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedId = documentIdSchema.safeParse(formData.get("participantId"));
  const parsed = parseParticipantForm(formData);

  if (!parsedId.success) {
    return { status: "error", message: "ไม่พบรหัสผู้รับ", errors: {}, submittedAt: Date.now() };
  }
  if (!parsed.success) return validationState(parsed.error);

  const confirmationNameKey = buildParticipantNameKey(parsed.data);
  const allowNameDuplicate =
    formData.get("allowNameDuplicate") === "true"
    && _previousState?.requiresNameConfirmation === true
    && _previousState?.confirmationNameKey === confirmationNameKey;

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc(parsed.data.eventId);
    const participantReference = db.collection("participants").doc(parsedId.data);
    const participantQuery = db
      .collection("participants")
      .where("event_id", "==", parsed.data.eventId);
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const [eventSnapshot, participantSnapshot, participantsSnapshot] = await Promise.all([
        transaction.get(eventReference),
        transaction.get(participantReference),
        transaction.get(participantQuery),
      ]);

      if (!eventSnapshot.exists) throw new Error("EVENT_NOT_FOUND");
      if (!participantSnapshot.exists) throw new Error("PARTICIPANT_NOT_FOUND");

      if (hasStrongDuplicate(participantsSnapshot, parsed.data, participantReference.id)) {
        throw new Error("PARTICIPANT_DUPLICATE");
      }
      if (
        !allowNameDuplicate
        && hasNameDuplicate(participantsSnapshot, parsed.data, participantReference.id)
      ) {
        throw new Error("PARTICIPANT_NAME_DUPLICATE");
      }

      transaction.update(participantReference, participantDocumentData(parsed.data, actor));
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "PARTICIPANT_UPDATED",
          actor,
          entityId: participantReference.id,
          entityType: "PARTICIPANT",
          metadata: {
            name: parsed.data.fullName,
            eventId: parsed.data.eventId,
            certificateType: parsed.data.certificateType,
          },
        }),
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PARTICIPANT_NAME_DUPLICATE") {
      return duplicateNameState(
        "พบชื่อ–นามสกุลเหมือนกับผู้รับรายอื่น หากยืนยันว่าเป็นคนละคนให้กดบันทึกชื่อซ้ำ",
        confirmationNameKey,
      );
    }
    return {
      status: "error",
      message:
        message === "PARTICIPANT_DUPLICATE"
          ? "รหัสผู้รับหรืออีเมลนี้ซ้ำกับผู้รับรายอื่นในกิจกรรม"
          : message === "EVENT_NOT_FOUND"
            ? "ไม่พบกิจกรรมที่เลือก"
            : message === "PARTICIPANT_NOT_FOUND"
              ? "ไม่พบผู้รับรายนี้ในระบบ"
              : "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidateParticipantViews();
  return {
    status: "success",
    message: "บันทึกข้อมูลผู้รับเรียบร้อยแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}

export async function deleteParticipantAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedId = documentIdSchema.safeParse(formData.get("participantId"));

  if (!parsedId.success) {
    return { status: "error", message: "ไม่พบรหัสผู้รับ", errors: {}, submittedAt: Date.now() };
  }

  try {
    const db = getFirebaseAdminDb();
    const participantReference = db.collection("participants").doc(parsedId.data);
    const certificateQuery = db
      .collection("certificates")
      .where("participant_id", "==", parsedId.data)
      .limit(1);
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const [snapshot, certificateSnapshot] = await Promise.all([
        transaction.get(participantReference),
        transaction.get(certificateQuery),
      ]);
      if (!snapshot.exists) throw new Error("PARTICIPANT_NOT_FOUND");
      if (!certificateSnapshot.empty) throw new Error("PARTICIPANT_HAS_CERTIFICATE");

      const data = snapshot.data();
      transaction.delete(participantReference);
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "PARTICIPANT_DELETED",
          actor,
          entityId: participantReference.id,
          entityType: "PARTICIPANT",
          metadata: { name: data.full_name ?? "", eventId: data.event_id ?? "" },
        }),
      );
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message === "PARTICIPANT_HAS_CERTIFICATE"
          ? "ไม่สามารถลบได้ เนื่องจากผู้รับรายนี้มีเกียรติบัตรอ้างอิงอยู่"
          : "ไม่สามารถลบผู้รับได้ หรือรายการนี้ไม่มีอยู่แล้ว",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidateParticipantViews();
  return {
    status: "success",
    message: "ลบผู้รับออกจากกิจกรรมแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}

export async function importParticipantsAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedEventId = documentIdSchema.safeParse(formData.get("eventId"));
  const importToken = String(formData.get("importToken") ?? "").slice(0, 200);
  const allowNameDuplicates =
    formData.get("allowNameDuplicates") === "true"
    && _previousState?.requiresNameConfirmation === true
    && _previousState?.importToken === importToken
    && _previousState?.eventId === parsedEventId.data;
  let submittedRows;

  try {
    submittedRows = JSON.parse(String(formData.get("rowsJson") ?? "[]"));
  } catch {
    submittedRows = null;
  }

  const parsedRows = importSchema.safeParse(submittedRows);
  if (!parsedEventId.success || !parsedRows.success) {
    return {
      status: "error",
      message: "ไฟล์หรือกิจกรรมไม่ถูกต้อง กรุณาตรวจสอบและอ่านไฟล์ใหม่",
      importedCount: 0,
      skippedCount: 0,
      importToken,
      submittedAt: Date.now(),
    };
  }

  const rows = parsedRows.data.map((row) => ({ ...row, eventId: parsedEventId.data }));
  const strongDedupeKeys = rows.flatMap(buildParticipantStrongDedupeKeys);
  if (new Set(strongDedupeKeys).size !== strongDedupeKeys.length) {
    return {
      status: "error",
      message: "พบรหัสผู้รับหรืออีเมลซ้ำภายในไฟล์ กรุณาแก้ไขก่อนนำเข้า",
      importedCount: 0,
      skippedCount: 0,
      importToken,
      submittedAt: Date.now(),
    };
  }

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc(parsedEventId.data);
    const participantQuery = db
      .collection("participants")
      .where("event_id", "==", parsedEventId.data);

    const result = await db.runTransaction(async (transaction) => {
      const [eventSnapshot, participantsSnapshot] = await Promise.all([
        transaction.get(eventReference),
        transaction.get(participantQuery),
      ]);

      if (!eventSnapshot.exists) throw new Error("EVENT_NOT_FOUND");

      const existingStrongKeys = new Set(
        participantsSnapshot.docs.flatMap((document) => {
          const data = document.data();
          return buildParticipantStrongDedupeKeys({
            email: data.email,
            recipientCode: data.recipient_code,
          });
        }),
      );
      const existingNameKeys = new Set(
        participantsSnapshot.docs.map((document) => {
          const data = document.data();
          return data.normalized_name || normalizeParticipantText(data.full_name);
        }),
      );
      const importableRows = rows.filter((row) => {
        const strongKeys = buildParticipantStrongDedupeKeys(row);
        return !strongKeys.some((key) => existingStrongKeys.has(key));
      });
      const seenNameKeys = new Set(existingNameKeys);
      const firstImportedRowByNameKey = new Map();
      const duplicateNamesByKey = new Map();
      let duplicateNameCount = 0;
      importableRows.forEach((row) => {
        const key = buildParticipantNameKey(row);
        const firstImportedRow = firstImportedRowByNameKey.get(key);
        if (seenNameKeys.has(key)) {
          duplicateNameCount += 1;
          const detail = duplicateNamesByKey.get(key) ?? {
            fullName: firstImportedRow?.fullName || row.fullName,
            sourceRows: [],
            matchesExisting: existingNameKeys.has(key),
          };
          if (firstImportedRow?.sourceRow && !detail.sourceRows.includes(firstImportedRow.sourceRow)) {
            detail.sourceRows.push(firstImportedRow.sourceRow);
          }
          if (row.sourceRow && !detail.sourceRows.includes(row.sourceRow)) {
            detail.sourceRows.push(row.sourceRow);
          }
          duplicateNamesByKey.set(key, detail);
        }
        if (!firstImportedRow) firstImportedRowByNameKey.set(key, row);
        seenNameKeys.add(key);
      });
      const duplicateNames = [...duplicateNamesByKey.values()].map((detail) => ({
        ...detail,
        sourceRows: detail.sourceRows.sort((left, right) => left - right),
      }));

      if (duplicateNameCount && !allowNameDuplicates) {
        return {
          requiresNameConfirmation: true,
          duplicateNameCount,
          duplicateNames,
          importedCount: 0,
          skippedCount: rows.length - importableRows.length,
        };
      }

      importableRows.forEach((row) => {
        const reference = db.collection("participants").doc();
        transaction.set(reference, participantDocumentData(row, actor, { creating: true }));
      });

      if (importableRows.length) {
        const auditReference = db.collection("auditLogs").doc();
        transaction.set(
          auditReference,
          createAuditLogData({
            action: "PARTICIPANTS_IMPORTED",
            actor,
            entityId: parsedEventId.data,
            entityType: "EVENT",
            metadata: {
              name: eventSnapshot.data().name ?? "",
              importedCount: importableRows.length,
              skippedCount: rows.length - importableRows.length,
              duplicateNameCount,
            },
          }),
        );
      }

      return {
        importedCount: importableRows.length,
        skippedCount: rows.length - importableRows.length,
        duplicateNameCount,
        duplicateNames,
      };
    });

    if (result.requiresNameConfirmation) {
      return {
        status: "warning",
        message: `พบชื่อ–นามสกุลซ้ำ ${result.duplicateNameCount.toLocaleString("th-TH")} รายการ ระบบยังไม่ได้บันทึก หากเป็นคนละคนให้กดยืนยันนำเข้าชื่อซ้ำ`,
        importedCount: 0,
        skippedCount: result.skippedCount,
        duplicateNameCount: result.duplicateNameCount,
        duplicateNames: result.duplicateNames,
        requiresNameConfirmation: true,
        importToken,
        eventId: parsedEventId.data,
        submittedAt: Date.now(),
      };
    }

    revalidateParticipantViews();
    return {
      status: "success",
      message: result.importedCount
        ? `นำเข้า ${result.importedCount.toLocaleString("th-TH")} รายการเรียบร้อยแล้ว${
            result.skippedCount
              ? ` และข้ามข้อมูลที่มีอยู่แล้ว ${result.skippedCount.toLocaleString("th-TH")} รายการ`
              : ""
          }`
        : "ไม่มีรายการใหม่ ข้อมูลทั้งหมดมีอยู่ในกิจกรรมแล้ว",
      ...result,
      importToken,
      submittedAt: Date.now(),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message === "EVENT_NOT_FOUND"
          ? "ไม่พบกิจกรรมที่เลือก"
          : "ไม่สามารถนำเข้ารายชื่อได้ กรุณาลองใหม่",
      importedCount: 0,
      skippedCount: 0,
      importToken,
      submittedAt: Date.now(),
    };
  }
}
