import { z } from "zod";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase/admin";
import { isFirebaseAdminConfigured } from "@/lib/firebase/config";

const tokenSchema = z.uuid();

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  if (!isFirebaseAdminConfigured()) return new Response("Not found", { status: 404 });

  const { token } = await params;
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "png";

  const db = getFirebaseAdminDb();
  const publishedSnapshot = await db
    .collection("publishedCertificates")
    .where("verification_token", "==", parsed.data)
    .limit(1)
    .get();

  if (publishedSnapshot.empty) return new Response("Not found", { status: 404 });

  const publishedDoc = publishedSnapshot.docs[0];
  if (publishedDoc.data().status !== "PUBLISHED") {
    return new Response("Not found", { status: 404 });
  }

  const certificateSnapshot = await db.collection("certificates").doc(publishedDoc.id).get();
  const data = certificateSnapshot.data();
  const storagePath = format === "pdf" ? data?.pdf_path : data?.png_path;
  if (!certificateSnapshot.exists || !storagePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const [buffer] = await getFirebaseAdminStorage().bucket().file(storagePath).download();
    return new Response(buffer, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `${format === "pdf" ? "attachment" : "inline"}; filename="certificate-${data.certificate_number || publishedDoc.id}.${format}"`,
        "Content-Length": String(buffer.length),
        "Content-Type": format === "pdf" ? "application/pdf" : "image/png",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
