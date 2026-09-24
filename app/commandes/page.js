"use client";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { useRole } from "../../lib/useRole";
import { inputStyle, thStyle, tdStyle, linkBtn } from "../components/ui";
import { IconTrash, IconBan } from "../components/Icons";
import { formatDate } from "../../lib/format";
import TriMenu, { appliquerTri } from "../components/TriMenu";
import { chargerAvecCache } from "../../lib/cache";

const PAGE_SIZE = 100;
// Statuts connus à l'avance (pour le filtre), sans avoir besoin de charger
// tout le tableau juste pour lister les valeurs distinctes.
const STATUTS_CONNUS = ["A faire", "En cours", "Envoyée", "Livraison en cours", "Clôturée", "Clôturée (rupture)", "Annulée"];
const GROUPE_TERMINAL = new Set(["Clôturée", "Clôturée (rupture)", "Annulée"]);

export default function CommandesPage() {
  return (
    <Suspense fallback={<AuthGuard><p>Chargement...</p></AuthGuard>}>
      <CommandesInner />
    </Suspense>
  );
}

function CommandesInner() {
  const role = useRole();
  const searchParams = useSearchParams();
  const filtreDepuisTableauDeBord = searchParams.get("filtre") === "en_attente_livraison";
  const filtreSignature = searchParams.get("filtre") === "en_attente_signature";
  const filtreImpayees = searchParams.get("filtre") === "impayees";
  const modeSpecial = filtreDepuisTableauDeBord || filtreSignature || filtreImpayees;

  const [liste, setListe] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [receptions, setReceptions] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [prestationParBc, setPrestationParBc] = useState({});
  const [articlesParBc, setArticlesParBc] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPlus, setLoadingPlus] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [rechercheEffective, setRechercheEffective] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const anneeActuelle = new Date().getFullYear();
  const [filtreAnnee, setFiltreAnnee] = useState(String(anneeActuelle));
  const anneesDisponibles = useMemo(() => {
    const annees = [];
    for (let a = anneeActuelle; a >= anneeActuelle - 4; a--) annees.push(String(a));
    return annees;
  }, [anneeActuelle]);
  const [tri, setTri] = useState({ colonne: "defaut", sens: "desc" });

  // Debounce de la recherche : on attend une petite pause dans la saisie
  // avant de relancer une requête serveur, plutôt qu'à chaque lettre tapée.
  useEffect(() => {
    const t = setTimeout(() => setRechercheEffective(recherche.trim()), 350);
    return () => clearTimeout(t);
  }, [recherche]);

  // Construit les tables de correspondance (articles, catégorie "prestation")
  // à partir des lignes_bc et articles reçus — commun aux deux modes.
  const construireMaps = (lb, art) => {
    const catParDesignation = {};
    (art || []).forEach((a) => { catParDesignation[a.designation.toLowerCase()] = a.categorie?.nom; });
    const map = {};
    const articlesMap = {};
    (lb || []).forEach((l) => {
      if (!map[l.bc_id]) map[l.bc_id] = [];
      map[l.bc_id].push(catParDesignation[l.designation.toLowerCase()] === "Services & Prestations");
      if (!articlesMap[l.bc_id]) articlesMap[l.bc_id] = [];
      articlesMap[l.bc_id].push(`${l.designation} (${l.quantite} ${l.unite})`);
    });
    const prestation = {};
    Object.entries(map).forEach(([bcId, arr]) => { prestation[bcId] = arr.length > 0 && arr.every(Boolean); });
    return { prestation, articlesMap };
  };

  // ---- Mode spécial (arrivée depuis le Tableau de bord) : comportement
  // inchangé, tout est chargé et filtré côté client — ces vues sont des
  // sous-ensembles déjà naturellement restreints, pas besoin de paginer. ----
  const chargerModeSpecial = async () => {
    const [
      { data: c }, { data: r }, { data: d }, { data: f }, { data: lb }, art,
    ] = await Promise.all([
      supabase.from("commandes").select("*").order("created_at", { ascending: false }).limit(10000),
      supabase.from("receptions").select("*").limit(10000),
      supabase.from("demandes").select("id, service, demandeur, motif_projet").limit(10000),
      supabase.from("fournisseurs").select("id, conditions_paiement_jours").limit(10000),
      supabase.from("lignes_bc").select("bc_id, designation, quantite, unite").limit(10000),
      chargerAvecCache("articles-categorie", () => supabase.from("articles").select("designation, categorie:categories(nom)").limit(10000).then((r) => r.data)),
    ]);
    setListe(c || []);
    setTotalCount((c || []).length);
    setReceptions(r || []);
    setDemandes(d || []);
    setFournisseurs(f || []);
    const { prestation, articlesMap } = construireMaps(lb, art);
    setPrestationParBc(prestation);
    setArticlesParBc(articlesMap);
    setLoading(false);
  };

  // ---- Mode normal : chargement réel par lots côté serveur (100 à la
  // fois), mais affiché comme une liste continue qu'on fait défiler — un
  // clic sur "Charger plus" ajoute les 100 suivants à la suite, sans jamais
  // tout charger d'un coup. remplacer=true recommence de zéro (nouveau
  // filtre/tri/recherche) ; remplacer=false ajoute à ce qui est déjà affiché.
  const chargerPage = async (remplacer) => {
    if (remplacer) setLoading(true); else setLoadingPlus(true);
    const decalage = remplacer ? 0 : liste.length;
    let requete = supabase.from("commandes").select("*", { count: "exact" });
    if (rechercheEffective) {
      // Nettoie le texte de recherche : virgule/parenthèses ont un sens
      // spécial dans la syntaxe de filtre .or(), on les retire pour éviter
      // de casser la requête ou de filtrer autrement que prévu.
      const qSafe = rechercheEffective.replace(/[,()]/g, " ").trim();
      if (qSafe) requete = requete.or(`numero.ilike.%${qSafe}%,fournisseur_nom.ilike.%${qSafe}%`);
    }
    if (filtreStatut) requete = requete.eq("statut", filtreStatut);
    if (filtreAnnee !== "toutes") requete = requete.like("numero", `${filtreAnnee}%`);
    if (tri.colonne === "defaut") {
      requete = requete.order("numero", { ascending: false });
    } else {
      requete = requete.order(tri.colonne, { ascending: tri.sens === "asc" });
    }
    requete = requete.range(decalage, decalage + PAGE_SIZE - 1);

    const { data: c, count } = await requete;
    const nouvelleListe = remplacer ? (c || []) : [...liste, ...(c || [])];
    setListe(nouvelleListe);
    setTotalCount(count || 0);

    const bcIds = (c || []).map((x) => x.id);
    const demandeIds = [...new Set((c || []).map((x) => x.demande_id).filter(Boolean))];

    const [{ data: r }, { data: d }, { data: f }, { data: lb }, art] = await Promise.all([
      bcIds.length ? supabase.from("receptions").select("*").in("bc_id", bcIds) : Promise.resolve({ data: [] }),
      demandeIds.length ? supabase.from("demandes").select("id, service, demandeur, motif_projet").in("id", demandeIds) : Promise.resolve({ data: [] }),
      chargerAvecCache("fournisseurs-delai", () => supabase.from("fournisseurs").select("id, conditions_paiement_jours").limit(10000).then((r) => r.data)),
      bcIds.length ? supabase.from("lignes_bc").select("bc_id, designation, quantite, unite").in("bc_id", bcIds) : Promise.resolve({ data: [] }),
      chargerAvecCache("articles-categorie", () => supabase.from("articles").select("designation, categorie:categories(nom)").limit(10000).then((r) => r.data)),
    ]);
    setReceptions((prev) => (remplacer ? (r || []) : [...prev, ...(r || [])]));
    setDemandes((prev) => (remplacer ? (d || []) : [...prev, ...(d || [])]));
    setFournisseurs(f || []);
    const { prestation, articlesMap } = construireMaps(lb, art);
    setPrestationParBc((prev) => (remplacer ? prestation : { ...prev, ...prestation }));
    setArticlesParBc((prev) => (remplacer ? articlesMap : { ...prev, ...articlesMap }));
    setLoading(false);
    setLoadingPlus(false);
  };

  const charger = () => (modeSpecial ? chargerModeSpecial() : chargerPage(true));

  useEffect(() => { if (modeSpecial) chargerModeSpecial(); }, [modeSpecial]); // eslint-disable-line react-hooks/exhaustive-deps
  // Toute recherche/tri/filtre repart de zéro (remplace la liste)
  useEffect(() => { if (!modeSpecial) chargerPage(true); }, [modeSpecial, rechercheEffective, filtreStatut, filtreAnnee, tri]); // eslint-disable-line react-hooks/exhaustive-deps

  const demandeParId = useMemo(() => {
    const m = {};
    demandes.forEach((d) => { m[d.id] = d; });
    return m;
  }, [demandes]);

  const delaiParFournisseur = useMemo(() => {
    const m = {};
    fournisseurs.forEach((f) => { m[f.id] = f.conditions_paiement_jours || 30; });
    return m;
  }, [fournisseurs]);

  const bcRecuId = useMemo(() => {
    const m = {};
    receptions.forEach((r) => { m[r.bc_id] = true; });
    return m;
  }, [receptions]);

  // En mode spécial, filtrage/tri client-side comme avant. En mode normal,
  // le serveur a déjà renvoyé exactement la bonne page, triée : rien à refaire.
  const filtrees = useMemo(() => {
    if (!modeSpecial) return liste;
    const q = recherche.trim().toLowerCase();
    const base = liste.filter((c) => {
      const dmd = demandeParId[c.demande_id];
      const okRecherche = !q || [c.numero, c.fournisseur_nom, dmd?.service, dmd?.demandeur].some((v) => (v || "").toLowerCase().includes(q));
      const okStatut = !filtreStatut || c.statut === filtreStatut;
      if (filtreDepuisTableauDeBord) {
        const receptionsOfC = receptions.filter((r) => r.bc_id === c.id);
        const dejaComplet = receptionsOfC.some((r) => r.statut === "Totale");
        const pasEncoreEnvoye = !c.date_envoi_fournisseur;
        const enAttente = !dejaComplet && !pasEncoreEnvoye && c.statut !== "Annulée" && !c.statut?.startsWith("Clôturée");
        if (!enAttente) return false;
      }
      if (filtreSignature && !(c.date_envoi_signature && !c.date_signature && c.statut !== "Annulée")) return false;
      if (filtreImpayees && (c.statut_paiement === "Payé" || !bcRecuId[c.id])) return false;
      return okRecherche && okStatut;
    });
    const preTrie = [...base].sort((a, b) => (b.numero || "").localeCompare(a.numero || ""));
    if (tri.colonne === "defaut") {
      return preTrie.sort((a, b) => (GROUPE_TERMINAL.has(a.statut) ? 1 : 0) - (GROUPE_TERMINAL.has(b.statut) ? 1 : 0));
    }
    return appliquerTri(preTrie, tri);
  }, [modeSpecial, liste, recherche, filtreStatut, tri, demandeParId, filtreDepuisTableauDeBord, filtreSignature, filtreImpayees, receptions, bcRecuId]);

  const changerStatut = async (id, statut) => {
    setListe((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    await supabase.from("commandes").update({ statut }).eq("id", id);
  };

  const supprimerBc = async (c) => {
    if (!confirm(`Supprimer définitivement le bon de commande ${c.numero} ? Sa réception et son historique seront aussi supprimés.`)) return;
    await supabase.from("commandes").delete().eq("id", c.id);
    if (c.demande_id) {
      const { data: autresBc } = await supabase.from("commandes").select("id").eq("demande_id", c.demande_id);
      if (!autresBc || autresBc.length === 0) {
        await supabase.from("demandes").delete().eq("id", c.demande_id);
      }
    }
    charger();
  };

  const annulerBc = async (c) => {
    if (c.statut === "Annulée") {
      if (!confirm(`Réactiver le BC ${c.numero} (retirer le statut Annulée) ?`)) return;
      await supabase.from("commandes").update({ statut: "Clôturée" }).eq("id", c.id);
      charger();
      return;
    }
    const motif = prompt(`Pourquoi annuler le BC ${c.numero} ? (raison obligatoire)`);
    if (!motif || !motif.trim()) return;
    await supabase.from("commandes").update({ statut: "Annulée", observation: motif.trim() }).eq("id", c.id);
    charger();
  };

  const echeanceInfo = (c, delaiMap) => {
    if (!c.date_facture) return null;
    const d = new Date(c.date_facture);
    d.setDate(d.getDate() + (delaiMap[c.fournisseur_id] || 30));
    return d;
  };

  // Les exports doivent couvrir TOUT (pas juste la page affichée) : ils
  // rechargent donc leurs propres données fraîches et complètes au moment
  // du clic, indépendamment de la pagination à l'écran.
  const [exporting, setExporting] = useState(false);
  const exporter = async () => {
    setExporting(true);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from("commandes").select("*").order("created_at", { ascending: false }).limit(10000),
      supabase.from("receptions").select("*").limit(10000),
    ]);
    const rows = (c || []).map((cmd) => {
      const reception = (r || []).find((x) => x.bc_id === cmd.id);
      const importe = reception?.receptionnaire === "Import historique";
      return {
        numero: cmd.numero,
        date: cmd.date,
        fournisseur: cmd.fournisseur_nom,
        statut: cmd.statut,
        montantHt: Number(cmd.montant_ht) || 0,
        montantTva: Number(cmd.montant_tva) || 0,
        montantTtc: Number(cmd.montant_ttc) || 0,
        numeroFacture: cmd.numero_facture || "",
        dateFacture: cmd.date_facture || "",
        statutPaiement: cmd.statut_paiement || "Impayé",
        recu: reception ? new Date(reception.date_reception_reelle).toLocaleString("fr-FR") : "",
        confirmePar: reception ? reception.confirme_par : "",
        importeHistorique: importe ? "Oui (date de réception = date d'import, pas la date réelle)" : "",
        observation: cmd.observation || "",
      };
    });
    await exportExcel({
      filename: `bons-de-commande_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: "UNIFOODS — Bons de commande",
      sheets: [{
        name: "Bons de commande",
        sousTitre: "Liste complète des bons de commande",
        columns: [
          { header: "N° BC", key: "numero", width: 18 },
          { header: "Date", key: "date", width: 13 },
          { header: "Fournisseur", key: "fournisseur", width: 22 },
          { header: "Statut", key: "statut", width: 16 },
          { header: "Montant HT", key: "montantHt", width: 15 },
          { header: "TVA", key: "montantTva", width: 13 },
          { header: "Montant TTC", key: "montantTtc", width: 15 },
          { header: "N° facture", key: "numeroFacture", width: 16 },
          { header: "Date facture", key: "dateFacture", width: 13 },
          { header: "Statut paiement", key: "statutPaiement", width: 15 },
          { header: "Reçu le", key: "recu", width: 20 },
          { header: "Confirmé par", key: "confirmePar", width: 24 },
          { header: "Importé de l'historique", key: "importeHistorique", width: 30 },
          { header: "Observation", key: "observation", width: 28 },
        ],
        rows,
        currencyKeys: ["montantHt", "montantTva", "montantTtc"],
        dateKeys: ["date", "dateFacture"],
        totalsKeys: ["montantHt", "montantTva", "montantTtc"],
      }],
    });
    setExporting(false);
  };

  const [exportingImpayees, setExportingImpayees] = useState(false);
  const exporterFacturesImpayees = async () => {
    setExportingImpayees(true);
    const [{ data: c }, { data: r }, { data: d }, { data: f }] = await Promise.all([
      supabase.from("commandes").select("*").limit(10000),
      supabase.from("receptions").select("bc_id").limit(10000),
      supabase.from("demandes").select("id, service, demandeur, motif_projet").limit(10000),
      supabase.from("fournisseurs").select("id, conditions_paiement_jours").limit(10000),
    ]);
    const recuSet = new Set((r || []).map((x) => x.bc_id));
    const demandeMap = {};
    (d || []).forEach((x) => { demandeMap[x.id] = x; });
    const delaiMap = {};
    (f || []).forEach((x) => { delaiMap[x.id] = x.conditions_paiement_jours || 30; });

    const impayees = (c || []).filter((cmd) => recuSet.has(cmd.id) && cmd.statut_paiement !== "Payé" && cmd.statut !== "Annulée" && cmd.numero_facture);
    const rows = impayees.map((cmd) => {
      const echeance = echeanceInfo(cmd, delaiMap);
      const joursRetard = echeance ? Math.max(0, Math.floor((new Date() - echeance) / (1000 * 60 * 60 * 24))) : 0;
      const dmd = demandeMap[cmd.demande_id];
      return {
        numero: cmd.numero,
        fournisseur: cmd.fournisseur_nom,
        numeroFacture: cmd.numero_facture || "",
        dateFacture: cmd.date_facture || "",
        echeance: echeance ? echeance.toLocaleDateString("fr-FR") : "",
        joursRetard,
        montantTtc: Number(cmd.montant_ttc) || 0,
        service: dmd?.service || "",
        observation: cmd.observation_facture || cmd.observation || "",
      };
    }).sort((a, b) => b.joursRetard - a.joursRetard);

    await exportExcel({
      filename: `factures-impayees_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: "UNIFOODS — Factures fournisseurs impayées",
      sheets: [{
        name: "Factures impayées",
        sousTitre: "À l'attention du service Finance",
        columns: [
          { header: "N° BC", key: "numero", width: 18 },
          { header: "Fournisseur", key: "fournisseur", width: 24 },
          { header: "N° facture", key: "numeroFacture", width: 18 },
          { header: "Date facture", key: "dateFacture", width: 14 },
          { header: "Échéance", key: "echeance", width: 14 },
          { header: "Jours de retard", key: "joursRetard", width: 15 },
          { header: "Montant TTC", key: "montantTtc", width: 16 },
          { header: "Service demandeur", key: "service", width: 20 },
          { header: "Observation", key: "observation", width: 28 },
        ],
        rows,
        currencyKeys: ["montantTtc"],
        dateKeys: ["dateFacture"],
        totalsKeys: ["montantTtc"],
      }],
    });
    setExportingImpayees(false);
  };

  const resteAcharger = Math.max(0, totalCount - liste.length);
  const sentinelleRef = useRef(null);
  const conteneurScrollRef = useRef(null);

  // Charge automatiquement les 100 suivants dès que le repère en bas de
  // liste devient visible (défilement normal, sans clic).
  useEffect(() => {
    if (modeSpecial || resteAcharger <= 0) return;
    const cible = sentinelleRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees[0].isIntersecting && !loadingPlus && !loading) chargerPage(false);
      },
      { root: conteneurScrollRef.current, rootMargin: "200px" }
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [modeSpecial, resteAcharger, loadingPlus, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18 }}>Bons de commande</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/commandes/nouveau" style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
              + Créer un BC directement
            </Link>
            <Link href="/commandes/pv-vierge" style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
              PV vierge
            </Link>
            <button onClick={exporter} disabled={exporting} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" }}>
              {exporting ? "Génération..." : "Exporter en Excel"}
            </button>
            <button onClick={exporterFacturesImpayees} disabled={exportingImpayees} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #B3261E", background: "#fff", color: "#B3261E", fontSize: 13, cursor: "pointer" }} title="Rapport à envoyer au service Finance">
              {exportingImpayees ? "Génération..." : "Rapport factures impayées"}
            </button>
          </div>
        </div>

        {modeSpecial && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E8F0FA", color: "#1B4C7A", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, flexShrink: 0 }}>
            <span>
              Filtré depuis le Tableau de bord : seuls les {filtrees.length} BC
              {filtreDepuisTableauDeBord && " en attente de livraison"}
              {filtreSignature && " en attente de signature direction"}
              {filtreImpayees && " avec facture impayée"}
              {" "}sont affichés.
            </span>
            <Link href="/commandes" style={{ color: "#1B4C7A", textDecoration: "underline" }}>Voir tous les BC</Link>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <h2 style={{ fontSize: 15 }}>
              {modeSpecial
                ? `Liste (${filtrees.length} / ${liste.length})`
                : `Liste (${liste.length} chargés / ${totalCount} au total${filtreAnnee !== "toutes" ? `, année ${filtreAnnee}` : ""})`}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative", width: 260 }}>
                <input data-search-field placeholder="Rechercher (N° BC, fournisseur...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
                {recherche && <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer">×</button>}
              </div>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
                <option value="">Tous les statuts</option>
                {STATUTS_CONNUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {!modeSpecial && (
                <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)} style={inputStyle} title="Par défaut, seule l'année en cours est affichée">
                  {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
                  <option value="toutes">Toutes les années</option>
                </select>
              )}
              <TriMenu
                colonnes={[
                  { key: "created_at", label: "Date" },
                  { key: "numero", label: "N° BC" },
                  { key: "fournisseur_nom", label: "Fournisseur" },
                  { key: "montant_ttc", label: "Montant TTC" },
                  { key: "statut", label: "Statut" },
                ]}
                tri={tri}
                onChange={setTri}
              />
            </div>
          </div>
          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
          {!loading && filtrees.length === 0 && (
            <p style={{ color: "#888", fontSize: 13 }}>Aucun bon de commande pour ces filtres.</p>
          )}
          <div ref={conteneurScrollRef} style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date BC</th>
              <th style={{ ...thStyle, minWidth: 190 }}>N° BC</th>
              <th style={thStyle}>Fournisseur</th>
              <th style={thStyle}>Total TTC</th>
              <th style={thStyle}>Service / Demandeur</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}>Réception</th>
              <th style={thStyle}>Paiement</th>
              <th style={thStyle}>Observation</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((c) => {
              const reception = receptions.find((r) => r.bc_id === c.id);
              const echeance = echeanceInfo(c, delaiParFournisseur);
              const enRetard = bcRecuId[c.id] && echeance && c.statut_paiement !== "Payé" && new Date() > echeance;
              const dmd = demandeParId[c.demande_id];
              const estPrestation = !!prestationParBc[c.id];
              const couleurLigne = c.statut?.startsWith("Clôturée (rupture)") ? "#B3261E"
                : reception?.statut === "Totale" ? "#1B7A4C"
                : enRetard ? "#B3261E"
                : "#242322";
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0", color: couleurLigne }}>
                  <td style={tdStyle}>{formatDate(c.date)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <Link
                      href={`/commandes/${c.id}`}
                      style={{ color: "#1E3A34", textDecoration: "underline" }}
                      title={articlesParBc[c.id]?.length ? articlesParBc[c.id].join("\n") : "Aucun article"}
                    >
                      {c.numero}
                    </Link>
                    {dmd?.motif_projet && <div style={{ fontSize: 12, color: "#888", fontWeight: 400, whiteSpace: "normal" }}>{dmd.motif_projet}</div>}
                  </td>
                  <td style={tdStyle}>{c.fournisseur_nom}</td>
                  <td style={tdStyle}>{Number(c.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                  <td style={tdStyle}>
                    {dmd ? <>{dmd.service || "-"}<div style={{ fontSize: 12, color: "#888" }}>{dmd.demandeur || ""}</div></> : "-"}
                  </td>
                  <td style={tdStyle}>
                    <select value={c.statut} onChange={(e) => changerStatut(c.id, e.target.value)} style={inputStyle}>
                      <option>A faire</option>
                      <option>En cours</option>
                      <option>Envoyée</option>
                      <option>Livraison en cours</option>
                      <option>Clôturée</option>
                      <option>Clôturée (rupture)</option>
                      <option>Annulée</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {reception ? (
                      <span style={{ fontSize: 12, color: reception.statut === "Totale" ? "#1B7A4C" : "#8A6100" }}>
                        {estPrestation
                          ? (reception.statut === "Totale" ? "Prestation effectuée" : "Prestation partielle")
                          : reception.receptionnaire === "Magasin"
                            ? (reception.statut === "Totale" ? "Livré au Magasin" : "Livré partiellement au Magasin")
                            : (reception.statut === "Totale" ? "Livré" : "Livré partiellement")}
                        {reception.receptionnaire !== "Magasin" && <br />}
                        {reception.receptionnaire === "Import historique" ? (
                          <span style={{ color: "#1B4C7A" }} title="Date d'import de l'historique, pas la date réelle de réception">📥 import historique</span>
                        ) : reception.receptionnaire !== "Magasin" ? (
                          <span style={{ color: "#999" }}>par {reception.receptionnaire || reception.confirme_par}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#999" }}>{estPrestation ? "Prestation non effectuée" : "Non livré"}</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 12, padding: "3px 8px", borderRadius: 6,
                      background: c.statut_paiement === "Payé" ? "#EAF7EE" : enRetard ? "#FDECEA" : "#FFF3D6",
                      color: c.statut_paiement === "Payé" ? "#1B7A4C" : enRetard ? "#B3261E" : "#8A6100",
                    }}>
                      {c.statut_paiement === "Payé" ? "Payé" : enRetard ? "Échéance dépassée" : "Impayé"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "#666" }}>{c.observation || "-"}</td>
                  <td style={tdStyle}>
                    <button onClick={() => annulerBc(c)} style={{ ...linkBtn, background: "none", border: "none", color: c.statut === "Annulée" ? "#1B7A4C" : "#8A6100", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, marginRight: 8 }} title={c.statut === "Annulée" ? "Réactiver" : "Annuler"}><IconBan /></button>
                    <button onClick={() => supprimerBc(c)} style={{ ...linkBtn, background: "none", border: "none", color: "#B3261E", cursor: "pointer", display: role === "acheteur" ? "inline-flex" : "none", alignItems: "center", gap: 5 }} title="Supprimer"><IconTrash /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!modeSpecial && resteAcharger > 0 && (
          <div ref={sentinelleRef} style={{ display: "flex", justifyContent: "center", padding: 12, flexShrink: 0, fontSize: 12, color: "#999" }}>
            {loadingPlus ? "Chargement de la suite..." : `${resteAcharger} de plus en bas...`}
          </div>
        )}
        </div>
        </div>
      </div>
    </AuthGuard>
  );
}

const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
