// Calcule, pour chaque article, le nombre d'achats distincts (par BC, pas par
// ligne — un BC de bois de chauffage a souvent 10-14 lignes pour un seul achat
// mensuel, il ne faut pas le compter 10-14 fois) et le cycle moyen de
// réapprovisionnement en jours (durée moyenne entre deux commandes).
//
// lignesBc: [{ designation, bc_id }]
// commandesParId: { [bc_id]: { date, statut } }
export function calculerFrequenceAchats(lignesBc, commandesParId) {
  const parArticle = {}; // designation -> Map(bc_id -> date)

  (lignesBc || []).forEach((l) => {
    const bc = commandesParId[l.bc_id];
    if (!bc || bc.statut === "Annulée" || !bc.date) return;
    if (!parArticle[l.designation]) parArticle[l.designation] = new Map();
    parArticle[l.designation].set(l.bc_id, bc.date);
  });

  const resultats = [];
  Object.entries(parArticle).forEach(([designation, mapBc]) => {
    const dates = [...mapBc.values()].map((d) => new Date(d)).sort((a, b) => a - b);
    const nombreAchats = dates.length;
    let cycleJours = null;
    if (dates.length >= 2) {
      const intervalles = [];
      for (let i = 1; i < dates.length; i++) {
        intervalles.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      cycleJours = Math.round(intervalles.reduce((a, b) => a + b, 0) / intervalles.length);
    }
    const derniereDate = dates[dates.length - 1] || null;
    resultats.push({ designation, nombreAchats, cycleJours, derniereDate });
  });

  return resultats.sort((a, b) => b.nombreAchats - a.nombreAchats);
}

// Articles dont la prochaine commande "habituelle" approche ou est dépassée,
// pour alerter avant une rupture (ne garde que les articles avec un cycle
// établi sur au moins 3 achats, pour éviter les faux positifs).
export function articlesAReapprovisionner(frequences, seuilJoursAvance = 3) {
  const aujourdHui = new Date();
  return frequences
    .filter((f) => f.cycleJours != null && f.nombreAchats >= 3 && f.derniereDate)
    .map((f) => {
      const joursDepuisDernier = Math.floor((aujourdHui - f.derniereDate) / (1000 * 60 * 60 * 24));
      const joursAvantProchaine = f.cycleJours - joursDepuisDernier;
      return { ...f, joursDepuisDernier, joursAvantProchaine };
    })
    .filter((f) => f.joursAvantProchaine <= seuilJoursAvance)
    .sort((a, b) => a.joursAvantProchaine - b.joursAvantProchaine);
}

