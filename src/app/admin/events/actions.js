"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

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
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม",
    path: ["endDate"],
  });

const eventIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

function parseEventForm(formData) {
  return eventSchema.safeParse({
    name: formData.get("name"),
    issuerName: formData.get("issuerName"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
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

function eventDocumentData(data, actor, { creating = false } = {}) {
  const document = {
    name: data.name,
    issuer_name: data.issuerName,
    description: data.description,
    start_date: data.startDate,
    end_date: data.endDate,
    status: data.status,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor.id,
  };

  if (creating) {
    document.created_at = FieldValue.serverTimestamp();
    document.created_by = actor.id;
  }

  return document;
}

function revalidateEventViews() {
  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/logs");
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

  try {
    const db = getFirebaseAdminDb();
    const eventReference = db.collection("events").doc(parsedId.data);
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventReference);

      if (!snapshot.exists) throw new Error("EVENT_NOT_FOUND");

      transaction.update(eventReference, eventDocumentData(parsed.data, actor));
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
