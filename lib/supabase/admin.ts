import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/** Client met volledige rechten, enkel voor taken op de server (zoals herinneringen). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY of SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}
