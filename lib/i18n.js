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
  // ---------- Menu de navigation ----------
  nav_dashboard: { fr: "Tableau de bord", en: "Dashboard", mg: "Tabilao fanaraha-maso", hi: "डैशबोर्ड", mfe: "Tablo de bor" },
  nav_demandes: { fr: "Demandes", en: "Requests", mg: "Fangatahana", hi: "अनुरोध", mfe: "Demann" },
  nav_demandes_liste: { fr: "Liste des demandes", en: "Request list", mg: "Lisitry ny fangatahana", hi: "अनुरोधों की सूची", mfe: "Lalis demann" },
  nav_demandes_nouvelle: { fr: "Nouvelle demande", en: "New request", mg: "Fangatahana vaovao", hi: "नया अनुरोध", mfe: "Nouvo demann" },
  nav_petite_caisse: { fr: "Achat en petite caisse", en: "Petty cash purchase", mg: "Fividianana amin'ny kaoisy kely", hi: "छोटी नकदी से खरीद", mfe: "Aste avek ptit lakes" },
  nav_carburant_gaz: { fr: "Carburant / Gaz", en: "Fuel / Gas", mg: "Solika / Gazy", hi: "ईंधन / गैस", mfe: "Karbiran / Gaz" },
  nav_commandes: { fr: "Commandes", en: "Purchase orders", mg: "Baiko fividianana", hi: "खरीद आदेश", mfe: "Bon komann" },
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

  // ---------- Tableau de bord ----------
  db_a_traiter: { fr: "À traiter aujourd'hui", en: "To do today", mg: "Ho vitaina anio", hi: "आज करने योग्य", mfe: "Pou fer zordi" },
  db_resume_demandes: { fr: "demande(s) à traiter", en: "request(s) to process", mg: "fangatahana harahina", hi: "संसाधित करने हेतु अनुरोध", mfe: "demann pou tret" },
  db_resume_bc_livraison: { fr: "BC en attente de livraison", en: "PO awaiting delivery", mg: "BC miandry fanaterana", hi: "डिलीवरी की प्रतीक्षा में खरीद आदेश", mfe: "BC pe ekspekte livrezon" },
  db_resume_bc_signature: { fr: "BC en attente de signature direction", en: "PO awaiting management signature", mg: "BC miandry sonia avy amin'ny fitantanana", hi: "प्रबंधन के हस्ताक्षर की प्रतीक्षा में खरीद आदेश", mfe: "BC pe ekspekte sinyatir direksyon" },
  db_resume_factures: { fr: "facture(s) impayée(s)", en: "unpaid invoice(s)", mg: "faktiora tsy voaloa", hi: "अवैतनिक चालान", mfe: "faktir pa peye" },
  db_resume_standby: { fr: "DA en stand-by", en: "PR(s) on hold", mg: "DA mijanona kelikely", hi: "होल्ड पर DA", mfe: "DA an stand-by" },
  db_rien: { fr: "✓ Rien à signaler pour l'instant — tout est à jour.", en: "✓ Nothing to report for now — everything is up to date.", mg: "✓ Tsy misy zavatra hambara amin'izao — voafehy daholo.", hi: "✓ अभी कुछ सूचित करने को नहीं — सब कुछ अद्यतन है।", mfe: "✓ Nanye pou raporte pou le moman — tou a zour." },
  db_aucun_article: { fr: "Aucun article", en: "No items", mg: "Tsy misy entana", hi: "कोई वस्तु नहीं", mfe: "Pena artik" },

  db_sec_devis: { fr: "Relances devis fournisseurs", en: "Supplier quote follow-ups", mg: "Fampahatsiarovana ny devisy mpamatsy", hi: "आपूर्तिकर्ता कोटेशन अनुस्मारक", mfe: "Rapel devi fournisser" },
  db_devis_ligne: { fr: "créée il y a {n} jour(s), toujours sans prix saisi", en: "created {n} day(s) ago, still no price entered", mg: "noforonina {n} andro lasa, mbola tsy misy vidiny voasoratra", hi: "{n} दिन पहले बनाया गया, अब भी कोई मूल्य दर्ज नहीं", mfe: "kree ena {n} zour, ankor pena pri antre" },

  db_sec_livraison: { fr: "Suivi livraison / enlèvement fournisseurs", en: "Supplier delivery / pickup follow-up", mg: "Fanarahana ny fanaterana / fakana amin'ny mpamatsy", hi: "आपूर्तिकर्ता डिलीवरी / पिकअप की निगरानी", mfe: "Swivi livrezon / rekipeasyon fournisser" },
  db_livraison_enlevement: {
    fr: "enlèvement par nos soins prévu — avez-vous déjà planifié la récupération avec le coursier ? (envoyé il y a {n} jour(s))",
    en: "pickup by us planned — have you already scheduled the collection with the courier? (sent {n} day(s) ago)",
    mg: "fakana ataontsika manokana kasaina — efa nokarakarainao ve ny fakana miaraka amin'ny mpitatitra? (nalefa {n} andro lasa)",
    hi: "हमारे द्वारा पिकअप नियोजित — क्या आपने कूरियर के साथ संग्रहण की योजना बना ली है? ({n} दिन पहले भेजा गया)",
    mfe: "rekipeasyon par nou mem previ — eski ou finn deza planifie rekipeasyon avek kourier? (avoye ena {n} zour)",
  },
  db_livraison_fournisseur: { fr: "envoyé au fournisseur il y a {n} jour(s), toujours pas reçu", en: "sent to the supplier {n} day(s) ago, still not received", mg: "nalefa tany amin'ny mpamatsy {n} andro lasa, mbola tsy voaray", hi: "{n} दिन पहले आपूर्तिकर्ता को भेजा गया, अब भी प्राप्त नहीं", mfe: "avoye ar fournisser ena {n} zour, ankor pa resevwar" },
  db_relance_verification: { fr: "{ord} vérification faite", en: "{ord} check done", mg: "fanamarinana {ord} vita", hi: "{ord} बार जाँच हो गई", mfe: "{ord} verifikasyon fer" },
  db_relance_envoyee: { fr: "{ord} relance envoyée", en: "{ord} reminder sent", mg: "fampahatsiarovana {ord} nalefa", hi: "{ord} बार अनुस्मारक भेजा गया", mfe: "{ord} rapel avoye" },
  db_btn_deja_planifie: { fr: "Déjà planifié", en: "Already scheduled", mg: "Efa voakarakara", hi: "पहले से नियोजित", mfe: "Deza planifie" },
  db_btn_relancer: { fr: "Relancer", en: "Follow up", mg: "Ampahatsiaro", hi: "अनुस्मारक भेजें", mfe: "Relans" },
  db_titre_planifie: { fr: "Récupération déjà planifiée — masquer jusqu'à ce que le retard s'aggrave", en: "Collection already scheduled — hide until the delay gets worse", mg: "Efa voakarakara ny fakana — afeno mandra-pahasarotra ny fahatarana", hi: "संग्रहण पहले से नियोजित — देरी बढ़ने तक छिपाएँ", mfe: "Rekipeasyon deza planifie — kasiet ziska ki retar vinn pli grav" },
  db_titre_relance: { fr: "J'ai relancé le fournisseur — masquer jusqu'à ce que le retard s'aggrave", en: "I have followed up with the supplier — hide until the delay gets worse", mg: "Efa nampahatsiahy ny mpamatsy aho — afeno mandra-pahasarotra ny fahatarana", hi: "मैंने आपूर्तिकर्ता को अनुस्मारक भेजा — देरी बढ़ने तक छिपाएँ", mfe: "Mo finn relans fournisser — kasiet ziska ki retar vinn pli grav" },

  db_sec_estimation: { fr: "Reste à livrer — date estimée atteinte", en: "Remaining to deliver — estimated date reached", mg: "Sisa aterina — tonga ny daty tombantombana", hi: "शेष डिलीवरी — अनुमानित तिथि आ गई", mfe: "Res pou livre — dat estime ateny" },
  db_estimation_ligne: { fr: "reste attendu pour le {date}", en: "remainder expected on {date}", mg: "ny sisa andrasana amin'ny {date}", hi: "शेष {date} को अपेक्षित", mfe: "res ekspekte le {date}" },
  db_sec_paiement: { fr: "Factures fournisseurs en retard de paiement", en: "Supplier invoices overdue for payment", mg: "Faktiora mpamatsy tara fandoavana", hi: "आपूर्तिकर्ता चालान — भुगतान में देरी", mfe: "Faktir fournisser an retar pou peyman" },
  db_paiement_ligne: { fr: "échéance dépassée", en: "due date passed", mg: "lany daty ny fe-potoana", hi: "देय तिथि निकल चुकी", mfe: "dat limit depase" },
  db_sec_import: { fr: "Demandeurs à aviser par mail (article non disponible localement)", en: "Requesters to notify by email (item not available locally)", mg: "Mpangataka horaisina an'email (entana tsy misy eto an-toerana)", hi: "ईमेल से सूचित किए जाने वाले अनुरोधकर्ता (वस्तु स्थानीय रूप से उपलब्ध नहीं)", mfe: "Demander pou avize par mail (artik pa disponib lokalman)" },

  db_sec_reappro: { fr: "Réapprovisionnement à prévoir (cycle d'achat habituel qui approche)", en: "Restocking to plan (usual purchasing cycle approaching)", mg: "Famenoana entana haomana (akaiky ny fihodinan'ny fividianana mahazatra)", hi: "पुनः आपूर्ति की योजना (सामान्य खरीद चक्र निकट)", mfe: "Reaprovizyonman pou prevwar (sik aste abitye pe apros)" },
  db_reappro_habitude: { fr: "commandé habituellement tous les {cycle} jours, dernière commande il y a {depuis} jours", en: "usually ordered every {cycle} days, last order {depuis} days ago", mg: "matetika alaina isaky ny {cycle} andro, baiko farany {depuis} andro lasa", hi: "आमतौर पर हर {cycle} दिन में मँगाया जाता है, अंतिम आदेश {depuis} दिन पहले", mfe: "abitielman komande tou le {cycle} zour, dernie komann ena {depuis} zour" },
  db_reappro_depasse: { fr: "délai dépassé", en: "overdue", mg: "tara", hi: "समय सीमा पार", mfe: "delai depase" },
  db_reappro_prochaine: { fr: "prochaine échéance dans {n} jour(s)", en: "next due in {n} day(s)", mg: "fe-potoana manaraka afaka {n} andro", hi: "अगली देय तिथि {n} दिन में", mfe: "prosenn ekseans dan {n} zour" },
  db_btn_traite: { fr: "Traité", en: "Done", mg: "Vita", hi: "संपन्न", mfe: "Fini" },
  db_titre_traite: { fr: "J'ai avisé les personnes concernées — masquer jusqu'à ce que le retard s'aggrave", en: "I have notified the people concerned — hide until the delay gets worse", mg: "Efa nampahafantatra ireo olona voakasika aho — afeno mandra-pahasarotra ny fahatarana", hi: "मैंने संबंधित लोगों को सूचित कर दिया — देरी बढ़ने तक छिपाएँ", mfe: "Mo finn avize bann dimounn konsernen — kasiet ziska ki retar vinn pli grav" },

  db_sec_standby: { fr: "Demandes en stand-by dont le cycle habituel revient — décision à prendre", en: "Requests on hold whose usual cycle is back — decision needed", mg: "Fangatahana mijanona kelikely izay miverina ny fihodinany mahazatra — fanapahan-kevitra horaisina", hi: "होल्ड पर अनुरोध जिनका सामान्य चक्र लौट आया है — निर्णय आवश्यक", mfe: "Demann an stand-by ki sik abitye pe retourn — desizyon pou pran" },
  db_standby_un: {
    fr: "en stand-by, mais {articles} arrive à échéance de réapprovisionnement habituelle : à toi de décider si tu relances ou pas",
    en: "on hold, but {articles} has reached its usual restocking date: it is up to you to decide whether to relaunch or not",
    mg: "mijanona kelikely, fa {articles} tonga amin'ny fe-potoana mahazatra hamenoana indray: anao ny hisafidy hamerina na tsia",
    hi: "होल्ड पर है, लेकिन {articles} सामान्य पुनः आपूर्ति तिथि पर पहुँच गया है: फिर से शुरू करना है या नहीं, यह आप तय करें",
    mfe: "an stand-by, me {articles} finn ariv so dat reaprovizyonman abitye: se ou ki pou desid si ou relans ou pa",
  },
  db_standby_plusieurs: {
    fr: "en stand-by, mais {articles} arrivent à échéance de réapprovisionnement habituelle : à toi de décider si tu relances ou pas",
    en: "on hold, but {articles} have reached their usual restocking date: it is up to you to decide whether to relaunch or not",
    mg: "mijanona kelikely, fa {articles} tonga amin'ny fe-potoana mahazatra hamenoana indray: anao ny hisafidy hamerina na tsia",
    hi: "होल्ड पर है, लेकिन {articles} सामान्य पुनः आपूर्ति तिथि पर पहुँच गए हैं: फिर से शुरू करना है या नहीं, यह आप तय करें",
    mfe: "an stand-by, me {articles} finn ariv zot dat reaprovizyonman abitye: se ou ki pou desid si ou relans ou pa",
  },

  db_tendance: { fr: "Tendance des achats (6 derniers mois, TTC)", en: "Purchase trend (last 6 months, incl. tax)", mg: "Fironana ny fividianana (enim-bolana farany, TTC)", hi: "खरीद प्रवृत्ति (पिछले 6 महीने, कर सहित)", mfe: "Tandans bann aste (6 dernie mwa, TTC)" },
  db_agenda_titre: { fr: "Agenda / rendez-vous rapide", en: "Agenda / quick appointments", mg: "Fandaharam-potoana / fihaonana faingana", hi: "एजेंडा / त्वरित अपॉइंटमेंट", mfe: "Azenda / rendevou rapid" },
  db_agenda_placeholder: { fr: "Rendez-vous...", en: "Appointment...", mg: "Fihaonana...", hi: "अपॉइंटमेंट...", mfe: "Rendevou..." },
  db_agenda_vide: { fr: "Aucun rendez-vous à venir.", en: "No upcoming appointments.", mg: "Tsy misy fihaonana ho avy.", hi: "कोई आगामी अपॉइंटमेंट नहीं।", mfe: "Okenn rendevou pou vini." },
  db_agenda_a: { fr: " à {h}", en: " at {h}", mg: " tamin'ny {h}", hi: " {h} बजे", mfe: " a {h}" },
  db_taches_titre: { fr: "Notes / tâches rapides", en: "Notes / quick tasks", mg: "Naotin-javatra / asa faingana", hi: "नोट्स / त्वरित कार्य", mfe: "Not / tas rapid" },
  db_taches_placeholder: { fr: "Nouvelle tâche...", en: "New task...", mg: "Asa vaovao...", hi: "नया कार्य...", mfe: "Nouvo tas..." },
  db_taches_vide: { fr: "Aucune tâche en attente.", en: "No pending tasks.", mg: "Tsy misy asa miandry.", hi: "कोई लंबित कार्य नहीं।", mfe: "Okenn tas an atant." },

  // ---------- Communs (réutilisés par plusieurs écrans) ----------
  tous_statuts: { fr: "Tous les statuts", en: "All statuses", mg: "Ny sata rehetra", hi: "सभी स्थितियाँ", mfe: "Tou bann statit" },
  toutes_annees: { fr: "Toutes les années", en: "All years", mg: "Ny taona rehetra", hi: "सभी वर्ष", mfe: "Tou bann lane" },
  annee_defaut_info: { fr: "Par défaut, seule l'année en cours est affichée", en: "By default, only the current year is shown", mg: "Ny taona ankehitriny ihany no aseho raha tsy misy fanovana", hi: "डिफ़ॉल्ट रूप से केवल चालू वर्ष दिखाया जाता है", mfe: "Par defo, zis lane kouran ki afise" },
  chargement_suite: { fr: "Chargement de la suite...", en: "Loading more...", mg: "Miandry ny manaraka...", hi: "और लोड हो रहा है...", mfe: "Pe sarze lasit..." },
  n_de_plus: { fr: "{n} de plus en bas...", en: "{n} more below...", mg: "{n} hafa eo ambany...", hi: "नीचे {n} और...", mfe: "{n} ankor anba..." },
  tout_selectionner: { fr: "Tout sélectionner", en: "Select all", mg: "Fidio daholo", hi: "सभी चुनें", mfe: "Selektsyonn tou" },
  effacer: { fr: "Effacer", en: "Clear", mg: "Fafana", hi: "मिटाएँ", mfe: "Efas" },
  btn_reactiver: { fr: "Réactiver", en: "Reactivate", mg: "Hamerina", hi: "पुनः सक्रिय करें", mfe: "Reaktiv" },
  btn_annuler: { fr: "Annuler", en: "Cancel", mg: "Foano", hi: "रद्द करें", mfe: "Anile" },
  btn_supprimer: { fr: "Supprimer", en: "Delete", mg: "Fafana", hi: "हटाएँ", mfe: "Efase" },
  btn_exporter_excel: { fr: "Exporter en Excel", en: "Export to Excel", mg: "Alefa ho Excel", hi: "Excel में निर्यात करें", mfe: "Eksport an Excel" },
  generation: { fr: "Génération...", en: "Generating...", mg: "Mamokatra...", hi: "बन रहा है...", mfe: "Pe zenere..." },
  col_date: { fr: "Date", en: "Date", mg: "Daty", hi: "तिथि", mfe: "Dat" },
  col_numero_bc: { fr: "N° BC", en: "PO no.", mg: "Laharana BC", hi: "BC सं.", mfe: "N° BC" },
  col_fournisseur: { fr: "Fournisseur", en: "Supplier", mg: "Mpamatsy", hi: "आपूर्तिकर्ता", mfe: "Fournisser" },
  col_statut: { fr: "Statut", en: "Status", mg: "Sata", hi: "स्थिति", mfe: "Statit" },
  col_observation: { fr: "Observation", en: "Remarks", mg: "Fanamarihana", hi: "टिप्पणी", mfe: "Obzervasyon" },
  col_montant_ttc: { fr: "Montant TTC", en: "Amount incl. tax", mg: "Vola TTC", hi: "राशि (कर सहित)", mfe: "Montan TTC" },
  tri_titre: { fr: "Trier l'affichage", en: "Sort the display", mg: "Alahatra ny fampisehoana", hi: "प्रदर्शन क्रमबद्ध करें", mfe: "Trie afisaz" },
  tri_trier: { fr: "Trier", en: "Sort", mg: "Alahatra", hi: "क्रमबद्ध करें", mfe: "Trie" },
  tri_par: { fr: "Trier par", en: "Sort by", mg: "Alahatra araka ny", hi: "इसके अनुसार क्रमबद्ध करें", mfe: "Trie par" },

  // Statuts (les valeurs stockées en base restent en français, seul l'affichage est traduit)
  st_a_faire: { fr: "A faire", en: "To do", mg: "Ho vitaina", hi: "करना है", mfe: "Pou fer" },
  st_en_cours: { fr: "En cours", en: "In progress", mg: "Eo am-pandehanana", hi: "प्रगति में", mfe: "An kour" },
  st_envoyee: { fr: "Envoyée", en: "Sent", mg: "Nalefa", hi: "भेजा गया", mfe: "Avoye" },
  st_livraison_en_cours: { fr: "Livraison en cours", en: "Delivery in progress", mg: "Eo am-panaterana", hi: "डिलीवरी जारी", mfe: "Livrezon an kour" },
  st_cloturee: { fr: "Clôturée", en: "Closed", mg: "Voakatona", hi: "बंद", mfe: "Klotire" },
  st_cloturee_rupture: { fr: "Clôturée (rupture)", en: "Closed (stock-out)", mg: "Voakatona (tsy misy entana)", hi: "बंद (स्टॉक समाप्त)", mfe: "Klotire (rupture)" },
  st_annulee: { fr: "Annulée", en: "Cancelled", mg: "Nofoanana", hi: "रद्द", mfe: "Anile" },
  st_partiellement_traitee: { fr: "Partiellement traitée", en: "Partially processed", mg: "Voahodina ampahany", hi: "आंशिक रूप से संसाधित", mfe: "Partielman trete" },
  st_basculee_commande: { fr: "Basculée en commande", en: "Converted to order", mg: "Nafindra ho baiko", hi: "आदेश में परिवर्तित", mfe: "Konverti an komann" },
  st_en_stand_by: { fr: "En stand-by", en: "On hold", mg: "Mijanona kelikely", hi: "होल्ड पर", mfe: "An stand-by" },

  // ---------- Liste des commandes ----------
  cmd_titre: { fr: "Bons de commande", en: "Purchase orders", mg: "Baiko fividianana", hi: "खरीद आदेश", mfe: "Bon komann" },
  cmd_btn_creer: { fr: "+ Créer un BC directement", en: "+ Create a PO directly", mg: "+ Hamorona BC mivantana", hi: "+ सीधे BC बनाएँ", mfe: "+ Kree enn BC direkteman" },
  cmd_btn_pv: { fr: "PV vierge", en: "Blank receipt form", mg: "PV foana", hi: "रिक्त प्राप्ति रिपोर्ट", mfe: "PV vid" },
  cmd_btn_export_selection: { fr: "Exporter le contenu de {n} BC sélectionné(s)", en: "Export the content of {n} selected PO(s)", mg: "Alefa ny votoatin'ny BC voafidy {n}", hi: "चयनित {n} BC की सामग्री निर्यात करें", mfe: "Eksport kontni {n} BC selektsyone" },
  cmd_btn_rapport_impayees: { fr: "Rapport factures impayées", en: "Unpaid invoices report", mg: "Tatitra faktiora tsy voaloa", hi: "अवैतनिक चालान रिपोर्ट", mfe: "Rapor faktir pa peye" },
  cmd_rapport_info: { fr: "Rapport à envoyer au service Finance", en: "Report to send to the Finance department", mg: "Tatitra halefa any amin'ny sampana Finance", hi: "वित्त विभाग को भेजने के लिए रिपोर्ट", mfe: "Rapor pou avoye lor servis Finans" },
  cmd_banniere_livraison: { fr: "Filtré depuis le Tableau de bord : seuls les {n} BC en attente de livraison sont affichés.", en: "Filtered from the Dashboard: only the {n} PO(s) awaiting delivery are shown.", mg: "Nosivanina avy amin'ny Tabilao: ny BC {n} miandry fanaterana ihany no aseho.", hi: "डैशबोर्ड से फ़िल्टर किया गया: डिलीवरी की प्रतीक्षा में केवल {n} BC दिखाए गए हैं।", mfe: "Filtre depi Tablo de bor: zis {n} BC ki pe ekspekte livrezon ki afise." },
  cmd_banniere_signature: { fr: "Filtré depuis le Tableau de bord : seuls les {n} BC en attente de signature direction sont affichés.", en: "Filtered from the Dashboard: only the {n} PO(s) awaiting management signature are shown.", mg: "Nosivanina avy amin'ny Tabilao: ny BC {n} miandry sonia avy amin'ny fitantanana ihany no aseho.", hi: "डैशबोर्ड से फ़िल्टर किया गया: प्रबंधन के हस्ताक्षर की प्रतीक्षा में केवल {n} BC दिखाए गए हैं।", mfe: "Filtre depi Tablo de bor: zis {n} BC ki pe ekspekte sinyatir direksyon ki afise." },
  cmd_banniere_impayees: { fr: "Filtré depuis le Tableau de bord : seuls les {n} BC avec facture impayée sont affichés.", en: "Filtered from the Dashboard: only the {n} PO(s) with an unpaid invoice are shown.", mg: "Nosivanina avy amin'ny Tabilao: ny BC {n} manana faktiora tsy voaloa ihany no aseho.", hi: "डैशबोर्ड से फ़िल्टर किया गया: अवैतनिक चालान वाले केवल {n} BC दिखाए गए हैं।", mfe: "Filtre depi Tablo de bor: zis {n} BC avek faktir pa peye ki afise." },
  cmd_voir_tous: { fr: "Voir tous les BC", en: "See all POs", mg: "Hijery ny BC rehetra", hi: "सभी BC देखें", mfe: "Get tou BC" },
  cmd_liste_special: { fr: "Liste ({a} / {b})", en: "List ({a} / {b})", mg: "Lisitra ({a} / {b})", hi: "सूची ({a} / {b})", mfe: "Lalis ({a} / {b})" },
  cmd_liste_toutes: { fr: "Liste ({charges} chargés / {total} au total)", en: "List ({charges} loaded / {total} in total)", mg: "Lisitra (voaray {charges} / {total} rehetra)", hi: "सूची ({charges} लोड / कुल {total})", mfe: "Lalis ({charges} sarze / {total} total)" },
  cmd_liste_annee: { fr: "Liste ({charges} chargés / {total} au total, année {annee})", en: "List ({charges} loaded / {total} in total, year {annee})", mg: "Lisitra (voaray {charges} / {total} rehetra, taona {annee})", hi: "सूची ({charges} लोड / कुल {total}, वर्ष {annee})", mfe: "Lalis ({charges} sarze / {total} total, lane {annee})" },
  cmd_recherche: { fr: "Rechercher (N° BC, fournisseur...)", en: "Search (PO no., supplier...)", mg: "Hitady (laharana BC, mpamatsy...)", hi: "खोजें (BC सं., आपूर्तिकर्ता...)", mfe: "Rod (N° BC, fournisser...)" },
  cmd_aucun: { fr: "Aucun bon de commande pour ces filtres.", en: "No purchase order for these filters.", mg: "Tsy misy baiko fividianana amin'ireo sivana ireo.", hi: "इन फ़िल्टरों के लिए कोई खरीद आदेश नहीं।", mfe: "Okenn bon komann pou bann filtre-la." },
  cmd_h_date_bc: { fr: "Date BC", en: "PO date", mg: "Daty BC", hi: "BC तिथि", mfe: "Dat BC" },
  cmd_h_total_ttc: { fr: "Total TTC", en: "Total incl. tax", mg: "Fitambarany TTC", hi: "कुल (कर सहित)", mfe: "Total TTC" },
  cmd_h_service: { fr: "Service / Demandeur", en: "Department / Requester", mg: "Sampana / Mpangataka", hi: "विभाग / अनुरोधकर्ता", mfe: "Servis / Demander" },
  cmd_h_reception: { fr: "Réception", en: "Receipt", mg: "Fandraisana", hi: "प्राप्ति", mfe: "Resepsyon" },
  cmd_h_paiement: { fr: "Paiement", en: "Payment", mg: "Fandoavana", hi: "भुगतान", mfe: "Peyman" },
  cmd_prestation_effectuee: { fr: "Prestation effectuée", en: "Service completed", mg: "Vita ny asa", hi: "सेवा पूर्ण", mfe: "Servis fer" },
  cmd_prestation_partielle: { fr: "Prestation partielle", en: "Service partially completed", mg: "Vita ampahany ny asa", hi: "सेवा आंशिक", mfe: "Servis partiel" },
  cmd_prestation_non: { fr: "Prestation non effectuée", en: "Service not completed", mg: "Tsy vita ny asa", hi: "सेवा पूर्ण नहीं", mfe: "Servis pa fer" },
  cmd_livre_magasin: { fr: "Livré au Magasin", en: "Delivered to the Store", mg: "Nateraka tany amin'ny Magazay", hi: "स्टोर में डिलीवर", mfe: "Livre dan Magazin" },
  cmd_livre_partiel_magasin: { fr: "Livré partiellement au Magasin", en: "Partially delivered to the Store", mg: "Nateraka ampahany tany amin'ny Magazay", hi: "स्टोर में आंशिक डिलीवरी", mfe: "Livre partielman dan Magazin" },
  cmd_livre: { fr: "Livré", en: "Delivered", mg: "Nateraka", hi: "डिलीवर", mfe: "Livre" },
  cmd_livre_partiel: { fr: "Livré partiellement", en: "Partially delivered", mg: "Nateraka ampahany", hi: "आंशिक डिलीवरी", mfe: "Livre partielman" },
  cmd_non_livre: { fr: "Non livré", en: "Not delivered", mg: "Tsy mbola nateraka", hi: "डिलीवर नहीं", mfe: "Pa livre" },
  cmd_par: { fr: "par {nom}", en: "by {nom}", mg: "nataon'i {nom}", hi: "{nom} द्वारा", mfe: "par {nom}" },
  cmd_import_historique: { fr: "📥 import historique", en: "📥 historical import", mg: "📥 fampidirana tantara", hi: "📥 ऐतिहासिक आयात", mfe: "📥 import istorik" },
  cmd_import_info: { fr: "Date d'import de l'historique, pas la date réelle de réception", en: "Historical import date, not the actual receipt date", mg: "Daty nampidirana ny tantara, fa tsy ny daty tena nandraisana", hi: "इतिहास के आयात की तिथि, वास्तविक प्राप्ति तिथि नहीं", mfe: "Dat import istorik, pa dat reel resepsyon" },
  cmd_paye: { fr: "Payé", en: "Paid", mg: "Voaloa", hi: "भुगतान किया", mfe: "Peye" },
  cmd_echeance_depassee: { fr: "Échéance dépassée", en: "Overdue", mg: "Lany daty", hi: "देय तिथि पार", mfe: "Ekseans depase" },
  cmd_impaye: { fr: "Impayé", en: "Unpaid", mg: "Tsy voaloa", hi: "अवैतनिक", mfe: "Pa peye" },
  cmd_confirm_supprimer: { fr: "Supprimer définitivement le bon de commande {numero} ? Sa réception et son historique seront aussi supprimés.", en: "Permanently delete purchase order {numero}? Its receipt and history will also be deleted.", mg: "Hofafana tanteraka ve ny baiko fividianana {numero}? Ho voafafa koa ny fandraisana sy ny tantarany.", hi: "क्या खरीद आदेश {numero} को स्थायी रूप से हटाएँ? इसकी प्राप्ति और इतिहास भी हटा दिए जाएँगे।", mfe: "Efas definitivman bon komann {numero}? So resepsyon ek so istorik pou osi efase." },
  cmd_confirm_reactiver: { fr: "Réactiver le BC {numero} (retirer le statut Annulée) ?", en: "Reactivate PO {numero} (remove the Cancelled status)?", mg: "Hamerina ny BC {numero} ve (esorina ny sata Nofoanana)?", hi: "क्या BC {numero} को पुनः सक्रिय करें (रद्द स्थिति हटाएँ)?", mfe: "Reaktiv BC {numero} (retir statit Anile)?" },
  cmd_prompt_annuler: { fr: "Pourquoi annuler le BC {numero} ? (raison obligatoire)", en: "Why cancel PO {numero}? (reason required)", mg: "Nahoana no hofoanana ny BC {numero}? (tsy maintsy misy antony)", hi: "BC {numero} क्यों रद्द करें? (कारण अनिवार्य)", mfe: "Kifer anile BC {numero}? (rezon obligatwar)" },

  // ---------- Communs : saisie de lignes, totaux ----------
  retour: { fr: "Retour", en: "Back", mg: "Miverina", hi: "वापस", mfe: "Retour" },
  ph_designation: { fr: "Désignation", en: "Description", mg: "Famaritana", hi: "विवरण", mfe: "Deskripsyon" },
  ph_qte: { fr: "Qté", en: "Qty", mg: "Habetsany", hi: "मात्रा", mfe: "Kantite" },
  ph_unite: { fr: "unité", en: "unit", mg: "singa", hi: "इकाई", mfe: "inite" },
  ph_remise: { fr: "remise %", en: "discount %", mg: "fihenam-bidy %", hi: "छूट %", mfe: "remiz %" },
  btn_retirer: { fr: "Retirer", en: "Remove", mg: "Esory", hi: "हटाएँ", mfe: "Retir" },
  btn_choisir: { fr: "Choisir", en: "Choose", mg: "Fidio", hi: "चुनें", mfe: "Swazir" },
  btn_changer: { fr: "Changer", en: "Change", mg: "Ovay", hi: "बदलें", mfe: "Sanze" },
  btn_ajouter_ligne: { fr: "+ Ajouter une ligne", en: "+ Add a line", mg: "+ Hanampy andalana", hi: "+ पंक्ति जोड़ें", mfe: "+ Azoute enn lign" },
  lbl_total_ht: { fr: "Total HT", en: "Total excl. tax", mg: "Fitambarany HT", hi: "कुल (कर रहित)", mfe: "Total HT" },
  lbl_tva: { fr: "TVA", en: "VAT", mg: "TVA", hi: "वैट", mfe: "TVA" },
  lbl_total_ttc: { fr: "Total TTC", en: "Total incl. tax", mg: "Fitambarany TTC", hi: "कुल (कर सहित)", mfe: "Total TTC" },
  lbl_non_taxable: { fr: "Non taxable", en: "Non-taxable", mg: "Tsy misy hetra", hi: "कर रहित", mfe: "Pa taksab" },

  // ---------- Création directe d'un BC ----------
  ncmd_titre: { fr: "Créer un bon de commande directement", en: "Create a purchase order directly", mg: "Hamorona baiko fividianana mivantana", hi: "सीधे खरीद आदेश बनाएँ", mfe: "Kree enn bon komann direkteman" },
  ncmd_depuis_demande: { fr: "Depuis la demande {numero} — sans passer par un comparatif TCO.", en: "From request {numero} — without going through a TCO comparison.", mg: "Avy amin'ny fangatahana {numero} — tsy mandalo tabilao fampitahana TCO.", hi: "अनुरोध {numero} से — TCO तुलना के बिना।", mfe: "Depi demann {numero} — san pas par enn konparasyon TCO." },
  ncmd_sans_demande: { fr: "Sans passer par une demande/TCO — pour les articles disponibles chez un seul fournisseur ou un fournisseur déjà recommandé/imposé.", en: "Without going through a request/TCO — for items available from a single supplier or from an already recommended/imposed supplier.", mg: "Tsy mandalo fangatahana/TCO — ho an'ny entana azo alaina amin'ny mpamatsy iray monja na mpamatsy efa naroso/nanery.", hi: "बिना अनुरोध/TCO के — उन वस्तुओं के लिए जो केवल एक आपूर्तिकर्ता के पास उपलब्ध हैं या पहले से अनुशंसित/निर्धारित आपूर्तिकर्ता के लिए।", mfe: "San pas par enn demann/TCO — pou bann artik ki disponib ek enn sel fournisser oubien enn fournisser deza rekomande/impoze." },
  ncmd_non_taxable_check: { fr: "Fournisseur non taxable", en: "Non-taxable supplier", mg: "Mpamatsy tsy misy hetra", hi: "कर-मुक्त आपूर्तिकर्ता", mfe: "Fournisser pa taksab" },
  ncmd_ph_fournisseur: { fr: "Taper le nom du fournisseur...", en: "Type the supplier name...", mg: "Soraty ny anaran'ny mpamatsy...", hi: "आपूर्तिकर्ता का नाम लिखें...", mfe: "Tape nom fournisser..." },
  ncmd_h_reference: { fr: "Référence", en: "Reference", mg: "Tsiahy", hi: "संदर्भ", mfe: "Referans" },
  ncmd_ph_ref_devis: { fr: "Réf. devis fournisseur (visible sur le BC imprimé)", en: "Supplier quote ref. (shown on the printed PO)", mg: "Tsiahy devisy mpamatsy (hita eo amin'ny BC voatonta)", hi: "आपूर्तिकर्ता कोटेशन संदर्भ (मुद्रित BC पर दिखाई देता है)", mfe: "Ref. devi fournisser (vizib lor BC imprime)" },
  ncmd_date_reelle_info: { fr: "Date de livraison réelle (un voyage = une ligne)", en: "Actual delivery date (one trip = one line)", mg: "Daty tena nanaterana (dia iray = andalana iray)", hi: "वास्तविक डिलीवरी तिथि (एक फेरा = एक पंक्ति)", mfe: "Dat livrezon reel (enn vwayaz = enn lign)" },
  ncmd_btn_creer: { fr: "Créer le bon de commande", en: "Create the purchase order", mg: "Hamorona ny baiko fividianana", hi: "खरीद आदेश बनाएँ", mfe: "Kree bon komann" },
  ncmd_creation: { fr: "Création...", en: "Creating...", mg: "Mamorona...", hi: "बनाया जा रहा है...", mfe: "Pe kree..." },

  // ---------- Communs : colonnes et boutons de formulaire ----------
  col_article: { fr: "Article", en: "Item", mg: "Entana", hi: "वस्तु", mfe: "Artik" },
  col_unite: { fr: "Unité", en: "Unit", mg: "Singa", hi: "इकाई", mfe: "Inite" },
  col_pu_ht: { fr: "PU HT", en: "Unit price excl. tax", mg: "Vidiny isaky ny singa HT", hi: "इकाई मूल्य (कर रहित)", mfe: "Pri inite HT" },
  col_remise: { fr: "Remise", en: "Discount", mg: "Fihenam-bidy", hi: "छूट", mfe: "Remiz" },
  col_montant_ht: { fr: "Montant HT", en: "Amount excl. tax", mg: "Vola HT", hi: "राशि (कर रहित)", mfe: "Montan HT" },
  col_montant: { fr: "Montant", en: "Amount", mg: "Vola", hi: "राशि", mfe: "Montan" },
  btn_enregistrer: { fr: "Enregistrer", en: "Save", mg: "Tehirizo", hi: "सहेजें", mfe: "Anrezistre" },
  btn_modifier: { fr: "Modifier", en: "Edit", mg: "Ovay", hi: "संपादित करें", mfe: "Modifie" },
  btn_ajouter: { fr: "+ Ajouter", en: "+ Add", mg: "+ Ampio", hi: "+ जोड़ें", mfe: "+ Azoute" },

  // ---------- Fiche d'un bon de commande ----------
  bc_introuvable: { fr: "Bon de commande introuvable.", en: "Purchase order not found.", mg: "Tsy hita ny baiko fividianana.", hi: "खरीद आदेश नहीं मिला।", mfe: "Bon komann pa trouve." },
  bc_tab_bc: { fr: "Bon de commande", en: "Purchase order", mg: "Baiko fividianana", hi: "खरीद आदेश", mfe: "Bon komann" },
  bc_tab_suivi: { fr: "Suivi & Transmission", en: "Tracking & Transmission", mg: "Fanarahana & Fampitaovana", hi: "ट्रैकिंग और प्रेषण", mfe: "Swivi & Transmisyon" },
  bc_tab_facture: { fr: "Facture & Paiement", en: "Invoice & Payment", mg: "Faktiora & Fandoavana", hi: "चालान और भुगतान", mfe: "Faktir & Peyman" },
  bc_btn_modifier: { fr: "Modifier le BC", en: "Edit the PO", mg: "Ovay ny BC", hi: "BC संपादित करें", mfe: "Modifie BC" },
  bc_btn_imprimer: { fr: "Imprimer le BC", en: "Print the PO", mg: "Alefa ho pirinty ny BC", hi: "BC प्रिंट करें", mfe: "Imprim BC" },
  bc_demande_origine: { fr: "Demande d'origine :", en: "Original request:", mg: "Fangatahana niandohana :", hi: "मूल अनुरोध:", mfe: "Demann orizinal :" },
  bc_objet_label: { fr: "Objet (pour le BC imprimé) :", en: "Subject (for the printed PO):", mg: "Lohahevitra (ho an'ny BC voatonta) :", hi: "विषय (मुद्रित BC के लिए):", mfe: "Objè (pou BC imprime) :" },
  bc_objet_info: { fr: "Utilisé pour le BC imprimé. Pré-rempli depuis la demande liée si elle existe, sinon à saisir ici (BC direct).", en: "Used for the printed PO. Pre-filled from the linked request if there is one, otherwise to be entered here (direct PO).", mg: "Ampiasaina amin'ny BC voatonta. Feno mialoha avy amin'ny fangatahana mifandray raha misy, raha tsy izany dia soratana eto (BC mivantana).", hi: "मुद्रित BC के लिए उपयोग किया जाता है। यदि संबंधित अनुरोध है तो उसी से पहले से भरा जाता है, अन्यथा यहाँ दर्ज करें (सीधा BC)।", mfe: "Servi pou BC imprime. Deza ranpli depi demann lie si ena, sinon ekrir isi (BC direk)." },
  bc_ph_objet: { fr: "Objet", en: "Subject", mg: "Lohahevitra", hi: "विषय", mfe: "Objè" },
  bc_utilisateur_final_label: { fr: "Utilisateur Final :", en: "End user:", mg: "Mpampiasa farany :", hi: "अंतिम उपयोगकर्ता:", mfe: "Itilizater final :" },
  bc_ph_utilisateur_final: { fr: "Utilisateur final", en: "End user", mg: "Mpampiasa farany", hi: "अंतिम उपयोगकर्ता", mfe: "Itilizater final" },
  bc_btn_enregistrer_modifs: { fr: "Enregistrer les modifications", en: "Save changes", mg: "Tehirizo ny fanovana", hi: "परिवर्तन सहेजें", mfe: "Anrezistre bann modifikasyon" },
  bc_h_livre_le: { fr: "Livré le", en: "Delivered on", mg: "Nateraka tamin'ny", hi: "डिलीवरी तिथि", mfe: "Livre le" },
  bc_etat_cloture_rupture: { fr: "Clôturé (rupture)", en: "Closed (stock-out)", mg: "Voakatona (tsy misy entana)", hi: "बंद (स्टॉक समाप्त)", mfe: "Klotire (rupture)" },
  bc_hist_receptions: { fr: "Historique des réceptions", en: "Receipt history", mg: "Tantaran'ny fandraisana", hi: "प्राप्ति का इतिहास", mfe: "Istorik resepsyon" },
  bc_le: { fr: "Livré le", en: "Delivered on", mg: "Nateraka tamin'ny", hi: "डिलीवर तिथि", mfe: "Livre le" },
  bc_saisi_par: { fr: "saisi par {nom}", en: "entered by {nom}", mg: "nampidirin'i {nom}", hi: "{nom} द्वारा दर्ज", mfe: "antre par {nom}" },
  bc_import_note: { fr: "📥 (date d'import, pas la date réelle)", en: "📥 (import date, not the actual date)", mg: "📥 (daty nampidirana, fa tsy ny daty tena izy)", hi: "📥 (आयात की तिथि, वास्तविक तिथि नहीं)", mfe: "📥 (dat import, pa dat reel)" },
  bc_aide_pv: { fr: "Imprime le PV à l'avance pour le donner au magasin, ou saisis directement une nouvelle réception (partielle ou totale sur le reste).", en: "Print the receipt form in advance to give it to the store, or directly enter a new receipt (partial or complete for the remainder).", mg: "Atonta mialoha ny PV mba homena ny magazay, na ampidiro mivantana ny fandraisana vaovao (ampahany na feno amin'ny sisa).", hi: "स्टोर को देने के लिए PV पहले से प्रिंट करें, या सीधे नई प्राप्ति दर्ज करें (शेष पर आंशिक या पूर्ण)।", mfe: "Imprim PV davans pou donn magazin, oubien antre direkteman enn nouvo resepsyon (partiel oubien total lor res la)." },
  bc_demandeur_paren: { fr: "{nom} (demandeur)", en: "{nom} (requester)", mg: "{nom} (mpangataka)", hi: "{nom} (अनुरोधकर्ता)", mfe: "{nom} (demander)" },
  bc_recept_magasin: { fr: "Magasin", en: "Store", mg: "Magazay", hi: "स्टोर", mfe: "Magazin" },
  bc_recept_direction: { fr: "Direction", en: "Management", mg: "Fitantanana", hi: "प्रबंधन", mfe: "Direksyon" },
  bc_recept_site: { fr: "Site travaux", en: "Worksite", mg: "Toerana asa", hi: "कार्य स्थल", mfe: "Sit travo" },
  bc_recept_prestataire: { fr: "Prestataire", en: "Service provider", mg: "Mpanome tolotra", hi: "सेवा प्रदाता", mfe: "Prestater" },
  bc_recept_autre: { fr: "Autre", en: "Other", mg: "Hafa", hi: "अन्य", mfe: "Lot" },
  bc_mode_livraison_fournisseur: { fr: "Livraison fournisseur", en: "Supplier delivery", mg: "Fanaterana avy amin'ny mpamatsy", hi: "आपूर्तिकर्ता द्वारा डिलीवरी", mfe: "Livrezon fournisser" },
  bc_mode_enlevement: { fr: "Enlèvement par nos soins", en: "Pickup by us", mg: "Fakana ataontsika", hi: "हमारे द्वारा पिकअप", mfe: "Rekipeasyon par nou mem" },
  bc_mode_prestation: { fr: "Prestation / Travaux", en: "Service / Works", mg: "Asa / Fanamboarana", hi: "सेवा / कार्य", mfe: "Servis / Travo" },
  bc_ph_preciser_recept: { fr: "Préciser le réceptionnaire", en: "Specify the receiver", mg: "Lazao ny mpandray", hi: "प्राप्तकर्ता निर्दिष्ट करें", mfe: "Presize reseptyonner" },
  bc_ph_bl: { fr: "N° de Bon de Livraison (BL)", en: "Delivery note no. (DN)", mg: "Laharana ny taratasy fanaterana (BL)", hi: "डिलीवरी नोट सं. (BL)", mfe: "N° Bon de Livrezon (BL)" },
  bc_ph_obs_reception: { fr: "Observation (obligatoire si livraison partielle ou quantité en surplus)", en: "Remarks (required if partial delivery or surplus quantity)", mg: "Fanamarihana (tsy maintsy raha fanaterana ampahany na habetsaka mihoatra)", hi: "टिप्पणी (आंशिक डिलीवरी या अधिक मात्रा होने पर अनिवार्य)", mfe: "Remark (obligatwar si livrezon partiel oubien kantite an plis)" },
  bc_h_qte_commandee: { fr: "Qté commandée", en: "Qty ordered", mg: "Habetsaka nasaina", hi: "मँगाई गई मात्रा", mfe: "Kantite komande" },
  bc_h_deja_livre: { fr: "Déjà livré", en: "Already delivered", mg: "Efa nateraka", hi: "पहले से डिलीवर", mfe: "Deza livre" },
  bc_h_reste: { fr: "Reste à livrer", en: "Remaining to deliver", mg: "Sisa aterina", hi: "शेष डिलीवरी", mfe: "Res pou livre" },
  bc_h_qte_maintenant: { fr: "Qté livrée maintenant", en: "Qty delivered now", mg: "Habetsaka nateraka izao", hi: "अभी डिलीवर मात्रा", mfe: "Kantite livre aster" },
  bc_btn_imprimer_pv: { fr: "Imprimer le PV de réception", en: "Print the receipt form", mg: "Alefa ho pirinty ny PV fandraisana", hi: "प्राप्ति PV प्रिंट करें", mfe: "Imprim PV resepsyon" },
  bc_btn_enregistrer_reception: { fr: "Enregistrer cette réception", en: "Save this receipt", mg: "Tehirizo ity fandraisana ity", hi: "यह प्राप्ति सहेजें", mfe: "Anrezistre sa resepsyon" },
  bc_date_estimee_reste: { fr: "Date estimée du reste à livrer :", en: "Estimated date for the remainder:", mg: "Daty tombantombana ho an'ny sisa aterina :", hi: "शेष डिलीवरी की अनुमानित तिथि:", mfe: "Dat estime pou res pou livre :" },
  bc_btn_arreter: { fr: "Arrêter la commande sur le déjà-livré (rupture fournisseur)", en: "Stop the order at what has already been delivered (supplier stock-out)", mg: "Ajanony ny baiko amin'ny efa nateraka (tsy misy entana amin'ny mpamatsy)", hi: "जो डिलीवर हो चुका उसी पर आदेश रोकें (आपूर्तिकर्ता के पास स्टॉक नहीं)", mfe: "Aret komann lor sa ki deza livre (rupture fournisser)" },
  bc_tout_livre: { fr: "✓ Commande entièrement livrée.", en: "✓ Order fully delivered.", mg: "✓ Vita tanteraka ny fanaterana ny baiko.", hi: "✓ आदेश पूरी तरह डिलीवर हो चुका है।", mfe: "✓ Komann antierman livre." },
  bc_tout_effectue: { fr: "✓ Travaux entièrement effectués.", en: "✓ Works fully completed.", mg: "✓ Vita tanteraka ny asa.", hi: "✓ कार्य पूरी तरह संपन्न।", mfe: "✓ Travo antierman fer." },
  bc_s1_titre: { fr: "1. Signature du BC", en: "1. PO signature", mg: "1. Sonian'ny BC", hi: "1. BC पर हस्ताक्षर", mfe: "1. Sinyatir BC" },
  bc_l_envoi_signature: { fr: "Date d'envoi pour signature", en: "Date sent for signature", mg: "Daty nandefasana hosoniavina", hi: "हस्ताक्षर हेतु भेजने की तिथि", mfe: "Dat avoy pou sinyatir" },
  bc_l_retour_signe: { fr: "Date de retour signé", en: "Date returned signed", mg: "Daty niverenana voasonia", hi: "हस्ताक्षरित लौटने की तिथि", mfe: "Dat retour sinye" },
  bc_l_dest_direction: { fr: "Destinataire (direction)", en: "Recipient (management)", mg: "Mpandray (fitantanana)", hi: "प्राप्तकर्ता (प्रबंधन)", mfe: "Destinatater (direksyon)" },
  bc_ph_ex_mayuri: { fr: "ex: Mayuri", en: "e.g.: Mayuri", mg: "oh: Mayuri", hi: "उदा: Mayuri", mfe: "pl: Mayuri" },
  bc_s2_titre: { fr: "2. Envoi au fournisseur", en: "2. Sending to the supplier", mg: "2. Fandefasana amin'ny mpamatsy", hi: "2. आपूर्तिकर्ता को भेजना", mfe: "2. Avoy ar fournisser" },
  bc_l_envoi_fournisseur: { fr: "Date d'envoi du BC signé", en: "Date the signed PO was sent", mg: "Daty nandefasana ny BC voasonia", hi: "हस्ताक्षरित BC भेजने की तिथि", mfe: "Dat avoy BC sinye" },
  bc_l_mode: { fr: "Mode", en: "Mode", mg: "Fomba", hi: "तरीका", mfe: "Mod" },
  bc_l_coursier: { fr: "Nom du coursier", en: "Courier's name", mg: "Anaran'ny mpitatitra", hi: "कूरियर का नाम", mfe: "Nom kourier" },
  bc_ph_nom: { fr: "Nom", en: "Name", mg: "Anarana", hi: "नाम", mfe: "Nom" },
  bc_s3_titre: { fr: "3. Transmission à la comptabilité pour paiement", en: "3. Transmission to accounting for payment", mg: "3. Fandefasana any amin'ny kaontabilite ho fandoavana", hi: "3. भुगतान हेतु लेखा विभाग को प्रेषण", mfe: "3. Transmisyon kont pou peyman" },
  bc_l_envoi_compta: { fr: "Date d'envoi compta", en: "Date sent to accounting", mg: "Daty nandefasana tany kaontabilite", hi: "लेखा को भेजने की तिथि", mfe: "Dat avoy kontabilite" },
  bc_l_dispo_paiement: { fr: "Date disponibilité paiement", en: "Payment availability date", mg: "Daty hisian'ny fandoavana", hi: "भुगतान उपलब्धता तिथि", mfe: "Dat disponibilite peyman" },
  bc_l_destinataire: { fr: "Destinataire", en: "Recipient", mg: "Mpandray", hi: "प्राप्तकर्ता", mfe: "Destinatater" },
  bc_ph_ex_compta: { fr: "ex: Compta", en: "e.g.: Accounting", mg: "oh: Kaontabilite", hi: "उदा: लेखा", mfe: "pl: Kontabilite" },
  bc_docs_joints: { fr: "Documents complets joints", en: "Complete documents attached", mg: "Taratasy feno nampiarahina", hi: "संलग्न पूर्ण दस्तावेज़", mfe: "Dokiman konple zwenn" },
  bc_doc_bc_signe: { fr: "BC signé", en: "Signed PO", mg: "BC voasonia", hi: "हस्ताक्षरित BC", mfe: "BC sinye" },
  bc_doc_pv: { fr: "PV de réception", en: "Receipt form", mg: "PV fandraisana", hi: "प्राप्ति PV", mfe: "PV resepsyon" },
  bc_doc_bl: { fr: "Bon de livraison (BL)", en: "Delivery note (DN)", mg: "Taratasy fanaterana (BL)", hi: "डिलीवरी नोट (BL)", mfe: "Bon de livrezon (BL)" },
  bc_doc_facture: { fr: "Facture fournisseur", en: "Supplier invoice", mg: "Faktiora mpamatsy", hi: "आपूर्तिकर्ता चालान", mfe: "Faktir fournisser" },
  bc_doc_fiche_decaissement: { fr: "Fiche de décaissement petite caisse validée par la direction", en: "Petty cash disbursement form approved by management", mg: "Taratasy famoahana vola amin'ny kaoisy kely nekena avy amin'ny fitantanana", hi: "प्रबंधन द्वारा स्वीकृत छोटी नकदी निकासी पत्र", mfe: "Fich desezmanman ptit lakes valide par direksyon" },
  bc_obs_titre: { fr: "Observation (visible dans l'Historique)", en: "Remarks (visible in the History)", mg: "Fanamarihana (hita ao amin'ny Tantara)", hi: "टिप्पणी (इतिहास में दिखाई देती है)", mfe: "Remark (vizib dan Istorik)" },
  bc_obs_aide: { fr: "Se remplit automatiquement à chaque étape (si vide), mais reste modifiable — plus jamais écrasée une fois que tu l'as personnalisée.", en: "Filled in automatically at each step (if empty), but remains editable — never overwritten again once you have customised it.", mg: "Feno ho azy isaky ny dingana (raha foana), saingy azo ovaina foana — tsy asolo intsony rehefa nasianao endrika manokana.", hi: "यदि खाली हो तो हर चरण पर अपने आप भर जाती है, पर संपादन योग्य रहती है — आपके बदलने के बाद उसे फिर कभी नहीं बदला जाता।", mfe: "Ranpli otomatikman a sak etap (si vid), me res modifiab — zame ankor ekrase kan ou finn personalize li." },
  bc_btn_enregistrer_suivi: { fr: "Enregistrer le suivi", en: "Save the tracking", mg: "Tehirizo ny fanarahana", hi: "ट्रैकिंग सहेजें", mfe: "Anrezistre swivi" },
  bc_btn_enregistrer_suivi_modifie: { fr: "● Enregistrer le suivi (modifié)", en: "● Save the tracking (modified)", mg: "● Tehirizo ny fanarahana (novaina)", hi: "● ट्रैकिंग सहेजें (संशोधित)", mfe: "● Anrezistre swivi (modifie)" },
  bc_accuses_titre: { fr: "Accusés de réception facture", en: "Invoice acknowledgements of receipt", mg: "Fanamarinana ny fandraisana faktiora", hi: "चालान की प्राप्ति की पावतियाँ", mfe: "Akize resepsyon faktir" },
  bc_h_date_accuse: { fr: "Date accusé", en: "Acknowledgement date", mg: "Daty fanamarinana", hi: "पावती तिथि", mfe: "Dat akize" },
  bc_h_date_facture: { fr: "Date facture", en: "Invoice date", mg: "Daty faktiora", hi: "चालान तिथि", mfe: "Dat faktir" },
  bc_h_num_facture: { fr: "N° facture", en: "Invoice no.", mg: "Laharana faktiora", hi: "चालान सं.", mfe: "N° faktir" },
  bc_facture_titre: { fr: "Facture et paiement", en: "Invoice and payment", mg: "Faktiora sy fandoavana", hi: "चालान और भुगतान", mfe: "Faktir ek peyman" },
  bc_ph_montant_facture: { fr: "Montant facturé (Ar)", en: "Invoiced amount (Ar)", mg: "Vola nafatra amin'ny faktiora (Ar)", hi: "चालान राशि (Ar)", mfe: "Montan fakture (Ar)" },
  bc_montant_facture_info: { fr: "Par défaut le montant du BC — à corriger si la facture réelle diffère (livraison partielle, commande arrêtée...)", en: "By default the PO amount — to be corrected if the actual invoice differs (partial delivery, order stopped...)", mg: "Ny vola ao amin'ny BC no fanao azy — ovay raha tsy mitovy amin'ny tena faktiora (fanaterana ampahany, baiko najanona...)", hi: "डिफ़ॉल्ट रूप से BC की राशि — यदि वास्तविक चालान अलग हो तो सुधारें (आंशिक डिलीवरी, आदेश रोका गया...)", mfe: "Par defo montan BC — korize si vre faktir diferan (livrezon partiel, komann aret...)" },
  bc_ecart_montant: { fr: "≠ montant BC ({montant} Ar) — observation obligatoire", en: "≠ PO amount ({montant} Ar) — remark required", mg: "≠ vola BC ({montant} Ar) — tsy maintsy misy fanamarihana", hi: "≠ BC राशि ({montant} Ar) — टिप्पणी अनिवार्य", mfe: "≠ montan BC ({montant} Ar) — remark obligatwar" },
  bc_echeance_label: { fr: "Échéance :", en: "Due date:", mg: "Fe-potoana :", hi: "देय तिथि:", mfe: "Ekseans :" },
  bc_echeance_info: { fr: "Calculée automatiquement : date facture + délai de paiement du fournisseur, non modifiable ici", en: "Calculated automatically: invoice date + the supplier's payment term, not editable here", mg: "Kajiana ho azy: daty faktiora + fe-potoana fandoavan'ny mpamatsy, tsy azo ovaina eto", hi: "अपने आप गणना: चालान तिथि + आपूर्तिकर्ता की भुगतान अवधि, यहाँ संपादन योग्य नहीं", mfe: "Kalkile otomatikman: dat faktir + delai peyman fournisser, pa modifiab isi" },
  bc_delai_jours: { fr: "({n}j)", en: "({n}d)", mg: "({n} andro)", hi: "({n} दिन)", mfe: "({n}j)" },
  bc_ph_obs_facture: { fr: "Observation (obligatoire si écart avec le montant BC)", en: "Remarks (required if different from the PO amount)", mg: "Fanamarihana (tsy maintsy raha tsy mitovy amin'ny vola BC)", hi: "टिप्पणी (BC राशि से अंतर होने पर अनिवार्य)", mfe: "Remark (obligatwar si diferan ek montan BC)" },
  bc_mode_reglement_ph: { fr: "Mode de règlement...", en: "Payment method...", mg: "Fomba fandoavana...", hi: "भुगतान का तरीका...", mfe: "Mod peyman..." },
  bc_reg_cheque: { fr: "Chèque", en: "Cheque", mg: "Sekely", hi: "चेक", mfe: "Sek" },
  bc_reg_especes: { fr: "Espèces", en: "Cash", mg: "Vola an-tanana", hi: "नकद", mfe: "Lakas" },
  bc_reg_virement: { fr: "Virement", en: "Bank transfer", mg: "Famindrana vola", hi: "बैंक ट्रांसफर", mfe: "Viremen" },
  bc_btn_enregistrer_modifie: { fr: "● Enregistrer (modifié)", en: "● Save (modified)", mg: "● Tehirizo (novaina)", hi: "● सहेजें (संशोधित)", mfe: "● Anrezistre (modifie)" },

  // Messages bloquants de la fiche
  bc_alert_ecart_modif: { fr: "La quantité livrée modifiée laisse un écart avec la quantité commandée — merci de préciser pourquoi dans l'observation du BC avant d'enregistrer.", en: "The modified delivered quantity leaves a gap with the ordered quantity — please explain why in the PO remarks before saving.", mg: "Ny habetsaka nateraka novaina dia tsy mitovy amin'ny habetsaka nasaina — lazao ao amin'ny fanamarihan'ny BC ny antony alohan'ny hitehirizana.", hi: "संशोधित डिलीवर मात्रा और मँगाई गई मात्रा में अंतर है — सहेजने से पहले कृपया BC की टिप्पणी में कारण बताएँ।", mfe: "Kantite livre modifie pa mem ek kantite komande — silvouple esplike kifer dan remark BC avan anrezistre." },
  bc_alert_surplus: { fr: "La quantité reçue dépasse la quantité commandée sur au moins un article — merci de préciser pourquoi dans l'observation avant d'enregistrer.", en: "The quantity received exceeds the quantity ordered on at least one item — please explain why in the remarks before saving.", mg: "Ny habetsaka voaray dia mihoatra ny nasaina amin'ny entana iray farafahakeliny — lazao ao amin'ny fanamarihana ny antony alohan'ny hitehirizana.", hi: "प्राप्त मात्रा कम से कम एक वस्तु पर मँगाई गई मात्रा से अधिक है — सहेजने से पहले कृपया टिप्पणी में कारण बताएँ।", mfe: "Kantite resevwar depas kantite komande lor omwin enn artik — silvouple esplike kifer dan remark avan anrezistre." },
  bc_alert_partielle: { fr: "Livraison partielle — merci de préciser pourquoi (reste à livrer plus tard, fournisseur en rupture, commande arrêtée...) dans l'observation avant d'enregistrer.", en: "Partial delivery — please explain why (remainder to be delivered later, supplier out of stock, order stopped...) in the remarks before saving.", mg: "Fanaterana ampahany — lazao ny antony (ho aterina any aoriana ny sisa, tsy misy entana amin'ny mpamatsy, baiko najanona...) ao amin'ny fanamarihana alohan'ny hitehirizana.", hi: "आंशिक डिलीवरी — सहेजने से पहले कृपया टिप्पणी में कारण बताएँ (शेष बाद में डिलीवर होगा, आपूर्तिकर्ता के पास स्टॉक नहीं, आदेश रोका गया...)।", mfe: "Livrezon partiel — silvouple esplike kifer (res pou livre pli tar, fournisser an rupture, komann aret...) dan remark avan anrezistre." },
  bc_confirm_arreter: { fr: "Arrêter cette commande sur le déjà-livré ? Une nouvelle demande d'achat sera créée avec les {n} article(s) restant(s), à sourcer ailleurs.", en: "Stop this order at what has already been delivered? A new purchase request will be created with the {n} remaining item(s), to be sourced elsewhere.", mg: "Hajanona ve ity baiko ity amin'ny efa nateraka? Hamorona fangatahana fividianana vaovao miaraka amin'ny entana {n} sisa, hotadiavina any ho any.", hi: "क्या इस आदेश को जो डिलीवर हो चुका उसी पर रोकें? शेष {n} वस्तुओं के साथ एक नया खरीद अनुरोध बनाया जाएगा, जिन्हें कहीं और से जुटाना होगा।", mfe: "Aret sa komann lor sa ki deza livre? Enn nouvo demann aste pou kree avek {n} artik ki reste, pou rod ailer." },
  bc_alert_montant_ecart: { fr: "Le montant facturé diffère du montant du BC — merci de préciser la cause dans l'observation (ex. livraison partielle, commande arrêtée...) avant d'enregistrer.", en: "The invoiced amount differs from the PO amount — please state the cause in the remarks (e.g. partial delivery, order stopped...) before saving.", mg: "Tsy mitovy amin'ny vola ao amin'ny BC ny vola nafatra amin'ny faktiora — lazao ao amin'ny fanamarihana ny antony (oh. fanaterana ampahany, baiko najanona...) alohan'ny hitehirizana.", hi: "चालान की राशि BC की राशि से भिन्न है — सहेजने से पहले कृपया टिप्पणी में कारण बताएँ (जैसे आंशिक डिलीवरी, आदेश रोका गया...)।", mfe: "Montan fakture diferan ek montan BC — silvouple esplike rezon dan remark (pl. livrezon partiel, komann aret...) avan anrezistre." },

  ph_pu_ht: { fr: "PU HT", en: "Unit price", mg: "Vidiny/singa", hi: "इकाई मूल्य", mfe: "Pri inite" },
  calc_titre: { fr: "Convertir depuis un montant TTC connu", en: "Convert from a known amount incl. tax", mg: "Avadika avy amin'ny vola TTC fantatra", hi: "ज्ञात कर-सहित राशि से बदलें", mfe: "Konverti depi enn montan TTC konnu" },
  calc_ph_ttc: { fr: "Montant TTC ({tva}%)", en: "Amount incl. tax ({tva}%)", mg: "Vola TTC ({tva}%)", hi: "राशि कर सहित ({tva}%)", mfe: "Montan TTC ({tva}%)" },

  // ---------- Communs : demandes ----------
  col_numero: { fr: "N°", en: "No.", mg: "Laharana", hi: "सं.", mfe: "N°" },
  col_service: { fr: "Service", en: "Department", mg: "Sampana", hi: "विभाग", mfe: "Servis" },
  prio_haute: { fr: "Haute", en: "High", mg: "Avo", hi: "उच्च", mfe: "O" },
  prio_moyenne: { fr: "Moyenne", en: "Medium", mg: "Antonony", hi: "मध्यम", mfe: "Mwayen" },
  prio_basse: { fr: "Basse", en: "Low", mg: "Ambany", hi: "निम्न", mfe: "Ba" },

  // ---------- Liste des demandes ----------
  dem_liste_special: { fr: "Liste des demandes ({a} / {b})", en: "Request list ({a} / {b})", mg: "Lisitry ny fangatahana ({a} / {b})", hi: "अनुरोधों की सूची ({a} / {b})", mfe: "Lalis demann ({a} / {b})" },
  dem_liste_toutes: { fr: "Liste des demandes ({charges} chargées / {total} au total)", en: "Request list ({charges} loaded / {total} in total)", mg: "Lisitry ny fangatahana (voaray {charges} / {total} rehetra)", hi: "अनुरोधों की सूची ({charges} लोड / कुल {total})", mfe: "Lalis demann ({charges} sarze / {total} total)" },
  dem_liste_annee: { fr: "Liste des demandes ({charges} chargées / {total} au total, année {annee})", en: "Request list ({charges} loaded / {total} in total, year {annee})", mg: "Lisitry ny fangatahana (voaray {charges} / {total} rehetra, taona {annee})", hi: "अनुरोधों की सूची ({charges} लोड / कुल {total}, वर्ष {annee})", mfe: "Lalis demann ({charges} sarze / {total} total, lane {annee})" },
  dem_banniere: { fr: "Filtré depuis le Tableau de bord : seules les {n} demande(s) à traiter sont affichées.", en: "Filtered from the Dashboard: only the {n} request(s) to process are shown.", mg: "Nosivanina avy amin'ny Tabilao: ny fangatahana {n} harahina ihany no aseho.", hi: "डैशबोर्ड से फ़िल्टर किया गया: संसाधित करने हेतु केवल {n} अनुरोध दिखाए गए हैं।", mfe: "Filtre depi Tablo de bor: zis {n} demann pou tret ki afise." },
  dem_voir_toutes: { fr: "Voir toutes les demandes", en: "See all requests", mg: "Hijery ny fangatahana rehetra", hi: "सभी अनुरोध देखें", mfe: "Get tou demann" },
  dem_recherche: { fr: "Rechercher (N°, service, demandeur, motif...)", en: "Search (no., department, requester, purpose...)", mg: "Hitady (laharana, sampana, mpangataka, antony...)", hi: "खोजें (सं., विभाग, अनुरोधकर्ता, उद्देश्य...)", mfe: "Rod (N°, servis, demander, motif...)" },
  dem_aucune: { fr: "Aucune demande pour ces filtres.", en: "No request for these filters.", mg: "Tsy misy fangatahana amin'ireo sivana ireo.", hi: "इन फ़िल्टरों के लिए कोई अनुरोध नहीं।", mfe: "Okenn demann pou bann filtre-la." },
  dem_h_date_da: { fr: "Date DA", en: "PR date", mg: "Daty DA", hi: "DA तिथि", mfe: "Dat DA" },
  dem_h_numero_da: { fr: "N° DA", en: "PR no.", mg: "Laharana DA", hi: "DA सं.", mfe: "N° DA" },
  dem_h_service: { fr: "Service demandeur", en: "Requesting department", mg: "Sampana mangataka", hi: "अनुरोधकर्ता विभाग", mfe: "Servis demander" },
  dem_h_nom: { fr: "Nom demandeur", en: "Requester name", mg: "Anaran'ny mpangataka", hi: "अनुरोधकर्ता का नाम", mfe: "Nom demander" },
  dem_h_demande: { fr: "Demande", en: "Request", mg: "Fangatahana", hi: "अनुरोध", mfe: "Demann" },
  dem_filtrer_statut: { fr: "Filtrer sur ce statut", en: "Filter on this status", mg: "Sivano amin'ity sata ity", hi: "इस स्थिति पर फ़िल्टर करें", mfe: "Filtre lor sa statit-la" },
  dem_aucun_article: { fr: "Aucun article saisi", en: "No items entered", mg: "Tsy misy entana voasoratra", hi: "कोई वस्तु दर्ज नहीं", mfe: "Okenn artik antre" },
  dem_priorite: { fr: "Priorité : {p}", en: "Priority: {p}", mg: "Laharam-pahamehana : {p}", hi: "प्राथमिकता: {p}", mfe: "Priyorite : {p}" },
  dem_a_rechercher_import: { fr: "À rechercher import", en: "To source via import", mg: "Hotadiavina avy any ivelany", hi: "आयात से खोजना है", mfe: "Pou rod par import" },
  dem_copier_devis: { fr: "Copier pour demande de devis", en: "Copy for a quote request", mg: "Adikao ho an'ny fangatahana devisy", hi: "कोटेशन अनुरोध के लिए कॉपी करें", mfe: "Kopie pou demann devi" },
  dem_btn_devis: { fr: "Devis", en: "Quote", mg: "Devisy", hi: "कोटेशन", mfe: "Devi" },
  dem_reactiver_standby: { fr: "Réactiver (sortir du stand-by)", en: "Reactivate (take off hold)", mg: "Hamerina (esorina amin'ny fijanonana)", hi: "पुनः सक्रिय करें (होल्ड से निकालें)", mfe: "Reaktiv (retir dan stand-by)" },
  dem_mettre_standby: { fr: "Mettre en stand-by", en: "Put on hold", mg: "Ataovy mijanona kelikely", hi: "होल्ड पर रखें", mfe: "Mete an stand-by" },
  dem_historique_label: { fr: "Historique :", en: "History:", mg: "Tantara :", hi: "इतिहास:", mfe: "Istorik :" },
  dem_copie_ok: { fr: "Copié — colle-le dans un e-mail (Outlook/Gmail), il ne reste qu'à mettre l'objet et le(s) destinataire(s).", en: "Copied — paste it into an email (Outlook/Gmail), you only need to add the subject and the recipient(s).", mg: "Voadika — apetraho ao anaty mailaka (Outlook/Gmail), sisa ny hanisy lohahevitra sy mpandray.", hi: "कॉपी हो गया — इसे ईमेल (Outlook/Gmail) में चिपकाएँ, बस विषय और प्राप्तकर्ता जोड़ने हैं।", mfe: "Kopie — kole li dan enn email (Outlook/Gmail), ou zis bizin azoute sizè ek destinatater." },
  dem_copie_texte: { fr: "Copié en texte brut (le tableau formaté n'a pas pu être copié) — colle-le dans un e-mail.", en: "Copied as plain text (the formatted table could not be copied) — paste it into an email.", mg: "Voadika ho lahatsoratra tsotra (tsy azo adika ny tabilao voalamina) — apetraho ao anaty mailaka.", hi: "सादे पाठ के रूप में कॉपी हुआ (स्वरूपित तालिका कॉपी नहीं हो सकी) — इसे ईमेल में चिपकाएँ।", mfe: "Kopie an tekst senp (tablo formate pa fine kopie) — kole li dan enn email." },
  dem_copie_echec: { fr: "La copie a échoué. Réessaie.", en: "The copy failed. Try again.", mg: "Tsy nahomby ny fandikana. Andramo indray.", hi: "कॉपी विफल रही। फिर से प्रयास करें।", mfe: "Kopiaz pa marse. Esei ankor." },
  dem_confirm_reactiver: { fr: "Réactiver la demande {numero} (retirer le statut Annulée) ?", en: "Reactivate request {numero} (remove the Cancelled status)?", mg: "Hamerina ny fangatahana {numero} ve (esorina ny sata Nofoanana)?", hi: "क्या अनुरोध {numero} को पुनः सक्रिय करें (रद्द स्थिति हटाएँ)?", mfe: "Reaktiv demann {numero} (retir statit Anile)?" },
  dem_prompt_annuler: { fr: "Pourquoi annuler la demande {numero} ? (raison obligatoire)", en: "Why cancel request {numero}? (reason required)", mg: "Nahoana no hofoanana ny fangatahana {numero}? (tsy maintsy misy antony)", hi: "अनुरोध {numero} क्यों रद्द करें? (कारण अनिवार्य)", mfe: "Kifer anile demann {numero}? (rezon obligatwar)" },
  dem_prompt_standby: { fr: "Pourquoi mettre en stand-by la demande {numero} ? (optionnel)", en: "Why put request {numero} on hold? (optional)", mg: "Nahoana no ataovy mijanona kelikely ny fangatahana {numero}? (tsy voatery)", hi: "अनुरोध {numero} को होल्ड पर क्यों रखें? (वैकल्पिक)", mfe: "Kifer mete demann {numero} an stand-by? (opsyonel)" },
  dem_confirm_supprimer_avec_bc: { fr: "La demande {numero} a {n} bon(s) de commande lié(s) ({noms}). Les supprimer aussi (avec leur réception/historique) et supprimer la demande ?", en: "Request {numero} has {n} linked purchase order(s) ({noms}). Delete them too (with their receipt/history) and delete the request?", mg: "Ny fangatahana {numero} dia manana baiko fividianana mifandray {n} ({noms}). Fafana koa ve (miaraka amin'ny fandraisana/tantara) ary fafana ny fangatahana?", hi: "अनुरोध {numero} से {n} खरीद आदेश जुड़े हैं ({noms})। क्या उन्हें (उनकी प्राप्ति/इतिहास सहित) भी हटाएँ और अनुरोध हटाएँ?", mfe: "Demann {numero} ena {n} bon komann lie ({noms}). Efas zot osi (avek zot resepsyon/istorik) ek efas demann?" },
  dem_confirm_supprimer: { fr: "Supprimer définitivement la demande {numero} ?", en: "Permanently delete request {numero}?", mg: "Hofafana tanteraka ve ny fangatahana {numero}?", hi: "क्या अनुरोध {numero} को स्थायी रूप से हटाएँ?", mfe: "Efas definitivman demann {numero}?" },

  // ---------- Nouvelle demande ----------
  nd_ph_nom_demandeur: { fr: "Nom du demandeur", en: "Requester's name", mg: "Anaran'ny mpangataka", hi: "अनुरोधकर्ता का नाम", mfe: "Nom demander" },
  nd_ph_motif: { fr: "Motif / projet", en: "Purpose / project", mg: "Antony / tetikasa", hi: "उद्देश्य / परियोजना", mfe: "Motif / proze" },
  nd_l_date_da: { fr: "Date DA (date de réception physique)", en: "PR date (date of physical receipt)", mg: "Daty DA (daty nahazoana ny taratasy)", hi: "DA तिथि (भौतिक प्राप्ति की तिथि)", mfe: "Dat DA (dat resepsyon fizik)" },
  nd_l_numero_da: { fr: "N° DA (numéro physique — laisser vide pour générer automatiquement)", en: "PR no. (physical number — leave empty to generate automatically)", mg: "Laharana DA (laharana amin'ny taratasy — avelao foana raha hamokatra ho azy)", hi: "DA सं. (भौतिक संख्या — स्वतः बनाने के लिए खाली छोड़ें)", mfe: "N° DA (nimero fizik — les vid pou zenere otomatikman)" },
  nd_ph_ex_da: { fr: "ex: MNTC-0115-26", en: "e.g.: MNTC-0115-26", mg: "oh: MNTC-0115-26", hi: "उदा: MNTC-0115-26", mfe: "pl: MNTC-0115-26" },
  nd_btn_generer: { fr: "Générer", en: "Generate", mg: "Amokatra", hi: "बनाएँ", mfe: "Zenere" },
  nd_btn_collage_ferme: { fr: "Fermer le collage multiple", en: "Close multiple paste", mg: "Akatony ny fandefasana marobe", hi: "एकाधिक पेस्ट बंद करें", mfe: "Ferm kolaz multip" },
  nd_btn_collage: { fr: "📋 Coller plusieurs articles (Excel)", en: "📋 Paste several items (Excel)", mg: "📋 Apetaho entana maromaro (Excel)", hi: "📋 कई वस्तुएँ चिपकाएँ (Excel)", mfe: "📋 Kole plizir artik (Excel)" },
  nd_aide_collage: { fr: "Colle ici plusieurs lignes copiées depuis Excel : une ligne = un article, colonnes Désignation / Quantité / Unité séparées par tabulation (la quantité et l'unité sont facultatives — 1 et l'unité habituelle de l'article seront utilisées si absentes).", en: "Paste here several lines copied from Excel: one line = one item, columns Description / Quantity / Unit separated by a tab (quantity and unit are optional — 1 and the item's usual unit will be used if missing).", mg: "Apetraho eto ny andalana maromaro voadika avy amin'ny Excel: andalana iray = entana iray, tsanganana Famaritana / Habetsaka / Singa sarahan'ny tabulation (afaka tsy atao ny habetsaka sy ny singa — ho 1 sy ny singa mahazatra ny entana no ampiasaina raha tsy misy).", hi: "Excel से कॉपी की गई कई पंक्तियाँ यहाँ चिपकाएँ: एक पंक्ति = एक वस्तु, विवरण / मात्रा / इकाई कॉलम टैब से अलग (मात्रा और इकाई वैकल्पिक हैं — न होने पर 1 और वस्तु की सामान्य इकाई ली जाएगी)।", mfe: "Kole isi plizir lign kopie depi Excel: enn lign = enn artik, kolonn Deskripsyon / Kantite / Inite separe par tabilasyon (kantite ek inite opsyonel — 1 ek inite abitye artik pou servi si zot manke)." },
  nd_btn_repartir: { fr: "Répartir en lignes", en: "Split into lines", mg: "Zarao ho andalana", hi: "पंक्तियों में बाँटें", mfe: "Separ an lign" },
  nd_ph_designation: { fr: "Désignation de l'article (tape pour voir les suggestions)", en: "Item description (type to see suggestions)", mg: "Famaritana ny entana (soraty mba hijerena ny soso-kevitra)", hi: "वस्तु का विवरण (सुझाव देखने के लिए टाइप करें)", mfe: "Deskripsyon artik (tape pou get sizesyon)" },
  nd_btn_creer: { fr: "Créer la demande et ouvrir le TCO", en: "Create the request and open the TCO", mg: "Hamorona ny fangatahana ary sokafy ny TCO", hi: "अनुरोध बनाएँ और TCO खोलें", mfe: "Kree demann ek ouver TCO" },
  nd_alert_service: { fr: "Renseigne d'abord le service demandeur pour générer un numéro.", en: "First enter the requesting department to generate a number.", mg: "Fenoy aloha ny sampana mangataka mba hamokarana laharana.", hi: "नंबर बनाने के लिए पहले अनुरोधकर्ता विभाग भरें।", mfe: "Ranpli dabor servis demander pou zenere enn nimero." },
  nd_confirm_da_existant: { fr: "Le numéro DA \"{numero}\" est déjà utilisé par une autre demande. Continuer quand même ?", en: "The PR number \"{numero}\" is already used by another request. Continue anyway?", mg: "Efa ampiasain'ny fangatahana hafa ny laharana DA \"{numero}\". Ho tohizana ihany ve?", hi: "DA संख्या \"{numero}\" पहले से किसी अन्य अनुरोध में उपयोग हुई है। फिर भी जारी रखें?", mfe: "Nimero DA \"{numero}\" deza servi par enn lot demann. Kontinie kanmemm?" },

  // ---------- Fiche demande et tableau comparatif (TCO) ----------
  dt_introuvable: { fr: "Demande introuvable.", en: "Request not found.", mg: "Tsy hita ny fangatahana.", hi: "अनुरोध नहीं मिला।", mfe: "Demann pa trouve." },
  dt_l_priorite: { fr: "Priorité", en: "Priority", mg: "Laharam-pahamehana", hi: "प्राथमिकता", mfe: "Priyorite" },
  dt_l_motif: { fr: "Motif de la demande", en: "Purpose of the request", mg: "Antony ny fangatahana", hi: "अनुरोध का उद्देश्य", mfe: "Motif demann" },
  dt_btn_marquer_avise: { fr: "Marquer le demandeur avisé", en: "Mark the requester as notified", mg: "Hamarina fa nampahafantarina ny mpangataka", hi: "अनुरोधकर्ता को सूचित के रूप में चिह्नित करें", mfe: "Marke demander avize" },
  dt_demandeur_avise: { fr: "✓ Demandeur avisé", en: "✓ Requester notified", mg: "✓ Nampahafantarina ny mpangataka", hi: "✓ अनुरोधकर्ता को सूचित किया गया", mfe: "✓ Demander avize" },
  dt_bc_generes: { fr: "Bon(s) de commande généré(s) :", en: "Purchase order(s) generated:", mg: "Baiko fividianana novokarina :", hi: "बनाए गए खरीद आदेश:", mfe: "Bon komann zenere :" },
  dt_btn_imprimer_demande: { fr: "Imprimer la demande", en: "Print the request", mg: "Alefa ho pirinty ny fangatahana", hi: "अनुरोध प्रिंट करें", mfe: "Imprim demann" },
  dt_h_non_dispo: { fr: "Non dispo. localement", en: "Not available locally", mg: "Tsy misy eto an-toerana", hi: "स्थानीय रूप से उपलब्ध नहीं", mfe: "Pa disponib lokalman" },
  dt_a_rechercher_import: { fr: "— à rechercher à l'import", en: "— to source via import", mg: "— hotadiavina avy any ivelany", hi: "— आयात से खोजना है", mfe: "— pou rod par import" },
  dt_btn_ajouter_article: { fr: "+ Ajouter un article", en: "+ Add an item", mg: "+ Hanampy entana", hi: "+ वस्तु जोड़ें", mfe: "+ Azoute enn artik" },
  dt_tco_titre: { fr: "Tableau comparatif (TCO)", en: "Comparison table (TCO)", mg: "Tabilao fampitahana (TCO)", hi: "तुलना तालिका (TCO)", mfe: "Tablo konparatif (TCO)" },
  dt_orient_info: { fr: "Par défaut automatique (portrait ≤2 fournisseurs, paysage au-delà) — modifiable ici si besoin", en: "Automatic by default (portrait for 2 suppliers or fewer, landscape beyond) — editable here if needed", mg: "Ho azy no fanao (portrait raha mpamatsy 2 na latsaka, landscape raha mihoatra) — azo ovaina eto raha ilaina", hi: "डिफ़ॉल्ट रूप से स्वचालित (2 या कम आपूर्तिकर्ताओं पर पोर्ट्रेट, उससे अधिक पर लैंडस्केप) — ज़रूरत हो तो यहाँ बदलें", mfe: "Otomatik par defo (portrait pou 2 fournisser oubien mwens, landscape ladan) — modifiab isi si bizin" },
  dt_orient_auto: { fr: "Orientation auto ({orient})", en: "Auto orientation ({orient})", mg: "Orientation ho azy ({orient})", hi: "स्वचालित ओरिएंटेशन ({orient})", mfe: "Oryantasyon otomatik ({orient})" },
  dt_paysage: { fr: "paysage", en: "landscape", mg: "landscape", hi: "लैंडस्केप", mfe: "landscape" },
  dt_portrait: { fr: "portrait", en: "portrait", mg: "portrait", hi: "पोर्ट्रेट", mfe: "portrait" },
  dt_forcer_portrait: { fr: "Forcer portrait", en: "Force portrait", mg: "Ampiasao ny portrait", hi: "पोर्ट्रेट लागू करें", mfe: "Forse portrait" },
  dt_forcer_paysage: { fr: "Forcer paysage", en: "Force landscape", mg: "Ampiasao ny landscape", hi: "लैंडस्केप लागू करें", mfe: "Forse landscape" },
  dt_enreg_prix: { fr: "Enregistrement des prix...", en: "Saving the prices...", mg: "Fitehirizana ny vidiny...", hi: "मूल्य सहेजे जा रहे हैं...", mfe: "Pe anrezistre bann pri..." },
  dt_btn_imprimer_comparatif: { fr: "Imprimer le comparatif", en: "Print the comparison", mg: "Alefa ho pirinty ny fampitahana", hi: "तुलना प्रिंट करें", mfe: "Imprim konparatif" },
  dt_ph_fournisseur: { fr: "Taper le nom du fournisseur à comparer...", en: "Type the name of the supplier to compare...", mg: "Soraty ny anaran'ny mpamatsy hampitahaina...", hi: "तुलना के लिए आपूर्तिकर्ता का नाम लिखें...", mfe: "Tape nom fournisser pou konpare..." },
  dt_comment_traiter: { fr: "Comment veux-tu traiter cette demande ?", en: "How do you want to handle this request?", mg: "Ahoana no fitantanana ity fangatahana ity?", hi: "आप इस अनुरोध को कैसे संभालना चाहते हैं?", mfe: "Kouma ou anvi tret sa demann-la ?" },
  dt_comparer: { fr: "↓ Comparer des fournisseurs (TCO) — ajoute-en un ci-dessous", en: "↓ Compare suppliers (TCO) — add one below", mg: "↓ Hampitaha mpamatsy (TCO) — ampio iray eto ambany", hi: "↓ आपूर्तिकर्ताओं की तुलना करें (TCO) — नीचे एक जोड़ें", mfe: "↓ Konpare fournisser (TCO) — azoute enn anba" },
  dt_creer_bc_direct: { fr: "Créer le BC directement (sans comparatif)", en: "Create the PO directly (without comparison)", mg: "Hamorona ny BC mivantana (tsy misy fampitahana)", hi: "सीधे BC बनाएँ (तुलना के बिना)", mfe: "Kree BC direkteman (san konparasyon)" },
  dt_ajouter_un_fournisseur: { fr: "Ajoute au moins un fournisseur pour saisir ses prix.", en: "Add at least one supplier to enter its prices.", mg: "Ampio mpamatsy iray farafahakeliny hanoratana ny vidiny.", hi: "उसकी कीमतें दर्ज करने के लिए कम से कम एक आपूर्तिकर्ता जोड़ें।", mfe: "Azoute omwin enn fournisser pou antre so bann pri." },
  dt_h_preconisation: { fr: "Préconisation", en: "Recommendation", mg: "Torohevitra", hi: "अनुशंसा", mfe: "Rekomandasyon" },
  dt_moins_cher: { fr: "moins cher", en: "cheapest", mg: "mora indrindra", hi: "सबसे सस्ता", mfe: "pli bon marse" },
  dt_moins_cher_articles: { fr: "moins cher — article {liste}", en: "cheapest — item {liste}", mg: "mora indrindra — entana {liste}", hi: "सबसे सस्ता — वस्तु {liste}", mfe: "pli bon marse — artik {liste}" },
  dt_num_n: { fr: "n°{n}", en: "no. {n}", mg: "laharana {n}", hi: "सं. {n}", mfe: "n°{n}" },
  dt_h_prix_unitaire_ht: { fr: "Prix unitaire HT", en: "Unit price excl. tax", mg: "Vidiny isaky ny singa HT", hi: "इकाई मूल्य (कर रहित)", mfe: "Pri inite HT" },
  dt_h_remise_pct: { fr: "Remise %", en: "Discount %", mg: "Fihenam-bidy %", hi: "छूट %", mfe: "Remiz %" },
  dt_ph_num_devis: { fr: "N° devis", en: "Quote no.", mg: "Laharana devisy", hi: "कोटेशन सं.", mfe: "N° devi" },
  dt_ph_obs_offre: { fr: "Observation (dispo, conditions, précision article...)", en: "Remarks (availability, conditions, item details...)", mg: "Fanamarihana (fisian'ny entana, fepetra, fanamarinana ny entana...)", hi: "टिप्पणी (उपलब्धता, शर्तें, वस्तु का विवरण...)", mfe: "Remark (disponibilite, kondisyon, presizyon artik...)" },
  dt_bc_deja_genere: { fr: "✓ BC déjà généré", en: "✓ PO already generated", mg: "✓ Efa novokarina ny BC", hi: "✓ BC पहले ही बन चुका है", mfe: "✓ BC deza zenere" },
  dt_ht: { fr: "HT", en: "excl. tax", mg: "HT", hi: "कर रहित", mfe: "HT" },
  dt_retenir_fournisseur: { fr: "Retenir ce fournisseur pour cet article", en: "Select this supplier for this item", mg: "Fidio ity mpamatsy ity ho an'ity entana ity", hi: "इस वस्तु के लिए यह आपूर्तिकर्ता चुनें", mfe: "Swazir sa fournisser-la pou sa artik-la" },
  dt_total_moins_cher: { fr: "Total des articles au prix le moins cher retenu (HT)", en: "Total of the items at the cheapest price selected (excl. tax)", mg: "Fitambaran'ny entana amin'ny vidiny mora indrindra voafidy (HT)", hi: "चुने गए सबसे सस्ते मूल्य पर वस्तुओं का कुल (कर रहित)", mfe: "Total bann artik o pli bon pri swazir (HT)" },
  dt_remarque_titre: { fr: "Remarque de la demande (pour le TCO imprimé)", en: "Request remark (for the printed TCO)", mg: "Fanamarihana ny fangatahana (ho an'ny TCO voatonta)", hi: "अनुरोध की टिप्पणी (मुद्रित TCO के लिए)", mfe: "Remark demann (pou TCO imprime)" },
  dt_remarque_ph: { fr: "Ex. article surligné en jaune abordable... / Autres fournisseurs consultés : Sanifer et Batimax pas de dispo, MC Mining en attente de réponse...", en: "E.g. item highlighted in yellow is affordable... / Other suppliers consulted: Sanifer and Batimax not available, MC Mining awaiting a reply...", mg: "Oh. entana voasongadina mavo azo vidiana... / Mpamatsy hafa nanontaniana: tsy misy Sanifer sy Batimax, miandry valiny MC Mining...", hi: "उदा. पीले रंग में हाइलाइट की गई वस्तु किफ़ायती है... / परामर्श किए गए अन्य आपूर्तिकर्ता: Sanifer और Batimax के पास उपलब्ध नहीं, MC Mining के उत्तर की प्रतीक्षा...", mfe: "Pl. artik souligne an zonn abordab... / Lezot fournisser konsilte : Sanifer ek Batimax pa disponib, MC Mining pe ekspekte enn reponn..." },
  dt_aide_radio: { fr: "Le point (radio) coché sur chaque article indique le fournisseur retenu pour cet article (par défaut le moins cher). Change-le si besoin avant de générer les bons de commande — un BC distinct sera créé par fournisseur retenu, seulement pour les articles pas encore attribués.", en: "The ticked dot (radio button) on each item shows the supplier selected for that item (the cheapest by default). Change it if needed before generating the purchase orders — a separate PO will be created for each selected supplier, only for items not yet allocated.", mg: "Ny teboka (radio) voamarika amin'ny entana tsirairay dia mampiseho ny mpamatsy voafidy ho an'ilay entana (mora indrindra raha tsy misy fanovana). Ovay raha ilaina alohan'ny hamoronana ny baiko fividianana — BC samihafa no hoforonina isaky ny mpamatsy voafidy, ho an'ny entana mbola tsy nozaraina ihany.", hi: "हर वस्तु पर चुना गया बिंदु (रेडियो) उस वस्तु के लिए चुने गए आपूर्तिकर्ता को दर्शाता है (डिफ़ॉल्ट रूप से सबसे सस्ता)। खरीद आदेश बनाने से पहले ज़रूरत हो तो बदलें — चुने गए हर आपूर्तिकर्ता के लिए अलग BC बनेगा, केवल उन वस्तुओं के लिए जो अभी आवंटित नहीं हुई हैं।", mfe: "Pwen (radyo) koche lor sak artik montre fournisser swazir pou sa artik-la (pli bon marse par defo). Sanze si bizin avan zenere bann bon komann — enn BC separe pou kree pou sak fournisser swazir, zis pou bann artik ki pankor atribye." },
  dt_btn_generer_bc: { fr: "Générer le(s) bon(s) de commande", en: "Generate the purchase order(s)", mg: "Hamoron'ny baiko fividianana", hi: "खरीद आदेश बनाएँ", mfe: "Zenere bon komann" },
  dt_un_instant: { fr: "Un instant — le calcul du fournisseur le moins cher se met à jour après ta dernière saisie de prix.", en: "One moment — the cheapest supplier calculation is updating after your last price entry.", mg: "Fanontaniana kely — mihavao ny kajy ny mpamatsy mora indrindra aorian'ny fampidirana vidiny farany.", hi: "एक क्षण — आपकी अंतिम मूल्य प्रविष्टि के बाद सबसे सस्ते आपूर्तिकर्ता की गणना अपडेट हो रही है।", mfe: "Enn moman — kalkil fournisser pli bon marse pe met a zour apre ou dernie pri antre." },
  dt_tous_couverts: { fr: "✓ Tous les articles de cette demande ont déjà un bon de commande.", en: "✓ All the items in this request already have a purchase order.", mg: "✓ Efa manana baiko fividianana daholo ny entana rehetra amin'ity fangatahana ity.", hi: "✓ इस अनुरोध की सभी वस्तुओं के लिए पहले से खरीद आदेश है।", mfe: "✓ Tou bann artik dan sa demann-la deza ena enn bon komann." },
  dt_confirm_retirer: { fr: "Retirer \"{designation}\" de la demande ?", en: "Remove \"{designation}\" from the request?", mg: "Esorina ao amin'ny fangatahana ve ny \"{designation}\"?", hi: "क्या \"{designation}\" को अनुरोध से हटाएँ?", mfe: "Retir \"{designation}\" depi demann ?" },
  dt_attention: { fr: "Attention : {morceaux}.", en: "Warning: {morceaux}.", mg: "Tandremo : {morceaux}.", hi: "ध्यान दें: {morceaux}।", mfe: "Atansyon : {morceaux}." },
  dt_echec_bc: { fr: "le BC n'a pas pu être créé pour {noms} — les lignes correspondantes restent disponibles pour une nouvelle tentative", en: "the PO could not be created for {noms} — the corresponding lines remain available for another attempt", mg: "tsy nahomby ny famoronana ny BC ho an'i {noms} — mbola azo andramana indray ny andalana mifandray", hi: "{noms} के लिए BC नहीं बन सका — संबंधित पंक्तियाँ फिर से प्रयास के लिए उपलब्ध रहती हैं", mfe: "BC pa finn kree pou {noms} — bann lign korespondan res disponib pou enn nouvo esei" },
  dt_reliquat: { fr: "{n} article(s) sans aucun prix ont été transférés vers une nouvelle demande dédiée (à rechercher ailleurs ou à signaler aux demandeurs)", en: "{n} item(s) with no price at all were moved to a new dedicated request (to be sourced elsewhere or reported to the requesters)", mg: "entana {n} tsy nisy vidiny mihitsy dia nafindra tany amin'ny fangatahana vaovao natokana (hotadiavina any ho any na ho ambara amin'ny mpangataka)", hi: "बिना किसी मूल्य वाली {n} वस्तुएँ एक नए समर्पित अनुरोध में भेज दी गईं (कहीं और से जुटानी हैं या अनुरोधकर्ताओं को बतानी हैं)", mfe: "{n} artik san okenn pri finn transfere dan enn nouvo demann dedie (pou rod ailer oubien pou avize bann demander)" },

  col_num: { fr: "N°", en: "No.", mg: "Laharana", hi: "क्र.सं.", mfe: "N°" },

  // ---------- Articles ----------
  art_titre_liste: { fr: "Liste des articles ({a} / {b})", en: "Item list ({a} / {b})", mg: "Lisitry ny entana ({a} / {b})", hi: "वस्तुओं की सूची ({a} / {b})", mfe: "Lalis artik ({a} / {b})" },
  art_ph_recherche: { fr: "Rechercher un article (désignation, catégorie...)", en: "Search an item (description, category...)", mg: "Hitady entana (famaritana, sokajy...)", hi: "वस्तु खोजें (विवरण, श्रेणी...)", mfe: "Rod enn artik (deskripsyon, kategori...)" },
  art_l_categorie: { fr: "Catégorie", en: "Category", mg: "Sokajy", hi: "श्रेणी", mfe: "Kategori" },
  art_l_dernier_prix_ht: { fr: "Dernier prix HT", en: "Last price excl. tax", mg: "Vidiny farany HT", hi: "अंतिम मूल्य (कर रहित)", mfe: "Dernie pri HT" },
  art_toutes_categories: { fr: "Toutes les catégories", en: "All categories", mg: "Ny sokajy rehetra", hi: "सभी श्रेणियाँ", mfe: "Tou bann kategori" },
  art_sans_categorie: { fr: "— Sans catégorie ({n}) —", en: "— No category ({n}) —", mg: "— Tsy misy sokajy ({n}) —", hi: "— बिना श्रेणी ({n}) —", mfe: "— San kategori ({n}) —" },
  art_choisir_categorie: { fr: "— Choisir une catégorie —", en: "— Choose a category —", mg: "— Fidio sokajy —", hi: "— श्रेणी चुनें —", mfe: "— Swazir enn kategori —" },
  art_endormi_label: { fr: "Article endormi (exclu de l'alerte réapprovisionnement)", en: "Dormant item (excluded from the restocking alert)", mg: "Entana matory (tsy ao anatin'ny fampitandremana famenoana)", hi: "निष्क्रिय वस्तु (पुनः आपूर्ति अलर्ट से बाहर)", mfe: "Artik andormi (ekskli lalert reaprovizyonman)" },
  art_continue_par: { fr: "Continue par :", en: "Replaced by:", mg: "Solon'ny :", hi: "इसकी जगह:", mfe: "Ranplase par :" },
  art_continue_par_passif: { fr: "Continué par :", en: "Replaced by:", mg: "Solon'ny :", hi: "इसकी जगह:", mfe: "Ranplase par :" },
  art_ph_remplacement: { fr: "Tape le nom de l'article de remplacement...", en: "Type the name of the replacement item...", mg: "Soraty ny anaran'ny entana hisolo...", hi: "प्रतिस्थापन वस्तु का नाम लिखें...", mfe: "Tape nom artik ranplasman..." },
  art_rompre_info: { fr: "Rompre le lien — cet article redevient indépendant", en: "Break the link — this item becomes independent again", mg: "Vahao ny rohy — mahaleotena indray ity entana ity", hi: "लिंक तोड़ें — यह वस्तु फिर स्वतंत्र हो जाती है", mfe: "Kase lien — sa artik vinn endepandan ankor" },
  art_rompre: { fr: "Rompre le lien", en: "Break the link", mg: "Vahao ny rohy", hi: "लिंक तोड़ें", mfe: "Kase lien" },
  art_endormi_badge: { fr: "😴 Endormi", en: "😴 Dormant", mg: "😴 Matory", hi: "😴 निष्क्रिय", mfe: "😴 Andormi" },
  art_arrete: { fr: "⏸ Achat probablement arrêté", en: "⏸ Purchasing probably stopped", mg: "⏸ Mety efa nijanona ny fividianana", hi: "⏸ खरीद संभवतः बंद", mfe: "⏸ Aste probableman aret" },
  art_arrete_info: { fr: "Dernier achat remontant à plus de 3 fois le cycle habituel — probablement plus utilisé", en: "Last purchase more than 3 times the usual cycle ago — probably no longer used", mg: "Fividianana farany mihoatra ny in-3 ny fihodinana mahazatra — mety tsy ampiasaina intsony", hi: "अंतिम खरीद सामान्य चक्र से 3 गुना से अधिक पहले — संभवतः अब उपयोग में नहीं", mfe: "Dernie aste ena plis ki 3 fwa sik abitye — probableman pa servi ankor" },
  art_copier_infos: { fr: "Copier toutes les infos", en: "Copy all the info", mg: "Adikao daholo ny fampahalalana", hi: "सारी जानकारी कॉपी करें", mfe: "Kopie tou lenformasyon" },
  art_l_unite_achat: { fr: "Unité d'achat", en: "Purchase unit", mg: "Singa fividianana", hi: "खरीद की इकाई", mfe: "Inite lasat" },
  art_l_dernier_prix_ref: { fr: "Dernier prix HT (référence)", en: "Last price excl. tax (reference)", mg: "Vidiny farany HT (tsiahy)", hi: "अंतिम मूल्य कर रहित (संदर्भ)", mfe: "Dernie pri HT (referans)" },
  art_l_dernier_achat: { fr: "Dernier achat réel", en: "Last actual purchase", mg: "Fividianana farany tena izy", hi: "अंतिम वास्तविक खरीद", mfe: "Dernie aste reel" },
  art_dernier_achat_detail: { fr: "{pu} Ar HT ({puTtc} Ar TTC) — qté {qte} — le {date} — BC {bc}", en: "{pu} Ar excl. tax ({puTtc} Ar incl. tax) — qty {qte} — on {date} — PO {bc}", mg: "{pu} Ar HT ({puTtc} Ar TTC) — habetsaka {qte} — tamin'ny {date} — BC {bc}", hi: "{pu} Ar (कर रहित) ({puTtc} Ar कर सहित) — मात्रा {qte} — {date} को — BC {bc}", mfe: "{pu} Ar HT ({puTtc} Ar TTC) — kantite {qte} — le {date} — BC {bc}" },
  art_copie_dernier_achat: { fr: "{fournisseur} — {pu} Ar HT le {date} (BC {bc})", en: "{fournisseur} — {pu} Ar excl. tax on {date} (PO {bc})", mg: "{fournisseur} — {pu} Ar HT tamin'ny {date} (BC {bc})", hi: "{fournisseur} — {pu} Ar (कर रहित) {date} को (BC {bc})", mfe: "{fournisseur} — {pu} Ar HT le {date} (BC {bc})" },
  art_autres_fournisseurs: { fr: "Autres fournisseurs consultés :", en: "Other suppliers consulted:", mg: "Mpamatsy hafa nangatahana :", hi: "परामर्श किए गए अन्य आपूर्तिकर्ता:", mfe: "Lezot fournisser konsilte :" },
  art_aucun_achat: { fr: "Aucun achat enregistré pour l'instant sur cet article.", en: "No purchase recorded so far for this item.", mg: "Tsy mbola misy fividianana voasoratra amin'ity entana ity.", hi: "इस वस्तु पर अभी तक कोई खरीद दर्ज नहीं।", mfe: "Okenn aste anrezistre pou le moman lor sa artik la." },

  art_ph_unite_suggestions: { fr: "Unité (tape pour voir les suggestions)", en: "Unit (type to see suggestions)", mg: "Singa (soraty mba hahita ny soso-kevitra)", hi: "इकाई (सुझाव देखने के लिए टाइप करें)", mfe: "Inite (tape pou get sizesyon)" },
  btn_ajouter_simple: { fr: "Ajouter", en: "Add", mg: "Ampio", hi: "जोड़ें", mfe: "Azoute" },

  // ---------- Gérer les catégories ----------
  cat_titre: { fr: "Gérer les catégories d'articles", en: "Manage item categories", mg: "Hitantana ny sokajin'ny entana", hi: "वस्तु श्रेणियाँ प्रबंधित करें", mfe: "Zer bann kategori artik" },
  cat_ph_nouvelle: { fr: "Nom de la nouvelle catégorie", en: "Name of the new category", mg: "Anaran'ny sokajy vaovao", hi: "नई श्रेणी का नाम", mfe: "Nom nouvo kategori" },
  cat_creation: { fr: "Création...", en: "Creating...", mg: "Mamorona...", hi: "बनाई जा रही है...", mfe: "Pe kree..." },
  cat_deja_existe: { fr: "Cette catégorie existe déjà.", en: "This category already exists.", mg: "Efa misy io sokajy io.", hi: "यह श्रेणी पहले से मौजूद है।", mfe: "Sa kategori la existe deza." },
  cat_erreur_creation: { fr: "Erreur lors de la création.", en: "Error while creating.", mg: "Nisy olana teo am-pamoronana.", hi: "बनाते समय त्रुटि हुई।", mfe: "Erer pandan kreasyon." },
  cat_meme_nom: { fr: "Une catégorie porte déjà ce nom.", en: "A category already has this name.", mg: "Efa misy sokajy manana io anarana io.", hi: "इस नाम की श्रेणी पहले से मौजूद है।", mfe: "Enn kategori ena sa nom la deza." },
  cat_erreur_renommage: { fr: "Erreur lors du renommage.", en: "Error while renaming.", mg: "Nisy olana teo am-panovana anarana.", hi: "नाम बदलते समय त्रुटि हुई।", mfe: "Erer pandan renome." },
  cat_confirm_supprimer_utilisee: { fr: "Impossible de supprimer \"{nom}\" : {n} article(s) l'utilisent encore. Change leur catégorie d'abord.", en: "Cannot delete \"{nom}\": {n} item(s) still use it. Change their category first.", mg: "Tsy azo fafana \"{nom}\" : mbola misy entana {n} mampiasa azy. Ovay aloha ny sokajin'izy ireo.", hi: "\"{nom}\" हटाना संभव नहीं: {n} वस्तुएँ अभी भी इसका उपयोग कर रही हैं। पहले उनकी श्रेणी बदलें।", mfe: "Pa kapav efas \"{nom}\" : {n} artik pe servi li ankor. Sanz zot kategori avan." },
  cat_confirm_supprimer: { fr: "Supprimer la catégorie \"{nom}\" ?", en: "Delete the category \"{nom}\"?", mg: "Hofafana ve ny sokajy \"{nom}\" ?", hi: "क्या श्रेणी \"{nom}\" हटाएँ?", mfe: "Efas kategori \"{nom}\" ?" },
  cat_h_nom: { fr: "Nom", en: "Name", mg: "Anarana", hi: "नाम", mfe: "Nom" },
  cat_h_articles: { fr: "Articles", en: "Items", mg: "Entana", hi: "वस्तुएँ", mfe: "Artik" },
  cat_aucune: { fr: "Aucune catégorie pour le moment.", en: "No category for now.", mg: "Tsy mbola misy sokajy amin'izao.", hi: "अभी कोई श्रेणी नहीं।", mfe: "Okenn kategori pou le moman." },

  // ---------- Bandeau lecture seule ----------
  ls_titre: { fr: "Lecture seule", en: "Read only", mg: "Famakiana ihany", hi: "केवल पढ़ने योग्य", mfe: "Lekti sel" },
  ls_cree_par: { fr: "créé par {nom}", en: "created by {nom}", mg: "nataon'i {nom}", hi: "{nom} द्वारा बनाया गया", mfe: "kree par {nom}" },
  ls_cree_autre: { fr: "créé par quelqu'un d'autre", en: "created by someone else", mg: "nataon'olon-kafa", hi: "किसी अन्य द्वारा बनाया गया", mfe: "kree par enn lot dimounn" },
  ls_aide: { fr: "Tu peux consulter et imprimer, mais pas modifier ni faire avancer le traitement ici.", en: "You can view and print, but not edit or move this forward here.", mg: "Azonao jerena sy atonta, saingy tsy azo ovaina na ampandrosoina eto.", hi: "आप देख और प्रिंट कर सकते हैं, पर यहाँ संपादित या आगे नहीं बढ़ा सकते।", mfe: "Ou kapav konsilte ek imprim, me pa modifie ni fer avans traitman isi." },

  // ---------- Cadre extensible ----------
  ce_reduire: { fr: "Réduire (Échap)", en: "Collapse (Esc)", mg: "Ahena (Esc)", hi: "छोटा करें (Esc)", mfe: "Redir (Esc)" },
  ce_reduire_btn: { fr: "Réduire", en: "Collapse", mg: "Ahena", hi: "छोटा करें", mfe: "Redir" },
  ce_agrandir: { fr: "Agrandir en plein écran", en: "Expand to full screen", mg: "Halehibiazo amin'ny efijery manontolo", hi: "पूर्ण स्क्रीन में बड़ा करें", mfe: "Agrandi an plin ekran" },

  // ---------- PV de réception vierge ----------
  pvv_titre: { fr: "PV de réception vierge", en: "Blank receipt form", mg: "PV fandraisana foana", hi: "रिक्त प्राप्ति रिपोर्ट (PV)", mfe: "PV resepsyon vid" },
  pvv_btn_imprimer: { fr: "Imprimer", en: "Print", mg: "Alefa ho pirinty", hi: "प्रिंट करें", mfe: "Imprim" },
  pvv_aide: { fr: "Pour les livraisons qui ne passent pas par une demande créée dans l'appli — à remplir entièrement à la main. Toutes les lignes du tableau ont une bordure visible, même vides, pour guider l'écriture.", en: "For deliveries that do not go through a request created in the app — to be filled in entirely by hand. Every row of the table has a visible border, even empty, to guide handwriting.", mg: "Ho an'ny fanaterana tsy mandalo fangatahana noforonina ao amin'ny rindrankaja — feno tanteraka an-tanana. Ny andalana rehetra ao amin'ny tabilao dia manana sisiny hita, na dia foana aza, mba hitarika ny fanoratana.", hi: "उन डिलीवरी के लिए जो ऐप में बनाए गए अनुरोध से नहीं गुजरतीं — पूरी तरह हाथ से भरनी होगी। तालिका की हर पंक्ति में दिखाई देने वाली सीमा है, खाली होने पर भी, ताकि हस्तलेखन में मदद मिले।", mfe: "Pou bann livrezon ki pa pas par enn demann kree dan lapli — pou ranpli antierman amenn. Tou lign tablo la ena enn bordir vizib, mem vid, pou gid lekritir." },
  pvv_n_bc: { fr: "BC UF2 n°", en: "PO UF2 no.", mg: "Laharana BC UF2", hi: "BC UF2 सं.", mfe: "N° BC UF2" },
  pvv_description: { fr: "Description", en: "Description", mg: "Famaritana", hi: "विवरण", mfe: "Deskripsyon" },
  pvv_qte_livree: { fr: "Quantité livré", en: "Quantity delivered", mg: "Habetsaka nateraka", hi: "डिलीवर मात्रा", mfe: "Kantite livre" },
  pvv_remarque: { fr: "Remarque", en: "Remark", mg: "Fanamarihana", hi: "टिप्पणी", mfe: "Remark" },
  pvv_page: { fr: "Page 1/1", en: "Page 1/1", mg: "Pejy 1/1", hi: "पेज 1/1", mfe: "Paz 1/1" },
  pvv_signatures: { fr: "Signatures, Date, Nom :", en: "Signatures, Date, Name:", mg: "Sonia, Daty, Anarana :", hi: "हस्ताक्षर, तिथि, नाम:", mfe: "Sinyatir, Dat, Nom :" },
  pvv_date: { fr: "Date", en: "Date", mg: "Daty", hi: "तिथि", mfe: "Dat" },
  pvv_emis_par: { fr: "Emis par", en: "Issued by", mg: "Navoakan'i", hi: "जारीकर्ता", mfe: "Emiz par" },
  pvv_contact: { fr: "Contact", en: "Contact", mg: "Fifandraisana", hi: "संपर्क", mfe: "Kontak" },
  pvv_email: { fr: "E-Mail", en: "E-mail", mg: "Mailaka", hi: "ईमेल", mfe: "E-mail" },
  pvv_date_da: { fr: "Date DA", en: "PR date", mg: "Daty DA", hi: "DA तिथि", mfe: "Dat DA" },
  pvv_da_n: { fr: "DA N°", en: "PR no.", mg: "Laharana DA", hi: "DA सं.", mfe: "N° DA" },
  pvv_destinataire: { fr: "Destinataire", en: "Recipient", mg: "Mpandray", hi: "प्राप्तकर्ता", mfe: "Destinatater" },
  pvv_utilisateur_final: { fr: "Utilisateur Final", en: "End User", mg: "Mpampiasa farany", hi: "अंतिम उपयोगकर्ता", mfe: "Itilizater final" },
  pvv_adresse: { fr: "Adresse", en: "Address", mg: "Adiresy", hi: "पता", mfe: "Adres" },
  pvv_code_postal: { fr: "Code postal", en: "Postal code", mg: "Kaody postaly", hi: "पिन कोड", mfe: "Kod postal" },
  pvv_date_livraison: { fr: "Date de livraison", en: "Delivery date", mg: "Daty fanaterana", hi: "डिलीवरी तिथि", mfe: "Dat livrezon" },
  pvv_nom_recept_magasin: { fr: "Nom Réceptionnaire du Magasin", en: "Store receiver's name", mg: "Anaran'ny mpandray any amin'ny magazay", hi: "स्टोर प्राप्तकर्ता का नाम", mfe: "Nom reseptyonner Magazin" },
  pvv_type_reglement: { fr: "Type de règlement", en: "Payment type", mg: "Karazana fandoavana", hi: "भुगतान प्रकार", mfe: "Tip peyman" },
  pvv_modalite_paiement: { fr: "Modalité de paiement", en: "Payment terms", mg: "Fomba fandoavana", hi: "भुगतान शर्तें", mfe: "Modalite peyman" },
  pvv_resp_magasin: { fr: "RESPONSABLE MAGASIN", en: "STORE MANAGER", mg: "TOMPON'ANDRAIKITRA MAGAZAY", hi: "स्टोर प्रभारी", mfe: "RESPONSAB MAGAZIN" },
  pvv_magasinier: { fr: "MAGASINIER", en: "STOREKEEPER", mg: "MPIANDRAIKITRA MAGAZAY", hi: "स्टोरकीपर", mfe: "MAGAZINYE" },
  pvv_agent_securite: { fr: "AGENT DE SECURITE", en: "SECURITY AGENT", mg: "MPIAMBINA", hi: "सुरक्षा अधिकारी", mfe: "AZAN SEKIRITE" },
  pvv_tel: { fr: "Tél", en: "Phone", mg: "Tel", hi: "फ़ोन", mfe: "Tel" },
  pvv_livreur: { fr: "LIVREUR ou TRANSPORTEUR", en: "DELIVERY PERSON or CARRIER", mg: "MPANATITRA na MPITATITRA", hi: "डिलीवरी व्यक्ति या वाहक", mfe: "LIVRER ou TRANSPORTER" },

  art_traductions_titre: { fr: "Traductions du nom (facultatif — pour les expatriés)", en: "Name translations (optional — for expatriates)", mg: "Fandikana ny anarana (tsy voatery — ho an'ny vahiny)", hi: "नाम के अनुवाद (वैकल्पिक — प्रवासियों के लिए)", mfe: "Tradiksion nom (fakiltatif — pou expatriye)" },
  art_traductions_aide: { fr: "Traduis uniquement le nom générique (ex. \"colle\", \"brosse\"), jamais la marque ni la référence (ex. DUNSON, DJ64K, A07) — laisse vide si tu ne sais pas, le français s'affichera à la place.", en: "Translate only the generic name (e.g. \"glue\", \"brush\"), never the brand or reference (e.g. DUNSON, DJ64K, A07) — leave blank if unsure, French will show instead.", mg: "Adikao ny anarana ankapobeny ihany (oh. \"lasy\", \"borosy\"), tsy ny marika na ny laharana famantarana (oh. DUNSON, DJ64K, A07) — avelao foana raha tsy fantatra, ny frantsay no hiseho.", hi: "केवल सामान्य नाम अनुवाद करें (जैसे \"गोंद\", \"ब्रश\"), ब्रांड या संदर्भ कभी नहीं (जैसे DUNSON, DJ64K, A07) — यदि पता न हो तो खाली छोड़ें, फ़्रेंच दिखेगा।", mfe: "Tradir zis nom zenerik (pl. \"lakol\", \"bros\"), zame mark ou referans (pl. DUNSON, DJ64K, A07) — kit vid si ou pa sir, franse pou afiste." },
  art_trad_hint: { fr: "En français : {nom}", en: "In French: {nom}", mg: "Amin'ny teny frantsay : {nom}", hi: "फ़्रेंच में: {nom}", mfe: "An franse : {nom}" },

  art_ph_code: { fr: "Code article (facultatif)", en: "Item code (optional)", mg: "Kaody entana (tsy voatery)", hi: "वस्तु कोड (वैकल्पिक)", mfe: "Kod artik (fakiltatif)" },
  art_ph_nom: { fr: "Nom / désignation de l'article", en: "Item name", mg: "Anaran'ny entana", hi: "वस्तु का नाम", mfe: "Nom artik" },
  art_ph_marque: { fr: "Marque (facultatif)", en: "Brand (optional)", mg: "Marika (tsy voatery)", hi: "ब्रांड (वैकल्पिक)", mfe: "Mark (fakiltatif)" },
  art_ph_reference: { fr: "Référence fournisseur (facultatif)", en: "Supplier reference (optional)", mg: "Laharana famantarana mpamatsy (tsy voatery)", hi: "आपूर्तिकर्ता संदर्भ (वैकल्पिक)", mfe: "Referans fournisser (fakiltatif)" },
  art_apercu_designation: { fr: "Désignation complète : {designation}", en: "Full name: {designation}", mg: "Anarana feno : {designation}", hi: "पूरा नाम: {designation}", mfe: "Non komple : {designation}" },
  art_traductions_nom_titre: { fr: "Traductions du nom (facultatif — pour les expatriés)", en: "Name translations (optional — for expatriates)", mg: "Fandikana ny anarana (tsy voatery — ho an'ny vahiny)", hi: "नाम के अनुवाद (वैकल्पिक — प्रवासियों के लिए)", mfe: "Tradiksion nom (fakiltatif — pou expatriye)" },
  art_traductions_nom_aide: { fr: "Ne traduis que le nom ci-dessus — jamais le code, la marque ni la référence, qui restent identiques dans toutes les langues.", en: "Only translate the name above — never the code, brand or reference, which stay identical in every language.", mg: "Ny anarana etsy ambony ihany no adikao — tsy ny kaody, ny marika na ny laharana famantarana, izay mitovy amin'ny fiteny rehetra.", hi: "केवल ऊपर दिया गया नाम अनुवाद करें — कोड, ब्रांड या संदर्भ कभी नहीं, जो हर भाषा में समान रहते हैं।", mfe: "Zis tradir nom ki lao la — zame kod, mark ou referans, ki res parey dan tou langaz." },

  // ---------- Fournisseurs ----------
  four_titre_liste: { fr: "Liste des fournisseurs ({a} / {b})", en: "Supplier list ({a} / {b})", mg: "Lisitry ny mpamatsy ({a} / {b})", hi: "आपूर्तिकर्ताओं की सूची ({a} / {b})", mfe: "Lalis fournisser ({a} / {b})" },
  four_ph_recherche: { fr: "Rechercher un fournisseur (nom, contact, activité, tél...)", en: "Search a supplier (name, contact, activity, phone...)", mg: "Hitady mpamatsy (anarana, mpifandray, sehatra, tel...)", hi: "आपूर्तिकर्ता खोजें (नाम, संपर्क, गतिविधि, फ़ोन...)", mfe: "Rod enn fournisser (nom, kontak, aktivite, tel...)" },
  four_l_nom: { fr: "Nom", en: "Name", mg: "Anarana", hi: "नाम", mfe: "Nom" },
  four_l_activite: { fr: "Activité", en: "Activity", mg: "Sehatra", hi: "गतिविधि", mfe: "Aktivite" },
  four_l_date_creation: { fr: "Date de création", en: "Creation date", mg: "Daty namoronana", hi: "निर्माण तिथि", mfe: "Dat kreasyon" },
  four_copier_infos: { fr: "Copier toutes les infos", en: "Copy all the info", mg: "Adikao daholo ny fampahalalana", hi: "सारी जानकारी कॉपी करें", mfe: "Kopie tou lenformasyon" },
  four_l_contact: { fr: "Nom du contact", en: "Contact name", mg: "Anaran'ny mpifandray", hi: "संपर्क का नाम", mfe: "Nom kontak" },
  four_l_telephone: { fr: "Téléphone", en: "Phone", mg: "Telefaonina", hi: "फ़ोन", mfe: "Telefonn" },
  four_copie: { fr: "Copié !", en: "Copied!", mg: "Voadika !", hi: "कॉपी हुआ!", mfe: "Kopie !" },
  four_copier: { fr: "Copier", en: "Copy", mg: "Adikao", hi: "कॉपी करें", mfe: "Kopie" },
  four_l_adresse: { fr: "Adresse", en: "Address", mg: "Adiresy", hi: "पता", mfe: "Adres" },
  four_l_code_postal: { fr: "Code postal", en: "Postal code", mg: "Kaody postaly", hi: "पिन कोड", mfe: "Kod postal" },
  four_l_type_reglement: { fr: "Type de règlement", en: "Payment type", mg: "Karazana fandoavana", hi: "भुगतान प्रकार", mfe: "Tip peyman" },
  four_l_tva: { fr: "TVA", en: "VAT", mg: "TVA", hi: "वैट", mfe: "TVA" },
  four_non_assujetti: { fr: "Non assujetti", en: "Not subject", mg: "Tsy voakasika", hi: "कर-मुक्त", mfe: "Pa asizeti" },
  four_l_delai_paiement: { fr: "Délai paiement", en: "Payment term", mg: "Fe-potoana fandoavana", hi: "भुगतान अवधि", mfe: "Delai peyman" },
  four_l_remise_defaut: { fr: "Remise par défaut", en: "Default discount", mg: "Fihenam-bidy voafaritra", hi: "डिफ़ॉल्ट छूट", mfe: "Remiz par defo" },
  four_l_moment_paiement: { fr: "Moment du paiement", en: "Payment timing", mg: "Fotoana fandoavana", hi: "भुगतान का समय", mfe: "Moman peyman" },
  four_l_acompte: { fr: "Acompte à la commande", en: "Deposit on order", mg: "Vola mialoha amin'ny baiko", hi: "आदेश पर अग्रिम भुगतान", mfe: "Akont lor komann" },
  four_solde_livraison: { fr: "à la livraison", en: "on delivery", mg: "amin'ny fanaterana", hi: "डिलीवरी पर", mfe: "lor livrezon" },
  four_jours: { fr: "{n} jours", en: "{n} days", mg: "{n} andro", hi: "{n} दिन", mfe: "{n} zour" },

  // ---------- Créer / modifier un fournisseur ----------
  fournv_titre_modifier: { fr: "Modifier le fournisseur", en: "Edit the supplier", mg: "Ovay ny mpamatsy", hi: "आपूर्तिकर्ता संपादित करें", mfe: "Modifie fournisser" },
  fournv_voir_tous: { fr: "Voir tous les fournisseurs", en: "See all suppliers", mg: "Hijery ny mpamatsy rehetra", hi: "सभी आपूर्तिकर्ता देखें", mfe: "Get tou fournisser" },
  fournv_ph_nom: { fr: "Nom ou raison sociale", en: "Name or company name", mg: "Anarana na anaram-piraisana", hi: "नाम या कंपनी का नाम", mfe: "Nom ou rezon sosyal" },
  fournv_ph_contact: { fr: "Nom du contact", en: "Contact name", mg: "Anaran'ny mpifandray", hi: "संपर्क का नाम", mfe: "Nom kontak" },
  fournv_ph_telephone: { fr: "Téléphone", en: "Phone", mg: "Telefaonina", hi: "फ़ोन", mfe: "Telefonn" },
  fournv_ph_adresse: { fr: "Adresse", en: "Address", mg: "Adiresy", hi: "पता", mfe: "Adres" },
  fournv_ph_code_postal: { fr: "Code postal", en: "Postal code", mg: "Kaody postaly", hi: "पिन कोड", mfe: "Kod postal" },
  fournv_reg_cheque: { fr: "Chèque", en: "Cheque", mg: "Sekely", hi: "चेक", mfe: "Sek" },
  fournv_reg_especes: { fr: "Espèces", en: "Cash", mg: "Vola an-tanana", hi: "नकद", mfe: "Lakas" },
  fournv_reg_cheque_especes: { fr: "Chèque/Espèces", en: "Cheque/Cash", mg: "Sekely/Vola an-tanana", hi: "चेक/नकद", mfe: "Sek/Lakas" },
  fournv_reg_virement: { fr: "Virement", en: "Bank transfer", mg: "Famindrana vola", hi: "बैंक ट्रांसफर", mfe: "Viremen" },
  fournv_tva_taxable: { fr: "TVA 20% (taxable)", en: "VAT 20% (taxable)", mg: "TVA 20% (voakasika)", hi: "वैट 20% (कर योग्य)", mfe: "TVA 20% (taksab)" },
  fournv_tva_non_assujetti: { fr: "Non assujetti (0%)", en: "Not subject (0%)", mg: "Tsy voakasika (0%)", hi: "कर-मुक्त (0%)", mfe: "Pa asizeti (0%)" },
  fournv_ph_activite: { fr: "Activité / secteur", en: "Activity / sector", mg: "Sehatra", hi: "गतिविधि / क्षेत्र", mfe: "Aktivite / sekter" },
  fournv_l_delai: { fr: "Délai paiement (jours)", en: "Payment term (days)", mg: "Fe-potoana fandoavana (andro)", hi: "भुगतान अवधि (दिन)", mfe: "Delai peyman (zour)" },
  fournv_l_remise: { fr: "Remise par défaut (%)", en: "Default discount (%)", mg: "Fihenam-bidy voafaritra (%)", hi: "डिफ़ॉल्ट छूट (%)", mfe: "Remiz par defo (%)" },
  fournv_l_moment_paiement: { fr: "Moment du paiement", en: "Payment timing", mg: "Fotoana fandoavana", hi: "भुगतान का समय", mfe: "Moman peyman" },
  fournv_moment_reception: { fr: "À réception facture", en: "On invoice receipt", mg: "Rehefa voaray ny faktiora", hi: "चालान प्राप्ति पर", mfe: "Kan resevwar faktir" },
  fournv_moment_commande: { fr: "À la commande", en: "On order", mg: "Amin'ny baiko", hi: "आदेश पर", mfe: "Lor komann" },
  fournv_moment_livraison: { fr: "À la livraison", en: "On delivery", mg: "Amin'ny fanaterana", hi: "डिलीवरी पर", mfe: "Lor livrezon" },
  fournv_l_acompte: { fr: "Acompte à la commande (%)", en: "Deposit on order (%)", mg: "Vola mialoha amin'ny baiko (%)", hi: "आदेश पर अग्रिम भुगतान (%)", mfe: "Akont lor komann (%)" },
  fournv_ph_pas_acompte: { fr: "0 = pas d'acompte", en: "0 = no deposit", mg: "0 = tsy misy vola mialoha", hi: "0 = कोई अग्रिम नहीं", mfe: "0 = pena akont" },
  fournv_l_solde: { fr: "Solde payé à", en: "Balance paid on", mg: "Sisa aloa amin'ny", hi: "शेष भुगतान", mfe: "Sold peye lor" },
  fournv_solde_livraison: { fr: "À la livraison", en: "On delivery", mg: "Amin'ny fanaterana", hi: "डिलीवरी पर", mfe: "Lor livrezon" },
  fournv_solde_fin_travaux: { fr: "À la fin des travaux", en: "At the end of the works", mg: "Amin'ny fiafaran'ny asa", hi: "कार्य समाप्ति पर", mfe: "A lafin travo" },

  // ---------- Petite caisse ----------
  pc_titre: { fr: "Achat en petite caisse ({n})", en: "Petty cash purchase ({n})", mg: "Fividianana amin'ny kaoisy kely ({n})", hi: "छोटी नकदी से खरीद ({n})", mfe: "Aste avek ptit lakes ({n})" },
  pc_fermer: { fr: "Fermer", en: "Close", mg: "Hidio", hi: "बंद करें", mfe: "Ferm" },
  pc_btn_nouveau: { fr: "+ Nouvel achat en petite caisse", en: "+ New petty cash purchase", mg: "+ Fividianana vaovao amin'ny kaoisy kely", hi: "+ नई छोटी नकदी खरीद", mfe: "+ Nouvo aste avek ptit lakes" },
  pc_aide_creation: { fr: "Dès l'enregistrement, une demande et un bon de commande sont créés automatiquement (achat déjà validé par la direction via la fiche de décaissement — pas besoin de signature de BC), visibles dans les listes Demandes/Commandes et dans l'historique, marqués \"payé en espèce\".", en: "As soon as it's saved, a request and a purchase order are created automatically (purchase already approved by management via the disbursement form — no PO signature needed), visible in the Requests/Orders lists and in the history, marked \"paid in cash\".", mg: "Rehefa voatahiry, dia mamorona ho azy fangatahana sy baiko fividianana (fividianana efa nekena avy amin'ny fitantanana amin'ny alalan'ny taratasy famoahana vola — tsy ilaina soniavina intsony ny BC), hita ao amin'ny lisitra Fangatahana/Baiko ary ao amin'ny tantara, voamarika \"voaloa an-tanana\".", hi: "सहेजते ही, एक अनुरोध और खरीद आदेश अपने आप बन जाते हैं (खरीद पहले ही प्रबंधन द्वारा निकासी पत्र से स्वीकृत — BC हस्ताक्षर की ज़रूरत नहीं), अनुरोध/आदेश सूची और इतिहास में दिखेंगे, \"नकद भुगतान\" के रूप में चिह्नित।", mfe: "Depi ki anrezistre, enn demann ek enn bon komann kree otomatikman (aste deza validé par direksyon par fich desezmanman — pena bezwen sinyatir BC), vizib dan lalis Demann/Komann ek dan listorik, marke \"peye an lakes\"." },
  pc_ph_article: { fr: "Article (recherche dans la liste des articles)", en: "Item (search the item list)", mg: "Entana (fikarohana ao amin'ny lisitry ny entana)", hi: "वस्तु (वस्तु सूची में खोजें)", mfe: "Artik (rod dan lalis artik)" },
  pc_ph_fournisseur: { fr: "Fournisseur (laisser vide = Fournisseurs divers, à préciser plus tard)", en: "Supplier (leave blank = Miscellaneous suppliers, to specify later)", mg: "Mpamatsy (avelao foana = Mpamatsy samihafa, hazavaina any aoriana)", hi: "आपूर्तिकर्ता (खाली छोड़ें = विविध आपूर्तिकर्ता, बाद में बताएँ)", mfe: "Fournisser (kit vid = Fournisser divers, presize pli tar)" },
  pc_ph_motif: { fr: "Motif / précision (optionnel)", en: "Reason / detail (optional)", mg: "Antony / fanazavana (tsy voatery)", hi: "कारण / विवरण (वैकल्पिक)", mfe: "Rezon / presizion (fakiltatif)" },
  pc_ph_montant_demande: { fr: "Montant demandé (Ar)", en: "Requested amount (Ar)", mg: "Vola angatahina (Ar)", hi: "अनुरोधित राशि (Ar)", mfe: "Montan demande (Ar)" },
  pc_btn_creer: { fr: "Créer la demande", en: "Create the request", mg: "Hamorona ny fangatahana", hi: "अनुरोध बनाएँ", mfe: "Kree demann" },
  pc_st_demande: { fr: "Demandé", en: "Requested", mg: "Nangatahina", hi: "अनुरोधित", mfe: "Demande" },
  pc_st_decaisse: { fr: "Décaissé", en: "Disbursed", mg: "Navoaka", hi: "निकाला गया", mfe: "Desezme" },
  pc_st_justifie: { fr: "Justifié", en: "Justified", mg: "Voaporofo", hi: "प्रमाणित", mfe: "Zistifye" },
  pc_total: { fr: "Total {filtre} :", en: "Total {filtre}:", mg: "Fitambarany {filtre} :", hi: "कुल {filtre}:", mfe: "Total {filtre} :" },
  pc_aucune_ligne: { fr: "Aucune ligne pour ce filtre.", en: "No line for this filter.", mg: "Tsy misy andalana amin'ity sivana ity.", hi: "इस फ़िल्टर के लिए कोई पंक्ति नहीं।", mfe: "Okenn lign pou sa filtre-la." },
  pc_h_montant_demande: { fr: "Montant demandé", en: "Requested amount", mg: "Vola angatahina", hi: "अनुरोधित राशि", mfe: "Montan demande" },
  pc_h_signataire: { fr: "Signataire direction", en: "Management signatory", mg: "Mpanao sonia amin'ny fitantanana", hi: "प्रबंधन हस्ताक्षरकर्ता", mfe: "Sinyater direksyon" },
  pc_h_montant_depense: { fr: "Montant dépensé", en: "Amount spent", mg: "Vola lany", hi: "खर्च की गई राशि", mfe: "Montan depanse" },
  pc_h_piece_caisse: { fr: "Pièce de caisse", en: "Cash receipt", mg: "Taratasy kaoisy", hi: "नकद रसीद", mfe: "Pyes lakes" },
  pc_h_da_bc_lies: { fr: "DA / BC liés", en: "Linked PR / PO", mg: "DA / BC mifandray", hi: "संबद्ध DA / BC", mfe: "DA / BC lie" },
  pc_ph_num_piece: { fr: "N° pièce", en: "Receipt no.", mg: "Laharana taratasy", hi: "रसीद सं.", mfe: "N° pyes" },
  pc_suppr: { fr: "Suppr.", en: "Del.", mg: "Fafana", hi: "हटाएँ", mfe: "Efas" },
  pc_confirm_suppr_avec_bc: { fr: "Supprimer cette ligne, ainsi que la demande et le BC qu'elle avait générés ?", en: "Delete this line, along with the request and PO it generated?", mg: "Hofafana ve ity andalana ity, mbamin'ny fangatahana sy ny BC noforoniny?", hi: "यह पंक्ति, साथ ही इससे बनी अनुरोध और BC भी हटाएँ?", mfe: "Efas sa lign-la, ansanm avek demann ek BC ki li'nn zenere?" },
  pc_confirm_suppr: { fr: "Supprimer cette ligne de petite caisse ?", en: "Delete this petty cash line?", mg: "Hofafana ve ity andalana kaoisy kely ity?", hi: "यह छोटी नकदी पंक्ति हटाएँ?", mfe: "Efas sa lign ptit lakes-la?" },
  confirm_suppr_ligne: { fr: "Supprimer cette ligne ?", en: "Delete this line?", mg: "Hofafana ve ity andalana ity?", hi: "यह पंक्ति हटाएँ?", mfe: "Efas sa lign-la?" },

  // ---------- Carburant / Gaz ----------
  cg_titre: { fr: "Carburant / Gaz ({n})", en: "Fuel / Gas ({n})", mg: "Solika / Gazy ({n})", hi: "ईंधन / गैस ({n})", mfe: "Karbiran / Gaz ({n})" },
  cg_btn_nouveau: { fr: "+ Nouvelle opération", en: "+ New transaction", mg: "+ Asa vaovao", hi: "+ नया लेनदेन", mfe: "+ Nouvo operasyon" },
  cg_aide_creation: { fr: "Dès l'enregistrement, une demande et un bon de commande sont créés automatiquement (achat déjà autorisé via la carte, pas de signature à faire), visibles dans les listes Demandes/Commandes et dans l'historique.", en: "As soon as it's saved, a request and a purchase order are created automatically (purchase already authorised via the card, no signature needed), visible in the Requests/Orders lists and in the history.", mg: "Rehefa voatahiry, dia mamorona ho azy fangatahana sy baiko fividianana (fividianana efa nomena alalana tamin'ny alalan'ny karatra, tsy ilaina soniavina), hita ao amin'ny lisitra Fangatahana/Baiko ary ao amin'ny tantara.", hi: "सहेजते ही, एक अनुरोध और खरीद आदेश अपने आप बन जाते हैं (कार्ड से खरीद पहले ही अधिकृत, हस्ताक्षर की ज़रूरत नहीं), अनुरोध/आदेश सूची और इतिहास में दिखेंगे।", mfe: "Depi ki anrezistre, enn demann ek enn bon komann kree otomatikman (aste deza otorize par kart, pena sinyatir pou fer), vizib dan lalis Demann/Komann ek dan listorik." },
  cg_type_carburant: { fr: "Carburant", en: "Fuel", mg: "Solika", hi: "ईंधन", mfe: "Karbiran" },
  cg_type_gaz: { fr: "Gaz", en: "Gas", mg: "Gazy", hi: "गैस", mfe: "Gaz" },
  cg_ph_vehicule: { fr: "Véhicule / équipement (ex: 4107 TCD, Groupe électrogène...)", en: "Vehicle / equipment (e.g. 4107 TCD, Generator...)", mg: "Fiara / fitaovana (oh: 4107 TCD, Milina mamokatra herinaratra...)", hi: "वाहन / उपकरण (उदा: 4107 TCD, जनरेटर...)", mfe: "Veikil / lekipman (pl: 4107 TCD, Group elektrozen...)" },
  cg_ph_carte_fournisseur: { fr: "Fournisseur (Jovena, Galana... vide = Fournisseurs divers)", en: "Supplier (Jovena, Galana... blank = Miscellaneous suppliers)", mg: "Mpamatsy (Jovena, Galana... foana = Mpamatsy samihafa)", hi: "आपूर्तिकर्ता (Jovena, Galana... खाली = विविध आपूर्तिकर्ता)", mfe: "Fournisser (Jovena, Galana... vid = Fournisser divers)" },
  cg_ph_quantite: { fr: "Quantité", en: "Quantity", mg: "Habetsany", hi: "मात्रा", mfe: "Kantite" },
  cg_ph_montant_ttc: { fr: "Montant TTC (Ar)", en: "Amount incl. tax (Ar)", mg: "Vola TTC (Ar)", hi: "राशि कर सहित (Ar)", mfe: "Montan TTC (Ar)" },
  cg_info_montant: { fr: "Montant total payé, TVA comprise (le HT est recalculé automatiquement selon le fournisseur)", en: "Total amount paid, tax included (the excl.-tax amount is recalculated automatically based on the supplier)", mg: "Vola feno naloa, misy TVA (ny HT dia averina kajiana ho azy arakaraka ny mpamatsy)", hi: "भुगतान की गई कुल राशि, कर सहित (आपूर्तिकर्ता के अनुसार कर-रहित राशि अपने आप पुनर्गणित होती है)", mfe: "Montan total peye, avek TVA (HT rekalkile otomatikman selon fournisser)" },
  cg_ph_responsable: { fr: "Responsable / chauffeur", en: "Person in charge / driver", mg: "Tompon'andraikitra / mpamily", hi: "प्रभारी / चालक", mfe: "Responsab / sofer" },
  cg_tous_types: { fr: "Tous les types", en: "All types", mg: "Ny karazana rehetra", hi: "सभी प्रकार", mfe: "Tou bann tip" },
  cg_tous_vehicules: { fr: "Tous les véhicules/équipements", en: "All vehicles/equipment", mg: "Ny fiara/fitaovana rehetra", hi: "सभी वाहन/उपकरण", mfe: "Tou bann veikil/lekipman" },
  cg_total: { fr: "Total :", en: "Total:", mg: "Fitambarany :", hi: "कुल:", mfe: "Total :" },
  cg_aucune_operation: { fr: "Aucune opération pour ce filtre.", en: "No transaction for this filter.", mg: "Tsy misy asa amin'ity sivana ity.", hi: "इस फ़िल्टर के लिए कोई लेनदेन नहीं।", mfe: "Okenn operasyon pou sa filtre-la." },
  cg_h_type: { fr: "Type", en: "Type", mg: "Karazana", hi: "प्रकार", mfe: "Tip" },
  cg_h_vehicule: { fr: "Véhicule / équipement", en: "Vehicle / equipment", mg: "Fiara / fitaovana", hi: "वाहन / उपकरण", mfe: "Veikil / lekipman" },
  cg_h_carte: { fr: "Carte / fournisseur", en: "Card / supplier", mg: "Karatra / mpamatsy", hi: "कार्ड / आपूर्तिकर्ता", mfe: "Kart / fournisser" },
  cg_h_quantite: { fr: "Quantité", en: "Quantity", mg: "Habetsany", hi: "मात्रा", mfe: "Kantite" },
  cg_h_responsable: { fr: "Responsable", en: "Person in charge", mg: "Tompon'andraikitra", hi: "प्रभारी", mfe: "Responsab" },

  // ---------- KPI ----------
  kpi_titre: { fr: "KPI Achats", en: "Purchasing KPIs", mg: "KPI Fividianana", hi: "खरीद KPI", mfe: "KPI Aste" },
  kpi_btn_exporter_tout: { fr: "Exporter tout en Excel", en: "Export everything to Excel", mg: "Alefa daholo ho Excel", hi: "सब कुछ Excel में निर्यात करें", mfe: "Eksport tou an Excel" },
  kpi_carte_total: { fr: "Total des achats", en: "Total purchases", mg: "Fitambaran'ny fividianana", hi: "कुल खरीद", mfe: "Total bann aste" },
  kpi_carte_ce_mois: { fr: "Ce mois-ci", en: "This month", mg: "Ity volana ity", hi: "इस महीने", mfe: "Sa mwa la" },
  kpi_carte_bc: { fr: "{n} BC", en: "{n} PO(s)", mg: "BC {n}", hi: "{n} BC", mfe: "{n} BC" },
  kpi_carte_demandes_attente: { fr: "Demandes en attente de BC", en: "Requests awaiting a PO", mg: "Fangatahana miandry BC", hi: "BC की प्रतीक्षा में अनुरोध", mfe: "Demann pe ekspekte BC" },
  kpi_carte_bc_attente: { fr: "BC en attente de réception", en: "PO awaiting receipt", mg: "BC miandry fandraisana", hi: "प्राप्ति की प्रतीक्षा में BC", mfe: "BC pe ekspekte resepsyon" },
  kpi_carte_factures_impayees: { fr: "Factures impayées", en: "Unpaid invoices", mg: "Faktiora tsy voaloa", hi: "अवैतनिक चालान", mfe: "Faktir pa peye" },
  kpi_carte_delai_bc: { fr: "Délai moyen jusqu'au BC", en: "Average time to PO", mg: "Fe-potoana antonony ka hatramin'ny BC", hi: "BC तक औसत समय", mfe: "Delai moyenn ziska BC" },
  kpi_carte_delai_reception: { fr: "Délai moyen jusqu'à réception", en: "Average time to receipt", mg: "Fe-potoana antonony ka hatramin'ny fandraisana", hi: "प्राप्ति तक औसत समय", mfe: "Delai moyenn ziska resepsyon" },
  kpi_depuis_da: { fr: "depuis réception de la DA", en: "since the PR was received", mg: "hatramin'ny nandraisana ny DA", hi: "DA प्राप्त होने से", mfe: "depi resepsyon DA" },
  kpi_top_fournisseurs: { fr: "Top fournisseurs (montant TTC)", en: "Top suppliers (amount incl. tax)", mg: "Mpamatsy voalohany (vola TTC)", hi: "शीर्ष आपूर्तिकर्ता (कर सहित राशि)", mfe: "Top fournisser (montan TTC)" },
  kpi_top_articles: { fr: "Top articles (montant HT)", en: "Top items (amount excl. tax)", mg: "Entana voalohany (vola HT)", hi: "शीर्ष वस्तुएँ (कर रहित राशि)", mfe: "Top artik (montan HT)" },
  kpi_top_frequence: { fr: "Articles les plus achetés (fréquence)", en: "Most purchased items (frequency)", mg: "Entana be mpividy (fahatevezana)", hi: "सर्वाधिक खरीदी गई वस्तुएँ (आवृत्ति)", mfe: "Artik pli aste (frekans)" },
  kpi_btn_exporter: { fr: "Exporter", en: "Export", mg: "Alefa", hi: "निर्यात करें", mfe: "Eksport" },
  kpi_pas_commande: { fr: "Pas encore de commande.", en: "No order yet.", mg: "Tsy mbola misy baiko.", hi: "अभी तक कोई आदेश नहीं।", mfe: "Pena komann ankor." },
  kpi_pas_achat: { fr: "Pas encore d'achat.", en: "No purchase yet.", mg: "Tsy mbola misy fividianana.", hi: "अभी तक कोई खरीद नहीं।", mfe: "Pena aste ankor." },
  kpi_compte_par_bc: { fr: "Compté par bon de commande distinct (pas par ligne).", en: "Counted by distinct purchase order (not by line).", mg: "Isaina araka ny baiko fividianana miavaka (fa tsy araka ny andalana).", hi: "अलग खरीद आदेश के अनुसार गिना गया (पंक्ति के अनुसार नहीं)।", mfe: "Kompte par bon komann distink (pa par lign)." },
  kpi_cycle_titre: { fr: "Cycle de réapprovisionnement", en: "Restocking cycle", mg: "Fihodinan'ny famenoana entana", hi: "पुनः आपूर्ति चक्र", mfe: "Sik reaprovizyonman" },
  kpi_cycle_titre_complet: { fr: "Cycle de réapprovisionnement (durée moyenne entre deux commandes)", en: "Restocking cycle (average time between two orders)", mg: "Fihodinan'ny famenoana entana (fe-potoana antonony misy eo anelanelan'ny baiko roa)", hi: "पुनः आपूर्ति चक्र (दो आदेशों के बीच औसत समय)", mfe: "Sik reaprovizyonman (dire moyenn ant de komann)" },
  kpi_cycle_aide: { fr: "Articles achetés au moins 3 fois — durée moyenne entre deux commandes. Les alertes de réapprovisionnement approchant apparaissent au Tableau de bord.", en: "Items purchased at least 3 times — average time between two orders. Approaching restocking alerts appear on the Dashboard.", mg: "Entana novidina intelo farafahakeliny — fe-potoana antonony misy eo anelanelan'ny baiko roa. Miseho eo amin'ny Tabilao ny fampitandremana famenoana entana manatona.", hi: "कम से कम 3 बार खरीदी गई वस्तुएँ — दो आदेशों के बीच औसत समय। नज़दीक आ रहे पुनः आपूर्ति अलर्ट डैशबोर्ड पर दिखते हैं।", mfe: "Artik aste omwin 3 fwa — dire moyenn ant de komann. Bann alert reaprovizyonman ki pe apros afiste lor Tablo de bor." },
  kpi_pas_assez_historique: { fr: "Pas encore assez d'historique pour établir un cycle.", en: "Not enough history yet to establish a cycle.", mg: "Mbola tsy ampy tantara hanaovana fihodinana.", hi: "चक्र स्थापित करने के लिए अभी पर्याप्त इतिहास नहीं है।", mfe: "Pena ase listorik ankor pou etabli enn sik." },
  kpi_tous_les_j: { fr: "tous les {n} j ({achats} achats)", en: "every {n} d ({achats} purchases)", mg: "isaky ny {n} andro ({achats} fividianana)", hi: "हर {n} दिन ({achats} खरीद)", mfe: "tou le {n} zour ({achats} aste)" },
  kpi_achats_par_mois: { fr: "Achats par mois (12 derniers mois, TTC)", en: "Purchases by month (last 12 months, incl. tax)", mg: "Fividianana isam-bolana (12 volana farany, TTC)", hi: "महीने के अनुसार खरीद (पिछले 12 महीने, कर सहित)", mfe: "Aste par mwa (12 dernie mwa, TTC)" },

  // ---------- Historique (vue globale) ----------
  hist_titre: { fr: "Historique des achats — situation globale", en: "Purchase history — overall status", mg: "Tantaran'ny fividianana — fahitana ankapobeny", hi: "खरीद इतिहास — समग्र स्थिति", mfe: "Istorik bann aste — sitiasion global" },
  hist_ph_recherche: { fr: "Rechercher — article, fournisseur, service, demandeur, catégorie, usage/projet, N° BC, statut...", en: "Search — item, supplier, department, requester, category, use/project, PO no., status...", mg: "Hitady — entana, mpamatsy, sampana, mpangataka, sokajy, fampiasana/tetikasa, laharana BC, sata...", hi: "खोजें — वस्तु, आपूर्तिकर्ता, विभाग, अनुरोधकर्ता, श्रेणी, उपयोग/परियोजना, BC सं., स्थिति...", mfe: "Rod — artik, fournisser, servis, demander, kategori, itilizasion/projet, N° BC, statit..." },
  hist_du: { fr: "Du", en: "From", mg: "Manomboka", hi: "से", mfe: "Depi" },
  hist_au: { fr: "au", en: "to", mg: "hatramin'ny", hi: "तक", mfe: "ziska" },
  hist_annee_defaut_info: { fr: "Par défaut, seule l'année en cours est chargée", en: "By default, only the current year is loaded", mg: "Ny taona ankehitriny ihany no alaina raha tsy misy fanovana", hi: "डिफ़ॉल्ट रूप से केवल चालू वर्ष लोड होता है", mfe: "Par defo, zis lane kouran ki sarze" },
  hist_dernier_achat: { fr: "Dernier achat de \"{article}\"", en: "Last purchase of \"{article}\"", mg: "Fividianana farany ny \"{article}\"", hi: "\"{article}\" की अंतिम खरीद", mfe: "Dernie aste \"{article}\"" },
  hist_chez: { fr: "chez {fournisseur}, le {date}", en: "from {fournisseur}, on {date}", mg: "tao amin'i {fournisseur}, tamin'ny {date}", hi: "{fournisseur} से, {date} को", mfe: "kot {fournisseur}, le {date}" },
  hist_aucun_achat: { fr: "Aucun achat enregistré pour le moment.", en: "No purchase recorded for now.", mg: "Tsy mbola misy fividianana voasoratra amin'izao.", hi: "अभी तक कोई खरीद दर्ज नहीं।", mfe: "Okenn aste anrezistre pou le moman." },
  hist_ecart_qte_info: { fr: "Écart de quantité sans observation renseignée sur le BC — préciser la cause (commande arrêtée, fournisseur en rupture...)", en: "Quantity gap with no remark entered on the PO — please state the cause (order stopped, supplier out of stock...)", mg: "Tsy fitoviana habetsaka nefa tsy misy fanamarihana voasoratra ao amin'ny BC — lazao ny antony (baiko najanona, tsy misy entana amin'ny mpamatsy...)", hi: "BC पर बिना टिप्पणी के मात्रा में अंतर — कृपया कारण बताएँ (आदेश रोका गया, आपूर्तिकर्ता के पास स्टॉक नहीं...)", mfe: "Diferans kantite san remark ekrir lor BC — presize rezon (komann aret, fournisser an rupture...)" },
  hist_h_date_da: { fr: "Date DA", en: "PR date", mg: "Daty DA", hi: "DA तिथि", mfe: "Dat DA" },
  hist_h_qte_livree: { fr: "Qté livrée", en: "Qty delivered", mg: "Habetsaka nateraka", hi: "डिलीवर मात्रा", mfe: "Kantite livre" },
  hist_h_date_bc: { fr: "Date BC", en: "PO date", mg: "Daty BC", hi: "BC तिथि", mfe: "Dat BC" },
  hist_h_date_signature: { fr: "Date signature", en: "Signature date", mg: "Daty sonia", hi: "हस्ताक्षर तिथि", mfe: "Dat sinyatir" },
  hist_h_date_reception: { fr: "Date réception", en: "Receipt date", mg: "Daty fandraisana", hi: "प्राप्ति तिथि", mfe: "Dat resepsyon" },
  hist_h_mode_envoi: { fr: "Mode envoi / Coursier", en: "Sending mode / Courier", mg: "Fomba fandefasana / Mpitatitra", hi: "भेजने का तरीका / कूरियर", mfe: "Mod avoy / Kourier" },
  hist_h_etat_livraison: { fr: "État livraison", en: "Delivery status", mg: "Satan'ny fanaterana", hi: "डिलीवरी स्थिति", mfe: "Leta livrezon" },
  hist_h_service: { fr: "Service demandeur", en: "Requesting department", mg: "Sampana mpangataka", hi: "अनुरोधकर्ता विभाग", mfe: "Servis demander" },
  hist_h_usage: { fr: "Usage / Projet", en: "Use / Project", mg: "Fampiasana / Tetikasa", hi: "उपयोग / परियोजना", mfe: "Itilizasion / Projet" },
  hist_h_total_bc: { fr: "Total BC (TTC)", en: "Total PO (incl. tax)", mg: "Fitambaran'ny BC (TTC)", hi: "कुल BC (कर सहित)", mfe: "Total BC (TTC)" },
  hist_h_montant_facture: { fr: "Montant facture fournisseur", en: "Supplier invoice amount", mg: "Vola nafatra amin'ny faktioran'ny mpamatsy", hi: "आपूर्तिकर्ता चालान राशि", mfe: "Montan faktir fournisser" },
  hist_total_n: { fr: "Total ({n})", en: "Total ({n})", mg: "Fitambarany ({n})", hi: "कुल ({n})", mfe: "Total ({n})" },
  hist_h_receptionnaire: { fr: "Réceptionnaire", en: "Receiver", mg: "Mpandray", hi: "प्राप्तकर्ता", mfe: "Reseptyonner" },

  // ---------- Historique — Bois de chauffage ----------
  bois_titre: { fr: "Bois de chauffage — livraisons", en: "Firewood — deliveries", mg: "Kitay — fanaterana", hi: "जलावन की लकड़ी — डिलीवरी", mfe: "Dibwa — livrezon" },
  bois_aucune: { fr: "Aucune livraison de bois de chauffage réceptionnée pour l'instant. Ce rapport se remplit automatiquement dès qu'une réception est enregistrée sur un article \"Bois de chauffage\".", en: "No firewood delivery received for now. This report fills in automatically as soon as a receipt is recorded on a \"Firewood\" item.", mg: "Tsy mbola misy fanaterana kitay voaray amin'izao. Mameno ho azy ity tatitra ity rehefa misy fandraisana voasoratra amin'ny entana \"Kitay\".", hi: "अभी तक कोई जलावन डिलीवरी प्राप्त नहीं हुई। \"जलावन की लकड़ी\" वस्तु पर प्राप्ति दर्ज होते ही यह रिपोर्ट अपने आप भर जाती है।", mfe: "Okenn livrezon dibwa resevwar pou le moman. Sa rapor la ranpli otomatikman depi ki enn resepsyon anrezistre lor enn artik \"Dibwa\"." },
  bois_detail_journalier: { fr: "Détail journalier", en: "Daily detail", mg: "Antsipiriany isan'andro", hi: "दैनिक विवरण", mfe: "Detay par zour" },
  bois_aujourdhui: { fr: "Aujourd'hui", en: "Today", mg: "Androany", hi: "आज", mfe: "Zordi" },
  bois_cette_semaine: { fr: "Cette semaine", en: "This week", mg: "Ity herinandro ity", hi: "इस सप्ताह", mfe: "Sa semenn la" },
  bois_ce_mois: { fr: "Ce mois", en: "This month", mg: "Ity volana ity", hi: "इस महीने", mfe: "Sa mwa la" },
  bois_cette_annee: { fr: "Cette année", en: "This year", mg: "Ity taona ity", hi: "इस वर्ष", mfe: "Sa lane la" },
  bois_au: { fr: "au", en: "to", mg: "hatramin'ny", hi: "तक", mfe: "ziska" },
  bois_total_journalier: { fr: "Total journalier", en: "Daily total", mg: "Fitambarany isan'andro", hi: "दैनिक कुल", mfe: "Total par zour" },
  bois_aucune_periode: { fr: "Aucune livraison sur cette période.", en: "No delivery for this period.", mg: "Tsy misy fanaterana amin'ity vanim-potoana ity.", hi: "इस अवधि में कोई डिलीवरी नहीं।", mfe: "Okenn livrezon pou sa peryod-la." },
  bois_h_total_journalier_m3: { fr: "Total journalier (m³)", en: "Daily total (m³)", mg: "Fitambarany isan'andro (m³)", hi: "दैनिक कुल (m³)", mfe: "Total par zour (m³)" },
  bois_total: { fr: "Total", en: "Total", mg: "Fitambarany", hi: "कुल", mfe: "Total" },
  bois_lignes_sans_date: { fr: "Lignes sans date de voyage précise ({n})", en: "Lines without a precise trip date ({n})", mg: "Andalana tsy misy daty diavana marina ({n})", hi: "बिना सटीक यात्रा तिथि की पंक्तियाँ ({n})", mfe: "Lign san dat vwayaz presi ({n})" },
  bois_aide_sans_date: { fr: "Ces livraisons n'ont pas de date fiable par voyage (données anciennes, avant la saisie systématique) — affichées ligne par ligne plutôt que fondues dans un total journalier qui serait faux.", en: "These deliveries do not have a reliable per-trip date (older data, before systematic entry) — shown line by line rather than merged into a daily total that would be wrong.", mg: "Ireo fanaterana ireo dia tsy manana daty azo itokisana isaky ny dia (angona taloha, talohan'ny fampidirana tsy tapaka) — aseho isan'andalana fa tsy ampidirina ao anaty fitambarana isan'andro izay ho diso.", hi: "इन डिलीवरी की प्रति-यात्रा विश्वसनीय तिथि नहीं है (पुराना डेटा, व्यवस्थित प्रविष्टि से पहले) — गलत दैनिक कुल में मिलाने के बजाय पंक्ति दर पंक्ति दिखाया गया है।", mfe: "Sa bann livrezon la pena enn dat fiab par vwayaz (ansien done, avan lantre sistematik) — afiste lign par lign pli plito ki fonn dan enn total par zour ki ti pou fos." },
  bois_h_quantite_m3: { fr: "Quantité (m³)", en: "Quantity (m³)", mg: "Habetsany (m³)", hi: "मात्रा (m³)", mfe: "Kantite (m³)" },
  bois_h_date_approchee: { fr: "Date approchée (réception du BC)", en: "Approximate date (PO receipt)", mg: "Daty tombantombana (fandraisana ny BC)", hi: "अनुमानित तिथि (BC प्राप्ति)", mfe: "Dat aprosimatif (resepsyon BC)" },
  bois_recap_annuel: { fr: "Récapitulatif annuel", en: "Annual summary", mg: "Famintinana isan-taona", hi: "वार्षिक सारांश", mfe: "Rekapitilasion anyel" },
  bois_aucune_annee: { fr: "Aucune livraison sur {annee}.", en: "No delivery in {annee}.", mg: "Tsy misy fanaterana tamin'ny {annee}.", hi: "{annee} में कोई डिलीवरी नहीं।", mfe: "Okenn livrezon lor {annee}." },
  bois_h_total_m3: { fr: "Total (m³)", en: "Total (m³)", mg: "Fitambarany (m³)", hi: "कुल (m³)", mfe: "Total (m³)" },
  bois_h_montant_total: { fr: "Montant total", en: "Total amount", mg: "Vola tontaliny", hi: "कुल राशि", mfe: "Montan total" },
  bois_total_mensuel: { fr: "Total mensuel", en: "Monthly total", mg: "Fitambarany isam-bolana", hi: "मासिक कुल", mfe: "Total mansiel" },

  // ---------- Sauvegarde ----------
  sauv_titre: { fr: "Sauvegarde des données", en: "Data backup", mg: "Fitehirizana ny angona", hi: "डेटा बैकअप", mfe: "Sovgard done" },
  sauv_aide: { fr: "Génère un classeur Excel complet avec toutes tes données (fournisseurs, articles, demandes, BC, réceptions, factures). À faire régulièrement (par exemple toutes les semaines), et à garder à deux endroits : sur ton ordinateur et dans un cloud (OneDrive, Google Drive...).", en: "Generates a complete Excel workbook with all your data (suppliers, items, requests, POs, receipts, invoices). To be done regularly (e.g. every week), and kept in two places: on your computer and in a cloud (OneDrive, Google Drive...).", mg: "Mamorona boky Excel feno misy ny angonao rehetra (mpamatsy, entana, fangatahana, BC, fandraisana, faktiora). Atao tsy tapaka (oh. isan-kerinandro), ary tehirizo any amin'ny toerana roa : ao amin'ny solosainao sy ao amin'ny cloud (OneDrive, Google Drive...).", hi: "आपके सारे डेटा (आपूर्तिकर्ता, वस्तुएँ, अनुरोध, BC, प्राप्ति, चालान) के साथ एक पूर्ण Excel वर्कबुक बनाता है। नियमित रूप से करें (जैसे हर हफ़्ते), और दो जगह रखें: आपके कंप्यूटर पर और एक क्लाउड में (OneDrive, Google Drive...)।", mfe: "Zenere enn classer Excel konple avek tou to done (fournisser, artik, demann, BC, resepsyon, faktir). Pou fer regilierman (pl. tou le semenn), ek gard dan de landrwa : lor to lordinater ek dan enn cloud (OneDrive, Google Drive...)." },
  sauv_generation: { fr: "Génération en cours...", en: "Generating...", mg: "Eo am-pamokarana...", hi: "बनाया जा रहा है...", mfe: "Pe zenere..." },
  sauv_btn_telecharger: { fr: "Télécharger une sauvegarde complète maintenant", en: "Download a complete backup now", mg: "Alaivo tsy ela izao ny fitehirizana feno", hi: "अभी पूर्ण बैकअप डाउनलोड करें", mfe: "Telesarze enn sovgard konple aster" },
  sauv_confirmation: { fr: "✓ Sauvegarde générée le {date} — pense à la déplacer dans ton dossier de sauvegarde habituel.", en: "✓ Backup generated on {date} — remember to move it to your usual backup folder.", mg: "✓ Fitehirizana natao tamin'ny {date} — tsarovy ny hamindra izany ao amin'ny fitehirizanao mahazatra.", hi: "✓ बैकअप {date} को बनाया गया — इसे अपने सामान्य बैकअप फ़ोल्डर में ले जाना याद रखें।", mfe: "✓ Sovgard zenere le {date} — pa bliye deplas li dan to dosie sovgard abitiel." },
  sauv_bon_a_savoir: { fr: "Bon à savoir", en: "Good to know", mg: "Tsara ho fantatra", hi: "जानने योग्य बातें", mfe: "Bon pou konnet" },
  sauv_explication: { fr: "Le forfait gratuit de Supabase (celui utilisé pour cette appli) ne propose pas de sauvegarde automatique — c'est officiellement indiqué par Supabase eux-mêmes. Cette page comble ce manque, mais ça reste à toi de cliquer régulièrement. Si un jour tu veux une sauvegarde automatique quotidienne gérée par Supabase directement, ça existe à partir de leur forfait payant (environ 25$/mois) — à voir si ça vaut le coup selon la taille de l'appli à ce moment-là.", en: "Supabase's free plan (the one used for this app) does not offer automatic backups — this is officially stated by Supabase themselves. This page fills that gap, but it's still up to you to click regularly. If one day you want a daily automatic backup managed directly by Supabase, that exists from their paid plan (about $25/month) — worth considering depending on the app's size at that point.", mg: "Ny forfait maimaim-poana an'i Supabase (ilay ampiasaina amin'ity rindrankaja ity) dia tsy manolotra fitehirizana ho azy — voalaza ofisialy avy amin'i Supabase mihitsy izany. Ity pejy ity no mameno izany banga izany, saingy anao foana ny tokony hitsindry tsy tapaka. Raha te-hanana fitehirizana ho azy isan'andro karakarain'i Supabase mivantana ianao indray andro any, dia misy izany manomboka amin'ny forfait aloa (manodidina 25$/volana) — jereo raha mendrika izany arakaraka ny haben'ny rindrankaja amin'izay fotoana izay.", hi: "Supabase का मुफ़्त प्लान (इस ऐप के लिए उपयोग किया गया) स्वचालित बैकअप की सुविधा नहीं देता — यह Supabase द्वारा स्वयं आधिकारिक रूप से बताया गया है। यह पेज इस कमी को पूरा करता है, पर नियमित रूप से क्लिक करना आप पर ही निर्भर है। यदि कभी आप Supabase द्वारा सीधे प्रबंधित दैनिक स्वचालित बैकअप चाहें, तो यह उनके सशुल्क प्लान (लगभग $25/माह) से उपलब्ध है — उस समय ऐप के आकार के अनुसार यह उचित है या नहीं, यह देखने लायक है।", mfe: "Plan gratis Supabase (sa ki servi pou sa lapli la) pa ofer sovgard otomatik — Supabase mem finn dir sa ofisielman. Sa paz la konble sa mank la, me se ou ki bizin klik regilierman. Si enn zour ou anvi enn sovgard otomatik toulezour zere par Supabase direkteman, sa existe depi zot plan peyan (anviron 25$/mwa) — get si sa vo lapenn selon lagrander lapli sa moman-la." },

  // ---------- Journal d'audit ----------
  jour_titre: { fr: "Journal d'audit", en: "Audit log", mg: "Diarin'ny fanaraha-maso", hi: "ऑडिट लॉग", mfe: "Zournal odit" },
  jour_aide: { fr: "Historique chronologique de toutes les actions effectuées dans l'application (500 dernières).", en: "Chronological history of all actions performed in the application (last 500).", mg: "Tantara araka ny fotoana amin'ny hetsika rehetra natao tao amin'ny rindrankaja (500 farany).", hi: "एप्लिकेशन में की गई सभी कार्रवाइयों का कालानुक्रमिक इतिहास (अंतिम 500)।", mfe: "Istorik kronolozik tou aksion ki fer dan lapli (dernie 500)." },
  jour_ph_recherche: { fr: "Rechercher (référence, utilisateur...)", en: "Search (reference, user...)", mg: "Hitady (tsiahy, mpampiasa...)", hi: "खोजें (संदर्भ, उपयोगकर्ता...)", mfe: "Rod (referans, itilizater...)" },
  jour_toutes_entites: { fr: "Toutes les entités", en: "All entities", mg: "Ny singa rehetra", hi: "सभी संस्थाएँ", mfe: "Tou bann antite" },
  jour_toutes_actions: { fr: "Toutes les actions", en: "All actions", mg: "Ny hetsika rehetra", hi: "सभी कार्रवाइयाँ", mfe: "Tou bann aksion" },
  jour_action_creation: { fr: "Création", en: "Creation", mg: "Famoronana", hi: "निर्माण", mfe: "Kreasion" },
  jour_action_modification: { fr: "Modification", en: "Modification", mg: "Fanovana", hi: "संशोधन", mfe: "Modifikasion" },
  jour_action_suppression: { fr: "Suppression", en: "Deletion", mg: "Fafana", hi: "हटाना", mfe: "Sipresion" },
  jour_h_date_heure: { fr: "Date / heure", en: "Date / time", mg: "Daty / ora", hi: "तिथि / समय", mfe: "Dat / ler" },
  jour_h_utilisateur: { fr: "Utilisateur", en: "User", mg: "Mpampiasa", hi: "उपयोगकर्ता", mfe: "Itilizater" },
  jour_h_entite: { fr: "Entité", en: "Entity", mg: "Singa", hi: "संस्था", mfe: "Antite" },
  jour_h_reference: { fr: "Référence", en: "Reference", mg: "Tsiahy", hi: "संदर्भ", mfe: "Referans" },
  jour_aucune_entree: { fr: "Aucune entrée pour ces filtres.", en: "No entry for these filters.", mg: "Tsy misy fidirana amin'ireo sivana ireo.", hi: "इन फ़िल्टरों के लिए कोई प्रविष्टि नहीं।", mfe: "Okenn lantre pou bann filtre-la." },
  jour_ent_fournisseur: { fr: "Fournisseur", en: "Supplier", mg: "Mpamatsy", hi: "आपूर्तिकर्ता", mfe: "Fournisser" },
  jour_ent_article: { fr: "Article", en: "Item", mg: "Entana", hi: "वस्तु", mfe: "Artik" },
  jour_ent_demande: { fr: "Demande d'achat", en: "Purchase request", mg: "Fangatahana fividianana", hi: "खरीद अनुरोध", mfe: "Demann aste" },
  jour_ent_ligne_demande: { fr: "Ligne de demande", en: "Request line", mg: "Andalana fangatahana", hi: "अनुरोध पंक्ति", mfe: "Lign demann" },
  jour_ent_offre_tco: { fr: "Offre TCO", en: "TCO offer", mg: "Tolotra TCO", hi: "TCO ऑफ़र", mfe: "Ofer TCO" },
  jour_ent_ligne_offre: { fr: "Ligne d'offre", en: "Offer line", mg: "Andalana tolotra", hi: "ऑफ़र पंक्ति", mfe: "Lign ofer" },
  jour_ent_bc: { fr: "Bon de commande", en: "Purchase order", mg: "Baiko fividianana", hi: "खरीद आदेश", mfe: "Bon komann" },
  jour_ent_ligne_bc: { fr: "Ligne de BC", en: "PO line", mg: "Andalana BC", hi: "BC पंक्ति", mfe: "Lign BC" },
  jour_ent_reception: { fr: "Réception", en: "Receipt", mg: "Fandraisana", hi: "प्राप्ति", mfe: "Resepsyon" },
  jour_ent_ligne_reception: { fr: "Ligne de réception", en: "Receipt line", mg: "Andalana fandraisana", hi: "प्राप्ति पंक्ति", mfe: "Lign resepsyon" },
  jour_ent_accuse_facture: { fr: "Accusé facture", en: "Invoice acknowledgement", mg: "Fanamarinana faktiora", hi: "चालान पावती", mfe: "Akize faktir" },

  // ---------- Journal des erreurs techniques ----------
  err_titre: { fr: "Journal des erreurs techniques ({n})", en: "Technical error log ({n})", mg: "Diarin'ny hadisoana ara-teknika ({n})", hi: "तकनीकी त्रुटि लॉग ({n})", mfe: "Zournal erer teknik ({n})" },
  err_actualiser: { fr: "Actualiser", en: "Refresh", mg: "Havaozy", hi: "रीफ़्रेश करें", mfe: "Rafres" },
  err_aide: { fr: "Capture automatique des erreurs techniques non gérées côté appli (bugs de code, requêtes échouées de façon inattendue). Ne capture pas encore les messages d'erreur affichés directement par un formulaire — à étendre progressivement.", en: "Automatic capture of unhandled technical errors on the app side (code bugs, unexpectedly failed requests). Does not yet capture error messages shown directly by a form — to be extended progressively.", mg: "Fandraisana ho azy ny hadisoana ara-teknika tsy voafehy eo amin'ny lafiny rindrankaja (bugs amin'ny kaody, fangatahana tsy nahomby tampoka). Tsy mbola mandray ny hafatra hadisoana aseho mivantana amin'ny endri-taratasy — hitarina tsikelikely.", hi: "ऐप की ओर से अप्रबंधित तकनीकी त्रुटियों का स्वचालित संग्रह (कोड बग, अप्रत्याशित रूप से विफल अनुरोध)। अभी तक फ़ॉर्म द्वारा सीधे दिखाए गए त्रुटि संदेशों को कैप्चर नहीं करता — धीरे-धीरे विस्तारित किया जाएगा।", mfe: "Kaptir otomatik erer teknik non-zere kote lapli (bug dan kod, demann ki fail dan enn fason inatandi). Pa ankor kaptir bann mesaz erer ki afiste direkteman par enn formiler — pou etann progresivman." },
  err_voir_resolues: { fr: "Voir aussi les erreurs déjà marquées résolues", en: "Also show errors already marked resolved", mg: "Asehoy koa ny hadisoana efa voamarika vaha", hi: "पहले से हल के रूप में चिह्नित त्रुटियाँ भी दिखाएँ", mfe: "Montre osi bann erer ki deza marke rezolv" },
  err_aucune: { fr: "✓ Aucune erreur technique {suffixe}.", en: "✓ No technical error {suffixe}.", mg: "✓ Tsy misy hadisoana ara-teknika {suffixe}.", hi: "✓ कोई तकनीकी त्रुटि नहीं {suffixe}।", mfe: "✓ Okenn erer teknik {suffixe}." },
  err_en_attente: { fr: "en attente", en: "pending", mg: "miandry", hi: "लंबित", mfe: "an atant" },
  err_h_contexte: { fr: "Contexte", en: "Context", mg: "Toe-javatra", hi: "संदर्भ", mfe: "Kontex" },
  err_h_message: { fr: "Message", en: "Message", mg: "Hafatra", hi: "संदेश", mfe: "Mesaz" },
  err_h_page: { fr: "Page", en: "Page", mg: "Pejy", hi: "पेज", mfe: "Paz" },
  err_marquer_resolu: { fr: "Marquer résolu", en: "Mark resolved", mg: "Mariho vaha", hi: "हल के रूप में चिह्नित करें", mfe: "Marke rezolv" },

  // ---------- Contrôle qualité ----------
  cq_titre_singulier: { fr: "Contrôle qualité des données (1 anomalie)", en: "Data quality control (1 issue)", mg: "Fanaraha-maso ny kalitaon'ny angona (tsy fetezana 1)", hi: "डेटा गुणवत्ता नियंत्रण (1 समस्या)", mfe: "Kontrol kalite done (1 anomali)" },
  cq_titre_pluriel: { fr: "Contrôle qualité des données ({n} anomalies)", en: "Data quality control ({n} issues)", mg: "Fanaraha-maso ny kalitaon'ny angona (tsy fetezana {n})", hi: "डेटा गुणवत्ता नियंत्रण ({n} समस्याएँ)", mfe: "Kontrol kalite done ({n} anomali)" },
  cq_verification: { fr: "Vérification...", en: "Checking...", mg: "Fanamarinana...", hi: "जाँच हो रही है...", mfe: "Pe verifie..." },
  cq_relancer: { fr: "Relancer la vérification", en: "Re-run the check", mg: "Avero ny fanamarinana", hi: "जाँच फिर से चलाएँ", mfe: "Relans verifikasion" },
  cq_regles_verifiees: { fr: "Règles vérifiées (BC hors \"Annulée\") :", en: "Rules checked (POs excluding \"Cancelled\"):", mg: "Fitsipika voamarina (BC ivelan'ny \"Nofoanana\") :", hi: "जाँची गई नियम (\"रद्द\" को छोड़कर BC):", mfe: "Rezle verifye (BC apar \"Anile\") :" },
  cq_regle_tva_incoherente: { fr: "TVA du BC ne correspond pas au statut réel du fournisseur", en: "PO VAT does not match the supplier's actual status", mg: "Ny TVA amin'ny BC dia tsy mifanaraka amin'ny satan'ny mpamatsy tena izy", hi: "BC का वैट आपूर्तिकर्ता की वास्तविक स्थिति से मेल नहीं खाता", mfe: "TVA BC pa korespond ar vre statit fournisser" },
  cq_regle_non_taxable: { fr: "BC non taxable avec montant_ht ≠ montant_ttc ou montant_tva ≠ 0", en: "Non-taxable PO with montant_ht ≠ montant_ttc or montant_tva ≠ 0", mg: "BC tsy misy hetra nefa montant_ht ≠ montant_ttc na montant_tva ≠ 0", hi: "कर-मुक्त BC जिसमें montant_ht ≠ montant_ttc या montant_tva ≠ 0", mfe: "BC pa taksab avek montant_ht ≠ montant_ttc ou montant_tva ≠ 0" },
  cq_regle_taxable: { fr: "BC taxable avec montant_ttc incohérent (≠ HT × 1,2)", en: "Taxable PO with inconsistent montant_ttc (≠ excl.-tax × 1.2)", mg: "BC misy hetra nefa montant_ttc tsy mifanaraka (≠ HT × 1,2)", hi: "कर योग्य BC जिसमें montant_ttc असंगत है (≠ कर-रहित × 1.2)", mfe: "BC taksab avek montant_ttc inkoerаn (≠ HT × 1,2)" },
  cq_regle_somme_lignes: { fr: "Somme des lignes ≠ montant_ht du BC", en: "Sum of lines ≠ PO's montant_ht", mg: "Fitambaran'ny andalana ≠ montant_ht ny BC", hi: "पंक्तियों का योग ≠ BC का montant_ht", mfe: "Som lign ≠ montant_ht BC" },
  cq_toutes_regles: { fr: "Toutes les règles", en: "All rules", mg: "Ny fitsipika rehetra", hi: "सभी नियम", mfe: "Tou bann rezle" },
  cq_derniere_verif: { fr: "Dernière vérification : {date}", en: "Last check: {date}", mg: "Fanamarinana farany : {date}", hi: "अंतिम जाँच: {date}", mfe: "Dernie verifikasion : {date}" },
  cq_aucune_anomalie: { fr: "✓ Aucune anomalie détectée{suffixe}.", en: "✓ No issue detected{suffixe}.", mg: "✓ Tsy misy tsy fetezana hita{suffixe}.", hi: "✓ कोई समस्या नहीं मिली{suffixe}।", mfe: "✓ Okenn anomali detekte{suffixe}." },
  cq_pour_cette_regle: { fr: " pour cette règle", en: " for this rule", mg: " ho an'ity fitsipika ity", hi: " इस नियम के लिए", mfe: " pou sa rezle-la" },
  cq_h_regle_violee: { fr: "Règle violée", en: "Rule violated", mg: "Fitsipika voadika", hi: "उल्लंघित नियम", mfe: "Rezle vyole" },
  cq_h_detail: { fr: "Détail", en: "Detail", mg: "Antsipiriany", hi: "विवरण", mfe: "Detay" },
  cq_ouvrir_bc: { fr: "Ouvrir le BC", en: "Open the PO", mg: "Sokafy ny BC", hi: "BC खोलें", mfe: "Ouver BC" },
  cq_correction: { fr: "Correction...", en: "Fixing...", mg: "Fanitsiana...", hi: "सुधार हो रहा है...", mfe: "Pe korize..." },
  cq_corriger: { fr: "Corriger", en: "Fix", mg: "Ovay", hi: "सुधारें", mfe: "Korize" },
  cq_confirm_corriger: { fr: "Corriger automatiquement le BC {numero} ? Les montants seront recalculés à partir de ses lignes et du statut TVA réel du fournisseur.", en: "Automatically fix PO {numero}? The amounts will be recalculated from its lines and the supplier's actual VAT status.", mg: "Hohitsina ho azy ve ny BC {numero}? Hoverina kajiana ny vola avy amin'ny andalany sy ny satan'ny TVA tena izy an'ny mpamatsy.", hi: "क्या BC {numero} को स्वचालित रूप से ठीक करें? राशियों की पुनर्गणना इसकी पंक्तियों और आपूर्तिकर्ता की वास्तविक वैट स्थिति से होगी।", mfe: "Korize otomatikman BC {numero}? Bann montan pou rekalkile apartir so lign ek vre statit TVA fournisser." },

  bc_receptionne_par: { fr: "Réceptionné par", en: "Received by", mg: "Noraisin'i", hi: "प्राप्तकर्ता", mfe: "Resevwar par" },
  bc_ph_nom_receptionnaire: { fr: "Nom du réceptionnaire (ex. magasinier) — facultatif", en: "Receiver's name (e.g. storekeeper) — optional", mg: "Anaran'ny mpandray (oh. mpiandraikitra magazay) — tsy voatery", hi: "प्राप्तकर्ता का नाम (जैसे स्टोरकीपर) — वैकल्पिक", mfe: "Nom reseptyonner (pl. magazinye) — fakiltatif" },

  st_consultation_devis: { fr: "Consultation fournisseur en cours", en: "Supplier consultation in progress", mg: "Fanadihadiana amin'ny mpamatsy eo am-pandehanana", hi: "आपूर्तिकर्ता परामर्श जारी", mfe: "Konsiltasion fournisser an kour" },
  db_devis_ligne_envoye: { fr: "demande de devis envoyée il y a {n} jour(s), toujours sans prix saisi", en: "quote request sent {n} day(s) ago, still no price entered", mg: "fangatahana devisy nalefa {n} andro lasa, mbola tsy misy vidiny voasoratra", hi: "कोटेशन अनुरोध {n} दिन पहले भेजा गया, अब भी कोई मूल्य दर्ज नहीं", mfe: "demann devi avoye ena {n} zour, ankor pena pri antre" },

  // ---------- Aide « Raccourcis clavier » ----------
  touche_entree: { fr: "Entrée", en: "Enter", mg: "Enter", hi: "Enter", mfe: "Enter" },
  touche_echap: { fr: "Échap", en: "Esc", mg: "Esc", hi: "Esc", mfe: "Esc" },
  aide_ctrlf: { fr: "recherche de la page", en: "search the page", mg: "hitady eo amin'ny pejy", hi: "पेज में खोजें", mfe: "rod dan lapaz" },
  bc_nouvelle_reception: { fr: "Nouvelle réception", en: "New receipt", mg: "Fandraisana vaovao", hi: "नई प्राप्ति", mfe: "Nouvo resepsyon" },
  aide_echap_recherche: { fr: "quitter le champ de recherche", en: "leave the search field", mg: "hivoaka amin'ny saha fikarohana", hi: "खोज फ़ील्ड से बाहर निकलें", mfe: "kit sanp rod" },
  aide_slash: { fr: "recherche de la page (plus fiable que Ctrl+F selon le navigateur)", en: "search the page (more reliable than Ctrl+F depending on the browser)", mg: "hitady eo amin'ny pejy (azo itokisana kokoa noho Ctrl+F arakaraka ny navigateur)", hi: "पेज में खोजें (ब्राउज़र के अनुसार Ctrl+F से अधिक भरोसेमंद)", mfe: "rod dan lapaz (pli fiab ki Ctrl+F selon navigater)" },
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

// t("cle") ou t("cle", { n: 3 }) : les {n}, {date}… du texte sont remplacés
// par les valeurs données (une valeur absente s'affiche vide).
export function creerTraducteur(langue) {
  return (cle, vars) => {
    let texte = DICTIONNAIRE[cle]?.[langue] || DICTIONNAIRE[cle]?.fr || cle;
    if (vars) for (const [k, v] of Object.entries(vars)) texte = texte.split(`{${k}}`).join(v ?? "");
    return texte;
  };
}

// Statut affiché dans la langue choisie ; la valeur stockée reste celle du français.
const CLES_STATUTS = {
  "A faire": "st_a_faire", "En cours": "st_en_cours", "Envoyée": "st_envoyee",
  "Livraison en cours": "st_livraison_en_cours", "Clôturée": "st_cloturee",
  "Clôturée (rupture)": "st_cloturee_rupture", "Annulée": "st_annulee",
  "Partiellement traitée": "st_partiellement_traitee", "Basculée en commande": "st_basculee_commande",
  "En stand-by": "st_en_stand_by", "Consultation fournisseur en cours": "st_consultation_devis",
};
export function libelleStatut(t, valeur) {
  const cle = CLES_STATUTS[valeur];
  return cle ? t(cle) : valeur;
}

// Priorité affichée dans la langue choisie (la valeur stockée reste Haute / Moyenne / Basse).
export function libellePriorite(t, valeur) {
  const cle = { "Haute": "prio_haute", "Moyenne": "prio_moyenne", "Basse": "prio_basse" }[valeur || "Moyenne"];
  return cle ? t(cle) : valeur;
}

// Mois abrégés (graphiques) et nombres ordinaux (1ère relance, 2e relance…)
const MOIS_COURTS = {
  fr: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  mg: ["Jan", "Feb", "Mar", "Apr", "Mey", "Jon", "Jol", "Aog", "Sep", "Okt", "Nov", "Des"],
  hi: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"],
  mfe: ["Zan", "Fev", "Mar", "Avr", "Me", "Zin", "Zil", "Out", "Sep", "Okt", "Nov", "Des"],
};
export function moisCourt(langue, indexMois) {
  return (MOIS_COURTS[langue] || MOIS_COURTS.fr)[indexMois] || "";
}

const ORDINAUX = {
  fr: ["1ère", "2ème", "3ème", "4ème", "5ème"],
  en: ["1st", "2nd", "3rd", "4th", "5th"],
  mg: ["voalohany", "faharoa", "fahatelo", "fahefatra", "fahadimy"],
  hi: ["पहली", "दूसरी", "तीसरी", "चौथी", "पाँचवीं"],
  mfe: ["premye", "dezyem", "trwazyem", "katriyem", "sinkyem"],
};
const SUFFIXE_ORDINAL = { fr: "ème", en: "th", hi: "वीं", mfe: "em" };
export function ordinal(langue, n) {
  const liste = ORDINAUX[langue] || ORDINAUX.fr;
  if (liste[n - 1]) return liste[n - 1];
  return langue === "mg" ? `faha-${n}` : `${n}${SUFFIXE_ORDINAL[langue] ?? "ème"}`;
}

// Assemble la désignation complète d'un article à partir de ses 4 parties
// standard : [Code article] + [Nom] + [Marque] + [Référence fournisseur].
// Code, marque et référence sont facultatifs ; seul le nom est obligatoire.
export function composerDesignation({ code_article, nom, marque, reference_fournisseur }) {
  const parties = [];
  if (code_article?.trim()) parties.push(code_article.trim());
  parties.push((nom || "").trim());
  if (marque?.trim()) parties.push(marque.trim());
  let designation = parties.join(" ");
  if (reference_fournisseur?.trim()) designation += ` - ${reference_fournisseur.trim()}`;
  return designation;
}

// Nom d'un article dans la langue choisie : seul le "nom" (partie centrale,
// traduisible) change — le code, la marque et la référence restent
// identiques dans toutes les langues, comme demandé. Si l'article n'a pas
// de nom_article structuré (ancien article, avant ce standard) ou pas de
// traduction dans cette langue, on retombe sur la désignation complète
// française telle quelle.
const COLONNE_NOM = { en: "nom_en", mg: "nom_mg", hi: "nom_hi", mfe: "nom_mfe" };
export function nomArticleTraduit(article, langue) {
  if (!article) return "";
  if (langue === "fr" || !article.nom_article) return article.designation || "";
  const cle = COLONNE_NOM[langue];
  const nomTraduit = cle && article[cle];
  if (!nomTraduit) return article.designation || "";
  return composerDesignation({
    code_article: article.code_article, nom: nomTraduit,
    marque: article.marque, reference_fournisseur: article.reference_fournisseur,
  });
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
