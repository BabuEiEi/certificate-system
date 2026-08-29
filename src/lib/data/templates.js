import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { normalizePlacements } from "@/lib/templateFields";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeTemplate(snapshot) {
  const data = snapshot.data();
  const updatedAt = serializeTimestamp(data.updated_at);

  return {
    id: snapshot.id,
    eventId: data.event_id ?? "",
    certificateType: data.certificate_type ?? "",
    fileContentType: data.file_content_type ?? "",
    fileSize: Number(data.file_size ?? 0),
    fileKind: data.file_content_type === "application/pdf" ? "pdf" : "image",
    fileUrl: data.file_path
      ? `/api/admin/templates/${encodeURIComponent(snapshot.id)}/file?v=${encodeURIComponent(updatedAt ?? "")}`
      : "",
    placements: normalizePlacements(data.placements),
    createdAt: serializeTimestamp(data.created_at),
    updatedAt,
  };
}

export async function getTemplates(eventId) {
  if (!eventId) return [];

  const snapshot = await getFirebaseAdminDb()
    .collection("templates")
    .where("event_id", "==", eventId)
    .limit(2)
    .get();

  return snapshot.docs.map(serializeTemplate);
}
