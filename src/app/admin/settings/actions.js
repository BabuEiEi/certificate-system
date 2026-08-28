"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

const settingsSchema = z.object({
  displayPrefix: z.string().trim().max(40, "ข้อความนำหน้ายาวเกินไป"),
  prefix: z.string().trim().max(40, "Prefix ยาวเกินไป"),
  runningNumber: z.coerce.number().int().min(1, "เลขเริ่มต้นต้องไม่น้อยกว่า 1").max(999999999999),
  numberDigits: z.coerce.number().int().min(1).max(12, "จำนวนหลักต้องไม่เกิน 12"),
  separator: z.string().max(3, "ตัวคั่นต้องไม่เกิน 3 ตัวอักษร"),
  year: z.string().trim().regex(/^\d{4}$/, "กรุณาระบุปีเป็นตัวเลข 4 หลัก"),
  numberFormat: z.enum(["THAI", "ARABIC"], { message: "รูปแบบตัวเลขไม่ถูกต้อง" }),
});

export async function saveCertificateSettingsAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    displayPrefix: formData.get("displayPrefix"),
    prefix: formData.get("prefix"),
    runningNumber: formData.get("runningNumber"),
    numberDigits: formData.get("numberDigits"),
    separator: formData.get("separator"),
    year: formData.get("year"),
    numberFormat: formData.get("numberFormat"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจสอบการตั้งค่า",
      errors: parsed.error.flatten().fieldErrors,
      submittedAt: Date.now(),
    };
  }

  try {
    const db = getFirebaseAdminDb();
    const settingsReference = db.collection("certificateSettings").doc("default");
    const auditReference = db.collection("auditLogs").doc();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(settingsReference);
      const data = parsed.data;
      const settingsDocument = {
        display_prefix: data.displayPrefix,
        prefix: data.prefix,
        next_number: data.runningNumber,
        number_digits: data.numberDigits,
        separator: data.separator,
        year: data.year,
        number_format: data.numberFormat,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: actor.id,
      };

      if (!snapshot.exists) {
        settingsDocument.created_at = FieldValue.serverTimestamp();
        settingsDocument.created_by = actor.id;
      }

      transaction.set(settingsReference, settingsDocument, { merge: true });
      transaction.set(
        auditReference,
        createAuditLogData({
          action: "SETTINGS_UPDATED",
          actor,
          entityId: "default",
          entityType: "CERTIFICATE_SETTINGS",
          metadata: {
            number_format: data.numberFormat,
            prefix: data.prefix,
            year: data.year,
          },
        }),
      );
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่",
      errors: {},
      submittedAt: Date.now(),
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/logs");

  return {
    status: "success",
    message: "บันทึกการตั้งค่าเรียบร้อยแล้ว",
    errors: {},
    submittedAt: Date.now(),
  };
}
