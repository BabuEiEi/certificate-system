// Temporary diagnostic route: compares a certificate's stored data against
// a fresh re-render using that SAME real data (not fake test text) and the
// CURRENT template config, plus reports when the certificate was actually
// created (to catch stale/pre-fix files). Remove once diagnosed.
import { requireAdmin } from "@/lib/auth";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import { composeCertificateImage } from "@/lib/certificate/render";
import { normalizePlacements } from "@/lib/templateFields";

export async function GET(request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const certificateId = searchParams.get("certificateId") ?? "";
  const wantsImage = searchParams.get("image") === "1";

  if (!certificateId) {
    return Response.json({ error: "ต้องระบุ ?certificateId=<id>" }, { status: 400 });
  }

  const db = getFirebaseAdminDb();
  const certificateSnapshot = await db.collection("certificates").doc(certificateId).get();
  if (!certificateSnapshot.exists) {
    return Response.json({ error: "ไม่พบเกียรติบัตรนี้" }, { status: 404 });
  }
  const certificateData = certificateSnapshot.data();
  const templateId = `${certificateData.event_id}__${certificateData.certificate_type}`;
  const templateSnapshot = await db.collection("templates").doc(templateId).get();
  if (!templateSnapshot.exists) {
    return Response.json({ error: "ไม่พบแม่แบบ", templateId }, { status: 404 });
  }
  const templateData = templateSnapshot.data();

  const bucket = getFirebaseAdminStorage().bucket();
  const [templateBuffer] = await bucket.file(templateData.file_path).download();
  const placements = normalizePlacements(templateData.placements);

  const realTextValues = {
    certificate_number: certificateData.certificate_number ?? "",
    recipient_name: certificateData.recipient_name ?? "",
  };

  const { pngBuffer, width, height } = await composeCertificateImage({
    templateBuffer,
    templateContentType: templateData.file_content_type,
    placements,
    textValues: realTextValues,
    imageValues: {},
  });

  if (wantsImage) {
    return new Response(pngBuffer, { headers: { "Content-Type": "image/png" } });
  }

  return Response.json({
    certificateId,
    storedCertificateData: {
      certificate_number: certificateData.certificate_number ?? "",
      recipient_name: certificateData.recipient_name ?? "",
      status: certificateData.status ?? "",
      issued_at: certificateData.issued_at?.toDate?.()?.toISOString() ?? null,
      created_at: certificateData.created_at?.toDate?.()?.toISOString() ?? null,
      png_path: certificateData.png_path ?? "",
    },
    templateFilePath: templateData.file_path,
    currentPlacements: placements,
    canvasWidth: width,
    canvasHeight: height,
    realTextValuesUsedForThisTest: realTextValues,
  });
}
