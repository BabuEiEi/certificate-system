"use client";

import { useMemo, useState } from "react";
import { formatCertificateNumber } from "@/lib/certificateNumber";

const initialSettings = {
  displayPrefix: "เลขที่",
  prefix: "สทศ.",
  runningNumber: "1015",
  numberDigits: "4",
  separator: "/",
  year: "2569",
  numberFormat: "THAI",
};

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

export default function CertificateNumberSettings() {
  const [settings, setSettings] = useState(initialSettings);

  const preview = useMemo(() => {
    const digits = Math.max(1, Number(settings.numberDigits) || 1);
    const runningNumber = settings.runningNumber.padStart(digits, "0");

    return formatCertificateNumber({
      displayPrefix: settings.displayPrefix,
      prefix: settings.prefix,
      runningNumber,
      year: settings.year,
      separator: settings.separator,
      numberFormat: settings.numberFormat,
    });
  }, [settings]);

  function updateSetting(event) {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={(event) => event.preventDefault()}>
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Certificate Number</h2>
            <p className="mt-1 text-sm text-slate-500">กำหนดรูปแบบเลขเกียรติบัตรสำหรับการแสดงผล</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Preview only</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            ข้อความนำหน้า
            <input className={fieldClassName} name="displayPrefix" value={settings.displayPrefix} onChange={updateSetting} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Prefix
            <input className={fieldClassName} name="prefix" value={settings.prefix} onChange={updateSetting} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Running Start
            <input className={fieldClassName} name="runningNumber" type="number" min="0" value={settings.runningNumber} onChange={updateSetting} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Number Digits
            <input className={fieldClassName} name="numberDigits" type="number" min="1" max="12" value={settings.numberDigits} onChange={updateSetting} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Separator
            <input className={fieldClassName} name="separator" value={settings.separator} onChange={updateSetting} maxLength={3} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Year
            <input className={fieldClassName} name="year" inputMode="numeric" value={settings.year} onChange={updateSetting} />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Number Format
            <select className={fieldClassName} name="numberFormat" value={settings.numberFormat} onChange={updateSetting}>
              <option value="THAI">เลขไทย</option>
              <option value="ARABIC">เลขอารบิก</option>
            </select>
          </label>
        </div>

        <div className="mt-7 flex justify-end border-t border-slate-100 pt-5">
          <button type="button" disabled className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
            บันทึกใน Phase 2B
          </button>
        </div>
      </form>

      <aside className="h-fit rounded-2xl bg-brand-dark p-6 text-white shadow-xl shadow-blue-950/15 xl:sticky xl:top-28">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Real-time Preview</p>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/10 p-5">
          <p className="text-xs text-blue-200">ตัวอย่างเลขเกียรติบัตร</p>
          <p className="mt-3 break-words text-2xl font-bold leading-relaxed">{preview || "—"}</p>
        </div>
        <p className="mt-4 text-xs leading-5 text-blue-200">
          ค่าต้นทางยังคงเป็นเลขอารบิก และแปลงเป็นเลขไทยเฉพาะตอนแสดงผล
        </p>
      </aside>
    </div>
  );
}
