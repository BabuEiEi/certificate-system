// Temporary diagnostic route: runs the real composeCertificateImage against
// a template with obviously-visible test text, and reports the template's
// actual pixel dimensions alongside the configured placements. Remove once
// the invisible-text issue is diagnosed.
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

  const { pngBuffer, width, height } = await composeCertificateImage({
    templateBuffer,
    templateContentType: templateData.file_content_type,
    placements,
    textValues: {
      certificate_number: "TEST-NUMBER-1234",
      recipient_name: "ทดสอบ ชื่อทดสอบ",
    },
    imageValues: {},
  });

  if (wantsImage) {
    return new Response(pngBuffer, { headers: { "Content-Type": "image/png" } });
  }

  return Response.json({
    templateId,
    rawPlacements: templateData.placements,
    normalizedPlacements: placements,
    canvasWidth: width,
    canvasHeight: height,
    fontSizeToCanvasHeightPercent: Object.fromEntries(
      Object.entries(placements)
        .filter(([, p]) => p.fontSize)
        .map(([field, p]) => [field, ((p.fontSize / height) * 100).toFixed(3) + "%"]),
    ),
  });
}
