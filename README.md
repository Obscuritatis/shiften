# Shiften

Platform waar medewerkers aangeboden shiften zien en zich inschrijven. Elke medewerker heeft een functie en kan zich enkel inschrijven op shiften voor die functie. Een beheerder keurt nieuwe accounts goed en maakt shiften aan.

De app draait volledig zelfstandig: **Next.js** (website) + **Supabase** (login, database, beveiliging), te hosten op **Vercel**. Voor een kleine organisatie passen beide in het gratis plan.

## Wat zit erin

| Pagina | Voor wie | Wat |
|---|---|---|
| `/registreer` | iedereen | account aanmaken met naam, e-mail, wachtwoord en functie |
| `/login` | iedereen | aanmelden |
| `/shifts` | goedgekeurde medewerkers | eigen shiften + open shiften voor de eigen functie, in- en uitschrijven |
| `/admin` | beheerders | shiften aanmaken/verwijderen, zien wie ingeschreven is, medewerkers goedkeuren, functie of rol wijzigen, functies toevoegen |

De regels zitten **in de database zelf** (`supabase/schema.sql`), dus ook wie de website omzeilt kan ze niet breken:

- een medewerker ziet enkel shiften van de eigen functie;
- inschrijven kan enkel als je account goedgekeurd is, de functie klopt, de shift nog niet begonnen is en er nog plaats is (ook bij gelijktijdige inschrijvingen);
- een medewerker kan zijn eigen rol, status of functie niet aanpassen.

## Installatie (± 15 minuten)

### 1. Supabase
1. Maak een gratis account en project op [supabase.com](https://supabase.com) (regio: Frankfurt of een andere EU-regio).
2. Ga naar **SQL Editor**, plak de volledige inhoud van `supabase/schema.sql` en klik **Run**.
3. Pas onderaan in die file (of later via `/admin`) de lijst met functies aan.
4. Ga naar **Authentication > URL Configuration** en zet de *Site URL* op het adres van je app (eerst `http://localhost:3000`, later je Vercel-adres).
5. Noteer bij **Project Settings > API** de *Project URL* en de *anon public key*.

### 2. Lokaal draaien (optioneel)
```bash
cp .env.example .env.local   # vul de twee Supabase-waarden in
npm install
npm run dev                  # open http://localhost:3000
```

### 3. Online zetten via Vercel
1. Ga naar [vercel.com/new](https://vercel.com/new) en importeer deze GitHub-repo.
2. Voeg bij *Environment Variables* toe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `NEXT_PUBLIC_SITE_URL` (het Vercel-adres, bv. `https://shiften.vercel.app`).
3. Klik **Deploy**. Elke push naar `main` zet daarna automatisch een nieuwe versie online.
4. Zet het Vercel-adres ook als *Site URL* in Supabase (stap 1.4).

### 4. Eerste beheerder
Registreer jezelf via de app, bevestig je e-mail en voer dan in de Supabase SQL Editor uit:
```sql
update public.profiles set rol = 'admin', status = 'goedgekeurd' where email = 'jij@voorbeeld.be';
```
Daarna kan je alle andere accounts goedkeuren via `/admin`.

## Huisstijl aanpassen
- **Kleuren en lettertype**: bovenaan `app/globals.css` (de variabelen onder `:root`).
- **Naam en logo**: `lib/huisstijl.ts`. Zet het logo in de map `public/` (bv. `public/logo.svg`) en vul `logo: "/logo.svg"` in.

## Mogelijke volgende stappen
- E-mailmelding bij een nieuwe shift of bij goedkeuring van je account
- Meerdere functies per medewerker
- Uitschrijven enkel tot X uur vóór de shift
- Herhalende shiften (bv. elke maandag) en een kalenderweergave
- Export van de bezetting naar Excel
