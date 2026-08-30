export const EVENT_DELETION_STATUS = "IN_PROGRESS";

export function normalizeDeletionConfirmation(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesDeletionConfirmation(value, expectedValue) {
  return normalizeDeletionConfirmation(value) === normalizeDeletionConfirmation(expectedValue);
}

export function isEventDeletionLocked(data) {
  return Boolean(data?.deletion_status);
}

export function chunkItems(items, size = 400) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
