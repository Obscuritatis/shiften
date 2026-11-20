import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { herinneringsMail, stuurMail, type ShiftInfo } from "@/lib/mail";
import { lokaalNaarIso } from "@/lib/datum";
import { siteUrl } from "@/lib/env";

// Wordt dagelijks aangeroepen door Vercel Cron (zie vercel.json).
// Stuurt een herinnering voor alle shiften die morgen (Belgische tijd) beginnen.
export async function GET(request: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim || request.headers.get("authorization") !== `Bearer ${geheim}`) {
    return NextResponse.json({ fout: "niet toegestaan" }, { status: 401 });
  }

  const dag = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  const van = lokaalNaarIso(`${dag(1)}T00:00`);
  const tot = lokaalNaarIso(`${dag(2)}T00:00`);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inschrijvingen")
    .select("id, profiles(naam, email), shifts!inner(id, titel, dienst, locatie, omschrijving, start_tijd, eind_tijd)")
    .is("herinnering_verstuurd", null)
    .gte("shifts.start_tijd", van)
    .lt("shifts.start_tijd", tot);
  if (error) return NextResponse.json({ fout: error.message }, { status: 500 });

  let verstuurd = 0;
  for (const rij of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = rij.profiles as any as { naam: string; email: string } | null;
    const s = rij.shifts as unknown as ShiftInfo;
    if (!p?.email || !s) continue;
    const mail = herinneringsMail(p.naam, s, siteUrl());
    if (await stuurMail({ aan: p.email, ...mail })) {
      await supabase.from("inschrijvingen").update({ herinnering_verstuurd: new Date().toISOString() }).eq("id", rij.id);
      verstuurd++;
    }
  }
  return NextResponse.json({ verstuurd, van, tot });
}
