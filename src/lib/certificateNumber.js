import { toThaiDigits } from "./thaiNumber.js";

const NUMBER_FORMATS = new Set(["THAI", "ARABIC"]);

export function formatCertificateNumber({
  displayPrefix = "",
  prefix = "",
  runningNumber = "",
  year = "",
  separator = "/",
  numberFormat = "ARABIC",
} = {}) {
  const normalizedFormat = String(numberFormat).toUpperCase();

  if (!NUMBER_FORMATS.has(normalizedFormat)) {
    throw new Error("numberFormat must be THAI or ARABIC");
  }

  const rawNumber = `${runningNumber}${separator}${year}`;
  const displayNumber =
    normalizedFormat === "THAI" ? toThaiDigits(rawNumber) : rawNumber;
  const prefixedNumber = `${prefix}${displayNumber}`;

  return [displayPrefix, prefixedNumber].filter(Boolean).join(" ");
}
