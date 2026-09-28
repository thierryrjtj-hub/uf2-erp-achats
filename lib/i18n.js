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

// t("cle") ou t("cle", { n: 3 }) : les {n}, {date}… du texte sont remplacés
// par les valeurs données (une valeur absente s'affiche vide).
export function creerTraducteur(langue) {
  return (cle, vars) => {
    let texte = DICTIONNAIRE[cle]?.[langue] || DICTIONNAIRE[cle]?.fr || cle;
    if (vars) for (const [k, v] of Object.entries(vars)) texte = texte.split(`{${k}}`).join(v ?? "");
    return texte;
  };
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
