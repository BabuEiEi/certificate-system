import { redirect } from "next/navigation";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  redirect("/admin/participants?mode=bulk");
}
