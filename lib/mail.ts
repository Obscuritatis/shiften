import nodemailer from "nodemailer";
import { huisstijl } from "@/lib/huisstijl";
import { formatDatum, formatUur } from "@/lib/datum";

export type ShiftInfo = {
  id: number;
  titel: string;
  dienst: string | null;
  locatie: string | null;
  omschrijving: string | null;
  start_tijd: string;
  eind_tijd: string;
};

const kleur = "#1f4e79"; // zelfde als --kleur-primair in globals.css

type MailOpties = { aan: string; onderwerp: string; html: string; ics?: string };

/**
 * Verstuurt een mail. Twee mogelijkheden:
 * 1. SMTP: een bestaande mailbox (Gmail, Outlook/Microsoft 365, ...) via SMTP_HOST, SMTP_USER, SMTP_PASS
 * 2. Resend: via RESEND_API_KEY
 * Is geen van beide ingesteld, dan wordt er niets verstuurd.
 */
export async function stuurMail(opties: MailOpties) {
  if (process.env.SMTP_HOST) return stuurViaSmtp(opties);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("Geen mailinstellingen: mail niet verstuurd naar", opties.aan);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_AFZENDER ?? `${huisstijl.organisatie} <onboarding@resend.dev>`,
      to: [opties.aan],
      subject: opties.onderwerp,
      html: opties.html,
      attachments: opties.ics
        ? [{ filename: "shift.ics", content: Buffer.from(opties.ics).toString("base64") }]
        : undefined,
    }),
  });
  if (!res.ok) console.error("Mail versturen mislukt:", res.status, await res.text());
  return res.ok;
}

async function stuurViaSmtp(opties: MailOpties) {
  const poort = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: poort,
    secure: poort === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await transport.sendMail({
      from: process.env.MAIL_AFZENDER ?? `${huisstijl.organisatie} <${process.env.SMTP_USER}>`,
      to: opties.aan,
      subject: opties.onderwerp,
      html: opties.html,
      icalEvent: opties.ics ? { filename: "shift.ics", method: "PUBLISH", content: opties.ics } : undefined,
    });
    return true;
  } catch (e) {
    console.error("SMTP-mail mislukt:", e);
    return false;
  }
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shiftBlok(s: ShiftInfo) {
  const regels = [
    `<strong>${esc(s.titel)}</strong>`,
    `${formatDatum(s.start_tijd)}, ${formatUur(s.start_tijd)} tot ${formatUur(s.eind_tijd)}`,
    s.dienst ? `Dienst: ${esc(s.dienst)}` : "",
    s.locatie ? `Locatie: ${esc(s.locatie)}` : "",
    s.omschrijving ? esc(s.omschrijving) : "",
  ].filter(Boolean);
  return `<div style="border-left:4px solid ${kleur};padding:8px 14px;margin:16px 0;background:#f4f6f9">${regels.join("<br>")}</div>`;
}

function opmaak(naam: string, inhoud: string, siteUrl: string) {
  return `<div style="font-family:Arial,sans-serif;color:#1c2430;max-width:560px">
  <div style="background:${kleur};color:#fff;padding:12px 16px;font-weight:bold">${esc(huisstijl.organisatie)}</div>
  <div style="padding:16px">
    <p>Hallo ${esc(naam)},</p>
    ${inhoud}
    <p><a href="${siteUrl}/shifts" style="color:${kleur}">Bekijk je shiften</a></p>
  </div></div>`;
}

export function bevestigingsMail(naam: string, s: ShiftInfo, siteUrl: string) {
  return {
    onderwerp: `Bevestiging: ${s.titel} op ${formatDatum(s.start_tijd)}`,
    html: opmaak(
      naam,
      `<p>Je bent ingeschreven voor deze shift:</p>${shiftBlok(s)}<p>In de bijlage zit een agenda-item dat je in je agenda kunt zetten. Je krijgt de dag ervoor nog een herinnering.</p>`,
      siteUrl
    ),
    ics: maakIcs(s),
  };
}

export function herinneringsMail(naam: string, s: ShiftInfo, siteUrl: string) {
  return {
    onderwerp: `Herinnering: morgen ${s.titel} om ${formatUur(s.start_tijd)}`,
    html: opmaak(naam, `<p>Een herinnering: morgen heb je deze shift.</p>${shiftBlok(s)}`, siteUrl),
  };
}

function icsDatum(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const icsTekst = (t: string) => t.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function maakIcs(s: ShiftInfo) {
  const lijnen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shiften//NL",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:shift-${s.id}@shiften`,
    `DTSTAMP:${icsDatum(new Date().toISOString())}`,
    `DTSTART:${icsDatum(s.start_tijd)}`,
    `DTEND:${icsDatum(s.eind_tijd)}`,
    `SUMMARY:${icsTekst(s.titel + (s.dienst ? ` (${s.dienst})` : ""))}`,
    s.locatie ? `LOCATION:${icsTekst(s.locatie)}` : "",
    s.omschrijving ? `DESCRIPTION:${icsTekst(s.omschrijving)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lijnen.join("\r\n");
}
