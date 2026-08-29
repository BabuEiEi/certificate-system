import AdminShell from "@/components/admin/AdminShell";
import { requireStaff } from "@/lib/auth";

export const metadata = {
  title: "ระบบจัดการ",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const user = await requireStaff();
  return <AdminShell user={user}>{children}</AdminShell>;
}
