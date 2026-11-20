import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { huisstijl } from "@/lib/huisstijl";
import { uitloggen } from "./actions";

export const metadata: Metadata = {
  title: huisstijl.organisatie,
  description: huisstijl.slogan,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("rol, status").eq("id", user.id).single();
    isAdmin = data?.rol === "admin" && data?.status === "goedgekeurd";
  }

  return (
    <html lang="nl-BE">
      <body>
        <header className="kop">
          <div className="kop-inhoud">
            <Link href="/" className="logo">
              {huisstijl.logo ? <img src={huisstijl.logo} alt={huisstijl.organisatie} /> : huisstijl.organisatie}
            </Link>
            {user && (
              <nav>
                <Link href="/shifts">Shiften</Link>
                {isAdmin && <Link href="/admin">Beheer</Link>}
                <form action={uitloggen} className="inline">
                  <button type="submit">Afmelden</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
