import { getAdminUser } from "@/lib/auth";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import { TEMPLATE_CERTIFICATE_TYPE_VALUES } from "@/lib/templateFields";

const validDocumentId = new RegExp(`^[A-Za-z0-9_-]+__(${TEMPLATE_CERTIFICATE_TYPE_VALUES.join("|")})$`);

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { templateId } = await params;
  if (!validDocumentId.test(templateId)) {
    return new Response("Not found", { status: 404 });
  }

  const snapshot = await getFirebaseAdminDb().collection("templates").doc(templateId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data?.file_path) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [buffer] = await getFirebaseAdminStorage().bucket().file(data.file_path).download();
    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        "Content-Type": data.file_content_type || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
