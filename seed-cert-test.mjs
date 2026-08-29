import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createCanvas } from "@napi-rs/canvas";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.GCLOUD_PROJECT = "certificate-system-th-2026";

const app = initializeApp({ projectId: "certificate-system-th-2026", storageBucket: "certificate-system-th-2026.appspot.com" });
const db = getFirestore(app);
const storage = getStorage(app);
const bucket = storage.bucket();

async function ensureBucket() {
  // The storage emulator auto-provisions the default bucket; explicit
  // bucket.create() isn't supported by its REST API emulation.
}

async function main() {
  await ensureBucket();

  await db.collection("events").doc("evt1").set({
    name: "งานทดสอบระบบเกียรติบัตร",
    issuer_name: "หน่วยงานทดสอบ",
    status: "PUBLISHED",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  await db.collection("participants").doc("p1").set({
    event_id: "evt1",
    full_name: "สมชาย ใจดี",
    email: "somchai@example.com",
    organization: "ทดสอบ",
    recipient_code: "P001",
    certificate_type: "PASSED_TRAINING",
    status: "ELIGIBLE",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  await db.collection("certificateSettings").doc("default").set({
    display_prefix: "เลขที่",
    prefix: "สทศ.",
    next_number: 1015,
    number_digits: 4,
    separator: "/",
    year: "2569",
    number_format: "THAI",
    updated_at: FieldValue.serverTimestamp(),
  });

  // build a simple PNG template (landscape) with @napi-rs/canvas
  const canvas = createCanvas(1600, 1131);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fefaf0";
  ctx.fillRect(0, 0, 1600, 1131);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 1560, 1091);
  const templateBuffer = canvas.toBuffer("image/png");

  const templatePath = "templates/evt1/PASSED_TRAINING/test.png";
  await bucket.file(templatePath).save(templateBuffer, { resumable: false, metadata: { contentType: "image/png" } });

  await db.collection("templates").doc("evt1__PASSED_TRAINING").set({
    event_id: "evt1",
    certificate_type: "PASSED_TRAINING",
    file_path: templatePath,
    file_content_type: "image/png",
    file_size: templateBuffer.length,
    placements: [
      { field: "certificate_number", xPercent: 50, yPercent: 30, widthPercent: 60, fontSize: 32, align: "center" },
      { field: "recipient_name", xPercent: 50, yPercent: 45, widthPercent: 60, fontSize: 40, align: "center" },
      { field: "event_name", xPercent: 50, yPercent: 55, widthPercent: 60, fontSize: 24, align: "center" },
      { field: "issued_date", xPercent: 50, yPercent: 65, widthPercent: 60, fontSize: 20, align: "center" },
      { field: "signer_1_name", xPercent: 50, yPercent: 85, widthPercent: 60, fontSize: 20, align: "center" },
      { field: "signer_1_position", xPercent: 50, yPercent: 90, widthPercent: 60, fontSize: 16, align: "center" },
    ],
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  // signer without image (simplest smoke test)
  await db.collection("signers").doc("evt1__1").set({
    event_id: "evt1",
    order: 1,
    name: "นายทดสอบ ระบบ",
    position: "ผู้อำนวยการ",
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log("SEED_OK");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
