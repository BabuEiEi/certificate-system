export function normalizeSearchTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("th-TH")
    .trim()
    .replace(/\s+/g, " ");
}

// Source data commonly glues the Thai honorific onto the first name with no
// space (e.g. "นางสาวปนัดดา จันตะคุณ"), so a plain word-split only ever
// yields "นางสาวปนัดดา" as a token -- searching the bare first name
// "ปนัดดา" would never match. Longest-prefix-first so e.g. "นางสาว" is
// tried before "นาง".
const HONORIFIC_PREFIXES = [
  "ว่าที่ร้อยตรีหญิง",
  "ว่าที่ร้อยโทหญิง",
  "ว่าที่ร้อยเอกหญิง",
  "ว่าที่ร้อยตรี",
  "ว่าที่ร้อยโท",
  "ว่าที่ร้อยเอก",
  "ผู้ช่วยศาสตราจารย์",
  "รองศาสตราจารย์",
  "ศาสตราจารย์",
  "เด็กชาย",
  "เด็กหญิง",
  "นางสาว",
  "นาย",
  "นาง",
  "ดร.",
].sort((left, right) => right.length - left.length);

function stripHonorific(word) {
  const prefix = HONORIFIC_PREFIXES.find(
    (candidate) => word.startsWith(candidate) && word.length > candidate.length + 1,
  );
  return prefix ? word.slice(prefix.length) : null;
}

export function createSearchTerms(...values) {
  const terms = new Set();

  values.forEach((value) => {
    const normalized = normalizeSearchTerm(value);
    if (!normalized) return;

    const words = normalized.split(" ");
    const parts = [normalized, ...words];
    words.forEach((word) => {
      const stripped = stripHonorific(word);
      if (stripped) parts.push(stripped);
    });

    parts.forEach((part) => {
      if (part.length < 2) return;
      const maxLength = Math.min(part.length, 100);
      for (let length = 2; length <= maxLength; length += 1) {
        terms.add(part.slice(0, length));
      }
    });
  });

  return [...terms];
}
