import "server-only";

import { createClient } from "@/lib/supabase/server";

const metrics = [
  ["events", "events"],
  ["participants", "participants"],
  ["certificates", "certificates"],
];

async function countRows(supabase, table, filters = []) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getDashboardStats() {
  const supabase = await createClient();

  const baseCounts = await Promise.all(
    metrics.map(async ([key, table]) => [key, await countRows(supabase, table)]),
  );

  const [published, revoked] = await Promise.all([
    countRows(supabase, "certificates", [["status", "PUBLISHED"]]),
    countRows(supabase, "certificates", [["status", "REVOKED"]]),
  ]);

  return {
    ...Object.fromEntries(baseCounts),
    published,
    revoked,
    errors: 0,
  };
}
