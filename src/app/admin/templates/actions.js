"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import {
  TEMPLATE_CERTIFICATE_TYPE_VALUES,
  getTemplateCertificateTypeLabel,
  normalizePlacements,
} from "@/lib/templateFields";

const MAX_TEMPLATE_FILE_SIZE = 5 * 1024 * 1024;
const documentIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const templateSchema = z.object({
  eventId: documentIdSchema,
  certificateType: z.enum(TEMPLATE_CERTIFICATE_TYPE_VALUES),
});

function actionState(status, message, errors = {}) {
  return { status, message, errors, submittedAt: Date.now() };
}

function templateDocumentId(eventId, certificateType) {
  return `${eventId}__${certificateType}`;
}

function fileFromForm(formData) {
  const file = formData.get("template");
  return file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size
    ? file
    : null;
}

function parsePlacements(formData) {
  const raw = formData.get("placements");
  if (!raw) return { placements: {}, error: "" };

  try {
    const parsed = JSON.parse(String(raw));
    return { placements: normalizePlacements(parsed), error: "" };
  } catch {
    return { placements: {}, error: "ไม่สามารถอ่านตำแหน่งข้อความบนแม่แบบได้" };
  }
}

function detectTemplateFileType(buffer) {
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

  // WebP and PDF are intentionally not accepted for new uploads: a PDF
  // template must be rasterized via pdfjs-dist before compositing, which is
  // fragile to bundle correctly in a production build (see next.config.js).
  // Existing PDF templates uploaded before this change keep working --
  // src/lib/certificate/render.js still knows how to rasterize them -- only
  // new uploads are restricted to PNG/JPEG.
  return null;
}

async function validatedTemplateFile(file) {
  if (!file) return { file: null, error: "" };
  if (file.size > MAX_TEMPLATE_FILE_SIZE) {
    return { file: null, error: "ไฟล์แม่แบบต้องมีขนาดไม่เกิน 5 MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectTemplateFileType(buffer);
  if (!detectedType) {
    return { file: null, error: "รองรับเฉพาะไฟล์แม่แบบ PNG หรือ JPEG" };
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

function revalidateTemplateViews() {
  revalidatePath("/admin/templates");
  revalidatePath("/admin/logs");
}

export async function saveTemplateAction(_previousState, formData) {
  const actor = await requireStaff();
  const parsed = templateSchema.safeParse({
    eventId: formData.get("eventId"),
    certificateType: formData.get("certificateType"),
  });

  if (!parsed.success) {
    return actionState(
      "error",
      "กรุณาตรวจสอบข้อมูลแม่แบบ",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { placements, error: placementsError } = parsePlacements(formData);
  if (placementsError) {
    return actionState("error", placementsError);
  }

  let templateFile;
  try {
    templateFile = await validatedTemplateFile(fileFromForm(formData));
  } catch {
    return actionState("error", "ไม่สามารถอ่านไฟล์แม่แบบได้ กรุณาเลือกไฟล์ใหม่");
  }
  if (templateFile.error) {
    return actionState("error", "กรุณาตรวจสอบไฟล์แม่แบบ", {
      file: [templateFile.error],
    });
  }

  const db = getFirebaseAdminDb();
  const data = parsed.data;
  const templateId = templateDocumentId(data.eventId, data.certificateType);
  const eventReference = db.collection("events").doc(data.eventId);
  const templateReference = db.collection("templates").doc(templateId);
  let eventSnapshot;
  let templateSnapshot;
  try {
    [eventSnapshot, templateSnapshot] = await Promise.all([
      eventReference.get(),
      templateReference.get(),
    ]);
  } catch {
    return actionState("error", "ไม่สามารถตรวจสอบข้อมูลแม่แบบได้ กรุณาลองใหม่");
  }

  if (!eventSnapshot.exists) {
    return actionState("error", "ไม่พบกิจกรรมที่ต้องการกำหนดแม่แบบ");
  }

  const previousData = templateSnapshot.data() ?? {};
  if (!templateFile.file && !previousData.file_path) {
    return actionState("error", "กรุณาเลือกไฟล์แม่แบบ", {
      file: ["ต้องมีไฟล์แม่แบบเมื่อสร้างรายการใหม่"],
    });
  }

  const bucket = getFirebaseAdminStorage().bucket();
  let uploadedPath = "";

  try {
    if (templateFile.file) {
      uploadedPath = [
        "templates",
        data.eventId,
        data.certificateType,
        `${Date.now()}-${randomUUID()}.${templateFile.file.extension}`,
      ].join("/");
      await bucket.file(uploadedPath).save(templateFile.file.buffer, {
        resumable: false,
        metadata: {
          contentType: templateFile.file.contentType,
          cacheControl: "private, no-store",
          metadata: {
            eventId: data.eventId,
            certificateType: data.certificateType,
            uploadedBy: actor.id,
          },
        },
      });
    }

    const templateDocument = {
      event_id: data.eventId,
      certificate_type: data.certificateType,
      file_path: uploadedPath || previousData.file_path,
      file_content_type: templateFile.file?.contentType || previousData.file_content_type || "",
      file_size: templateFile.file?.size || previousData.file_size || 0,
      placements: Object.values(placements),
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.id,
    };

    if (!templateSnapshot.exists) {
      templateDocument.created_at = FieldValue.serverTimestamp();
      templateDocument.created_by = actor.id;
    }

    const batch = db.batch();
    batch.set(templateReference, templateDocument, { merge: true });
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: templateSnapshot.exists ? "TEMPLATE_UPDATED" : "TEMPLATE_CREATED",
        actor,
        entityId: templateId,
        entityType: "TEMPLATE",
        metadata: {
          eventId: data.eventId,
          eventName: eventSnapshot.data()?.name ?? "",
          certificateType: data.certificateType,
          certificateTypeLabel: getTemplateCertificateTypeLabel(data.certificateType),
        },
      }),
    );
    await batch.commit();
  } catch {
    if (uploadedPath) {
      await bucket.file(uploadedPath).delete({ ignoreNotFound: true }).catch(() => {});
    }
    return actionState("error", "ไม่สามารถบันทึกแม่แบบได้ กรุณาลองใหม่");
  }

  if (uploadedPath && previousData.file_path && previousData.file_path !== uploadedPath) {
    await bucket.file(previousData.file_path).delete({ ignoreNotFound: true }).catch(() => {});
  }

  revalidateTemplateViews();
  return actionState("success", "บันทึกแม่แบบเกียรติบัตรเรียบร้อยแล้ว");
}

export async function deleteTemplateAction(_previousState, formData) {
  const actor = await requireStaff();
  const parsedEventId = documentIdSchema.safeParse(formData.get("eventId"));
  const parsedCertificateType = z
    .enum(TEMPLATE_CERTIFICATE_TYPE_VALUES)
    .safeParse(formData.get("certificateType"));

  if (!parsedEventId.success || !parsedCertificateType.success) {
    return actionState("error", "ข้อมูลแม่แบบที่ต้องการลบไม่ถูกต้อง");
  }

  const templateId = templateDocumentId(parsedEventId.data, parsedCertificateType.data);
  const db = getFirebaseAdminDb();
  const templateReference = db.collection("templates").doc(templateId);
  let templateSnapshot;
  try {
    templateSnapshot = await templateReference.get();
  } catch {
    return actionState("error", "ไม่สามารถตรวจสอบข้อมูลแม่แบบได้ กรุณาลองใหม่");
  }
  const templateData = templateSnapshot.data();

  if (!templateSnapshot.exists || templateData?.event_id !== parsedEventId.data) {
    return actionState("error", "ไม่พบแม่แบบ หรือรายการถูกลบแล้ว");
  }

  try {
    const batch = db.batch();
    batch.delete(templateReference);
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "TEMPLATE_DELETED",
        actor,
        entityId: templateId,
        entityType: "TEMPLATE",
        metadata: {
          eventId: templateData.event_id,
          certificateType: templateData.certificate_type,
          certificateTypeLabel: getTemplateCertificateTypeLabel(templateData.certificate_type),
        },
      }),
    );
    await batch.commit();

    if (templateData.file_path) {
      await getFirebaseAdminStorage()
        .bucket()
        .file(templateData.file_path)
        .delete({ ignoreNotFound: true })
        .catch(() => {});
    }
  } catch {
    return actionState("error", "ไม่สามารถลบแม่แบบได้ กรุณาลองใหม่");
  }

  revalidateTemplateViews();
  return actionState("success", "ลบแม่แบบเกียรติบัตรเรียบร้อยแล้ว");
}
