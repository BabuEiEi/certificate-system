import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const searchSchema = z.string().trim().min(2).max(100);
const tokenSchema = z.uuid();

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchPublishedCertificates(rawQuery) {
  const parsed = searchSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return {
      status: rawQuery?.trim() ? "invalid" : "idle",
      items: [],
      message: rawQuery?.trim() ? "กรุณาระบุคำค้นอย่างน้อย 2 ตัวอักษร" : "",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      items: [],
      message: "ระบบค้นหายังไม่ได้เชื่อมต่อ Supabase",
    };
  }

  const supabase = await createClient();
  const pattern = `%${escapeLikePattern(parsed.data)}%`;
  const columns =
    "certificate_id, certificate_number, verification_token, recipient_name, event_name, issuer_name, issued_at, status";

  const [byRecipient, byNumber] = await Promise.all([
    supabase
      .from("published_certificates")
      .select(columns)
      .ilike("recipient_name", pattern)
      .order("issued_at", { ascending: false })
      .limit(20),
    supabase
      .from("published_certificates")
      .select(columns)
      .ilike("certificate_number", pattern)
      .order("issued_at", { ascending: false })
      .limit(20),
  ]);

  const error = byRecipient.error || byNumber.error;
  if (error) {
    return {
      status: "error",
      items: [],
      message: "ไม่สามารถค้นหาข้อมูลได้ในขณะนี้",
    };
  }

  const uniqueItems = new Map();
  [...(byRecipient.data ?? []), ...(byNumber.data ?? [])].forEach((item) => {
    uniqueItems.set(item.certificate_id, item);
  });

  return {
    status: "success",
    items: [...uniqueItems.values()].slice(0, 20),
    message: "",
  };
}

export async function getPublishedCertificateByToken(rawToken) {
  const parsed = tokenSchema.safeParse(rawToken);

  if (!parsed.success || !isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("published_certificates")
    .select(
      "certificate_number, recipient_name, event_name, issuer_name, issued_at, status, published_at, revoked_at, revoke_reason",
    )
    .eq("verification_token", parsed.data)
    .maybeSingle();

  return error ? null : data;
}
