"use client";
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Fondation de traduction de l'appli. Traduits pour l'instant : l'écran de
// connexion et le menu de navigation (voir components/Nav.js) — étendre ce
// dictionnaire et l'usage de t() au fur et à mesure des écrans.
//
// Usage dans un composant :  const { t } = useLangue();  ...  {t("connexion")}
// La langue choisie est mémorisée dans le navigateur (et sur le profil du
// compte, pour la retrouver depuis un autre appareil).

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
    mg: "Azafady manasa anao hanova ny teny miafina ety am-piandohana — ianao irery ihany no hahalala azy manomboka izao.",
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
  // ---------- Menu de navigation ----------
  nav_dashboard: { fr: "Tableau de bord", en: "Dashboard", mg: "Tabilao fanaraha-maso", hi: "डैशबोर्ड", mfe: "Tablo de bor" },
  nav_demandes: { fr: "Demandes", en: "Requests", mg: "Fangatahana", hi: "अनुरोध", mfe: "Demann" },
  nav_demandes_liste: { fr: "Liste des demandes", en: "Request list", mg: "Lisitry ny fangatahana", hi: "अनुरोधों की सूची", mfe: "Lalis demann" },
  nav_demandes_nouvelle: { fr: "Nouvelle demande", en: "New request", mg: "Fangatahana vaovao", hi: "नया अनुरोध", mfe: "Nouvo demann" },
  nav_petite_caisse: { fr: "Achat en petite caisse", en: "Petty cash purchase", mg: "Fividianana amin'ny Lelavola avy hatrany", hi: "छोटी नकदी से खरीद", mfe: "Aste avek ptit lakes" },
  nav_carburant_gaz: { fr: "Carburant / Gaz", en: "Fuel / Gas", mg: "Solika / Gazy", hi: "ईंधन / गैस", mfe: "Karbiran / Gaz" },
  nav_commandes: { fr: "Commandes", en: "Purchase orders", mg: "Kaomandy", hi: "खरीद आदेश", mfe: "Bon komann" },
  nav_historique: { fr: "Historique", en: "History", mg: "Tantara", hi: "इतिहास", mfe: "Istorik" },
  nav_historique_globale: { fr: "Vue globale", en: "Overview", mg: "Topi-maso ankapobeny", hi: "समग्र दृश्य", mfe: "Vi global" },
  nav_bois_chauffage: { fr: "Bois de chauffage", en: "Firewood", mg: "Kitay", hi: "जलावन की लकड़ी", mfe: "Dibwa" },
  nav_kpi: { fr: "KPI", en: "KPI", mg: "KPI", hi: "KPI", mfe: "KPI" },
  nav_fournisseurs: { fr: "Fournisseurs", en: "Suppliers", mg: "Mpamatsy", hi: "आपूर्तिकर्ता", mfe: "Fournisser" },
  nav_fournisseurs_liste: { fr: "Liste des fournisseurs", en: "Supplier list", mg: "Lisitry ny mpamatsy", hi: "आपूर्तिकर्ताओं की सूची", mfe: "Lalis fournisser" },
  nav_fournisseurs_ajouter: { fr: "Ajouter un fournisseur", en: "Add a supplier", mg: "Hanampy mpamatsy", hi: "आपूर्तिकर्ता जोड़ें", mfe: "Azoute enn fournisser" },
  nav_articles: { fr: "Articles", en: "Items", mg: "Entana", hi: "वस्तुएँ", mfe: "Artik" },
  nav_articles_liste: { fr: "Liste des articles", en: "Item list", mg: "Lisitry ny entana", hi: "वस्तुओं की सूची", mfe: "Lalis artik" },
  nav_articles_ajouter: { fr: "Ajouter un article", en: "Add an item", mg: "Hanampy entana", hi: "वस्तु जोड़ें", mfe: "Azoute enn artik" },
  nav_articles_categories: { fr: "Gérer les catégories", en: "Manage categories", mg: "Hitantana ny sokajy", hi: "श्रेणियाँ प्रबंधित करें", mfe: "Zere bann kategori" },
  nav_administration: { fr: "Administration", en: "Administration", mg: "Fitantanana", hi: "प्रशासन", mfe: "Administrasyon" },
  nav_journal: { fr: "Journal d'audit", en: "Audit log", mg: "Diarin'ny fanaraha-maso", hi: "ऑडिट लॉग", mfe: "Zournal odit" },
  nav_controle_qualite: { fr: "Contrôle qualité", en: "Quality control", mg: "Fanaraha-maso ny kalitao", hi: "गुणवत्ता नियंत्रण", mfe: "Kontrol kalite" },
  nav_erreurs: { fr: "Journal des erreurs", en: "Error log", mg: "Diarin'ny hadisoana", hi: "त्रुटि लॉग", mfe: "Zournal erer" },
  nav_sauvegarde: { fr: "Sauvegarde", en: "Backup", mg: "Fitehirizana", hi: "बैकअप", mfe: "Sovgard" },
  nav_deconnexion: { fr: "Déconnexion", en: "Log out", mg: "Hivoaka", hi: "लॉग आउट", mfe: "Dekonekte" },
  nav_raccourcis: { fr: "Raccourcis clavier", en: "Keyboard shortcuts", mg: "Lalana fohy amin'ny klavie", hi: "कीबोर्ड शॉर्टकट", mfe: "Rakoursi klavie" },
  nav_cree_par: { fr: "Créé par", en: "Created by", mg: "Nataon'i", hi: "निर्माता:", mfe: "Kree par" },

  actualiser_page: { fr: "Actualiser la page (raccourci : R)", en: "Refresh the page (shortcut: R)", mg: "Havaozy ny pejy (lalana fohy : R)", hi: "पेज रीफ़्रेश करें (शॉर्टकट: R)", mfe: "Rafres lapaz (rakoursi : R)" },
  chargement: { fr: "Chargement...", en: "Loading...", mg: "Miandry kely...", hi: "लोड हो रहा है...", mfe: "Pe sarze..." },

  // ---------- Aide « Raccourcis clavier » ----------
  touche_entree: { fr: "Entrée", en: "Enter", mg: "Enter", hi: "Enter", mfe: "Enter" },
  touche_echap: { fr: "Échap", en: "Esc", mg: "Esc", hi: "Esc", mfe: "Esc" },
  aide_ctrlf: { fr: "recherche de la page", en: "search the page", mg: "hitady eo amin'ny pejy", hi: "पेज में खोजें", mfe: "rod dan lapaz" },
  aide_fleches: { fr: "naviguer les suggestions", en: "browse suggestions", mg: "mizaha ny soso-kevitra", hi: "सुझावों में नेविगेट करें", mfe: "navige bann sizesyon" },
  aide_entree: { fr: "valider le champ / la suggestion", en: "confirm the field / suggestion", mg: "manamarina ny saha / ny soso-kevitra", hi: "फ़ील्ड / सुझाव की पुष्टि करें", mfe: "valid sa champ / sizesyon" },
  aide_entree_tco: {
    fr: "(comparatif, colonne PU HT) — passe à la ligne suivante, puis au fournisseur suivant",
    en: "(comparison table, unit price column) — moves to the next row, then to the next supplier",
    mg: "(tabilao fampitahana, andalana PU HT) — mandeha any amin'ny andalana manaraka, avy eo any amin'ny mpamatsy manaraka",
    hi: "(तुलना तालिका, इकाई मूल्य कॉलम) — अगली पंक्ति पर, फिर अगले आपूर्तिकर्ता पर जाता है",
    mfe: "(tablo konparatif, kolonn PU HT) — al lor lign apre, apre lor fournisser apre",
  },
  aide_echap: { fr: "fermer une liste de suggestions", en: "close a suggestion list", mg: "akatony ny lisitry ny soso-kevitra", hi: "सुझाव सूची बंद करें", mfe: "ferm enn lalis sizesyon" },
  aide_actualiser: { fr: "(hors saisie) — actualiser la page", en: "(when not typing) — refresh the page", mg: "(rehefa tsy mameno saha) — havaozy ny pejy", hi: "(टाइप न करते समय) — पेज रीफ़्रेश करें", mfe: "(kan pa pe ekrir) — rafres lapaz" },
  aide_retour: { fr: "(hors saisie) — retour à la page précédente", en: "(when not typing) — back to the previous page", mg: "(rehefa tsy mameno saha) — miverina amin'ny pejy teo aloha", hi: "(टाइप न करते समय) — पिछले पेज पर वापस", mfe: "(kan pa pe ekrir) — retourn lor lapaz avan" },
  aide_ouvrir_onglet: { fr: "Ouvrir un onglet (hors saisie) :", en: "Open a tab (when not typing):", mg: "Hanokatra tabilao (rehefa tsy mameno saha):", hi: "टैब खोलें (टाइप न करते समय):", mfe: "Ouver enn onglet (kan pa pe ekrir) :" },
  aide_legende_onglets: {
    fr: "T tableau de bord · D demandes (DN nouvelle, DP petite caisse, DC carburant/gaz) · C commandes · H historique (HB bois de chauffage) · K KPI · F fournisseurs (FA ajouter) · AR articles (ARN ajouter, ARG catégories) · AD administration (ADJ journal, ADQ qualité, ADE erreurs) · S sauvegarde",
    en: "T dashboard · D requests (DN new, DP petty cash, DC fuel/gas) · C orders · H history (HB firewood) · K KPI · F suppliers (FA add) · AR items (ARN add, ARG categories) · AD administration (ADJ audit log, ADQ quality, ADE errors) · S backup",
    mg: "T tabilao · D fangatahana (DN vaovao, DP kaoisy kely, DC solika/gazy) · C baiko · H tantara (HB kitay) · K KPI · F mpamatsy (FA hanampy) · AR entana (ARN hanampy, ARG sokajy) · AD fitantanana (ADJ diary, ADQ kalitao, ADE hadisoana) · S fitehirizana",
    hi: "T डैशबोर्ड · D अनुरोध (DN नया, DP छोटी नकदी, DC ईंधन/गैस) · C आदेश · H इतिहास (HB जलावन) · K KPI · F आपूर्तिकर्ता (FA जोड़ें) · AR वस्तुएँ (ARN जोड़ें, ARG श्रेणियाँ) · AD प्रशासन (ADJ लॉग, ADQ गुणवत्ता, ADE त्रुटियाँ) · S बैकअप",
    mfe: "T tablo · D demann (DN nouvo, DP ptit lakes, DC karbiran/gaz) · C komann · H istorik (HB dibwa) · K KPI · F fournisser (FA azoute) · AR artik (ARN azoute, ARG kategori) · AD administrasyon (ADJ zournal, ADQ kalite, ADE erer) · S sovgard",
  },
  aide_lettres_fixes: {
    fr: "Les lettres restent les mêmes quelle que soit la langue.",
    en: "The letters stay the same whatever the language.",
    mg: "Mitovy foana ny litera na inona na inona fiteny.",
    hi: "अक्षर हर भाषा में वही रहते हैं।",
    mfe: "Bann lalet res parey kikenn langaz.",
  },
};

export function creerTraducteur(langue) {
  return (cle) => DICTIONNAIRE[cle]?.[langue] || DICTIONNAIRE[cle]?.fr || cle;
}

const CLE_LANGUE = "uf2_langue";
const EVENEMENT_LANGUE = "uf2-langue-changee";

export function langueMemorisee() {
  if (typeof window === "undefined") return "fr";
  return localStorage.getItem(CLE_LANGUE) || "fr";
}

// Hook : renvoie la langue courante et la fonction de traduction t().
// Se met à jour tout seul si la langue change ailleurs dans l'appli.
export function useLangue() {
  const [langue, setLangue] = useState("fr");

  useEffect(() => {
    const surChangement = () => setLangue(langueMemorisee());
    surChangement();
    window.addEventListener(EVENEMENT_LANGUE, surChangement);

    // Rien en mémoire dans ce navigateur (autre appareil, cache vidé) :
    // on reprend la langue enregistrée sur le profil du compte.
    if (!localStorage.getItem(CLE_LANGUE)) {
      (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const uid = data?.session?.user?.id;
          if (!uid) return;
          const { data: profil } = await supabase.from("profiles").select("langue").eq("id", uid).maybeSingle();
          if (profil?.langue) {
            localStorage.setItem(CLE_LANGUE, profil.langue);
            setLangue(profil.langue);
          }
        } catch (e) { /* mémoire du profil indisponible : on reste en français */ }
      })();
    }
    return () => window.removeEventListener(EVENEMENT_LANGUE, surChangement);
  }, []);

  return { langue, t: creerTraducteur(langue) };
}

// Change la langue partout, tout de suite, et la mémorise (navigateur + profil).
export async function changerLangue(code) {
  localStorage.setItem(CLE_LANGUE, code);
  window.dispatchEvent(new Event(EVENEMENT_LANGUE));
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (uid) await supabase.from("profiles").update({ langue: code }).eq("id", uid);
  } catch (e) { /* la mémorisation sur le profil est un plus, pas bloquante */ }
}
