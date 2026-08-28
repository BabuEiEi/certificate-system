import "server-only";

import { serializeCertificateSettings } from "@/lib/certificateSettings";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

export async function getCertificateSettings() {
  const snapshot = await getFirebaseAdminDb()
    .collection("certificateSettings")
    .doc("default")
    .get();

  return serializeCertificateSettings(snapshot.exists ? snapshot.data() : {});
}
