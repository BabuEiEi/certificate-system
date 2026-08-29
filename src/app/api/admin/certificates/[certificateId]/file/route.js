import { getAdminUser } from "@/lib/auth";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";

const validDocumentId = /^[A-Za-z0-9_-]+$/;

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { certificateId } = await params;
  if (!validDocumentId.test(certificateId)) {
    return new Response("Not found", { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "png";

  const snapshot = await getFirebaseAdminDb().collection("certificates").doc(certificateId).get();
  const data = snapshot.data();
  const storagePath = format === "pdf" ? data?.pdf_path : data?.png_path;
  if (!snapshot.exists || !storagePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [buffer] = await getFirebaseAdminStorage().bucket().file(storagePath).download();
    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        "Content-Type": format === "pdf" ? "application/pdf" : "image/png",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
