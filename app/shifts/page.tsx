import { vereisProfiel } from "@/lib/auth";
import { formatDatum, formatUur } from "@/lib/datum";
import { Melding } from "@/components/Melding";
import { inschrijven, uitschrijven } from "../actions";

type Shift = {
  id: number;
  titel: string;
  omschrijving: string | null;
  dienst: string | null;
  locatie: string | null;
  start_tijd: string;
  eind_tijd: string;
  capaciteit: number;
};

export default async function ShiftsPagina({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string; melding?: string }>;
}) {
  const { fout, melding } = await searchParams;
  const { supabase, profiel } = await vereisProfiel();

  if (profiel.status !== "goedgekeurd") {
    return (
      <div className="kaart smal">
        <h1>Even geduld</h1>
        <p>
          Hallo {profiel.naam}, je account {profiel.status === "geblokkeerd" ? "is geblokkeerd" : "wacht nog op goedkeuring"}.
          Zodra een beheerder je account goedkeurt, zie je hier de shiften voor jouw functie
          {profiel.functies ? ` (${profiel.functies.naam})` : ""}.
        </p>
      </div>
    );
  }

  // RLS zorgt dat je enkel shiften van je eigen functie ziet (beheerders zien alles)
  let query = supabase
    .from("shifts")
    .select("id, titel, omschrijving, dienst, locatie, start_tijd, eind_tijd, capaciteit")
    .gte("start_tijd", new Date().toISOString())
    .order("start_tijd");
  if (profiel.functie_id) query = query.eq("functie_id", profiel.functie_id);
  const { data: shifts } = await query.returns<Shift[]>();

  const { data: mijn } = await supabase.from("inschrijvingen").select("shift_id").eq("user_id", profiel.id);
  const ingeschreven = new Set((mijn ?? []).map((i) => i.shift_id));

  const bezetting = new Map<number, number>();
  await Promise.all(
    (shifts ?? []).map(async (s) => {
      const { data } = await supabase.rpc("bezetting", { p_shift_id: s.id });
      bezetting.set(s.id, (data as number) ?? 0);
    })
  );

  const mijnShifts = (shifts ?? []).filter((s) => ingeschreven.has(s.id));
  const open = (shifts ?? []).filter((s) => !ingeschreven.has(s.id));

  const Kaart = ({ s }: { s: Shift }) => {
    const bezet = bezetting.get(s.id) ?? 0;
    const vol = bezet >= s.capaciteit;
    const ik = ingeschreven.has(s.id);
    return (
      <div className="kaart shift">
        <h3>{s.titel}</h3>
        <p className="meta">
          {formatDatum(s.start_tijd)}, {formatUur(s.start_tijd)} tot {formatUur(s.eind_tijd)}
        </p>
        {s.dienst && <p className="meta">Dienst: {s.dienst}</p>}
        {s.locatie && <p className="meta">{s.locatie}</p>}
        {s.omschrijving && <p>{s.omschrijving}</p>}
        <div className="acties">
          <span className={`badge ${ik ? "ok" : vol ? "vol" : ""}`}>
            {ik ? "Ingeschreven" : vol ? "Volzet" : `${s.capaciteit - bezet} van ${s.capaciteit} vrij`}
          </span>
          <form action={ik ? uitschrijven : inschrijven}>
            <input type="hidden" name="shift_id" value={s.id} />
            {ik ? (
              <button type="submit" className="secundair">Uitschrijven</button>
            ) : (
              <button type="submit" disabled={vol}>Inschrijven</button>
            )}
          </form>
        </div>
      </div>
    );
  };

  return (
    <>
      <h1>Shiften{profiel.functies ? ` voor ${profiel.functies.naam}` : ""}</h1>
      <Melding fout={fout} melding={melding} />

      <h2>Mijn shiften</h2>
      {mijnShifts.length ? (
        <div className="raster">{mijnShifts.map((s) => <Kaart key={s.id} s={s} />)}</div>
      ) : (
        <p className="zacht">Je bent nog niet ingeschreven op een shift.</p>
      )}

      <h2>Aangeboden shiften</h2>
      {open.length ? (
        <div className="raster">{open.map((s) => <Kaart key={s.id} s={s} />)}</div>
      ) : (
        <p className="zacht">Er zijn momenteel geen open shiften voor jouw functie.</p>
      )}
    </>
  );
}
