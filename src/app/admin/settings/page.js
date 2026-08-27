import CertificateNumberSettings from "@/components/admin/CertificateNumberSettings";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Configuration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">ตั้งค่ารูปแบบและการทำงานของระบบเกียรติบัตร</p>
      </div>
      <CertificateNumberSettings />
    </section>
  );
}
