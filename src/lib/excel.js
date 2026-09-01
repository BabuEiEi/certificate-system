import {
  getCertificateTypeLabel,
  getParticipantStatusLabel,
} from "@/lib/participant";

const certificateStatusLabels = {
  PUBLISHED: "เผยแพร่แล้ว",
  REVOKED: "ยกเลิกแล้ว",
};

function getCertificateStatusLabel(status) {
  return certificateStatusLabels[status] ?? "ยังไม่ออก";
}

const headerStyle = {
  fontWeight: "bold",
  textColor: "#FFFFFF",
  backgroundColor: "#123F63",
  alignVertical: "center",
};

function header(value) {
  return { value, type: String, format: "@", ...headerStyle };
}

function textCell(value) {
  return {
    value: String(value ?? ""),
    type: String,
    format: "@",
    alignVertical: "center",
  };
}

function wrappedTextCell(value, overrides = {}) {
  return {
    ...textCell(value),
    wrap: true,
    ...overrides,
  };
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

async function saveMultiSheetWorkbook(sheets, fileName) {
  const [
    { default: writeExcelFile },
    { default: dataValidation },
  ] = await Promise.all([
    import("write-excel-file/browser"),
    import("@onparallel/write-excel-file-data-validation"),
  ]);
  await writeExcelFile(sheets, {
    fontFamily: "Tahoma",
    fontSize: 11,
    features: [dataValidation],
  }).toFile(fileName);
}

export async function downloadParticipantExcelTemplate() {
  const participantData = [
    [
      header("ชื่อ-นามสกุล"),
      header("ประเภท"),
      header("อีเมล"),
      header("รหัสผู้รับ"),
      header("หน่วยงาน / สถานศึกษา"),
      header("สถานะสิทธิ์"),
    ],
    [
      textCell("นายตัวอย่าง ผ่านอบรม"),
      textCell("ผ่านการอบรม"),
      textCell("example@example.com"),
      textCell("REC-001"),
      textCell("โรงเรียนตัวอย่าง"),
      textCell("มีสิทธิ์ได้รับเกียรติบัตร"),
    ],
    [
      textCell("นางสาวตัวอย่าง เข้าร่วม"),
      textCell("เข้าร่วม"),
      textCell(""),
      textCell(""),
      textCell(""),
      textCell("มีสิทธิ์ได้รับเกียรติบัตร"),
    ],
    ...Array.from({ length: 198 }, () => [
      textCell(""),
      textCell(""),
      textCell(""),
      textCell(""),
      textCell(""),
      textCell(""),
    ]),
  ];

  const descriptionData = [
    [
      wrappedTextCell("คำอธิบายหัวตารางสำหรับนำเข้ารายชื่อผู้รับเกียรติบัตร", {
        columnSpan: 4,
        fontWeight: "bold",
        fontSize: 14,
        textColor: "#123F63",
      }),
      null,
      null,
      null,
    ],
    [
      wrappedTextCell("ทุกคอลัมน์เป็นรูปแบบ Text; ต้องระบุ ‘ชื่อ-นามสกุล’ และ ‘ประเภท’ ส่วนคอลัมน์อื่นไม่บังคับ", {
        columnSpan: 4,
        textColor: "#92400E",
        backgroundColor: "#FFFBEB",
      }),
      null,
      null,
      null,
    ],
    [null, null, null, null],
    [header("หัวตาราง"), header("จำเป็น"), header("คำอธิบาย"), header("ค่าที่รองรับ / ตัวอย่าง")],
    [
      textCell("ชื่อ-นามสกุล"),
      wrappedTextCell("จำเป็น", { fontWeight: "bold", textColor: "#B91C1C" }),
      wrappedTextCell("ชื่อและนามสกุลของผู้รับเกียรติบัตร"),
      wrappedTextCell("นายสมชาย ใจดี"),
    ],
    [
      textCell("ประเภท"),
      wrappedTextCell("จำเป็น", { fontWeight: "bold", textColor: "#B91C1C" }),
      wrappedTextCell("ประเภทข้อความที่จะใช้กับเกียรติบัตร"),
      wrappedTextCell("ผ่านการอบรม หรือ เข้าร่วม"),
    ],
    [
      textCell("อีเมล"),
      textCell("ไม่บังคับ"),
      wrappedTextCell("อีเมลของผู้รับ หากระบุต้องเป็นรูปแบบอีเมลที่ถูกต้องและไม่ซ้ำในกิจกรรม"),
      wrappedTextCell("example@example.com"),
    ],
    [
      textCell("รหัสผู้รับ"),
      textCell("ไม่บังคับ"),
      wrappedTextCell("รหัสประจำตัวผู้รับ หากระบุต้องไม่ซ้ำในกิจกรรม"),
      wrappedTextCell("REC-001"),
    ],
    [
      textCell("หน่วยงาน / สถานศึกษา"),
      textCell("ไม่บังคับ"),
      wrappedTextCell("ชื่อหน่วยงาน โรงเรียน หรือสถานศึกษาของผู้รับ"),
      wrappedTextCell("โรงเรียนตัวอย่าง"),
    ],
    [
      textCell("สถานะสิทธิ์"),
      textCell("ไม่บังคับ"),
      wrappedTextCell("สถานะสิทธิ์ในการรับเกียรติบัตร หากเว้นว่างระบบจะกำหนดเป็นมีสิทธิ์"),
      wrappedTextCell("มีสิทธิ์ได้รับเกียรติบัตร หรือ ระงับสิทธิ์"),
    ],
  ];

  await saveMultiSheetWorkbook(
    [
      {
        data: participantData,
        sheet: "รายชื่อผู้รับ",
        columns: [
          { width: 38 },
          { width: 22 },
          { width: 32 },
          { width: 18 },
          { width: 34 },
          { width: 24 },
        ],
        stickyRowsCount: 1,
        dataValidation: [
          {
            cellRange: {
              from: { row: 2, column: 2 },
              to: { row: 201, column: 2 },
            },
            validation: {
              type: "list",
              values: ["ผ่านการอบรม", "เข้าร่วม"],
              allowBlank: false,
              inputTitle: "เลือกประเภท",
              input: "กรุณาเลือกผ่านการอบรมหรือเข้าร่วม",
              errorTitle: "ประเภทไม่ถูกต้อง",
              error: "กรุณาเลือกค่าจากรายการที่กำหนด",
            },
          },
          {
            cellRange: {
              from: { row: 2, column: 6 },
              to: { row: 201, column: 6 },
            },
            validation: {
              type: "list",
              values: ["มีสิทธิ์ได้รับเกียรติบัตร", "ระงับสิทธิ์"],
              allowBlank: true,
              inputTitle: "เลือกสถานะสิทธิ์",
              input: "เว้นว่างได้ โดยระบบจะกำหนดเป็นมีสิทธิ์",
              errorTitle: "สถานะสิทธิ์ไม่ถูกต้อง",
              error: "กรุณาเลือกค่าจากรายการที่กำหนด",
            },
          },
        ],
      },
      {
        data: descriptionData,
        sheet: "คำอธิบายหัวตาราง",
        columns: [
          { width: 28 },
          { width: 14 },
          { width: 54 },
          { width: 40 },
        ],
        stickyRowsCount: 4,
      },
    ],
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

export async function exportCertificatesToExcel({ event, participants, certificatesByParticipantId }) {
  const data = [
    [
      header("ชื่อ-นามสกุล"),
      header("ประเภทเกียรติบัตร"),
      header("เลขที่เกียรติบัตร"),
      header("สถานะ"),
    ],
    ...participants.map((participant) => {
      const certificate = certificatesByParticipantId[participant.id];
      return [
        textCell(participant.fullName),
        textCell(getCertificateTypeLabel(participant.certificateType)),
        textCell(certificate?.certificateNumber || ""),
        textCell(getCertificateStatusLabel(certificate?.status)),
      ];
    }),
  ];

  await saveWorkbook(
    data,
    {
      sheet: "เกียรติบัตร",
      columns: [
        { width: 38 },
        { width: 24 },
        { width: 24 },
        { width: 20 },
      ],
      stickyRowsCount: 1,
    },
    `เกียรติบัตร-${sanitizeFileName(event?.name)}.xlsx`,
  );
}
