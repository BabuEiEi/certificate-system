const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(Boolean);
}

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT,
  );
}

export function isFirebaseAdminRuntimeAvailable() {
  if (!isFirebaseAdminConfigured()) return false;

  const hasServiceAccount = Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  const hasApplicationDefaultCredentials = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
      || process.env.K_SERVICE
      || process.env.FUNCTION_TARGET
      || process.env.FIREBASE_CONFIG,
  );

  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
      || hasServiceAccount
      || hasApplicationDefaultCredentials,
  );
}

export function getFirebaseConfig() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set all NEXT_PUBLIC_FIREBASE_* variables.",
    );
  }

  return firebaseConfig;
}

export function getFirebaseProjectId() {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  return projectId;
}
