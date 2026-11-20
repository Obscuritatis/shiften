import { vereisAdmin } from "@/lib/auth";
import { formatDatum, formatUur } from "@/lib/datum";
import { Melding } from "@/components/Melding";
import { functieToevoegen, gebruikerBijwerken, shiftAanmaken, shiftVerwijderen } from "../actions";

export default async function AdminPagina({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string; melding?: string }>;
}) {
  const { fout, melding } = await searchParams;
  const { supabase } = await vereisAdmin();

  const [{ data: functies }, { data: gebruikers }, { data: shifts }] = await Promise.all([
    supabase.from("functies").select("id, naam").order("naam"),
    supabase.from("profiles").select("id, naam, email, functie_id, rol, status").order("created_at", { ascending: false }),
    supabase
      .from("shifts")
      .select("id, titel, locatie, start_tijd, eind_tijd, capaciteit, functies(naam), inschrijvingen(profiles(naam))")
      .gte("eind_tijd", new Date().toISOString())
      .order("start_tijd"),
  ]);

  const wachtend = (gebruikers ?? []).filter((g) => g.status === "wachtend").length;

  return (
    <>
      <h1>Beheer</h1>
      <Melding fout={fout} melding={melding} />

      <h2>Nieuwe shift</h2>
      <form action={shiftAanmaken} className="kaart">
        <div className="twee-kol">
          <div>
            <label htmlFor="titel">Titel</label>
            <input id="titel" name="titel" required placeholder="bv. Vroege dienst" />
          </div>
          <div>
            <label htmlFor="functie_id">Functie</label>
            <select id="functie_id" name="functie_id" required defaultValue="">
              <option value="" disabled>Kies een functie</option>
              {functies?.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="start_tijd">Start</label>
            <input id="start_tijd" name="start_tijd" type="datetime-local" required />
          </div>
          <div>
            <label htmlFor="eind_tijd">Einde</label>
            <input id="eind_tijd" name="eind_tijd" type="datetime-local" required />
          </div>
          <div>
            <label htmlFor="locatie">Locatie</label>
            <input id="locatie" name="locatie" />
          </div>
          <div>
            <label htmlFor="capaciteit">Aantal plaatsen</label>
            <input id="capaciteit" name="capaciteit" type="number" min={1} defaultValue={1} required />
          </div>
        </div>
        <label htmlFor="omschrijving">Omschrijving</label>
        <textarea id="omschrijving" name="omschrijving" rows={2} />
        <button type="submit" className="volle-breedte">Shift aanmaken</button>
      </form>

      <h2>Geplande shiften</h2>
      {shifts?.length ? (
        <div className="tabel-wrap">
          <table>
            <thead>
              <tr><th>Wanneer</th><th>Shift</th><th>Functie</th><th>Bezetting</th><th>Ingeschreven</th><th></th></tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const namen = ((s.inschrijvingen ?? []) as any[]).map((i) => i.profiles?.naam).filter(Boolean);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const functie = (s.functies as any)?.naam ?? "";
                return (
                  <tr key={s.id}>
                    <td>{formatDatum(s.start_tijd)}<br /><span className="zacht">{formatUur(s.start_tijd)} tot {formatUur(s.eind_tijd)}</span></td>
                    <td>{s.titel}{s.locatie && <><br /><span className="zacht">{s.locatie}</span></>}</td>
                    <td>{functie}</td>
                    <td>{namen.length} / {s.capaciteit}</td>
                    <td>{namen.join(", ") || <span className="zacht">niemand</span>}</td>
                    <td>
                      <form action={shiftVerwijderen}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="gevaar">Verwijderen</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="zacht">Nog geen geplande shiften.</p>
      )}

      <h2>Medewerkers {wachtend > 0 && <span className="badge vol">{wachtend} wachten op goedkeuring</span>}</h2>
      <div className="tabel-wrap">
        <table>
          <thead>
            <tr><th>Naam</th><th>E-mail</th><th>Functie</th><th>Rol</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {gebruikers?.map((g) => (
              <tr key={g.id}>
                <td>{g.naam}</td>
                <td>{g.email}</td>
                <td colSpan={4}>
                  <form action={gebruikerBijwerken} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={g.id} />
                    <select name="functie_id" defaultValue={g.functie_id ?? ""}>
                      <option value="">geen</option>
                      {functies?.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}
                    </select>
                    <select name="rol" defaultValue={g.rol}>
                      <option value="medewerker">medewerker</option>
                      <option value="admin">beheerder</option>
                    </select>
                    <select name="status" defaultValue={g.status}>
                      <option value="wachtend">wachtend</option>
                      <option value="goedgekeurd">goedgekeurd</option>
                      <option value="geblokkeerd">geblokkeerd</option>
                    </select>
                    <button type="submit">Opslaan</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Functies</h2>
      <div className="kaart">
        <p>{functies?.map((f) => <span key={f.id} className="badge" style={{ marginRight: 6 }}>{f.naam}</span>)}</p>
        <form action={functieToevoegen} style={{ display: "flex", gap: 8 }}>
          <input name="naam" placeholder="Nieuwe functie" required />
          <button type="submit">Toevoegen</button>
        </form>
      </div>
    </>
  );
}
