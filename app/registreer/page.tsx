import Link from "next/link";
import { registreren } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { Melding } from "@/components/Melding";

export default async function RegistreerPagina({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const { fout } = await searchParams;
  const supabase = await createClient();
  const { data: functies } = await supabase.from("functies").select("id, naam").order("naam");

  return (
    <div className="kaart smal">
      <h1>Registreren</h1>
      <p className="zacht">Na registratie keurt een beheerder je account en functie goed.</p>
      <Melding fout={fout} />
      <form action={registreren}>
        <label htmlFor="naam">Volledige naam</label>
        <input id="naam" name="naam" required autoComplete="name" />
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="wachtwoord">Wachtwoord (min. 8 tekens)</label>
        <input id="wachtwoord" name="wachtwoord" type="password" minLength={8} required autoComplete="new-password" />
        <label htmlFor="functie_id">Functie</label>
        <select id="functie_id" name="functie_id" required defaultValue="">
          <option value="" disabled>Kies je functie</option>
          {functies?.map((f) => (
            <option key={f.id} value={f.id}>{f.naam}</option>
          ))}
        </select>
        <button type="submit" className="volle-breedte">Account aanmaken</button>
      </form>
      <p className="zacht">
        Al een account? <Link href="/login">Meld je aan</Link>
      </p>
    </div>
  );
}
