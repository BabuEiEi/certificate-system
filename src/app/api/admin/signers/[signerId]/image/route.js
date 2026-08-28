import { getAdminUser } from "@/lib/auth";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";

const validDocumentId = /^[A-Za-z0-9_-]+__([1-3])$/;

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { signerId } = await params;
  if (!validDocumentId.test(signerId)) {
    return new Response("Not found", { status: 404 });
  }

  const snapshot = await getFirebaseAdminDb().collection("signers").doc(signerId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data?.image_path) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [buffer] = await getFirebaseAdminStorage().bucket().file(data.image_path).download();
    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        "Content-Type": data.image_content_type || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
