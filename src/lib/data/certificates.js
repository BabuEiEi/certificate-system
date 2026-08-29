import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeCertificate(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    eventId: data.event_id ?? "",
    participantId: data.participant_id ?? "",
    certificateType: data.certificate_type ?? "",
    certificateNumber: data.certificate_number ?? "",
    recipientName: data.recipient_name ?? "",
    status: data.status ?? "PUBLISHED",
    verificationToken: data.verification_token ?? "",
    revokeReason: data.revoke_reason ?? "",
    issuedAt: serializeTimestamp(data.issued_at),
    publishedAt: serializeTimestamp(data.published_at),
    revokedAt: serializeTimestamp(data.revoked_at),
    createdAt: serializeTimestamp(data.created_at),
    fileUrl: `/api/admin/certificates/${encodeURIComponent(snapshot.id)}/file?format=png`,
    pdfUrl: `/api/admin/certificates/${encodeURIComponent(snapshot.id)}/file?format=pdf`,
  };
}

export async function getCertificates(eventId) {
  if (!eventId) return [];

  const snapshot = await getFirebaseAdminDb()
    .collection("certificates")
    .where("event_id", "==", eventId)
    .limit(500)
    .get();

  return snapshot.docs
    .map(serializeCertificate)
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

export async function getCertificatesByParticipantId(participantIds) {
  if (!participantIds.length) return {};

  const db = getFirebaseAdminDb();
  const chunks = [];
  for (let index = 0; index < participantIds.length; index += 30) {
    chunks.push(participantIds.slice(index, index + 30));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db.collection("certificates").where("participant_id", "in", chunk).get(),
    ),
  );

  const byParticipantId = {};
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      const certificate = serializeCertificate(doc);
      byParticipantId[certificate.participantId] = certificate;
    });
  });

  return byParticipantId;
}
