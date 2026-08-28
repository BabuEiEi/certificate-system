export function normalizeSearchTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("th-TH")
    .trim()
    .replace(/\s+/g, " ");
}

export function createSearchTerms(...values) {
  const terms = new Set();

  values.forEach((value) => {
    const normalized = normalizeSearchTerm(value);
    if (!normalized) return;

    [normalized, ...normalized.split(" ")].forEach((part) => {
      if (part.length < 2) return;
      const maxLength = Math.min(part.length, 100);
      for (let length = 2; length <= maxLength; length += 1) {
        terms.add(part.slice(0, length));
      }
    });
  });

  return [...terms];
}
