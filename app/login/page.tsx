import Link from "next/link";
import { inloggen } from "../actions";
import { Melding } from "@/components/Melding";

export default async function LoginPagina({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string; melding?: string }>;
}) {
  const { fout, melding } = await searchParams;
  return (
    <div className="kaart smal">
      <h1>Aanmelden</h1>
      <Melding fout={fout} melding={melding} />
      <form action={inloggen}>
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="wachtwoord">Wachtwoord</label>
        <input id="wachtwoord" name="wachtwoord" type="password" required autoComplete="current-password" />
        <button type="submit" className="volle-breedte">Aanmelden</button>
      </form>
      <p className="zacht">
        Nog geen account? <Link href="/registreer">Registreer je</Link>
      </p>
    </div>
  );
}
