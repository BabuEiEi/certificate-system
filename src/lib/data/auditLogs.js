import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function getAuditLogs() {
  const snapshot = await getFirebaseAdminDb()
    .collection("auditLogs")
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data();

    return {
      id: document.id,
      action: data.action ?? "UNKNOWN",
      actorEmail: data.actor_email ?? "",
      entityId: data.entity_id ?? "",
      entityType: data.entity_type ?? "",
      metadata: data.metadata ?? {},
      createdAt: serializeTimestamp(data.created_at),
    };
  });
}
