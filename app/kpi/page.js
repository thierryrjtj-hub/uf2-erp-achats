"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import CadreExtensible from "../components/CadreExtensible";
import { exportExcel } from "../../lib/exportExcel";
import { buttonStyle } from "../components/ui";
import { calculerFrequenceAchats } from "../../lib/frequenceAchats";
import { CATEGORIES_MATIERES_PREMIERES } from "../../lib/categoriesArticles";

export default function KpiPage() {
  const [commandes, setCommandes] = useState([]);
  const [lignesBc, setLignesBc] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [receptions, setReceptions] = useState([]);
  const [lignesReception, setLignesReception] = useState([]);
  const [categorieParDesignation, setCategorieParDesignation] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("commandes").select("*").limit(10000);
      const { data: l } = await supabase.from("lignes_bc").select("*").limit(10000);
      const { data: d } = await supabase.from("demandes").select("*").limit(10000);
      const { data: r } = await supabase.from("receptions").select("*").limit(10000);
      const { data: lr } = await supabase.from("lignes_reception").select("*").limit(10000);
      const { data: art } = await supabase.from("articles").select("designation, categorie").limit(10000);
      setCommandes(c || []);
      setLignesBc(l || []);
      setDemandes(d || []);
      setReceptions(r || []);
      setLignesReception(lr || []);
      const catMap = {};
      (art || []).forEach((a) => { catMap[a.designation] = a.categorie; });
      setCategorieParDesignation(catMap);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const totalTTC = commandes.reduce((s, c) => s + Number(c.montant_ttc || 0), 0);
    const nowMonth = new Date().toISOString().slice(0, 7);
    const commandesMois = commandes.filter((c) => (c.date || "").slice(0, 7) === nowMonth);
    const totalMois = commandesMois.reduce((s, c) => s + Number(c.montant_ttc || 0), 0);

    const parFournisseur = {};
    commandes.forEach((c) => { parFournisseur[c.fournisseur_nom] = (parFournisseur[c.fournisseur_nom] || 0) + Number(c.montant_ttc || 0); });
    const topFournisseurs = Object.entries(parFournisseur).sort((a, b) => b[1] - a[1]);

    const parArticle = {};
    lignesBc.forEach((l) => { parArticle[l.designation] = (parArticle[l.designation] || 0) + Number(l.montant_ht || 0); });
    const topArticles = Object.entries(parArticle).sort((a, b) => b[1] - a[1]);

    // ---- Fréquence d'achat par article : nombre de BC distincts (pas de lignes) ----
    // Uniquement les catégories "matières premières" — voir lib/categoriesArticles.js
    const commandesParId = {};
    commandes.forEach((c) => { commandesParId[c.id] = c; });
    const frequences = calculerFrequenceAchats(lignesBc, commandesParId)
      .filter((f) => CATEGORIES_MATIERES_PREMIERES.includes(categorieParDesignation[f.designation]));
    const topFrequenceArticles = frequences.map((f) => [f.designation, f.nombreAchats]);

    // ---- Cycle de réapprovisionnement : durée moyenne entre deux commandes, pour les
    // articles achetés au moins 3 fois (pour avoir un cycle fiable) ----
    const topCycles = frequences
      .filter((f) => f.cycleJours != null && f.nombreAchats >= 3)
      .sort((a, b) => a.cycleJours - b.cycleJours);

    const impayes = commandes.filter((c) => c.statut_paiement !== "Payé");
    const totalImpaye = impayes.reduce((s, c) => s + Number(c.montant_ttc || 0), 0);

    const demandesEnAttente = demandes.filter((d) => d.statut !== "Basculée en commande").length;
    const bcNonRecus = commandes.filter((c) => !receptions.some((r) => r.bc_id === c.id)).length;

    // ---- Délais de traitement ----
    const joursEntre = (d1, d2) => Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));

    const delaisBc = [];
    commandes.forEach((c) => {
      if (!c.demande_id || !c.date_signature) return;
      const dmd = demandes.find((d) => d.id === c.demande_id);
      if (dmd?.created_at) delaisBc.push(joursEntre(dmd.created_at, c.date_signature));
    });
    const delaiMoyenBc = delaisBc.length ? Math.round(delaisBc.reduce((a, b) => a + b, 0) / delaisBc.length) : null;

    const delaisReception = [];
    commandes.forEach((c) => {
      if (!c.demande_id) return;
      const dmd = demandes.find((d) => d.id === c.demande_id);
      if (!dmd?.created_at) return;
      const lignesDeCeBc = lignesBc.filter((l) => l.bc_id === c.id);
      if (lignesDeCeBc.length === 0) return;
      const receptionsDeCeBc = receptions.filter((r) => r.bc_id === c.id);
      const toutLivre = lignesDeCeBc.every((l) => {
        const cumul = lignesReception.filter((lr) => receptionsDeCeBc.some((r) => r.id === lr.reception_id) && lr.ligne_bc_id === l.id).reduce((s, lr) => s + (Number(lr.quantite_livree) || 0), 0);
        return cumul >= Number(l.quantite);
      });
      if (!toutLivre || receptionsDeCeBc.length === 0) return;
      const derniereDate = receptionsDeCeBc.map((r) => r.date_reception_reelle).sort().slice(-1)[0];
      delaisReception.push(joursEntre(dmd.created_at, derniereDate));
    });
    const delaiMoyenReception = delaisReception.length ? Math.round(delaisReception.reduce((a, b) => a + b, 0) / delaisReception.length) : null;

    // ---- Achats par mois, 12 derniers mois ----
    const parMois = [];
    const MOIS_LABEL = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const cle = d.toISOString().slice(0, 7);
      const montant = commandes.filter((c) => (c.date || "").slice(0, 7) === cle).reduce((s, c) => s + Number(c.montant_ttc || 0), 0);
      parMois.push({ mois: cle, label: MOIS_LABEL[d.getMonth()], montant });
    }

    return { totalTTC, totalMois, nbCommandesMois: commandesMois.length, topFournisseurs, topArticles, topFrequenceArticles, topCycles, impayesCount: impayes.length, totalImpaye, demandesEnAttente, bcNonRecus, delaiMoyenBc, delaiMoyenReception, parMois };
  }, [commandes, lignesBc, demandes, receptions, lignesReception, categorieParDesignation]);

  const exporterClassement = async (titre, nomFichier, colonneLabel, lignes, suffixe) => {
    await exportExcel({
      filename: `${nomFichier}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: `UNIFOODS — ${titre}`,
      sheets: [{
        name: titre.slice(0, 30),
        columns: [{ header: colonneLabel, key: "label", width: 42 }, { header: "Valeur", key: "valeur", width: 20 }],
        rows: lignes.map(([label, valeur], i) => ({ label: `${i + 1}. ${label}`, valeur: `${valeur}${suffixe || ""}` })),
      }],
    });
  };

  const exporter = async () => {
    setExporting(true);
    const kpiRows = [
      { label: "Montant total des achats (TTC)", valeur: stats.totalTTC },
      { label: "Montant des achats ce mois-ci (TTC)", valeur: stats.totalMois },
      { label: "Nombre de BC ce mois-ci", valeur: stats.nbCommandesMois },
      { label: "Demandes en attente de BC", valeur: stats.demandesEnAttente },
      { label: "BC en attente de réception", valeur: stats.bcNonRecus },
      { label: "Factures impayées (nombre)", valeur: stats.impayesCount },
      { label: "Montant total impayé", valeur: stats.totalImpaye },
      { label: "Délai moyen jusqu'au BC (jours)", valeur: stats.delaiMoyenBc ?? "" },
      { label: "Délai moyen jusqu'à réception (jours)", valeur: stats.delaiMoyenReception ?? "" },
    ];
    await exportExcel({
      filename: `kpi-achats_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: "UNIFOODS — KPI Achats",
      sheets: [
        { name: "Vue d'ensemble", sousTitre: "Indicateurs clés", columns: [{ header: "Indicateur", key: "label", width: 42 }, { header: "Valeur", key: "valeur", width: 26 }], rows: kpiRows, currencyKeys: ["valeur"] },
        { name: "Top fournisseurs", sousTitre: "Par montant TTC", columns: [{ header: "Fournisseur", key: "label", width: 32 }, { header: "Montant TTC", key: "valeur", width: 20 }], rows: stats.topFournisseurs.map(([nom, montant]) => ({ label: nom, valeur: montant })), currencyKeys: ["valeur"], totalsKeys: ["valeur"] },
        { name: "Top articles (montant)", sousTitre: "Par montant HT", columns: [{ header: "Article", key: "label", width: 42 }, { header: "Montant HT", key: "valeur", width: 20 }], rows: stats.topArticles.map(([nom, montant]) => ({ label: nom, valeur: montant })), currencyKeys: ["valeur"], totalsKeys: ["valeur"] },
        { name: "Fréquence d'achat", sousTitre: "Nombre de BC distincts par article", columns: [{ header: "Article", key: "label", width: 42 }, { header: "Nombre d'achats", key: "valeur", width: 18 }], rows: stats.topFrequenceArticles.map(([nom, nb]) => ({ label: nom, valeur: nb })) },
        { name: "Cycle réapprovisionnement", sousTitre: "Durée moyenne entre deux commandes (jours)", columns: [{ header: "Article", key: "label", width: 42 }, { header: "Cycle moyen (jours)", key: "valeur", width: 18 }, { header: "Nombre d'achats", key: "nb", width: 16 }], rows: stats.topCycles.map((f) => ({ label: f.designation, valeur: f.cycleJours, nb: f.nombreAchats })) },
      ],
    });
    setExporting(false);
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  const maxFournisseur = stats.topFournisseurs[0]?.[1] || 1;
  const maxArticle = stats.topArticles[0]?.[1] || 1;
  const maxFrequence = stats.topFrequenceArticles[0]?.[1] || 1;

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18 }}>KPI Achats</h1>
          <button onClick={exporter} disabled={exporting} style={buttonStyle}>
            {exporting ? "Génération..." : "Exporter tout en Excel"}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <Card label="Total des achats" value={`${stats.totalTTC.toLocaleString("fr-FR")} Ar`} />
            <Card label="Ce mois-ci" value={`${stats.totalMois.toLocaleString("fr-FR")} Ar`} sub={`${stats.nbCommandesMois} BC`} />
            <Card label="Demandes en attente de BC" value={stats.demandesEnAttente} />
            <Card label="BC en attente de réception" value={stats.bcNonRecus} />
            <Card label="Factures impayées" value={stats.impayesCount} sub={stats.totalImpaye ? `${stats.totalImpaye.toLocaleString("fr-FR")} Ar` : null} />
            <Card label="Délai moyen jusqu'au BC" value={stats.delaiMoyenBc != null ? `${stats.delaiMoyenBc} j` : "-"} sub="depuis réception de la DA" />
            <Card label="Délai moyen jusqu'à réception" value={stats.delaiMoyenReception != null ? `${stats.delaiMoyenReception} j` : "-"} sub="depuis réception de la DA" />
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
            <CadreExtensible titre="Top fournisseurs (montant TTC)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minWidth: 320 }}>
              {(etendu) => (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15 }}>Top fournisseurs (montant TTC)</h2>
                    <button className="no-print" onClick={() => exporterClassement("Top fournisseurs", "top-fournisseurs", "Fournisseur", stats.topFournisseurs, " Ar")} style={miniExportBtn}>Exporter</button>
                  </div>
                  {stats.topFournisseurs.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore de commande.</p>}
                  {(etendu ? stats.topFournisseurs : stats.topFournisseurs.slice(0, 6)).map(([nom, montant]) => (
                    <BarRow key={nom} label={nom} value={montant} max={maxFournisseur} suffix=" Ar" />
                  ))}
                </>
              )}
            </CadreExtensible>

            <CadreExtensible titre="Top articles (montant HT)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minWidth: 320 }}>
              {(etendu) => (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15 }}>Top articles (montant HT)</h2>
                    <button className="no-print" onClick={() => exporterClassement("Top articles", "top-articles", "Article", stats.topArticles, " Ar")} style={miniExportBtn}>Exporter</button>
                  </div>
                  {stats.topArticles.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore d'achat.</p>}
                  {(etendu ? stats.topArticles : stats.topArticles.slice(0, 6)).map(([nom, montant]) => (
                    <BarRow key={nom} label={nom} value={montant} max={maxArticle} suffix=" Ar" />
                  ))}
                </>
              )}
            </CadreExtensible>

            <CadreExtensible titre="Articles les plus achetés (fréquence)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minWidth: 320 }}>
              {(etendu) => (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15 }}>Articles les plus achetés (fréquence)</h2>
                    <button className="no-print" onClick={() => exporterClassement("Fréquence d'achat", "frequence-achat", "Article", stats.topFrequenceArticles, " achats")} style={miniExportBtn}>Exporter</button>
                  </div>
                  <p style={{ fontSize: 11, color: "#999", marginBottom: 10 }}>Compté par bon de commande distinct (pas par ligne).</p>
                  {stats.topFrequenceArticles.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore d'achat.</p>}
                  {(etendu ? stats.topFrequenceArticles : stats.topFrequenceArticles.slice(0, 6)).map(([nom, nb]) => (
                    <BarRow key={nom} label={nom} value={nb} max={maxFrequence} suffix=" achats" />
                  ))}
                </>
              )}
            </CadreExtensible>
          </div>

          <CadreExtensible titre="Cycle de réapprovisionnement (durée moyenne entre deux commandes)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
            {(etendu) => (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <h2 style={{ fontSize: 15 }}>Cycle de réapprovisionnement</h2>
                  <button className="no-print" onClick={() => exporterClassement("Cycle de réapprovisionnement", "cycle-reappro", "Article", stats.topCycles.map((f) => [f.designation, f.cycleJours]), " jours")} style={miniExportBtn}>Exporter</button>
                </div>
                <p style={{ fontSize: 11, color: "#999", marginBottom: 10 }}>Articles achetés au moins 3 fois — durée moyenne entre deux commandes. Les alertes de réapprovisionnement approchant apparaissent au Tableau de bord.</p>
                {stats.topCycles.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore assez d'historique pour établir un cycle.</p>}
                {(etendu ? stats.topCycles : stats.topCycles.slice(0, 10)).map((f) => (
                  <div key={f.designation} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f4f4f0", fontSize: 13 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={f.designation}>{f.designation}</span>
                    <span style={{ color: "#666", marginLeft: 12, whiteSpace: "nowrap" }}>tous les <strong style={{ color: "#1E3A34" }}>{f.cycleJours} j</strong> ({f.nombreAchats} achats)</span>
                  </div>
                ))}
              </>
            )}
          </CadreExtensible>

          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Achats par mois (12 derniers mois, TTC)</h2>
            {stats.parMois.every((m) => m.montant === 0) ? (
              <p style={{ color: "#888", fontSize: 13 }}>Pas encore de commande.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, paddingTop: 10 }}>
                {stats.parMois.map((m) => {
                  const maxMois = Math.max(...stats.parMois.map((x) => x.montant), 1);
                  return (
                    <div key={m.mois} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 10, color: "#888" }}>{m.montant ? `${Math.round(m.montant / 1000).toLocaleString("fr-FR")}k` : ""}</div>
                      <div style={{ width: "100%", maxWidth: 34, height: `${(m.montant / maxMois) * 110 || 1}px`, background: "#1E3A34", borderRadius: 4 }} />
                      <div style={{ fontSize: 11, color: "#666" }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function Card({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: "16px 24px", minWidth: 170 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, suffix = "" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ width: 140, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "#F0EFEA", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: "#1E3A34" }} />
      </div>
      <div style={{ width: 90, textAlign: "right", fontSize: 12 }}>{typeof value === "number" && suffix === " Ar" ? value.toLocaleString("fr-FR") : value}{suffix}</div>
    </div>
  );
}

const miniExportBtn = { fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#1B2430", cursor: "pointer" };

