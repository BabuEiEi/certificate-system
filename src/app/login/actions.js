"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteSessionCookie } from "@/lib/firebase/session";

export async function logoutAction() {
  await deleteSessionCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
