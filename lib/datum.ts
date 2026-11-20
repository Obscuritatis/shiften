const tz = "Europe/Brussels";
export function formatDatum(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
}
export function formatUur(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}
/** Zet een datetime-local waarde (Belgische tijd) om naar ISO in UTC. */
export function lokaalNaarIso(waarde: string) {
  // Bepaal de offset van Brussel op dat moment
  const ruw = new Date(waarde + "Z");
  const inBrussel = new Date(ruw.toLocaleString("en-US", { timeZone: tz }));
  const inUtc = new Date(ruw.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = inBrussel.getTime() - inUtc.getTime();
  return new Date(ruw.getTime() - offset).toISOString();
}
