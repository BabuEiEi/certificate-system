// Temporary diagnostic route: dumps a template's raw placements so we can
// see exactly what's stored without needing Firebase Console access. Remove
// once the render-not-drawing-text issue is diagnosed.
import { requireAdmin } from "@/lib/auth";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

export async function GET(request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const db = getFirebaseAdminDb();

  let eventId = searchParams.get("event") ?? "";
  let certificateType = searchParams.get("type") ?? "";
  let certificateInfo;

  // Easier entry point: paste a certificate id (from its /file?format=...
  // URL) and we look up its event/type ourselves instead of requiring the
  // admin to dig those out of the page URL separately.
  const certificateId = searchParams.get("certificateId") ?? "";
  if (certificateId) {
    const certificateSnapshot = await db.collection("certificates").doc(certificateId).get();
    if (!certificateSnapshot.exists) {
      return Response.json({ error: "ไม่พบเกียรติบัตรนี้", certificateId }, { status: 404 });
    }
    const certificateData = certificateSnapshot.data();
    eventId = certificateData.event_id ?? "";
    certificateType = certificateData.certificate_type ?? "";
    certificateInfo = {
      certificateId,
      event_id: eventId,
      certificate_type: certificateType,
      certificate_number: certificateData.certificate_number ?? "",
      recipient_name: certificateData.recipient_name ?? "",
      status: certificateData.status ?? "",
      png_path: certificateData.png_path ?? "",
      pdf_path: certificateData.pdf_path ?? "",
    };
  }

  if (!eventId || !certificateType) {
    return Response.json(
      { error: "ต้องระบุ ?certificateId=<id> หรือ ?event=<eventId>&type=<certificateType>" },
      { status: 400 },
    );
  }

  const templateId = `${eventId}__${certificateType}`;
  const snapshot = await db.collection("templates").doc(templateId).get();

  if (!snapshot.exists) {
    return Response.json({ error: "ไม่พบแม่แบบ", templateId, certificateInfo }, { status: 404 });
  }

  const templateData = snapshot.data();
  const template = {
    event_id: templateData.event_id ?? "",
    certificate_type: templateData.certificate_type ?? "",
    file_path: templateData.file_path ?? "",
    file_content_type: templateData.file_content_type ?? "",
    file_size: templateData.file_size ?? 0,
    placements: templateData.placements ?? [],
  };

  return Response.json({ templateId, template, certificateInfo });
}
