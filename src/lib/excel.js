import {
  getCertificateTypeLabel,
  getParticipantStatusLabel,
} from "@/lib/participant";

const headerStyle = {
  fontWeight: "bold",
  textColor: "#FFFFFF",
  backgroundColor: "#123F63",
  alignVertical: "center",
};

function header(value) {
  return { value, ...headerStyle };
}

function textCell(value) {
  return { value: String(value ?? ""), type: String, alignVertical: "center" };
}

function sanitizeFileName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\[\]]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "กิจกรรม";
}

async function saveWorkbook(data, options, fileName) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile(data, options, {
    fontFamily: "Tahoma",
    fontSize: 11,
  }).toFile(fileName);
}

export async function downloadParticipantExcelTemplate() {
  const data = [
    [header("ชื่อ-นามสกุล"), header("ประเภท")],
    [textCell("นายตัวอย่าง ผ่านอบรม"), textCell("ผ่านการอบรม")],
    [textCell("นางสาวตัวอย่าง เข้าร่วม"), textCell("เข้าร่วม")],
  ];

  await saveWorkbook(
    data,
    {
      sheet: "รายชื่อผู้รับ",
      columns: [{ width: 38 }, { width: 22 }],
      stickyRowsCount: 1,
    },
    "participant-import-template.xlsx",
  );
}

export async function exportParticipantsToExcel({ event, participants }) {
  const data = [
    [
      header("ชื่อ-นามสกุล"),
      header("ประเภท"),
      header("อีเมล"),
      header("หน่วยงาน"),
      header("รหัสผู้รับ"),
      header("สถานะ"),
    ],
    ...participants.map((participant) => [
      textCell(participant.fullName),
      textCell(getCertificateTypeLabel(participant.certificateType)),
      textCell(participant.email),
      textCell(participant.organization),
      textCell(participant.recipientCode),
      textCell(getParticipantStatusLabel(participant.status)),
    ]),
  ];

  await saveWorkbook(
    data,
    {
      sheet: "รายชื่อผู้รับ",
      columns: [
        { width: 38 },
        { width: 22 },
        { width: 32 },
        { width: 34 },
        { width: 18 },
        { width: 24 },
      ],
      stickyRowsCount: 1,
    },
    `รายชื่อผู้รับ-${sanitizeFileName(event?.name)}.xlsx`,
  );
}
