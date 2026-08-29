import "server-only";

import { isCertificateFileExpired } from "@/lib/certificate/retention";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeCertificate(snapshot) {
  const data = snapshot.data();
  const issuedAt = serializeTimestamp(data.issued_at);

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
    issuedAt,
    publishedAt: serializeTimestamp(data.published_at),
    revokedAt: serializeTimestamp(data.revoked_at),
    createdAt: serializeTimestamp(data.created_at),
    // The underlying files are auto-deleted by a Cloud Storage lifecycle
    // rule on the `certificates/` prefix after CERTIFICATE_FILE_RETENTION_DAYS,
    // independent of this app -- this flag just lets the UI stop offering a
    // dead download link once that's expected to have happened.
    filesExpired: isCertificateFileExpired(issuedAt),
    hasPng: Boolean(data.png_path),
    hasPdf: Boolean(data.pdf_path),
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

// A participant can end up with more than one certificate doc once a
// revoked one is reissued (the old one is kept for audit history, not
// deleted). The admin list shows one row per participant, so pick whichever
// certificate is actually relevant: a live PUBLISHED one wins over any
// REVOKED one, and ties break on whichever was issued most recently.
function isMoreRelevantCertificate(candidate, current) {
  if (!current) return true;
  if (candidate.status === "PUBLISHED" && current.status !== "PUBLISHED") return true;
  if (candidate.status !== "PUBLISHED" && current.status === "PUBLISHED") return false;
  return (candidate.createdAt ?? "") > (current.createdAt ?? "");
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
      if (isMoreRelevantCertificate(certificate, byParticipantId[certificate.participantId])) {
        byParticipantId[certificate.participantId] = certificate;
      }
    });
  });

  return byParticipantId;
}
