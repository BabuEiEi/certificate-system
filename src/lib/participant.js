export const participantStatusOptions = [
  { value: "ELIGIBLE", label: "มีสิทธิ์รับเกียรติบัตร" },
  { value: "EXCLUDED", label: "ระงับสิทธิ์" },
];

export const certificateTypeOptions = [
  { value: "", label: "กำหนดตาม Template" },
  { value: "PASSED_TRAINING", label: "ผ่านการอบรม" },
  { value: "PARTICIPATED", label: "เข้าร่วม" },
];

export function normalizeParticipantText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th-TH");
}

export function buildParticipantStrongDedupeKeys({ recipientCode, email }) {
  const normalizedCode = normalizeParticipantText(recipientCode);
  const normalizedEmail = normalizeParticipantText(email);
  return [
    normalizedCode ? `code:${normalizedCode}` : "",
    normalizedEmail ? `email:${normalizedEmail}` : "",
  ].filter(Boolean);
}

export function buildParticipantStrongDedupeKey(data) {
  return buildParticipantStrongDedupeKeys(data)[0] ?? "";
}

export function buildParticipantNameKey({ fullName }) {
  return normalizeParticipantText(fullName);
}

export function getCertificateTypeLabel(value) {
  return certificateTypeOptions.find((option) => option.value === value)?.label
    ?? "กำหนดตาม Template";
}

export function getParticipantStatusLabel(value) {
  return participantStatusOptions.find((option) => option.value === value)?.label
    ?? "มีสิทธิ์รับเกียรติบัตร";
}

export function parseCertificateType(value) {
  const normalized = normalizeParticipantText(value).replace(/[\s_-]+/g, "");
  const templateValues = new Set([
    "",
    "template",
    "ตามtemplate",
    "กำหนดตามtemplate",
  ]);
  if (templateValues.has(normalized)) return { value: "", error: "" };

  const passedValues = new Set([
    "ผ่าน",
    "ผ่านการอบรม",
    "passed",
    "passedtraining",
    "trainingpassed",
  ]);
  const participatedValues = new Set([
    "เข้าร่วม",
    "เข้าร่วมกิจกรรม",
    "participated",
    "participation",
    "participant",
  ]);

  if (passedValues.has(normalized)) return { value: "PASSED_TRAINING", error: "" };
  if (participatedValues.has(normalized)) return { value: "PARTICIPATED", error: "" };

  return {
    value: "",
    error: "ประเภทต้องเป็น ‘ผ่านการอบรม’ หรือ ‘เข้าร่วม’ หรือเว้นว่าง",
  };
}

export function parseParticipantStatus(value) {
  const normalized = normalizeParticipantText(value).replace(/[\s_-]+/g, "");
  if (!normalized) return { value: "ELIGIBLE", error: "" };

  const eligibleValues = new Set([
    "eligible",
    "มีสิทธิ์",
    "มีสิทธิ์รับเกียรติบัตร",
  ]);
  const excludedValues = new Set([
    "excluded",
    "ระงับสิทธิ์",
    "ไม่มีสิทธิ์",
  ]);

  if (eligibleValues.has(normalized)) return { value: "ELIGIBLE", error: "" };
  if (excludedValues.has(normalized)) return { value: "EXCLUDED", error: "" };

  return {
    value: "ELIGIBLE",
    error: "สถานะต้องเป็น ‘มีสิทธิ์รับเกียรติบัตร’ หรือ ‘ระงับสิทธิ์’ หรือเว้นว่าง",
  };
}
