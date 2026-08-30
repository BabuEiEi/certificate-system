import localFont from "next/font/local";

const notoSansThai = localFont({
  src: [
    { path: "../lib/certificate/fonts/NotoSansThai-Regular.ttf", weight: "400", style: "normal" },
    { path: "../lib/certificate/fonts/NotoSansThai-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-certificate-noto-sans-thai",
  display: "swap",
});

const sarabun = localFont({
  src: [
    { path: "../lib/certificate/fonts/Sarabun-Regular.ttf", weight: "400", style: "normal" },
    { path: "../lib/certificate/fonts/Sarabun-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-certificate-sarabun",
  display: "swap",
});

const kanit = localFont({
  src: [
    { path: "../lib/certificate/fonts/Kanit-Regular.ttf", weight: "400", style: "normal" },
    { path: "../lib/certificate/fonts/Kanit-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-certificate-kanit",
  display: "swap",
});

const prompt = localFont({
  src: [
    { path: "../lib/certificate/fonts/Prompt-Regular.ttf", weight: "400", style: "normal" },
    { path: "../lib/certificate/fonts/Prompt-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-certificate-prompt",
  display: "swap",
});

export const certificateFontVariables = [notoSansThai, sarabun, kanit, prompt]
  .map((font) => font.variable)
  .join(" ");
