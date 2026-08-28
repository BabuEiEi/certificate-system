import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeParticipant(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    eventId: data.event_id ?? "",
    fullName: data.full_name ?? "",
    email: data.email ?? "",
    organization: data.organization ?? "",
    recipientCode: data.recipient_code ?? "",
    certificateType: data.certificate_type ?? "",
    status: data.status ?? "ELIGIBLE",
    createdAt: serializeTimestamp(data.created_at),
    updatedAt: serializeTimestamp(data.updated_at),
  };
}

export async function getParticipants(eventId) {
  if (!eventId) return [];

  const snapshot = await getFirebaseAdminDb()
    .collection("participants")
    .where("event_id", "==", eventId)
    .limit(500)
    .get();

  return snapshot.docs
    .map(serializeParticipant)
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}
