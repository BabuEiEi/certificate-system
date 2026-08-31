"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import {
  EVENT_DELETION_STATUS,
  matchesDeletionConfirmation,
} from "@/lib/deletion";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import {
  deleteDocumentReferences,
  deleteStoragePrefixes,
  getAuditReferencesForEvent,
} from "@/lib/firebase/purge";

const eventSchema = z
  .object({
    name: z.string().trim().min(3, "กรุณาระบุชื่ออย่างน้อย 3 ตัวอักษร").max(160, "ชื่อกิจกรรมยาวเกินไป"),
    issuerName: z.string().trim().min(2, "กรุณาระบุหน่วยงานผู้ออก").max(160, "ชื่อหน่วยงานยาวเกินไป"),
    description: z.string().trim().max(1000, "รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันที่เริ่ม"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันที่สิ้นสุด"),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"], {
      message: "สถานะกิจกรรมไม่ถูกต้อง",
    }),
    signerCount: z.coerce.number().int().min(1, "อย่างน้อย 1 คน").max(3, "สูงสุด 3 คน"),
    certDisplayPrefix: z.string().trim().max(40, "ข้อความนำหน้ายาวเกินไป"),
    certPrefix: z.string().trim().max(40, "Prefix ยาวเกินไป"),
    certRunningNumber: z.coerce.number().int().min(1, "เลขเริ่มต้นต้องไม่น้อยกว่า 1").max(999999999999),
    certNumberDigits: z.coerce.number().int().min(1).max(12, "จำนวนหลักต้องไม่เกิน 12"),
    certSeparator: z.string().max(3, "ตัวคั่นต้องไม่เกิน 3 ตัวอักษร"),
    certYear: z.string().trim().regex(/^\d{4}$/, "กรุณาระบุปีเป็นตัวเลข 4 หลัก"),
    certNumberFormat: z.enum(["THAI", "ARABIC"], { message: "รูปแบบตัวเลขไม่ถูกต้อง" }),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม",
    path: ["endDate"],
  });

const eventIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const deleteEventSchema = z.object({
  eventId: eventIdSchema,
  confirmationName: z.string().trim().min(1).max(160),
});

function parseEventForm(formData) {
  return eventSchema.safeParse({
    name: formData.get("name"),
    issuerName: formData.get("issuerName"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
    signerCount: formData.get("signerCount"),
    certDisplayPrefix: formData.get("certDisplayPrefix") ?? "",
    certPrefix: formData.get("certPrefix") ?? "",
    certRunningNumber: formData.get("certRunningNumber"),
    certNumberDigits: formData.get("certNumberDigits"),
    certSeparator: formData.get("certSeparator") ?? "",
    certYear: formData.get("certYear"),
    certNumberFormat: formData.get("certNumberFormat"),
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

function eventDocumentData(data, actor, { creating = false, skipRunningNumber = false } = {}) {
  const document = {
    name: data.name,
    issuer_name: data.issuerName,
    description: data.description,
    start_date: data.startDate,
    end_date: data.endDate,
    status: data.status,
    signer_count: data.signerCount,
    display_prefix: data.certDisplayPrefix,
    prefix: data.certPrefix,
    number_digits: data.certNumberDigits,
    separator: data.certSeparator,
    year: data.certYear,
    number_format: data.certNumberFormat,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor.id,
  };

  // The running number keeps advancing every time a certificate is issued
  // (see issueSingleCertificate). Only stamp it here on creation, or when
  // the admin has deliberately changed it in the form -- otherwise a routine
  // edit (e.g. renaming the event) made from a stale page would silently
  // roll back an already-advanced counter and cause duplicate numbers.
  if (creating || !skipRunningNumber) {
    document.next_number = data.certRunningNumber;
  }

  if (creating) {
    document.created_at = FieldValue.serverTimestamp();
    document.created_by = actor.id;
  }

  return document;
}

function revalidateEventViews() {
  revalidatePath("/admin/events");
  revalidatePath("/admin/participants");
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/templates");
  revalidatePath("/admin/signers");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/logs");
  revalidatePath("/");
  revalidatePath("/search");
}

function actionState(status, message, extra = {}) {
  return { status, message, errors: {}, submittedAt: Date.now(), ...extra };
}

async function countEventDocuments(db, collectionName, eventId) {
  const snapshot = await db
    .collection(collectionName)
    .where("event_id", "==", eventId)
    .count()
    .get();
  return snapshot.data().count;
}

export async function getEventDeletionPreviewAction(rawEventId) {
  await requireAdmin();
  const parsedId = eventIdSchema.safeParse(rawEventId);
  if (!parsedId.success) return actionState("error", "ไม่พบรหัสกิจกรรมที่ต้องการลบ");

  try {
    const db = getFirebaseAdminDb();
    const eventSnapshot = await db.collection("events").doc(parsedId.data).get();
    if (!eventSnapshot.exists) return actionState("error", "ไม่พบกิจกรรมนี้ในระบบ");

    const [participants, certificates, templates, signers] = await Promise.all([
      countEventDocuments(db, "participants", parsedId.data),
      countEventDocuments(db, "certificates", parsedId.data),
      countEventDocuments(db, "templates", parsedId.data),
      countEventDocuments(db, "signers", parsedId.data),
    ]);

    return actionState("success", "", {
      eventName: eventSnapshot.data()?.name ?? "",
      counts: { participants, certificates, templates, signers },
    });
  } catch {
    return actionState("error", "ไม่สามารถตรวจสอบข้อมูลที่เกี่ยวข้องได้ กรุณาลองใหม่");
  }
}

async function markEventDeletionFailed(eventReference) {
  await eventReference.set(
    {
      deletion_status: "FAILED",
      deletion_failed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  ).catch(() => {});
}

export async function createEventAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = parseEventForm(formData);

  if (!parsed.success) return validationState(parsed.error);

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc();
    const auditReference = db.collection("auditLogs").doc();
    const batch = db.batch();

    batch.set(eventReference, eventDocumentData(parsed.data, actor, { creating: true }));
    batch.set(
      auditReference,
      createAuditLogData({
        action: "EVENT_CREATED",
        actor,
        entityId: eventReference.id,
        entityType: "EVENT",
        metadata: { name: parsed.data.name, status: parsed.data.status },
      }),
    );

    await batch.commit();
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถสร้างกิจกรรมได้ กรุณาลองใหม่",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidateEventViews();

  return {
    status: "success",
    message: "สร้างกิจกรรมเรียบร้อยแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}

export async function updateEventAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedId = eventIdSchema.safeParse(formData.get("eventId"));
  const parsed = parseEventForm(formData);

  if (!parsedId.success) {
    return {
      status: "error",
      message: "ไม่พบรหัสกิจกรรมที่ต้องการแก้ไข",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  if (!parsed.success) return validationState(parsed.error);

  const originalRunningNumberRaw = formData.get("certRunningNumberOriginal");
  const skipRunningNumber =
    originalRunningNumberRaw !== null && Number(originalRunningNumberRaw) === parsed.data.certRunningNumber;

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc(parsedId.data);
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventReference);

      if (!snapshot.exists) throw new Error("EVENT_NOT_FOUND");
      if (snapshot.data()?.deletion_status) throw new Error("EVENT_DELETION_LOCKED");

      transaction.update(eventReference, eventDocumentData(parsed.data, actor, { skipRunningNumber }));
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "EVENT_UPDATED",
          actor,
          entityId: eventReference.id,
          entityType: "EVENT",
          metadata: { name: parsed.data.name, status: parsed.data.status },
        }),
      );
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message === "EVENT_NOT_FOUND"
          ? "ไม่พบกิจกรรมนี้ในระบบ"
          : error instanceof Error && error.message === "EVENT_DELETION_LOCKED"
            ? "กิจกรรมนี้อยู่ระหว่างการลบ จึงไม่สามารถแก้ไขได้"
          : "ไม่สามารถบันทึกกิจกรรมได้ กรุณาลองใหม่",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidateEventViews();

  return {
    status: "success",
    message: "บันทึกการแก้ไขเรียบร้อยแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}

export async function deleteEventAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = deleteEventSchema.safeParse({
    eventId: formData.get("eventId"),
    confirmationName: formData.get("confirmationName"),
  });
  if (!parsed.success) return actionState("error", "ข้อมูลยืนยันการลบกิจกรรมไม่ถูกต้อง");

  const db = getFirebaseAdminDb();
  const storage = getFirebaseAdminStorage();
  const eventReference = db.collection("events").doc(parsed.data.eventId);
  let eventName = "";
  let deletionPhase = "LOCK_EVENT";

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventReference);
      if (!snapshot.exists) throw new Error("EVENT_NOT_FOUND");

      eventName = snapshot.data()?.name ?? "";
      if (!matchesDeletionConfirmation(parsed.data.confirmationName, eventName)) {
        throw new Error("CONFIRMATION_MISMATCH");
      }

      transaction.set(
        eventReference,
        {
          deletion_status: EVENT_DELETION_STATUS,
          deletion_started_at: FieldValue.serverTimestamp(),
          deletion_started_by: actor.id,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    deletionPhase = "LOAD_RELATED_DATA";
    const [
      participantSnapshot,
      certificateSnapshot,
      templateSnapshot,
      signerSnapshot,
      publishedSnapshot,
    ] =
      await Promise.all([
        db.collection("participants").where("event_id", "==", parsed.data.eventId).get(),
        db.collection("certificates").where("event_id", "==", parsed.data.eventId).get(),
        db.collection("templates").where("event_id", "==", parsed.data.eventId).get(),
        db.collection("signers").where("event_id", "==", parsed.data.eventId).get(),
        db.collection("publishedCertificates").where("event_id", "==", parsed.data.eventId).get(),
      ]);

    deletionPhase = "LOAD_AUDIT_LOGS";
    const relatedDocuments = [
      ...participantSnapshot.docs,
      ...certificateSnapshot.docs,
      ...templateSnapshot.docs,
      ...signerSnapshot.docs,
    ];
    const entityIds = relatedDocuments.map((document) => document.id);
    const auditReferences = await getAuditReferencesForEvent(db, parsed.data.eventId, entityIds);
    const publishedReferences = [
      ...publishedSnapshot.docs.map((document) => document.ref),
      ...certificateSnapshot.docs.map((document) =>
        db.collection("publishedCertificates").doc(document.id),
      ),
    ];

    deletionPhase = "DELETE_STORAGE_FILES";
    await deleteStoragePrefixes(storage, [
      `certificates/${parsed.data.eventId}/`,
      `templates/${parsed.data.eventId}/`,
      `signatures/${parsed.data.eventId}/`,
    ]);

    deletionPhase = "DELETE_RELATED_DOCUMENTS";
    await deleteDocumentReferences(db, [
      ...relatedDocuments.map((document) => document.ref),
      ...publishedReferences,
      ...auditReferences,
    ]);

    deletionPhase = "FINALIZE_EVENT_DELETION";
    const finalBatch = db.batch();
    finalBatch.delete(eventReference);
    finalBatch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "EVENT_PURGED",
        actor,
        entityId: parsed.data.eventId,
        entityType: "EVENT",
        eventId: parsed.data.eventId,
        metadata: {
          name: eventName,
          participantsDeleted: participantSnapshot.size,
          certificatesDeleted: certificateSnapshot.size,
          templatesDeleted: templateSnapshot.size,
          signersDeleted: signerSnapshot.size,
        },
      }),
    );
    await finalBatch.commit();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Event deletion failed", {
      eventId: parsed.data.eventId,
      phase: deletionPhase,
      code: error?.code,
      error,
    });
    if (message !== "EVENT_NOT_FOUND" && message !== "CONFIRMATION_MISMATCH") {
      await markEventDeletionFailed(eventReference);
    }
    const phaseMessage =
      deletionPhase === "DELETE_STORAGE_FILES"
        ? "ไม่สามารถลบไฟล์ของกิจกรรมจาก Storage ได้ กรุณาตรวจสิทธิ์ของ Firebase Storage แล้วลองซ้ำ"
        : deletionPhase === "LOAD_RELATED_DATA" || deletionPhase === "LOAD_AUDIT_LOGS"
          ? "ไม่สามารถอ่านข้อมูลที่เกี่ยวข้องจาก Firestore ได้ กรุณาตรวจดัชนีและสิทธิ์ของ Firebase แล้วลองซ้ำ"
          : deletionPhase === "DELETE_RELATED_DOCUMENTS" || deletionPhase === "FINALIZE_EVENT_DELETION"
            ? "ลบข้อมูลบางส่วนไม่สำเร็จ ระบบล็อกกิจกรรมไว้แล้ว กรุณากดลบซ้ำเพื่อดำเนินการต่อ"
            : "ลบกิจกรรมไม่สำเร็จ ระบบล็อกกิจกรรมไว้เพื่อความปลอดภัย กรุณาลองลบซ้ำ";
    return actionState(
      "error",
      message === "EVENT_NOT_FOUND"
        ? "ไม่พบกิจกรรมนี้ในระบบ หรือรายการถูกลบแล้ว"
        : message === "CONFIRMATION_MISMATCH"
          ? "ชื่อกิจกรรมที่พิมพ์ไม่ตรงกัน ระบบยังไม่ได้ลบข้อมูล"
          : phaseMessage,
    );
  }

  revalidateEventViews();
  return actionState("success", "ลบกิจกรรมและข้อมูลที่เกี่ยวข้องทั้งหมดเรียบร้อยแล้ว");
}
