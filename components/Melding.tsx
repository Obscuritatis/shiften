export function Melding({ fout, melding }: { fout?: string; melding?: string }) {
  if (fout) return <div className="melding fout">{fout}</div>;
  if (melding) return <div className="melding ok">{melding}</div>;
  return null;
}
