// Temporary diagnostic route: checks whether the Thai font file is actually
// present in the deployed container and whether @napi-rs/canvas can
// register it. Remove once the invisible-text issue is diagnosed.
import fs from "node:fs";
import path from "node:path";
import { GlobalFonts, createCanvas } from "@napi-rs/canvas";
import { requireAdmin } from "@/lib/auth";

const THAI_FONT_FAMILY = "NotoSansThaiCertificateDebug";
const THAI_FONT_PATH = path.join(process.cwd(), "src/lib/certificate/fonts/NotoSansThai-Regular.ttf");

export async function GET(request) {
  await requireAdmin();
  const wantsImage = new URL(request.url).searchParams.get("image") === "1";

  const result = {
    cwd: process.cwd(),
    fontPath: THAI_FONT_PATH,
  };

  try {
    result.fontFileExists = fs.existsSync(THAI_FONT_PATH);
    if (result.fontFileExists) {
      result.fontFileSize = fs.statSync(THAI_FONT_PATH).size;
    }
  } catch (error) {
    result.fsError = String(error);
  }

  try {
    result.familiesBeforeRegister = GlobalFonts.getFamilies();
  } catch (error) {
    result.getFamiliesBeforeError = String(error);
  }

  try {
    const registered = GlobalFonts.registerFromPath(THAI_FONT_PATH, THAI_FONT_FAMILY);
    result.registerFromPathReturned = registered;
  } catch (error) {
    result.registerFromPathError = String(error);
  }

  try {
    result.familiesAfterRegister = GlobalFonts.getFamilies();
  } catch (error) {
    result.getFamiliesAfterError = String(error);
  }

  let imageBuffer;
  try {
    const canvas = createCanvas(400, 100);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 400, 100);
    context.font = `24px "${THAI_FONT_FAMILY}"`;
    context.fillStyle = "#000000";
    context.fillText("ทดสอบภาษาไทย 123", 10, 50);
    imageBuffer = canvas.toBuffer("image/png");
  } catch (error) {
    result.canvasError = String(error);
  }

  if (wantsImage && imageBuffer) {
    return new Response(imageBuffer, { headers: { "Content-Type": "image/png" } });
  }

  return Response.json(result);
}
