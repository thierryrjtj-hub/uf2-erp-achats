/**
 * Calculs du Tableau Comparatif des Offres (TCO).
 * Fonctions pures, sans dépendance React — utilisables aussi bien dans
 * l'écran de saisie du TCO que dans le modèle d'impression.
 *
 * Formes de données attendues :
 *
 * article = { numero: number, designation: string, quantite: number, unite: string }
 *
 * fournisseur = {
 *   nom: string,
 *   numeroDevis: string,
 *   dateDevis: string,        // déjà formatée pour l'affichage (ex. "26/5/2026")
 *   nonTaxable: boolean,
 *   tauxRemiseDefaut: number|null,  // taux habituel accordé par ce fournisseur (ex. 15 pour 15%),
 *                                   // vient de la base fournisseurs ; null si inconnu/variable
 *   observation: string,      // conditions libres (échéance, dispo, mode de paiement...),
 *                              // à pré-remplir par défaut depuis la fiche fournisseur
 *   lignes: [{ pu: number|null, remise: number }],  // un élément par article, même ordre
 *                              // remise = montant remisé PAR UNITÉ (pas un %) ; le taux réel
 *                              // se déduit avec tauxRemiseLigne(ligne) pour comparaison
 * }
 */

/** Formate un montant en Ariary avec séparateur de milliers français. Retourne "" pour null/0. */
export function money(n) {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n) + " Ar";
}

/** Montant HT d'une ligne fournisseur pour une quantité donnée, ou null si pas de prix saisi. */
export function montantHT(ligne, qte) {
  if (!ligne || ligne.pu === null || ligne.pu === undefined) return null;
  return (ligne.pu - (ligne.remise || 0)) * qte;
}

/**
 * Calcule la préconisation (offre la moins chère) pour un article donné.
 * Gère les ex-aequo (plusieurs fournisseurs à égalité) et l'exonération de TVA.
 */
export function calculerPreconisation(fournisseurs, articles, articleIndex) {
  const qte = articles[articleIndex].quantite;
  let min = null;
  let gagnants = [];
  fournisseurs.forEach((f) => {
    const m = montantHT(f.lignes[articleIndex], qte);
    if (m !== null) {
      if (min === null || m < min) {
        min = m;
        gagnants = [f.nom];
      } else if (m === min) {
        gagnants.push(f.nom);
      }
    }
  });
  if (min === null) return { fournisseurs: [], totalNetHT: null, montantTTC: null };
  const nonTax = fournisseurs.find((f) => gagnants.includes(f.nom) && f.nonTaxable);
  const ttc = nonTax ? min : min * 1.2;
  return { fournisseurs: gagnants, totalNetHT: min, montantTTC: ttc };
}

/** Calcule la préconisation pour tous les articles d'un coup. */
export function calculerToutesPreconisations(fournisseurs, articles) {
  return articles.map((_, i) => calculerPreconisation(fournisseurs, articles, i));
}

/** Numéros des articles où ce fournisseur est (seul ou ex-aequo) le moins cher. */
export function winningArticleNumbers(f, articles, preconisations) {
  return articles
    .filter((a, i) => preconisations[i].fournisseurs.includes(f.nom))
    .map((a) => a.numero);
}

/** Liste à la française : "3 et 5" / "1, 3 et 5" — plus lisible qu'une liste à virgules. */
export function joinFrench(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return String(arr[0]);
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

/** Totaux HT / TVA / TTC / remise totale pour un fournisseur, tous articles confondus. */
export function totauxFournisseur(f, articles) {
  const montantHTTotal = articles.reduce(
    (s, a, i) => s + (montantHT(f.lignes[i], a.quantite) || 0),
    0
  );
  const tva = f.nonTaxable ? 0 : montantHTTotal * 0.2;
  const remiseTotale = articles.reduce(
    (s, a, i) => s + ((f.lignes[i].remise || 0) * a.quantite),
    0
  );
  return { montantHTTotal, tva, totalTTC: montantHTTotal + tva, remiseTotale };
}

/** Taux de remise réel d'une ligne (arrondi à l'entier), pour comparaison au taux habituel du fournisseur. */
export function tauxRemiseLigne(ligne) {
  if (ligne.pu === null || ligne.pu === undefined || !ligne.pu) return null;
  return Math.round(((ligne.remise || 0) / ligne.pu) * 100);
}

/**
 * Articles dont la remise s'écarte du taux habituel du fournisseur (article
 * en promo laissé sans remise, ou remise exceptionnelle plus forte que
 * d'habitude). Ne s'applique que si le fournisseur a un taux habituel connu
 * (tauxRemiseDefaut) — sinon on ne peut rien comparer.
 */
export function remiseExceptions(f, articles) {
  if (f.tauxRemiseDefaut === null || f.tauxRemiseDefaut === undefined) return [];
  const out = [];
  articles.forEach((a, i) => {
    const ligne = f.lignes[i];
    if (ligne.pu === null || ligne.pu === undefined) return;
    const taux = tauxRemiseLigne(ligne);
    if (taux !== f.tauxRemiseDefaut) {
      out.push({ numero: a.numero, designation: a.designation, taux, tauxDefaut: f.tauxRemiseDefaut });
    }
  });
  return out;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Texte affiché dans la case "Observation" du fournisseur : son champ libre
 * (conditions de paiement, échéance...) suivi des notes automatiques sur les
 * remises qui s'écartent du taux habituel.
 */
export function observationAffichee(f, articles) {
  const auto = remiseExceptions(f, articles).map((e) => {
    if (e.taux === 0) {
      return `* Pas de remise sur l'article n°${e.numero} (${truncate(e.designation, 28)}) — habituellement ${e.tauxDefaut}%`;
    }
    return `* Remise de ${e.taux}% sur l'article n°${e.numero} (${truncate(e.designation, 28)}), au lieu de ${e.tauxDefaut}% habituellement`;
  });
  return [f.observation, ...auto].filter(Boolean).join("\n");
}

/** Totaux HT / TVA / TTC de la demande, au prix le moins cher retenu sur chaque article. */
export function totauxRetenus(preconisations) {
  const totalHTRetenu = preconisations.reduce((s, p) => s + (p.totalNetHT || 0), 0);
  const totalTTCRetenu = preconisations.reduce((s, p) => s + (p.montantTTC || 0), 0);
  const totalTVARetenu = totalTTCRetenu - totalHTRetenu;
  return { totalHTRetenu, totalTVARetenu, totalTTCRetenu };
}

/**
 * Un fournisseur consulté mais qui n'a soumis aucun prix ne doit pas occuper
 * de colonne dans le document imprimé (il se signale plutôt via le champ
 * libre "Autres fournisseurs consultés").
 */
export function fournisseursAvecOffre(fournisseurs) {
  return fournisseurs.filter((f) => f.lignes.some((l) => l.pu !== null && l.pu !== undefined));
}

/** Découpe un tableau en groupes de taille fixe (pour la pagination horizontale). */
export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Orientation et nombre de fournisseurs par page :
 * - moins de 2 fournisseurs avec offre -> portrait (1 colonne fournisseur
 *   tient très à l'aise en largeur A4 portrait)
 * - 2 fournisseurs ou plus -> paysage, plafonné à 4 fournisseurs par page
 */
export function getLayoutPlan(fournisseurs, { suppliersPerPageMax = 4 } = {}) {
  const avecOffre = fournisseursAvecOffre(fournisseurs);
  const orientation = avecOffre.length < 2 ? "portrait" : "landscape";
  const suppliersPerPage = orientation === "portrait" ? 1 : suppliersPerPageMax;
  const pages = chunk(avecOffre, suppliersPerPage);
  return { avecOffre, orientation, suppliersPerPage, pages };
}

/**
 * Le tableau se resserre (beaucoup d'articles) ou respire (peu d'articles)
 * pour que la page imprimée reste équilibrée dans les deux cas.
 */
export function getDensityClass(articleCount) {
  if (articleCount > 10) return "density-compact";
  if (articleCount <= 3) return "density-cozy";
  return "";
}
