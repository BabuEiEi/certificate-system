import "server-only";

import { serializeCertificateSettings } from "@/lib/certificateSettings";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeEvent(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    name: data.name ?? "",
    issuerName: data.issuer_name ?? "",
    description: data.description ?? "",
    startDate: data.start_date ?? "",
    endDate: data.end_date ?? "",
    status: data.status ?? "DRAFT",
    deletionStatus: data.deletion_status ?? "",
    signerCount: Number(data.signer_count ?? 3),
    // Falls back to the same defaults as the old global certificateSettings
    // doc so an event that hasn't customized its numbering yet still shows
    // sensible values in the edit form. hasCustomCertNumbering distinguishes
    // "showing a fallback default" from "this was actually saved" -- the
    // edit form needs that distinction to know whether a first-time save
    // should always stamp next_number (see actions.js).
    hasCustomCertNumbering: data.next_number !== undefined,
    certificateNumber: serializeCertificateSettings(data),
    createdAt: serializeTimestamp(data.created_at),
    updatedAt: serializeTimestamp(data.updated_at),
  };
}

export async function getEvents() {
  const snapshot = await getFirebaseAdminDb()
    .collection("events")
    .orderBy("updated_at", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map(serializeEvent);
}
