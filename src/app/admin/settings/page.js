import UserManager from "@/components/admin/UserManager";
import { requireAdmin } from "@/lib/auth";
import { getUsers } from "@/lib/data/users";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const actor = await requireAdmin();
  const users = await getUsers();

  return (
    <section>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Configuration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          จัดการบัญชีผู้ใช้งานระบบและบทบาท (Admin / Staff)
        </p>
      </div>
      <UserManager users={users} currentUserId={actor.id} />
    </section>
  );
}
