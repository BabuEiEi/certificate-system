import { certificateTypeOptions } from "@/lib/participant";

// Templates are managed per certificate type so an event can have one design
// for "ผ่านการอบรม" and another for "เข้าร่วม" (the "" / follow-template value
// from certificateTypeOptions does not apply here).
export const TEMPLATE_CERTIFICATE_TYPES = certificateTypeOptions.filter((option) => option.value);
export const TEMPLATE_CERTIFICATE_TYPE_VALUES = TEMPLATE_CERTIFICATE_TYPES.map((option) => option.value);

export function getTemplateCertificateTypeLabel(value) {
  return TEMPLATE_CERTIFICATE_TYPES.find((option) => option.value === value)?.label ?? value;
}

// Placement fields describe every piece of content that can be positioned on
// a certificate template. Coordinates are stored as percentages (0-100) of
// the template's width/height so they stay valid regardless of the source
// file resolution.
export const TEMPLATE_PLACEMENT_FIELDS = [
  { id: "certificate_number", label: "เลขที่เกียรติบัตร", type: "text" },
  { id: "recipient_name", label: "ชื่อ-นามสกุลผู้รับ", type: "text" },
  { id: "event_name", label: "ชื่อกิจกรรม", type: "text" },
  { id: "issued_date", label: "วันที่ออกเกียรติบัตร", type: "text" },
  { id: "signer_1_name", label: "ชื่อผู้ลงนามลำดับ 1", type: "text" },
  { id: "signer_1_position", label: "ตำแหน่งผู้ลงนามลำดับ 1", type: "text" },
  { id: "signer_1_image", label: "ลายเซ็นผู้ลงนามลำดับ 1", type: "image" },
  { id: "signer_2_name", label: "ชื่อผู้ลงนามลำดับ 2", type: "text" },
  { id: "signer_2_position", label: "ตำแหน่งผู้ลงนามลำดับ 2", type: "text" },
  { id: "signer_2_image", label: "ลายเซ็นผู้ลงนามลำดับ 2", type: "image" },
  { id: "signer_3_name", label: "ชื่อผู้ลงนามลำดับ 3", type: "text" },
  { id: "signer_3_position", label: "ตำแหน่งผู้ลงนามลำดับ 3", type: "text" },
  { id: "signer_3_image", label: "ลายเซ็นผู้ลงนามลำดับ 3", type: "image" },
];

export const TEMPLATE_PLACEMENT_FIELD_IDS = TEMPLATE_PLACEMENT_FIELDS.map((field) => field.id);

export function getTemplateField(id) {
  return TEMPLATE_PLACEMENT_FIELDS.find((field) => field.id === id) ?? null;
}

export function getTemplateFieldLabel(id) {
  return getTemplateField(id)?.label ?? id;
}

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "ชิดซ้าย" },
  { value: "center", label: "กึ่งกลาง" },
  { value: "right", label: "ชิดขวา" },
];

export const DEFAULT_TEXT_PLACEMENT = {
  xPercent: 50,
  yPercent: 50,
  widthPercent: 60,
  fontSize: 24,
  align: "center",
};

export const DEFAULT_IMAGE_PLACEMENT = {
  xPercent: 50,
  yPercent: 50,
  widthPercent: 16,
  heightPercent: 10,
};

export function defaultPlacementFor(fieldId) {
  const field = getTemplateField(fieldId);
  return field?.type === "image"
    ? { ...DEFAULT_IMAGE_PLACEMENT }
    : { ...DEFAULT_TEXT_PLACEMENT };
}

// Normalizes a raw placements array (as stored in Firestore, or posted from
// the client) into a map keyed by field id, dropping unknown fields and
// filling in any missing numbers with sane defaults.
export function normalizePlacements(rawPlacements) {
  const list = Array.isArray(rawPlacements) ? rawPlacements : [];
  const map = {};

  for (const entry of list) {
    const field = getTemplateField(entry?.field);
    if (!field) continue;

    const fallback = defaultPlacementFor(field.id);
    const placement = {
      field: field.id,
      xPercent: clampPercent(entry.xPercent, fallback.xPercent),
      yPercent: clampPercent(entry.yPercent, fallback.yPercent),
      widthPercent: clampPercent(entry.widthPercent, fallback.widthPercent),
    };

    if (field.type === "text") {
      placement.fontSize = clampNumber(entry.fontSize, 6, 200, fallback.fontSize);
      placement.align = TEXT_ALIGN_OPTIONS.some((option) => option.value === entry.align)
        ? entry.align
        : fallback.align;
    } else {
      placement.heightPercent = clampPercent(entry.heightPercent, fallback.heightPercent);
    }

    map[field.id] = placement;
  }

  return map;
}

function clampPercent(value, fallback) {
  return clampNumber(value, 0, 100, fallback);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
