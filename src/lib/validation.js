export function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

export function isValidCertificateNumberSettings(settings) {
  return (
    isPositiveInteger(settings.runningNumber) &&
    isPositiveInteger(settings.year) &&
    isPositiveInteger(settings.numberDigits) &&
    ["THAI", "ARABIC"].includes(settings.numberFormat)
  );
}
