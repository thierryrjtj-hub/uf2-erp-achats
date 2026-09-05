"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { buttonStyle } from "../components/ui";

export default function KpiPage() {
  const [commandes, setCommandes] = useState([]);
  const [lignesBc, setLignesBc] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [receptions, setReceptions] = useState([]);
  const [lignesReception, setLignesReception] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("commandes").select("*");
      const { data: l } = await supabase.from("lignes_bc").select("*");
      const { data: d } = await supabase.from("demandes").select("*");
      const { data: r } = await supabase.from("receptions").select("*");
      const { data: lr } = await supabase.from("lignes_reception").select("*");
      setCommandes(c || []);
      setLignesBc(l || []);
      setDemandes(d || []);
      setReceptions(r || []);
      setLignesReception(lr || []);
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
    const topFournisseurs = Object.entries(parFournisseur).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const parArticle = {};
    lignesBc.forEach((l) => { parArticle[l.designation] = (parArticle[l.designation] || 0) + Number(l.montant_ht || 0); });
    const topArticles = Object.entries(parArticle).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const impayes = commandes.filter((c) => c.statut_paiement !== "Payé");
    const totalImpaye = impayes.reduce((s, c) => s + Number(c.montant_ttc || 0), 0);

    const demandesEnAttente = demandes.filter((d) => d.statut !== "Basculée en commande").length;
    const bcNonRecus = commandes.filter((c) => !receptions.some((r) => r.bc_id === c.id)).length;

    // ---- Délais de traitement (point 28) ----
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

    // ---- Achats par mois, 12 derniers mois (point 7) ----
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

    return { totalTTC, totalMois, nbCommandesMois: commandesMois.length, topFournisseurs, topArticles, impayesCount: impayes.length, totalImpaye, demandesEnAttente, bcNonRecus, delaiMoyenBc, delaiMoyenReception, parMois };
  }, [commandes, lignesBc, demandes, receptions, lignesReception]);

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
      { label: "", valeur: "" },
      { label: "Top fournisseurs (montant TTC)", valeur: "" },
      ...stats.topFournisseurs.map(([nom, montant]) => ({ label: nom, valeur: montant })),
      { label: "", valeur: "" },
      { label: "Top articles (montant HT)", valeur: "" },
      ...stats.topArticles.map(([nom, montant]) => ({ label: nom, valeur: montant })),
    ];
    await exportExcel({
      filename: `kpi-achats_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: "KPI",
        columns: [{ header: "Indicateur", key: "label", width: 42 }, { header: "Valeur", key: "valeur", width: 26 }],
        rows: kpiRows,
        currencyKeys: ["valeur"],
      }],
    });
    setExporting(false);
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  const maxFournisseur = stats.topFournisseurs[0]?.[1] || 1;
  const maxArticle = stats.topArticles[0]?.[1] || 1;

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>KPI Achats</h1>
        <button onClick={exporter} disabled={exporting} style={buttonStyle}>
          {exporting ? "Génération..." : "Exporter en Excel"}
        </button>
      </div>

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
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minWidth: 320 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Top fournisseurs (montant TTC)</h2>
          {stats.topFournisseurs.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore de commande.</p>}
          {stats.topFournisseurs.map(([nom, montant]) => (
            <BarRow key={nom} label={nom} value={montant} max={maxFournisseur} />
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minWidth: 320 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Top articles (montant HT)</h2>
          {stats.topArticles.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Pas encore d'achat.</p>}
          {stats.topArticles.map(([nom, montant]) => (
            <BarRow key={nom} label={nom} value={montant} max={maxArticle} />
          ))}
        </div>
      </div>

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
                  <div style={{ width: "100%", maxWidth: 34, height: `${(m.montant / maxMois) * 110 || 1}px`, background: "#1B2430", borderRadius: 4 }} />
                  <div style={{ fontSize: 11, color: "#666" }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        )}
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

function BarRow({ label, value, max }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ width: 140, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "#F0EFEA", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: "#1B2430" }} />
      </div>
      <div style={{ width: 110, textAlign: "right", fontSize: 12 }}>{value.toLocaleString("fr-FR")} Ar</div>
    </div>
  );
}

