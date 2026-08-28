import "server-only";

import { FieldValue } from "firebase-admin/firestore";

export function createAuditLogData({
  action,
  actor,
  entityId,
  entityType,
  metadata = {},
}) {
  return {
    action,
    actor_id: actor.id,
    actor_email: actor.email || "",
    entity_id: entityId,
    entity_type: entityType,
    metadata,
    created_at: FieldValue.serverTimestamp(),
  };
}
