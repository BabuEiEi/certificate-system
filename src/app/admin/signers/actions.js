"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;
const documentIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const signerSchema = z.object({
  eventId: documentIdSchema,
  order: z.coerce.number().int().min(1).max(3),
  name: z.string().trim().min(2, "กรุณาระบุชื่อ–นามสกุลผู้ลงนาม").max(160, "ชื่อผู้ลงนามยาวเกินไป"),
  position: z.string().trim().min(2, "กรุณาระบุตำแหน่งผู้ลงนาม").max(160, "ตำแหน่งยาวเกินไป"),
});

function actionState(status, message, errors = {}) {
  return { status, message, errors, submittedAt: Date.now() };
}

function signerDocumentId(eventId, order) {
  return `${eventId}__${order}`;
}

function fileFromForm(formData) {
  const file = formData.get("signature");
  return file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size
    ? file
    : null;
}

function detectSignatureType(buffer) {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

async function validatedSignatureFile(file) {
  if (!file) return { file: null, error: "" };
  if (file.size > MAX_SIGNATURE_SIZE) {
    return { file: null, error: "ไฟล์ลายเซ็นต้องมีขนาดไม่เกิน 2 MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectSignatureType(buffer);
  if (!detectedType) {
    return { file: null, error: "รองรับเฉพาะไฟล์ลายเซ็น PNG, JPEG หรือ WebP" };
  }

  return {
    file: {
      buffer,
      size: buffer.length,
      ...detectedType,
    },
    error: "",
  };
}

function revalidateSignerViews() {
  revalidatePath("/admin/signers");
  revalidatePath("/admin/logs");
}

export async function saveSignerAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = signerSchema.safeParse({
    eventId: formData.get("eventId"),
    order: formData.get("order"),
    name: formData.get("name"),
    position: formData.get("position"),
  });

  if (!parsed.success) {
    return actionState(
      "error",
      "กรุณาตรวจสอบข้อมูลผู้ลงนาม",
      parsed.error.flatten().fieldErrors,
    );
  }

  let signature;
  try {
    signature = await validatedSignatureFile(fileFromForm(formData));
  } catch {
    return actionState("error", "ไม่สามารถอ่านไฟล์ลายเซ็นได้ กรุณาเลือกไฟล์ใหม่");
  }
  if (signature.error) {
    return actionState("error", "กรุณาตรวจสอบไฟล์ลายเซ็น", {
      signature: [signature.error],
    });
  }

  const db = getFirebaseAdminDb();
  const data = parsed.data;
  const signerId = signerDocumentId(data.eventId, data.order);
  const eventReference = db.collection("events").doc(data.eventId);
  const signerReference = db.collection("signers").doc(signerId);
  let eventSnapshot;
  let signerSnapshot;
  try {
    [eventSnapshot, signerSnapshot] = await Promise.all([
      eventReference.get(),
      signerReference.get(),
    ]);
  } catch {
    return actionState("error", "ไม่สามารถตรวจสอบข้อมูลผู้ลงนามได้ กรุณาลองใหม่");
  }

  if (!eventSnapshot.exists) {
    return actionState("error", "ไม่พบกิจกรรมที่ต้องการกำหนดผู้ลงนาม");
  }

  const previousData = signerSnapshot.data() ?? {};
  if (!signature.file && !previousData.image_path) {
    return actionState("error", "กรุณาเลือกไฟล์ลายเซ็น", {
      signature: ["ต้องมีไฟล์ลายเซ็นเมื่อบันทึกผู้ลงนามใหม่"],
    });
  }

  const bucket = getFirebaseAdminStorage().bucket();
  let uploadedPath = "";

  try {
    if (signature.file) {
      uploadedPath = [
        "signatures",
        data.eventId,
        signerId,
        `${Date.now()}-${randomUUID()}.${signature.file.extension}`,
      ].join("/");
      await bucket.file(uploadedPath).save(signature.file.buffer, {
        resumable: false,
        metadata: {
          contentType: signature.file.contentType,
          cacheControl: "private, no-store",
          metadata: {
            eventId: data.eventId,
            signerId,
            uploadedBy: actor.id,
          },
        },
      });
    }

    const signerDocument = {
      event_id: data.eventId,
      order: data.order,
      name: data.name,
      position: data.position,
      image_path: uploadedPath || previousData.image_path,
      image_content_type: signature.file?.contentType || previousData.image_content_type || "",
      image_size: signature.file?.size || previousData.image_size || 0,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.id,
    };

    if (!signerSnapshot.exists) {
      signerDocument.created_at = FieldValue.serverTimestamp();
      signerDocument.created_by = actor.id;
    }

    const batch = db.batch();
    batch.set(signerReference, signerDocument, { merge: true });
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: signerSnapshot.exists ? "SIGNER_UPDATED" : "SIGNER_CREATED",
        actor,
        entityId: signerId,
        entityType: "SIGNER",
        metadata: {
          name: data.name,
          eventId: data.eventId,
          eventName: eventSnapshot.data()?.name ?? "",
          order: data.order,
        },
      }),
    );
    await batch.commit();
  } catch {
    if (uploadedPath) {
      await bucket.file(uploadedPath).delete({ ignoreNotFound: true }).catch(() => {});
    }
    return actionState("error", "ไม่สามารถบันทึกผู้ลงนามได้ กรุณาลองใหม่");
  }

  if (uploadedPath && previousData.image_path && previousData.image_path !== uploadedPath) {
    await bucket.file(previousData.image_path).delete({ ignoreNotFound: true }).catch(() => {});
  }

  revalidateSignerViews();
  return actionState("success", "บันทึกข้อมูลผู้ลงนามเรียบร้อยแล้ว");
}

export async function deleteSignerAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedEventId = documentIdSchema.safeParse(formData.get("eventId"));
  const parsedOrder = z.coerce.number().int().min(1).max(3).safeParse(formData.get("order"));

  if (!parsedEventId.success || !parsedOrder.success) {
    return actionState("error", "ข้อมูลผู้ลงนามที่ต้องการลบไม่ถูกต้อง");
  }

  const signerId = signerDocumentId(parsedEventId.data, parsedOrder.data);
  const db = getFirebaseAdminDb();
  const signerReference = db.collection("signers").doc(signerId);
  let signerSnapshot;
  try {
    signerSnapshot = await signerReference.get();
  } catch {
    return actionState("error", "ไม่สามารถตรวจสอบข้อมูลผู้ลงนามได้ กรุณาลองใหม่");
  }
  const signerData = signerSnapshot.data();

  if (!signerSnapshot.exists || signerData?.event_id !== parsedEventId.data) {
    return actionState("error", "ไม่พบข้อมูลผู้ลงนาม หรือรายการถูกลบแล้ว");
  }

  try {
    const batch = db.batch();
    batch.delete(signerReference);
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "SIGNER_DELETED",
        actor,
        entityId: signerId,
        entityType: "SIGNER",
        metadata: {
          name: signerData.name ?? "",
          eventId: signerData.event_id,
          order: signerData.order,
        },
      }),
    );
    await batch.commit();

    if (signerData.image_path) {
      await getFirebaseAdminStorage()
        .bucket()
        .file(signerData.image_path)
        .delete({ ignoreNotFound: true })
        .catch(() => {});
    }
  } catch {
    return actionState("error", "ไม่สามารถลบผู้ลงนามได้ กรุณาลองใหม่");
  }

  revalidateSignerViews();
  return actionState("success", "ลบข้อมูลผู้ลงนามเรียบร้อยแล้ว");
}
