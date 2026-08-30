import "server-only";

import path from "node:path";
import { GlobalFonts, createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import {
  getCertificateFont,
  normalizeCertificateFontFamily,
  normalizeCertificateFontWeight,
} from "../certificateFonts.js";

// PDF templates are rasterized before compositing. This MUST match the scale
// used by the admin's live preview in TemplateManager (pdfjs render scale 2)
// so that a placement's fontSize/xPercent/yPercent values -- which the admin
// tuned against that on-screen preview -- land in the same visual spot and
// size on the final, server-rendered certificate.
const PDF_TEMPLATE_RENDER_SCALE = 2;

const CERTIFICATE_FONT_DIRECTORY = path.join(process.cwd(), "src/lib/certificate/fonts");
const registeredFonts = new Map();

function ensureFontRegistered(fontFamily, fontWeight) {
  const normalizedFamily = normalizeCertificateFontFamily(fontFamily);
  const normalizedWeight = normalizeCertificateFontWeight(fontWeight);
  const registrationKey = `${normalizedFamily}:${normalizedWeight}`;
  const existingFamily = registeredFonts.get(registrationKey);
  if (existingFamily) return existingFamily;

  const font = getCertificateFont(normalizedFamily);
  const fontPath = path.join(CERTIFICATE_FONT_DIRECTORY, font.files[normalizedWeight]);
  const canvasFamily = `Certificate${normalizedFamily}${normalizedWeight}`;
  const registeredFont = GlobalFonts.registerFromPath(fontPath, canvasFamily);
  if (!registeredFont) {
    throw new Error(`Unable to register certificate font: ${fontPath}`);
  }
  registeredFonts.set(registrationKey, canvasFamily);
  return canvasFamily;
}

async function rasterizeCanvasFromTemplate(templateBuffer, templateContentType) {
  if (templateContentType === "application/pdf") {
    // Loaded lazily because pdfjs-dist's legacy Node build touches DOM-ish
    // globals during module init that we don't want paid for on every import.
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document_ = await pdfjsLib.getDocument({
      data: new Uint8Array(templateBuffer),
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    const page = await document_.getPage(1);
    const viewport = page.getViewport({ scale: PDF_TEMPLATE_RENDER_SCALE });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }

  const image = await loadImage(templateBuffer);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, image.width, image.height);
  return canvas;
}

function drawTextPlacement(context, canvasWidth, canvasHeight, placement, text, canvasFontFamily) {
  if (!text) return;

  const x = (placement.xPercent / 100) * canvasWidth;
  const y = (placement.yPercent / 100) * canvasHeight;
  // fontSize is stored as a raw pixel value matching the admin's live preview
  // resolution (see TemplateManager.js), so it is used as-is here rather than
  // being re-derived from a percentage.
  const fontSize = Math.max(1, Math.round(placement.fontSize));

  context.save();
  context.font = `${fontSize}px "${canvasFontFamily}"`;
  context.fillStyle = "#111111";
  context.textBaseline = "middle";
  context.textAlign = placement.align === "left"
    ? "left"
    : placement.align === "right"
      ? "right"
      : "center";
  context.fillText(String(text), x, y);
  context.restore();
}

async function drawImagePlacement(context, canvasWidth, canvasHeight, placement, imageBuffer) {
  if (!imageBuffer) return;

  const image = await loadImage(imageBuffer);
  const boxWidth = (placement.widthPercent / 100) * canvasWidth;
  const boxHeight = (placement.heightPercent / 100) * canvasHeight;
  const centerX = (placement.xPercent / 100) * canvasWidth;
  const centerY = (placement.yPercent / 100) * canvasHeight;

  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  context.drawImage(
    image,
    centerX - drawWidth / 2,
    centerY - drawHeight / 2,
    drawWidth,
    drawHeight,
  );
}

/**
 * Composes a final certificate image by drawing the resolved field values
 * (text + signer images) onto a rasterized copy of the template, following
 * the percentage-based placements configured in the Templates module.
 *
 * @param {Object} options
 * @param {Buffer} options.templateBuffer - Raw template file bytes.
 * @param {string} options.templateContentType - Template file MIME type.
 * @param {Record<string, object>} options.placements - Field id -> placement, as produced by normalizePlacements().
 * @param {Record<string, string>} options.textValues - Field id -> text content for text fields.
 * @param {Record<string, Buffer>} options.imageValues - Field id -> image bytes for image fields (e.g. signatures).
 * @param {string} options.fontFamily - A value from CERTIFICATE_FONT_FAMILY_VALUES.
 * @param {string} options.fontWeight - A value from CERTIFICATE_FONT_WEIGHT_VALUES.
 * @returns {Promise<{ pngBuffer: Buffer, width: number, height: number }>}
 */
export async function composeCertificateImage({
  templateBuffer,
  templateContentType,
  placements,
  textValues = {},
  imageValues = {},
  fontFamily,
  fontWeight,
}) {
  if (!placements || typeof placements !== "object" || Array.isArray(placements)) {
    throw new TypeError("Certificate placements must be a map keyed by template field ID");
  }

  const canvasFontFamily = ensureFontRegistered(fontFamily, fontWeight);
  const canvas = await rasterizeCanvasFromTemplate(templateBuffer, templateContentType);
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  for (const [fieldId, placement] of Object.entries(placements)) {
    if (placement.heightPercent !== undefined) {
       
      await drawImagePlacement(context, width, height, placement, imageValues[fieldId]);
    } else {
      drawTextPlacement(context, width, height, placement, textValues[fieldId], canvasFontFamily);
    }
  }

  return { pngBuffer: canvas.toBuffer("image/png"), width, height };
}

/**
 * Wraps a composited certificate PNG into a single-page PDF sized to match
 * the image dimensions (in points, at 96 DPI), so the PDF and PNG stay
 * pixel-for-pixel identical to what admins previewed while building the
 * template.
 *
 * @param {Object} options
 * @param {Buffer} options.pngBuffer
 * @param {number} options.width
 * @param {number} options.height
 * @returns {Promise<Buffer>}
 */
export async function buildCertificatePdf({ pngBuffer, width, height }) {
  const pdfDocument = await PDFDocument.create();
  const pageWidthPoints = width * (72 / 96);
  const pageHeightPoints = height * (72 / 96);
  const page = pdfDocument.addPage([pageWidthPoints, pageHeightPoints]);
  const embeddedImage = await pdfDocument.embedPng(pngBuffer);

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageWidthPoints,
    height: pageHeightPoints,
  });

  return Buffer.from(await pdfDocument.save());
}
