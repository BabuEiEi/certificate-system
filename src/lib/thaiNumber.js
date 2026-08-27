const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function toThaiDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => THAI_DIGITS[digit]);
}
