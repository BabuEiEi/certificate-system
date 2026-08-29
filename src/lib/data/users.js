import "server-only";

import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase/admin";

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function getUsers() {
  const db = getFirebaseAdminDb();
  const auth = getFirebaseAdminAuth();

  const [profilesSnapshot, listUsersResult] = await Promise.all([
    db.collection("profiles").orderBy("created_at", "desc").limit(200).get(),
    auth.listUsers(1000),
  ]);

  const authUsersById = new Map(listUsersResult.users.map((user) => [user.uid, user]));

  return profilesSnapshot.docs.map((doc) => {
    const data = doc.data();
    const authUser = authUsersById.get(doc.id);

    return {
      id: doc.id,
      displayName: data.display_name || authUser?.displayName || "",
      email: authUser?.email || "",
      role: data.role === "ADMIN" ? "ADMIN" : "STAFF",
      isActive: data.is_active !== false,
      createdAt: serializeTimestamp(data.created_at),
    };
  });
}
