import "server-only";

import { z } from "zod";
import { isCertificateFileExpired } from "@/lib/certificate/retention";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  isFirebaseAdminRuntimeAvailable,
} from "@/lib/firebase/config";
import { normalizeSearchTerm } from "@/lib/firebase/search";
import { chunkItems } from "@/lib/deletion";

const searchSchema = z.string().trim().min(2).max(100);
const eventIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const tokenSchema = z.uuid();

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeCertificate(snapshot) {
  const data = snapshot.data();
  const issuedAt = serializeTimestamp(data.issued_at);
  return {
    ...data,
    certificate_id: data.certificate_id ?? snapshot.id,
    verification_token: data.verification_token ?? snapshot.id,
    issued_at: issuedAt,
    published_at: serializeTimestamp(data.published_at),
    revoked_at: serializeTimestamp(data.revoked_at),
    // See the Cloud Storage lifecycle rule on the `certificates/` prefix --
    // files are deleted automatically after this window, independent of
    // this app; this just stops the page from offering a dead link.
    files_expired: isCertificateFileExpired(issuedAt),
  };
}

async function getDocumentsByReferences(db, references) {
  const snapshots = [];
  for (const referencesChunk of chunkItems(references, 200)) {
    snapshots.push(...await db.getAll(...referencesChunk));
  }
  return snapshots;
}

export async function getPublicEvents() {
  if (!isFirebaseAdminRuntimeAvailable()) return [];

  try {
    const db = getFirebaseAdminDb();
    // Keep these sequential: when local Application Default Credentials are
    // absent, starting both Admin SDK requests at once can leave a second
    // credential lookup rejection after the first one has already been
    // handled by this function's catch block.
    const publishedSnapshot = await db
      .collection("publishedCertificates")
      .where("status", "==", "PUBLISHED")
      .select("event_id", "event_name")
      .get();
    const eventSnapshot = await db.collection("events").get();
    const eventIds = new Set();
    const legacyDocuments = [];

    publishedSnapshot.docs.forEach((document) => {
      const data = document.data();
      if (data.event_id) eventIds.add(data.event_id);
      else legacyDocuments.push(document);
    });

    if (legacyDocuments.length) {
      const legacyCertificateSnapshots = await getDocumentsByReferences(
        db,
        legacyDocuments.map((document) => db.collection("certificates").doc(document.id)),
      );
      legacyCertificateSnapshots.forEach((document) => {
        const eventId = document.data()?.event_id;
        if (eventId) eventIds.add(eventId);
      });
    }

    return eventSnapshot.docs
      .filter((document) => {
        const data = document.data();
        return !data.deletion_status && eventIds.has(document.id);
      })
      .map((document) => ({ id: document.id, name: document.data()?.name ?? "" }))
      .sort((left, right) => left.name.localeCompare(right.name, "th"));
  } catch {
    return [];
  }
}

export async function searchPublishedCertificates(rawEventId, rawQuery) {
  const parsedEventId = eventIdSchema.safeParse(rawEventId);
  const parsed = searchSchema.safeParse(rawQuery);

  if (!parsedEventId.success) {
    return {
      status: rawEventId ? "invalid" : "idle",
      items: [],
      message: rawEventId ? "กิจกรรมที่เลือกไม่ถูกต้อง" : "กรุณาเลือกกิจกรรมก่อนค้นหา",
    };
  }

  if (!parsed.success) {
    return {
      status: rawQuery?.trim() ? "invalid" : "idle",
      items: [],
      message: rawQuery?.trim() ? "กรุณาระบุคำค้นอย่างน้อย 2 ตัวอักษร" : "",
    };
  }

  if (!isFirebaseAdminRuntimeAvailable()) {
    return {
      status: "unavailable",
      items: [],
      message: "ระบบค้นหายังไม่ได้เชื่อมต่อ Firebase",
    };
  }

  try {
    const db = getFirebaseAdminDb();
    const eventSnapshot = await db.collection("events").doc(parsedEventId.data).get();
    if (!eventSnapshot.exists || eventSnapshot.data()?.deletion_status) {
      return { status: "invalid", items: [], message: "ไม่พบกิจกรรมที่เลือก" };
    }

    // A participant can end up with several publishedCertificates docs over
    // time (a revoked one is kept for audit history, not deleted -- see
    // revokeCertificateAction/issueCertificatesAction). Only ever one of
    // those can be PUBLISHED at a time, so filtering to that status is
    // enough to show a single, current result per participant.
    let eventScopedDocuments = [];
    let eventIndexAvailable = true;
    try {
      const snapshot = await db
        .collection("publishedCertificates")
        .where("event_id", "==", parsedEventId.data)
        .where("search_terms", "array-contains", normalizeSearchTerm(parsed.data))
        .where("status", "==", "PUBLISHED")
        .orderBy("issued_at", "desc")
        .limit(20)
        .get();
      eventScopedDocuments = snapshot.docs;
    } catch {
      // The new composite index may still be building immediately after a
      // deploy. The legacy indexed query below keeps search available and
      // verifies each result against its private certificate event_id.
      eventIndexAvailable = false;
    }

    const items = eventScopedDocuments.map(serializeCertificate);

    // Transitional support for certificates issued before event_id was added
    // to the public registry. This can be removed after all legacy documents
    // have been reindexed.
    if (!eventIndexAvailable || items.length < 20) {
      const legacySnapshot = await db
        .collection("publishedCertificates")
        .where("search_terms", "array-contains", normalizeSearchTerm(parsed.data))
        .where("status", "==", "PUBLISHED")
        .orderBy("issued_at", "desc")
        .limit(100)
        .get();
      const legacyDocuments = eventIndexAvailable
        ? legacySnapshot.docs.filter((document) => !document.data()?.event_id)
        : legacySnapshot.docs;
      const legacyCertificateSnapshots = legacyDocuments.length
        ? await getDocumentsByReferences(
          db,
          legacyDocuments.map((document) => db.collection("certificates").doc(document.id)),
        )
        : [];
      const seenIds = new Set(items.map((item) => item.certificate_id));
      legacyDocuments.forEach((document, index) => {
        if (
          legacyCertificateSnapshots[index]?.data()?.event_id === parsedEventId.data
          && !seenIds.has(document.id)
          && items.length < 20
        ) {
          items.push(serializeCertificate(document));
          seenIds.add(document.id);
        }
      });
    }

    return {
      status: "success",
      items,
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

  if (!parsed.success || !isFirebaseAdminRuntimeAvailable()) return null;

  try {
    const snapshot = await getFirebaseAdminDb()
      .collection("publishedCertificates")
      .where("verification_token", "==", parsed.data)
      .limit(1)
      .get();

    return snapshot.empty ? null : serializeCertificate(snapshot.docs[0]);
  } catch {
    return null;
  }
}
