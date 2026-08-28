import "server-only";

import { z } from "zod";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/config";
import { normalizeSearchTerm } from "@/lib/firebase/search";

const searchSchema = z.string().trim().min(2).max(100);
const tokenSchema = z.uuid();

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeCertificate(snapshot) {
  const data = snapshot.data();
  return {
    ...data,
    certificate_id: data.certificate_id ?? snapshot.id,
    verification_token: data.verification_token ?? snapshot.id,
    issued_at: serializeTimestamp(data.issued_at),
    published_at: serializeTimestamp(data.published_at),
    revoked_at: serializeTimestamp(data.revoked_at),
  };
}

export async function searchPublishedCertificates(rawQuery) {
  const parsed = searchSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return {
      status: rawQuery?.trim() ? "invalid" : "idle",
      items: [],
      message: rawQuery?.trim() ? "กรุณาระบุคำค้นอย่างน้อย 2 ตัวอักษร" : "",
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return {
      status: "unavailable",
      items: [],
      message: "ระบบค้นหายังไม่ได้เชื่อมต่อ Firebase",
    };
  }

  try {
    const snapshot = await getFirebaseAdminDb()
      .collection("publishedCertificates")
      .where("search_terms", "array-contains", normalizeSearchTerm(parsed.data))
      .orderBy("issued_at", "desc")
      .limit(20)
      .get();

    return {
      status: "success",
      items: snapshot.docs.map(serializeCertificate),
      message: "",
    };
  } catch {
    return {
      status: "error",
      items: [],
      message: "ไม่สามารถค้นหาข้อมูลได้ในขณะนี้",
    };
  }
}

export async function getPublishedCertificateByToken(rawToken) {
  const parsed = tokenSchema.safeParse(rawToken);

  if (!parsed.success || !isFirebaseAdminConfigured()) return null;

  try {
    const snapshot = await getFirebaseAdminDb()
      .collection("publishedCertificates")
      .doc(parsed.data)
      .get();

    return snapshot.exists ? serializeCertificate(snapshot) : null;
  } catch {
    return null;
  }
}
