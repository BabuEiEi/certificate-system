import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth";

export const metadata = {
  title: "ระบบจัดการ",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const user = await requireAdmin();
  return <AdminShell user={user}>{children}</AdminShell>;
}
