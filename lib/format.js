// Formate une date (Date, ISO string ou "YYYY-MM-DD") en jj/mm/aa (ou jj/mm/aaaa si besoin)
export function formatDate(valeur, anneeCourte = true) {
  if (!valeur) return "";
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (isNaN(d.getTime())) return "";
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aaaa = d.getFullYear();
  return `${jj}/${mm}/${anneeCourte ? String(aaaa).slice(-2) : aaaa}`;
}

// Formate une date + heure en jj/mm/aa hh:mm
export function formatDateHeure(valeur) {
  if (!valeur) return "";
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(valeur)} ${hh}:${min}`;
}
