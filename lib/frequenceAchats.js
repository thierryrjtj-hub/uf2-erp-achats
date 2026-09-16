// Calcule, pour chaque article, le nombre d'achats distincts (par BC, pas par
// ligne — un BC de bois de chauffage a souvent 10-14 lignes pour un seul achat
// mensuel, il ne faut pas le compter 10-14 fois) et le cycle moyen de
// réapprovisionnement en jours (durée moyenne entre deux commandes).
//
// lignesBc: [{ designation, bc_id }]
// commandesParId: { [bc_id]: { date, statut } }
// chaineParDesignation (optionnel) : { [designation en minuscule]: designation
// suivante } — fusionne l'historique d'un article "ancien" avec celui de son
// remplaçant (continuité d'usage, ex. COLLE DUNSON -> TRANSPARENT BOND), pour
// que la fréquence/le cycle se prolongent au lieu de repartir de zéro.
export function calculerFrequenceAchats(lignesBc, commandesParId, chaineParDesignation = null) {
  const resoudre = (designation) => {
    if (!chaineParDesignation) return designation;
    let d = designation;
    const vus = new Set();
    while (chaineParDesignation[d.toLowerCase()] && !vus.has(d.toLowerCase())) {
      vus.add(d.toLowerCase());
      d = chaineParDesignation[d.toLowerCase()];
    }
    return d;
  };

  const parArticle = {}; // designation finale -> Map(bc_id -> date)

  (lignesBc || []).forEach((l) => {
    const bc = commandesParId[l.bc_id];
    if (!bc || bc.statut === "Annulée" || !bc.date) return;
    const designationFinale = resoudre(l.designation);
    if (!parArticle[designationFinale]) parArticle[designationFinale] = new Map();
    parArticle[designationFinale].set(l.bc_id, bc.date);
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

import { CATEGORIES_REAPPROVISIONNEMENT } from "./categoriesArticles";

// Articles dont la prochaine commande "habituelle" approche ou est dépassée,
// pour alerter avant une rupture (ne garde que les articles avec un cycle
// établi sur au moins 3 achats, pour éviter les faux positifs).
// categorieParDesignation (optionnel) : { [designation]: categorie } — ne
// garde que les catégories de CATEGORIES_REAPPROVISIONNEMENT (matières
// premières hors Bois de Chauffage — voir categoriesArticles.js) ; si non
// fourni, aucun filtre par catégorie n'est appliqué.
// signalements (optionnel) : { [designation]: joursAvantProchaine au moment
// du signalement "Traité" } — masque un article tant que sa situation ne
// s'est pas dégradée depuis, le fait réapparaître si le retard s'aggrave.
// endormiParDesignation (optionnel) : { [designation]: true } — exclut un
// article qu'on n'achète plus (remplacé, obsolète...) de l'alerte, sans
// toucher à son historique ni ses documents liés.
// Détection automatique d'arrêt d'achat : si le dernier achat remonte à plus
// de 3 fois le cycle habituel, l'article est considéré comme probablement
// arrêté (plutôt qu'"en retard") et sort tout seul de l'alerte, sans action
// manuelle nécessaire — voir aussi estAchatArrete() pour le repérer ailleurs.
const SEUIL_ARRET_MULTIPLICATEUR = 3;

export function estAchatArrete(f) {
  if (!f || f.cycleJours == null || f.nombreAchats < 3 || !f.derniereDate) return false;
  const joursDepuis = Math.floor((new Date() - f.derniereDate) / (1000 * 60 * 60 * 24));
  return joursDepuis > f.cycleJours * SEUIL_ARRET_MULTIPLICATEUR;
}

export function articlesAReapprovisionner(frequences, seuilJoursAvance = 3, categorieParDesignation = null, signalements = null, endormiParDesignation = null) {
  const aujourdHui = new Date();
  return frequences
    .filter((f) => f.cycleJours != null && f.nombreAchats >= 3 && f.derniereDate)
    .filter((f) => !categorieParDesignation || CATEGORIES_REAPPROVISIONNEMENT.includes(categorieParDesignation[f.designation]))
    .filter((f) => !endormiParDesignation || !endormiParDesignation[f.designation])
    .filter((f) => !estAchatArrete(f))
    .map((f) => {
      const joursDepuisDernier = Math.floor((aujourdHui - f.derniereDate) / (1000 * 60 * 60 * 24));
      const joursAvantProchaine = f.cycleJours - joursDepuisDernier;
      return { ...f, joursDepuisDernier, joursAvantProchaine };
    })
    .filter((f) => f.joursAvantProchaine <= seuilJoursAvance)
    .filter((f) => {
      if (!signalements || signalements[f.designation] == null) return true;
      return f.joursAvantProchaine < signalements[f.designation];
    })
    .sort((a, b) => a.joursAvantProchaine - b.joursAvantProchaine);
}
