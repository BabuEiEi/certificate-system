// One-off migration: recompute `search_terms` on every publishedCertificates
// doc using the updated createSearchTerms (which now also indexes names
// with their Thai honorific prefix stripped off, e.g. "ปนัดดา" in addition
// to "นางสาวปนัดดา"). Existing docs were indexed with the old logic and
// won't pick up the fix until re-written.
//
// Run with: node --env-file=.env.local scripts/reindex-search-terms.mjs
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createSearchTerms } from "../src/lib/firebase/search.js";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  process.exit(1);
}

// Same fallback as src/lib/firebase/admin.js: use an explicit service
// account if one is configured via env vars, otherwise fall back to
// Application Default Credentials (e.g. `gcloud auth application-default
// login`, or the App Hosting runtime's own service account).
const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault();

initializeApp({ projectId, credential });
const db = getFirestore();

const snapshot = await db.collection("publishedCertificates").get();
console.log(`Found ${snapshot.size} publishedCertificates docs`);

let updated = 0;
let batch = db.batch();
let opsInBatch = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const newTerms = createSearchTerms(data.recipient_name, data.certificate_number);
  const oldTerms = new Set(data.search_terms ?? []);
  const changed = newTerms.length !== oldTerms.size || newTerms.some((term) => !oldTerms.has(term));

  if (!changed) continue;

  batch.update(doc.ref, { search_terms: newTerms });
  opsInBatch += 1;
  updated += 1;

  if (opsInBatch >= 400) {
    await batch.commit();
    batch = db.batch();
    opsInBatch = 0;
  }
}

if (opsInBatch > 0) {
  await batch.commit();
}

console.log(`Re-indexed ${updated} doc(s)`);
