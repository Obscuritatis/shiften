-- =====================================================================
-- Shiften: databaseschema + beveiliging (Row Level Security)
-- Plak dit volledig in Supabase > SQL Editor en klik op "Run".
-- =====================================================================

-- ---------- Tabellen ----------

create table if not exists public.functies (
  id          bigint generated always as identity primary key,
  naam        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  naam        text not null,
  email       text not null,
  functie_id  bigint references public.functies(id),
  rol         text not null default 'medewerker' check (rol in ('medewerker', 'admin')),
  status      text not null default 'wachtend' check (status in ('wachtend', 'goedgekeurd', 'geblokkeerd')),
  created_at  timestamptz not null default now()
);

create table if not exists public.shifts (
  id           bigint generated always as identity primary key,
  titel        text not null,
  omschrijving text,
  locatie      text,
  start_tijd   timestamptz not null,
  eind_tijd    timestamptz not null,
  functie_id   bigint not null references public.functies(id),
  capaciteit   int not null default 1 check (capaciteit > 0),
  aangemaakt_door uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  check (eind_tijd > start_tijd)
);

create table if not exists public.inschrijvingen (
  id          bigint generated always as identity primary key,
  shift_id    bigint not null references public.shifts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (shift_id, user_id)
);

create index if not exists inschrijvingen_shift_idx on public.inschrijvingen(shift_id);
create index if not exists shifts_start_idx on public.shifts(start_tijd);

-- ---------- Hulpfuncties ----------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'admin' and status = 'goedgekeurd');
$$;

create or replace function public.is_goedgekeurd()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'goedgekeurd');
$$;

create or replace function public.mijn_functie()
returns bigint language sql stable security definer set search_path = public as $$
  select functie_id from profiles where id = auth.uid();
$$;

-- Aantal inschrijvingen per shift (zonder dat medewerkers elkaars namen zien)
create or replace function public.bezetting(p_shift_id bigint)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from inschrijvingen where shift_id = p_shift_id;
$$;

-- ---------- Profiel automatisch aanmaken bij registratie ----------
-- De app geeft naam en functie_id mee als user metadata bij signUp.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, naam, email, functie_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'naam', new.email),
    new.email,
    nullif(new.raw_user_meta_data->>'functie_id', '')::bigint
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Medewerkers mogen hun eigen rol/status/functie niet wijzigen ----------

create or replace function public.bescherm_profiel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is leeg in de SQL Editor / met de service key: dan mag alles
  if auth.uid() is not null and not public.is_admin() then
    if new.rol is distinct from old.rol
       or new.status is distinct from old.status
       or new.functie_id is distinct from old.functie_id
       or new.email is distinct from old.email then
      raise exception 'Alleen een beheerder kan rol, status, functie of e-mail wijzigen.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiel_bescherming on public.profiles;
create trigger profiel_bescherming
  before update on public.profiles
  for each row execute function public.bescherm_profiel();

-- ---------- Inschrijving controleren: functie, status, capaciteit, verleden ----------

create or replace function public.controleer_inschrijving()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_shift shifts%rowtype;
  v_profiel profiles%rowtype;
  v_aantal int;
begin
  -- Shift vergrendelen zodat twee mensen niet tegelijk de laatste plek nemen
  select * into v_shift from shifts where id = new.shift_id for update;
  if not found then
    raise exception 'Shift bestaat niet.';
  end if;

  select * into v_profiel from profiles where id = new.user_id;
  if v_profiel.status <> 'goedgekeurd' then
    raise exception 'Je account is nog niet goedgekeurd.';
  end if;
  if v_profiel.functie_id is distinct from v_shift.functie_id then
    raise exception 'Deze shift is niet bedoeld voor jouw functie.';
  end if;
  if v_shift.start_tijd < now() then
    raise exception 'Deze shift is al begonnen of voorbij.';
  end if;

  select count(*) into v_aantal from inschrijvingen where shift_id = new.shift_id;
  if v_aantal >= v_shift.capaciteit then
    raise exception 'Deze shift is volzet.';
  end if;

  return new;
end;
$$;

drop trigger if exists inschrijving_controle on public.inschrijvingen;
create trigger inschrijving_controle
  before insert on public.inschrijvingen
  for each row execute function public.controleer_inschrijving();

-- ---------- Row Level Security ----------

alter table public.functies       enable row level security;
alter table public.profiles       enable row level security;
alter table public.shifts         enable row level security;
alter table public.inschrijvingen enable row level security;

-- functies: iedereen (ook niet ingelogd, voor het registratieformulier) mag lezen
drop policy if exists "functies lezen" on public.functies;
create policy "functies lezen" on public.functies for select using (true);
drop policy if exists "functies beheren" on public.functies;
create policy "functies beheren" on public.functies for all using (public.is_admin()) with check (public.is_admin());

-- profiles: eigen profiel lezen/aanpassen (naam), admin alles
drop policy if exists "eigen profiel lezen" on public.profiles;
create policy "eigen profiel lezen" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "eigen profiel wijzigen" on public.profiles;
create policy "eigen profiel wijzigen" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- shifts: goedgekeurde medewerkers zien enkel shifts van hun functie; admin ziet en beheert alles
drop policy if exists "shifts lezen" on public.shifts;
create policy "shifts lezen" on public.shifts for select using (
  public.is_admin() or (public.is_goedgekeurd() and functie_id = public.mijn_functie())
);
drop policy if exists "shifts beheren" on public.shifts;
create policy "shifts beheren" on public.shifts for all using (public.is_admin()) with check (public.is_admin());

-- inschrijvingen: eigen inschrijvingen lezen/maken/verwijderen; admin alles
drop policy if exists "inschrijvingen lezen" on public.inschrijvingen;
create policy "inschrijvingen lezen" on public.inschrijvingen for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "zelf inschrijven" on public.inschrijvingen;
create policy "zelf inschrijven" on public.inschrijvingen for insert with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "zelf uitschrijven" on public.inschrijvingen;
create policy "zelf uitschrijven" on public.inschrijvingen for delete using (user_id = auth.uid() or public.is_admin());

-- ---------- Startdata (pas aan naar jullie functies) ----------

insert into public.functies (naam) values
  ('Verpleegkundige'), ('Zorgkundige'), ('Logistiek'), ('Onthaal')
on conflict (naam) do nothing;

-- ---------- Eerste beheerder ----------
-- Registreer jezelf eerst via de app, voer daarna dit uit met jouw e-mailadres:
-- update public.profiles set rol = 'admin', status = 'goedgekeurd' where email = 'jij@voorbeeld.be';
