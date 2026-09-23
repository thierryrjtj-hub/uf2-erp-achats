// Fondation de traduction de l'appli. Pour l'instant seul l'écran de
// connexion est traduit (voir app/login/page.js) — étendre ce dictionnaire
// et l'usage de t() au fur et à mesure des écrans à traduire.
//
// Usage : const t = creerTraducteur(langue); ... {t("connexion")}

export const LANGUES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "mg", label: "Malagasy" },
  { code: "hi", label: "हिन्दी" },
  { code: "mfe", label: "Kreol Morisien" },
];

const DICTIONNAIRE = {
  titreApp: { fr: "Achats Locaux", en: "Local Purchasing", mg: "Fividianana eto an-toerana", hi: "स्थानीय खरीद", mfe: "Sa Aseté Lokal" },
  connexion: { fr: "Connexion", en: "Login", mg: "Fidirana", hi: "लॉगिन", mfe: "Koneksion" },
  nomUtilisateur: { fr: "Nom d'utilisateur", en: "Username", mg: "Anaran'ny mpampiasa", hi: "उपयोगकर्ता नाम", mfe: "Non itilizater" },
  motDePasse: { fr: "Mot de passe", en: "Password", mg: "Teny miafina", hi: "पासवर्ड", mfe: "Mo pas" },
  seConnecter: { fr: "Se connecter", en: "Log in", mg: "Hiditra", hi: "लॉग इन करें", mfe: "Konekté" },
  connexionEnCours: { fr: "Connexion...", en: "Logging in...", mg: "Miditra...", hi: "लॉग इन हो रहा है...", mfe: "Pe konekté..." },
  premiereConnexion: { fr: "Première connexion", en: "First login", mg: "Fidirana voalohany", hi: "पहला लॉगिन", mfe: "Premie konexion" },
  choisirMotDePasse: {
    fr: "Merci de choisir votre propre mot de passe — vous seul le connaîtrez à partir de maintenant.",
    en: "Please choose your own password — only you will know it from now on.",
    mg: "Azafady mifidiana ny teny miafinao manokana — ianao irery no hahalala azy manomboka izao.",
    hi: "कृपया अपना पासवर्ड चुनें — अब से केवल आप ही इसे जानेंगे।",
    mfe: "Silvouple swazir to prop mo pas — zis twa ki pou konn li apartir asterla.",
  },
  nouveauMotDePasse: { fr: "Nouveau mot de passe", en: "New password", mg: "Teny miafina vaovao", hi: "नया पासवर्ड", mfe: "Nouvo mo pas" },
  confirmerMotDePasse: { fr: "Confirmer le mot de passe", en: "Confirm password", mg: "Hamafiso ny teny miafina", hi: "पासवर्ड की पुष्टि करें", mfe: "Konfirm mo pas" },
  validerEtEntrer: { fr: "Valider et entrer dans l'appli", en: "Confirm and enter the app", mg: "Ekeo ary midira ao anaty rindrankaja", hi: "पुष्टि करें और ऐप में प्रवेश करें", mfe: "Valid ek antre dan lapli" },
  enregistrement: { fr: "Enregistrement...", en: "Saving...", mg: "Fitehirizana...", hi: "सहेजा जा रहा है...", mfe: "Pe anrezistré..." },
  afficher: { fr: "Afficher", en: "Show", mg: "Asehoy", hi: "दिखाएं", mfe: "Montre" },
  masquer: { fr: "Masquer", en: "Hide", mg: "Afeno", hi: "छिपाएं", mfe: "Kasiet" },
  langue: { fr: "Langue", en: "Language", mg: "Fiteny", hi: "भाषा", mfe: "Langaz" },
};

export function creerTraducteur(langue) {
  return (cle) => DICTIONNAIRE[cle]?.[langue] || DICTIONNAIRE[cle]?.fr || cle;
}
