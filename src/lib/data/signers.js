import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeSigner(snapshot) {
  const data = snapshot.data();
  const updatedAt = serializeTimestamp(data.updated_at);

  return {
    id: snapshot.id,
    eventId: data.event_id ?? "",
    order: Number(data.order ?? 0),
    name: data.name ?? "",
    position: data.position ?? "",
    imageContentType: data.image_content_type ?? "",
    imageSize: Number(data.image_size ?? 0),
    imageUrl: data.image_path
      ? `/api/admin/signers/${encodeURIComponent(snapshot.id)}/image?v=${encodeURIComponent(updatedAt ?? "")}`
      : "",
    createdAt: serializeTimestamp(data.created_at),
    updatedAt,
  };
}

export async function getSigners(eventId) {
  if (!eventId) return [];

  const snapshot = await getFirebaseAdminDb()
    .collection("signers")
    .where("event_id", "==", eventId)
    .limit(3)
    .get();

  return snapshot.docs
    .map(serializeSigner)
    .sort((left, right) => left.order - right.order);
}
