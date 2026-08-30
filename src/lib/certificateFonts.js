export const DEFAULT_CERTIFICATE_FONT_FAMILY = "NOTO_SANS_THAI";
export const DEFAULT_CERTIFICATE_FONT_WEIGHT = "REGULAR";

export const CERTIFICATE_FONT_WEIGHTS = Object.freeze([
  { value: "REGULAR", label: "ปกติ (Regular)", cssWeight: 400 },
  { value: "BOLD", label: "ตัวหนา (Bold)", cssWeight: 700 },
]);

export const CERTIFICATE_FONT_OPTIONS = Object.freeze([
  {
    value: "NOTO_SANS_THAI",
    label: "Noto Sans Thai",
    cssVariable: "--font-certificate-noto-sans-thai",
    files: {
      REGULAR: "NotoSansThai-Regular.ttf",
      BOLD: "NotoSansThai-Bold.ttf",
    },
  },
  {
    value: "SARABUN",
    label: "Sarabun (สารบรรณ)",
    cssVariable: "--font-certificate-sarabun",
    files: {
      REGULAR: "Sarabun-Regular.ttf",
      BOLD: "Sarabun-Bold.ttf",
    },
  },
  {
    value: "KANIT",
    label: "Kanit (คณิต)",
    cssVariable: "--font-certificate-kanit",
    files: {
      REGULAR: "Kanit-Regular.ttf",
      BOLD: "Kanit-Bold.ttf",
    },
  },
  {
    value: "PROMPT",
    label: "Prompt (พร้อม)",
    cssVariable: "--font-certificate-prompt",
    files: {
      REGULAR: "Prompt-Regular.ttf",
      BOLD: "Prompt-Bold.ttf",
    },
  },
]);

export const CERTIFICATE_FONT_FAMILY_VALUES = Object.freeze(
  CERTIFICATE_FONT_OPTIONS.map((font) => font.value),
);
export const CERTIFICATE_FONT_WEIGHT_VALUES = Object.freeze(
  CERTIFICATE_FONT_WEIGHTS.map((weight) => weight.value),
);

export function normalizeCertificateFontFamily(value) {
  return CERTIFICATE_FONT_FAMILY_VALUES.includes(value)
    ? value
    : DEFAULT_CERTIFICATE_FONT_FAMILY;
}

export function normalizeCertificateFontWeight(value) {
  return CERTIFICATE_FONT_WEIGHT_VALUES.includes(value)
    ? value
    : DEFAULT_CERTIFICATE_FONT_WEIGHT;
}

export function getCertificateFont(value) {
  const normalizedValue = normalizeCertificateFontFamily(value);
  return CERTIFICATE_FONT_OPTIONS.find((font) => font.value === normalizedValue);
}

export function getCertificateFontWeight(value) {
  const normalizedValue = normalizeCertificateFontWeight(value);
  return CERTIFICATE_FONT_WEIGHTS.find((weight) => weight.value === normalizedValue);
}
