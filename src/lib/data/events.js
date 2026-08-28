import "server-only";

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
