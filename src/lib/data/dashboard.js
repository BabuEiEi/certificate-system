import "server-only";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

const metrics = [
  ["events", "events"],
  ["participants", "participants"],
  ["certificates", "certificates"],
];

async function countDocuments(db, collectionName, filters = []) {
  let query = db.collection(collectionName);

  filters.forEach(([field, value]) => {
    query = query.where(field, "==", value);
  });

  const snapshot = await query.count().get();
  return snapshot.data().count;
}

export async function getDashboardStats() {
  const db = getFirebaseAdminDb();

  const baseCounts = await Promise.all(
    metrics.map(async ([key, collectionName]) => [
      key,
      await countDocuments(db, collectionName),
    ]),
  );

  const [published, revoked] = await Promise.all([
    countDocuments(db, "certificates", [["status", "PUBLISHED"]]),
    countDocuments(db, "certificates", [["status", "REVOKED"]]),
  ]);

  return {
    ...Object.fromEntries(baseCounts),
    published,
    revoked,
    errors: 0,
  };
}
