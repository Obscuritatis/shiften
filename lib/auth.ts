import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profiel = {
  id: string;
  naam: string;
  email: string;
  functie_id: number | null;
  rol: "medewerker" | "admin";
  status: "wachtend" | "goedgekeurd" | "geblokkeerd";
  functies: { naam: string } | null;
};

/** Haalt de ingelogde gebruiker + profiel op, of stuurt naar /login. */
export async function vereisProfiel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profiel } = await supabase
    .from("profiles")
    .select("*, functies(naam)")
    .eq("id", user.id)
    .single<Profiel>();
  if (!profiel) redirect("/login");

  return { supabase, profiel };
}

export async function vereisAdmin() {
  const ctx = await vereisProfiel();
  if (ctx.profiel.rol !== "admin" || ctx.profiel.status !== "goedgekeurd") redirect("/shifts");
  return ctx;
}
