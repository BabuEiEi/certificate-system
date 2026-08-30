import "server-only";

import { chunkItems } from "@/lib/deletion";

function uniqueReferences(references) {
  const byPath = new Map();
  references.forEach((reference) => {
    if (reference?.path) byPath.set(reference.path, reference);
  });
  return [...byPath.values()];
}

export async function deleteDocumentReferences(db, references) {
  const unique = uniqueReferences(references);
  for (const chunk of chunkItems(unique)) {
    const batch = db.batch();
    chunk.forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
  return unique.length;
}

export async function deleteStoragePaths(storage, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return 0;

  const bucket = storage.bucket();
  await Promise.all(
    uniquePaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
  );
  return uniquePaths.length;
}

export async function deleteStoragePrefixes(storage, prefixes) {
  const uniquePrefixes = [...new Set(prefixes.filter(Boolean))];
  if (!uniquePrefixes.length) return;

  const bucket = storage.bucket();
  for (const prefix of uniquePrefixes) {
    await bucket.deleteFiles({ prefix });
  }
}

async function queryAuditReferences(db, field, operator, value) {
  if (operator === "in" && !value.length) return [];
  const snapshot = await db.collection("auditLogs").where(field, operator, value).get();
  return snapshot.docs.map((document) => document.ref);
}

export async function getAuditReferencesForParticipant(db, participantId, certificateIds) {
  const queries = [
    queryAuditReferences(db, "entity_id", "==", participantId),
    queryAuditReferences(db, "metadata.participant_id", "==", participantId),
  ];

  chunkItems(certificateIds, 30).forEach((ids) => {
    queries.push(queryAuditReferences(db, "entity_id", "in", ids));
  });

  return uniqueReferences((await Promise.all(queries)).flat());
}

export async function getAuditReferencesForEvent(db, eventId, entityIds) {
  const queries = [
    queryAuditReferences(db, "event_id", "==", eventId),
    queryAuditReferences(db, "metadata.eventId", "==", eventId),
    queryAuditReferences(db, "metadata.event_id", "==", eventId),
    queryAuditReferences(db, "entity_id", "==", eventId),
  ];

  chunkItems(entityIds, 30).forEach((ids) => {
    queries.push(queryAuditReferences(db, "entity_id", "in", ids));
  });

  return uniqueReferences((await Promise.all(queries)).flat());
}
