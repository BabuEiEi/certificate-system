import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: "ระบบจัดการ",
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
