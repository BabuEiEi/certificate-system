// Must match the Cloud Storage lifecycle rule on the `certificates/` prefix
// (bucket-level, configured outside the app): objects older than this are
// deleted automatically. This constant only drives what the UI *displays* --
// it doesn't perform any deletion itself.
export const CERTIFICATE_FILE_RETENTION_DAYS = 90;

export function isCertificateFileExpired(issuedAt) {
  if (!issuedAt) return false;

  const issuedTime = new Date(issuedAt).getTime();
  if (Number.isNaN(issuedTime)) return false;

  const ageMs = Date.now() - issuedTime;
  const retentionMs = CERTIFICATE_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return ageMs >= retentionMs;
}
