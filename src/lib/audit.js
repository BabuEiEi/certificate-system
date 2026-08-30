import "server-only";

import { FieldValue } from "firebase-admin/firestore";

export function createAuditLogData({
  action,
  actor,
  entityId,
  entityType,
  eventId = "",
  metadata = {},
}) {
  const resolvedEventId =
    eventId
    || metadata.event_id
    || metadata.eventId
    || (entityType === "EVENT" ? entityId : "");
  const document = {
    action,
    actor_id: actor.id,
    actor_email: actor.email || "",
    entity_id: entityId,
    entity_type: entityType,
    metadata,
    created_at: FieldValue.serverTimestamp(),
  };

  if (resolvedEventId) document.event_id = resolvedEventId;
  return document;
}
