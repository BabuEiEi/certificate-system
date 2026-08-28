export const DEFAULT_CERTIFICATE_SETTINGS = {
  displayPrefix: "เลขที่",
  prefix: "สทศ.",
  runningNumber: "1015",
  numberDigits: "4",
  separator: "/",
  year: "2569",
  numberFormat: "THAI",
};

export function serializeCertificateSettings(data = {}) {
  return {
    displayPrefix: data.display_prefix ?? DEFAULT_CERTIFICATE_SETTINGS.displayPrefix,
    prefix: data.prefix ?? DEFAULT_CERTIFICATE_SETTINGS.prefix,
    runningNumber: String(data.next_number ?? DEFAULT_CERTIFICATE_SETTINGS.runningNumber),
    numberDigits: String(data.number_digits ?? DEFAULT_CERTIFICATE_SETTINGS.numberDigits),
    separator: data.separator ?? DEFAULT_CERTIFICATE_SETTINGS.separator,
    year: String(data.year ?? DEFAULT_CERTIFICATE_SETTINGS.year),
    numberFormat: data.number_format ?? DEFAULT_CERTIFICATE_SETTINGS.numberFormat,
  };
}
