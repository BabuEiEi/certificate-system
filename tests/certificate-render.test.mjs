import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

// Next.js resolves this marker while bundling the application. Register a
// no-op module only in Node's test process so the production renderer itself
// can be imported and exercised without maintaining a second test-only copy.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { buildCertificatePdf, composeCertificateImage } = await import(
  "../src/lib/certificate/render.js"
);
const {
  getMissingRequiredCertificatePlacements,
  normalizePlacements,
} = await import("../src/lib/templateFields.js");
const {
  CERTIFICATE_FONT_OPTIONS,
  CERTIFICATE_FONT_WEIGHTS,
  DEFAULT_CERTIFICATE_FONT_FAMILY,
  DEFAULT_CERTIFICATE_FONT_WEIGHT,
  normalizeCertificateFontFamily,
  normalizeCertificateFontWeight,
} = await import("../src/lib/certificateFonts.js");

const rawFirestorePlacements = [
  {
    field: "certificate_number",
    xPercent: 50,
    yPercent: 32,
    widthPercent: 70,
    fontSize: 30,
    align: "center",
  },
  {
    field: "recipient_name",
    xPercent: 50,
    yPercent: 58,
    widthPercent: 70,
    fontSize: 42,
    align: "center",
  },
];

function createBlankTemplate() {
  const canvas = createCanvas(900, 320);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toBuffer("image/png");
}

async function countNonWhitePixels(buffer) {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
      count += 1;
    }
  }

  return count;
}

test("normalizes the placements array stored by Firestore into a field-keyed map", () => {
  const placements = normalizePlacements(rawFirestorePlacements);

  assert.deepEqual(Object.keys(placements), ["certificate_number", "recipient_name"]);
  assert.equal(placements.certificate_number.field, "certificate_number");
  assert.equal(placements.recipient_name.field, "recipient_name");
  assert.deepEqual(getMissingRequiredCertificatePlacements(placements), []);
});

test("renderer rejects an unnormalized placements array instead of silently drawing blank output", async () => {
  await assert.rejects(
    composeCertificateImage({
      templateBuffer: createBlankTemplate(),
      templateContentType: "image/png",
      placements: rawFirestorePlacements,
      textValues: {
        certificate_number: "เลขที่ สทศ.๑๐๑๕/๒๕๖๙",
        recipient_name: "นายทดสอบ ระบบเกียรติบัตร",
      },
    }),
    /placements must be a map/i,
  );
});

test("unknown font settings safely fall back for templates created before font selection existed", () => {
  assert.equal(normalizeCertificateFontFamily(undefined), DEFAULT_CERTIFICATE_FONT_FAMILY);
  assert.equal(normalizeCertificateFontWeight("UNKNOWN"), DEFAULT_CERTIFICATE_FONT_WEIGHT);
});

test("every selectable Thai font and weight is bundled and renders certificate text", async () => {
  const placements = normalizePlacements(rawFirestorePlacements);

  for (const font of CERTIFICATE_FONT_OPTIONS) {
    for (const weight of CERTIFICATE_FONT_WEIGHTS) {
      await access(path.join(
        process.cwd(),
        "src/lib/certificate/fonts",
        font.files[weight.value],
      ));

      const { pngBuffer } = await composeCertificateImage({
        templateBuffer: createBlankTemplate(),
        templateContentType: "image/png",
        placements,
        fontFamily: font.value,
        fontWeight: weight.value,
        textValues: {
          certificate_number: "เลขที่ สทศ.๑๐๑๕/๒๕๖๙",
          recipient_name: "นายทดสอบ ระบบเกียรติบัตร",
        },
      });

      assert.ok(
        await countNonWhitePixels(pngBuffer) > 1_000,
        `${font.label} ${weight.label} did not render enough visible text`,
      );
    }
  }
});

test("production renderer draws recipient and certificate number and wraps the result as PDF", async () => {
  const placements = normalizePlacements(rawFirestorePlacements);
  const { pngBuffer, width, height } = await composeCertificateImage({
    templateBuffer: createBlankTemplate(),
    templateContentType: "image/png",
    placements,
    textValues: {
      certificate_number: "เลขที่ สทศ.๑๐๑๕/๒๕๖๙",
      recipient_name: "นายทดสอบ ระบบเกียรติบัตร",
    },
  });

  assert.equal(width, 900);
  assert.equal(height, 320);
  assert.ok(await countNonWhitePixels(pngBuffer) > 1_000);

  const pdfBuffer = await buildCertificatePdf({ pngBuffer, width, height });
  const pdf = await PDFDocument.load(pdfBuffer);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 675, height: 240 });
  assert.ok(pdfBuffer.length > 1_000);
});
