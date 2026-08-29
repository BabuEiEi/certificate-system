import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { composeCertificateImage, buildCertificatePdf } from "./render-test-copy.mjs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.GCLOUD_PROJECT = "certificate-system-th-2026";

const app = initializeApp({ projectId: "certificate-system-th-2026", storageBucket: "certificate-system-th-2026.appspot.com" });
const db = getFirestore(app);
const storage = getStorage(app);
const bucket = storage.bucket();

function formatCertificateNumber({ displayPrefix, prefix, runningNumber, year, separator, numberFormat }) {
  const rawNumber = `${runningNumber}${separator}${year}`;
  const prefixedNumber = `${prefix}${rawNumber}`;
  return [displayPrefix, prefixedNumber].filter(Boolean).join(" ");
}

async function main() {
  const eventSnap = await db.collection("events").doc("evt1").get();
  const event = eventSnap.data();
  const participantSnap = await db.collection("participants").doc("p1").get();
  const participant = { id: "p1", ...participantSnap.data() };
  const templateSnap = await db.collection("templates").doc("evt1__PASSED_TRAINING").get();
  const template = { id: templateSnap.id, ...templateSnap.data() };
  const signersSnap = await db.collection("signers").where("event_id", "==", "evt1").get();
  const signers = signersSnap.docs.map((d) => d.data());

  const settingsRef = db.collection("certificateSettings").doc("default");
  const certificateReference = db.collection("certificates").doc();
  const publishedReference = db.collection("publishedCertificates").doc(certificateReference.id);
  const verificationToken = randomUUID();

  const { certificateNumber } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef);
    const settings = snap.data();
    const nextNumber = Number(settings.next_number);
    const numberDigits = Number(settings.number_digits);
    const runningNumber = String(nextNumber).padStart(numberDigits, "0");
    const formattedNumber = formatCertificateNumber({
      displayPrefix: settings.display_prefix,
      prefix: settings.prefix,
      runningNumber,
      year: settings.year,
      separator: settings.separator,
      numberFormat: settings.number_format,
    });
    tx.set(settingsRef, { next_number: nextNumber + 1 }, { merge: true });
    return { certificateNumber: formattedNumber };
  });

  console.log("Certificate number:", certificateNumber);

  const placements = {};
  template.placements.forEach((p) => { placements[p.field] = p; });

  const textValues = {
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    event_name: event.name,
    issued_date: new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date()),
  };
  signers.forEach((s) => {
    textValues[`signer_${s.order}_name`] = s.name;
    textValues[`signer_${s.order}_position`] = s.position;
  });

  const [templateBuffer] = await bucket.file(template.file_path).download();

  const { pngBuffer, width, height } = await composeCertificateImage({
    templateBuffer,
    templateContentType: template.file_content_type,
    placements,
    textValues,
    imageValues: {},
  });
  const pdfBuffer = await buildCertificatePdf({ pngBuffer, width, height });

  console.log("PNG size:", pngBuffer.length, "PDF size:", pdfBuffer.length, "dims:", width, height);

  const pngPath = `certificates/evt1/${certificateReference.id}.png`;
  const pdfPath = `certificates/evt1/${certificateReference.id}.pdf`;
  await bucket.file(pngPath).save(pngBuffer, { resumable: false, metadata: { contentType: "image/png" } });
  await bucket.file(pdfPath).save(pdfBuffer, { resumable: false, metadata: { contentType: "application/pdf" } });

  await certificateReference.set({
    event_id: "evt1",
    participant_id: "p1",
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    status: "PUBLISHED",
    verification_token: verificationToken,
    png_path: pngPath,
    pdf_path: pdfPath,
    issued_at: FieldValue.serverTimestamp(),
  });

  await publishedReference.set({
    certificate_id: certificateReference.id,
    verification_token: verificationToken,
    certificate_number: certificateNumber,
    recipient_name: participant.full_name,
    event_name: event.name,
    issuer_name: event.issuer_name,
    status: "PUBLISHED",
    search_terms: ["somchai", "สมชาย"],
    issued_at: FieldValue.serverTimestamp(),
  });

  // Save PNG locally for visual inspection
  const fs = await import("node:fs/promises");
  await fs.writeFile("/tmp/test-certificate.png", pngBuffer);
  await fs.writeFile("/tmp/test-certificate.pdf", pdfBuffer);

  console.log("DONE. certificateId=", certificateReference.id, "token=", verificationToken);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
