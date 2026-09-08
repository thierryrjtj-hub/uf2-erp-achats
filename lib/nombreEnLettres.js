const UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

function centaineEnLettres(n) {
  if (n === 0) return "";
  let mots = [];
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c > 0) mots.push((c > 1 ? UNITES[c] + " " : "") + "cent" + (c > 1 && reste === 0 ? "s" : ""));
  if (reste > 0) {
    if (reste < 20) {
      mots.push(UNITES[reste]);
    } else {
      const d = Math.floor(reste / 10);
      const u = reste % 10;
      if (d === 7 || d === 9) {
        mots.push(DIZAINES[d - 1] + "-" + UNITES[10 + u]);
      } else {
        let mot = DIZAINES[d];
        if (u === 1 && d !== 8) mot += " et un";
        else if (u > 0) mot += "-" + UNITES[u];
        else if (d === 8) mot += "s";
        mots.push(mot);
      }
    }
  }
  return mots.join(" ");
}

// Convertit un nombre entier en toutes lettres françaises (ex: 654480 -> "six cent cinquante-quatre mille quatre cent quatre-vingts")
export function nombreEnLettres(nombre) {
  let n = Math.round(Math.abs(Number(nombre) || 0));
  if (n === 0) return "zéro";

  const tranches = [
    { valeur: 1000000000, mot: "milliard" },
    { valeur: 1000000, mot: "million" },
    { valeur: 1000, mot: "mille" },
  ];

  let mots = [];
  for (const t of tranches) {
    const q = Math.floor(n / t.valeur);
    if (q > 0) {
      if (t.valeur === 1000 && q === 1) {
        mots.push("mille");
      } else {
        mots.push(centaineEnLettres(q) + " " + t.mot + (q > 1 && t.valeur !== 1000 ? "s" : ""));
      }
      n = n % t.valeur;
    }
  }
  if (n > 0) mots.push(centaineEnLettres(n));

  return mots.join(" ").replace(/\s+/g, " ").trim();
}

// Montant en toutes lettres suivi de la devise, formaté pour la phrase d'usage
export function montantEnLettresAriary(montant) {
  const texte = nombreEnLettres(montant);
  return texte.charAt(0).toUpperCase() + texte.slice(1) + " Ariary";
}

