"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vereisAdmin, vereisProfiel } from "@/lib/auth";
import { lokaalNaarIso } from "@/lib/datum";
import { siteUrl } from "@/lib/env";

const metFout = (pad: string, fout: string) => redirect(`${pad}?fout=${encodeURIComponent(fout)}`);
const metMelding = (pad: string, melding: string) => redirect(`${pad}?melding=${encodeURIComponent(melding)}`);

// ---------- Account ----------

export async function inloggen(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("wachtwoord")),
  });
  if (error) {
    if (error.code === "email_not_confirmed")
      metFout("/login", "Je e-mailadres is nog niet bevestigd. Klik eerst op de link in de bevestigingsmail (kijk ook bij spam).");
    metFout("/login", "E-mailadres of wachtwoord klopt niet.");
  }
  redirect("/shifts");
}

export async function registreren(formData: FormData) {
  const naam = String(formData.get("naam") ?? "").trim();
  const functieId = String(formData.get("functie_id") ?? "");
  if (!naam || !functieId) metFout("/registreer", "Vul je naam in en kies je functie.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("wachtwoord")),
    options: {
      data: { naam, functie_id: functieId },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });
  if (error) metFout("/registreer", error.message);
  metMelding(
    "/login",
    "Account aangemaakt. Bevestig je e-mailadres; daarna keurt een beheerder je account goed."
  );
}

export async function uitloggen() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Medewerker ----------

export async function inschrijven(formData: FormData) {
  const { supabase, profiel } = await vereisProfiel();
  const { error } = await supabase
    .from("inschrijvingen")
    .insert({ shift_id: Number(formData.get("shift_id")), user_id: profiel.id });
  if (error) {
    const bekend = error.message.match(/(niet bedoeld|volzet|goedgekeurd|voorbij)/);
    metFout("/shifts", bekend ? error.message : error.code === "23505" ? "Je bent al ingeschreven." : "Inschrijven lukte niet.");
  }
  revalidatePath("/shifts");
  metMelding("/shifts", "Je bent ingeschreven.");
}

export async function uitschrijven(formData: FormData) {
  const { supabase, profiel } = await vereisProfiel();
  await supabase
    .from("inschrijvingen")
    .delete()
    .eq("shift_id", Number(formData.get("shift_id")))
    .eq("user_id", profiel.id);
  revalidatePath("/shifts");
  metMelding("/shifts", "Je bent uitgeschreven.");
}

// ---------- Beheer ----------

export async function gebruikerBijwerken(formData: FormData) {
  const { supabase } = await vereisAdmin();
  const update: Record<string, unknown> = {};
  for (const veld of ["status", "rol", "functie_id"]) {
    const v = formData.get(veld);
    if (v !== null && v !== "") update[veld] = veld === "functie_id" ? Number(v) : v;
  }
  const { error } = await supabase.from("profiles").update(update).eq("id", String(formData.get("id")));
  if (error) metFout("/admin", error.message);
  revalidatePath("/admin");
  metMelding("/admin", "Gebruiker bijgewerkt.");
}

export async function shiftAanmaken(formData: FormData) {
  const { supabase, profiel } = await vereisAdmin();
  const { error } = await supabase.from("shifts").insert({
    titel: String(formData.get("titel")),
    omschrijving: String(formData.get("omschrijving") ?? "") || null,
    locatie: String(formData.get("locatie") ?? "") || null,
    start_tijd: lokaalNaarIso(String(formData.get("start_tijd"))),
    eind_tijd: lokaalNaarIso(String(formData.get("eind_tijd"))),
    functie_id: Number(formData.get("functie_id")),
    capaciteit: Number(formData.get("capaciteit") || 1),
    aangemaakt_door: profiel.id,
  });
  if (error) metFout("/admin", "Shift aanmaken lukte niet: " + error.message);
  revalidatePath("/admin");
  metMelding("/admin", "Shift aangemaakt.");
}

export async function shiftVerwijderen(formData: FormData) {
  const { supabase } = await vereisAdmin();
  await supabase.from("shifts").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/admin");
  metMelding("/admin", "Shift verwijderd.");
}

export async function functieToevoegen(formData: FormData) {
  const { supabase } = await vereisAdmin();
  const naam = String(formData.get("naam") ?? "").trim();
  if (naam) {
    const { error } = await supabase.from("functies").insert({ naam });
    if (error) metFout("/admin", "Functie bestaat al of kon niet worden toegevoegd.");
  }
  revalidatePath("/admin");
  metMelding("/admin", "Functie toegevoegd.");
}
