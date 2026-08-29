// Temporary diagnostic route: dumps a template's raw placements so we can
// see exactly what's stored without needing Firebase Console access. Remove
// once the render-not-drawing-text issue is diagnosed.
import { requireAdmin } from "@/lib/auth";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

export async function GET(request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event") ?? "";
  const certificateType = searchParams.get("type") ?? "";

  if (!eventId || !certificateType) {
    return Response.json(
      { error: "ต้องระบุ ?event=<eventId>&type=<certificateType>" },
      { status: 400 },
    );
  }

  const templateId = `${eventId}__${certificateType}`;
  const snapshot = await getFirebaseAdminDb().collection("templates").doc(templateId).get();

  if (!snapshot.exists) {
    return Response.json({ error: "ไม่พบแม่แบบ", templateId }, { status: 404 });
  }

  return Response.json({ templateId, data: snapshot.data() });
}
