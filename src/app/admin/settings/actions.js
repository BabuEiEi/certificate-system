"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAuditLogData } from "@/lib/audit";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";

const documentIdSchema = z.string().trim().min(1).max(128);
const roleSchema = z.enum(["ADMIN", "STAFF"], { message: "บทบาทไม่ถูกต้อง" });

const createUserSchema = z.object({
  email: z.string().trim().email("กรุณาระบุอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128),
  displayName: z.string().trim().min(2, "กรุณาระบุชื่อผู้ใช้งาน").max(160),
  role: roleSchema,
});

function actionState(status, message, errors = {}) {
  return { status, message, errors, submittedAt: Date.now() };
}

function revalidateUserViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/logs");
}

export async function createUserAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return actionState("error", "กรุณาตรวจสอบข้อมูลผู้ใช้งาน", parsed.error.flatten().fieldErrors);
  }

  const { email, password, displayName, role } = parsed.data;
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminDb();

  let uid;
  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    uid = userRecord.uid;
  } catch (error) {
    const message =
      error?.errorInfo?.code === "auth/email-already-exists"
        ? "อีเมลนี้มีบัญชีผู้ใช้งานอยู่แล้ว"
        : "ไม่สามารถสร้างบัญชีผู้ใช้งานได้ กรุณาลองใหม่";
    return actionState("error", message, { email: [message] });
  }

  try {
    const batch = db.batch();
    batch.set(db.collection("profiles").doc(uid), {
      role,
      is_active: true,
      display_name: displayName,
      created_at: FieldValue.serverTimestamp(),
      created_by: actor.id,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.id,
    });
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "USER_CREATED",
        actor,
        entityId: uid,
        entityType: "USER",
        metadata: { email, role, displayName },
      }),
    );
    await batch.commit();
  } catch {
    await auth.deleteUser(uid).catch(() => {});
    return actionState("error", "ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้ กรุณาลองใหม่");
  }

  revalidateUserViews();
  return actionState("success", "สร้างบัญชีผู้ใช้งานเรียบร้อยแล้ว");
}

export async function updateUserRoleAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedUserId = documentIdSchema.safeParse(formData.get("userId"));
  const parsedRole = roleSchema.safeParse(formData.get("role"));

  if (!parsedUserId.success || !parsedRole.success) {
    return actionState("error", "ข้อมูลที่ต้องการแก้ไขไม่ถูกต้อง");
  }

  if (parsedUserId.data === actor.id) {
    return actionState("error", "ไม่สามารถเปลี่ยนบทบาทของบัญชีตนเองได้");
  }

  const db = getFirebaseAdminDb();
  try {
    const batch = db.batch();
    batch.set(
      db.collection("profiles").doc(parsedUserId.data),
      { role: parsedRole.data, updated_at: FieldValue.serverTimestamp(), updated_by: actor.id },
      { merge: true },
    );
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "USER_ROLE_UPDATED",
        actor,
        entityId: parsedUserId.data,
        entityType: "USER",
        metadata: { role: parsedRole.data },
      }),
    );
    await batch.commit();
  } catch {
    return actionState("error", "ไม่สามารถแก้ไขบทบาทได้ กรุณาลองใหม่");
  }

  revalidateUserViews();
  return actionState("success", "แก้ไขบทบาทเรียบร้อยแล้ว");
}

export async function setUserActiveAction(_previousState, formData) {
  const actor = await requireAdmin();
  const parsedUserId = documentIdSchema.safeParse(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";

  if (!parsedUserId.success) {
    return actionState("error", "ข้อมูลที่ต้องการแก้ไขไม่ถูกต้อง");
  }

  if (parsedUserId.data === actor.id) {
    return actionState("error", "ไม่สามารถระงับบัญชีตนเองได้");
  }

  const db = getFirebaseAdminDb();
  try {
    await getFirebaseAdminAuth().updateUser(parsedUserId.data, { disabled: !isActive });

    const batch = db.batch();
    batch.set(
      db.collection("profiles").doc(parsedUserId.data),
      { is_active: isActive, updated_at: FieldValue.serverTimestamp(), updated_by: actor.id },
      { merge: true },
    );
    batch.set(
      db.collection("auditLogs").doc(),
      createAuditLogData({
        action: "USER_ACTIVE_UPDATED",
        actor,
        entityId: parsedUserId.data,
        entityType: "USER",
        metadata: { isActive },
      }),
    );
    await batch.commit();
  } catch {
    return actionState("error", "ไม่สามารถแก้ไขสถานะบัญชีได้ กรุณาลองใหม่");
  }

  revalidateUserViews();
  return actionState("success", isActive ? "เปิดใช้งานบัญชีเรียบร้อยแล้ว" : "ระงับบัญชีเรียบร้อยแล้ว");
}
