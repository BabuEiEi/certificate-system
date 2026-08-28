"use client";

import { useState } from "react";
import { confirmAppAction, showAppAlert } from "@/lib/sweetAlert";

function createEmptySigner() {
  return {
    name: "",
    position: "",
    source: "UPLOAD",
    imageUrl: "",
    uploadedPreview: "",
    fileName: "",
  };
}

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

export default function SignersManager() {
  const [signers, setSigners] = useState(() =>
    Array.from({ length: 3 }, createEmptySigner),
  );

  function updateSigner(index, field, value) {
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? { ...signer, [field]: value } : signer,
      ),
    );
  }

  function handleFile(index, file) {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      void showAppAlert({
        status: "error",
        message: "รองรับเฉพาะไฟล์ลายเซ็น PNG, JPEG หรือ WebP",
      });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setSigners((current) =>
        current.map((signer, signerIndex) =>
          signerIndex === index
            ? {
                ...signer,
                uploadedPreview: String(reader.result ?? ""),
                fileName: file.name,
              }
            : signer,
        ),
      );
    });
    reader.addEventListener("error", () => {
      void showAppAlert({ status: "error", message: "ไม่สามารถอ่านไฟล์ลายเซ็นได้" });
    });
    reader.readAsDataURL(file);
  }

  async function clearSigner(index) {
    const signer = signers[index];
    const hasData = Object.values(signer).some((value) => value && value !== "UPLOAD");
    if (!hasData) return;

    const confirmed = await confirmAppAction({
      title: `ล้างข้อมูลผู้ลงนามลำดับที่ ${index + 1}`,
      message: "ชื่อ ตำแหน่ง และไฟล์ลายเซ็นในรายการนี้จะถูกล้างออก",
      confirmButtonText: "ล้างข้อมูล",
    });
    if (!confirmed) return;

    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? createEmptySigner() : signer,
      ),
    );
  }

  return (
    <div className="space-y-6">
      {signers.map((signer, index) => {
        const previewSource =
          signer.source === "UPLOAD" ? signer.uploadedPreview : signer.imageUrl;

        return (
          <article key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-bold text-slate-800">ผู้ลงนามลำดับที่ {index + 1}</h2>
                  <p className="text-xs text-slate-400">รองรับสูงสุด 3 คนต่อกิจกรรม</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void clearSigner(index)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                ล้างข้อมูล
              </button>
            </header>

            <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    ชื่อ–นามสกุล
                    <input
                      className={inputClassName}
                      value={signer.name}
                      onChange={(event) => updateSigner(index, "name", event.target.value)}
                      placeholder="ระบุชื่อผู้ลงนาม"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    ตำแหน่ง
                    <input
                      className={inputClassName}
                      value={signer.position}
                      onChange={(event) => updateSigner(index, "position", event.target.value)}
                      placeholder="ระบุตำแหน่ง"
                    />
                  </label>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">Signature Source</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 has-checked:border-brand has-checked:bg-blue-50">
                      <input
                        type="radio"
                        name={`signature-source-${index}`}
                        value="UPLOAD"
                        checked={signer.source === "UPLOAD"}
                        onChange={(event) => updateSigner(index, "source", event.target.value)}
                        className="accent-blue-700"
                      />
                      Upload File
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 has-checked:border-brand has-checked:bg-blue-50">
                      <input
                        type="radio"
                        name={`signature-source-${index}`}
                        value="URL"
                        checked={signer.source === "URL"}
                        onChange={(event) => updateSigner(index, "source", event.target.value)}
                        className="accent-blue-700"
                      />
                      Image URL
                    </label>
                  </div>
                </fieldset>

                {signer.source === "UPLOAD" ? (
                  <label className="block rounded-xl border-2 border-dashed border-slate-200 p-5 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
                    <span className="block text-sm font-semibold text-slate-700">เลือกไฟล์ลายเซ็น</span>
                    <span className="mt-1 block text-xs text-slate-400">PNG, JPEG หรือ WebP</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-white"
                      onChange={(event) => handleFile(index, event.target.files?.[0])}
                    />
                    {signer.fileName ? <span className="mt-2 block truncate text-xs text-brand">{signer.fileName}</span> : null}
                  </label>
                ) : (
                  <label className="block text-sm font-semibold text-slate-700">
                    Image URL
                    <input
                      className={inputClassName}
                      type="url"
                      value={signer.imageUrl}
                      onChange={(event) => updateSigner(index, "imageUrl", event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                )}
              </div>

              <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Signature Preview</p>
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                </div>
                <div className="mt-4 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
                  {previewSource ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewSource} alt="ตัวอย่างลายเซ็น" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <p className="text-center text-xs leading-5 text-slate-400">ยังไม่มีภาพลายเซ็น</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-400"
                >
                  Remove Background — Phase ถัดไป
                </button>
              </aside>
            </div>
          </article>
        );
      })}
    </div>
  );
}
