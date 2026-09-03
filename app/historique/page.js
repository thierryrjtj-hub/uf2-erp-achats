"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel, slugify } from "../../lib/exportExcel";

export default function HistoriquePage() {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreFournisseur, setFiltreFournisseur] = useState("");
  const [filtreService, setFiltreService] = useState("");
  const [filtreCategorie, setFiltreCategorie] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: bcList } = await supabase.from("commandes").select("id, numero, date, fournisseur_nom, demande_id, assujetti_tva, montant_ttc");
      const { data: lignesBc } = await supabase.from("lignes_bc").select("*");
      const { data: receptionsList } = await supabase.from("receptions").select("id, bc_id, date_reception_reelle");
      const { data: lignesReceptionList } = await supabase.from("lignes_reception").select("reception_id, ligne_bc_id, quantite_livree");
      const { data: demandesList } = await supabase.from("demandes").select("id, service, demandeur, motif_projet");
      const { data: articlesList } = await supabase.from("articles").select("designation, categorie");

      const enrichies = (lignesBc || []).map((l) => {
        const bc = (bcList || []).find((b) => b.id === l.bc_id);
        const receptionsDeCeBc = (receptionsList || []).filter((r) => r.bc_id === l.bc_id).map((r) => r.id);
        const cumulLivre = (lignesReceptionList || [])
          .filter((lr) => receptionsDeCeBc.includes(lr.reception_id) && lr.ligne_bc_id === l.id)
          .reduce((s, lr) => s + (Number(lr.quantite_livree) || 0), 0);
        const derniereReception = (receptionsList || []).filter((r) => r.bc_id === l.bc_id).sort((a, b) => new Date(b.date_reception_reelle) - new Date(a.date_reception_reelle))[0];
        const dmd = bc?.demande_id ? (demandesList || []).find((d) => d.id === bc.demande_id) : null;
        const art = (articlesList || []).find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
        const assujetti = bc?.assujetti_tva !== false;
        const montantHt = Number(l.montant_ht) || 0;
        const montantTtc = assujetti ? montantHt * 1.2 : montantHt;
        let etatLivraison = "Non livré";
        if (cumulLivre >= Number(l.quantite) && cumulLivre > 0) etatLivraison = "Livré";
        else if (cumulLivre > 0) etatLivraison = "Livré partiellement";
        return {
          ...l,
          bc_numero: bc?.numero || "-",
          bc_date: bc?.date || "-",
          fournisseur_nom: bc?.fournisseur_nom || "-",
          bc_total_ttc: Number(bc?.montant_ttc) || 0,
          date_reception: derniereReception?.date_reception_reelle || null,
          service: dmd?.service || "",
          demandeur: dmd?.demandeur || "",
          usage_projet: dmd?.motif_projet || "",
          categorie: art?.categorie || "",
          montant_ttc: montantTtc,
          etat_livraison: etatLivraison,
        };
      });
      enrichies.sort((a, b) => new Date(b.bc_date) - new Date(a.bc_date));
      setLignes(enrichies);
      setLoading(false);
    })();
  }, []);

  const fournisseursDistincts = useMemo(() => [...new Set(lignes.map((l) => l.fournisseur_nom))].sort(), [lignes]);
  const servicesDistincts = useMemo(() => [...new Set(lignes.map((l) => l.service).filter(Boolean))].sort(), [lignes]);
  const categoriesDistinctes = useMemo(() => [...new Set(lignes.map((l) => l.categorie).filter(Boolean))].sort(), [lignes]);

  const filtrees = useMemo(() => {
    return lignes.filter((l) => {
      const okRecherche = !recherche || l.designation.toLowerCase().includes(recherche.toLowerCase()) || (l.demandeur || "").toLowerCase().includes(recherche.toLowerCase());
      const okFournisseur = !filtreFournisseur || l.fournisseur_nom === filtreFournisseur;
      const okService = !filtreService || l.service === filtreService;
      const okCategorie = !filtreCategorie || l.categorie === filtreCategorie;
      return okRecherche && okFournisseur && okService && okCategorie;
    });
  }, [lignes, recherche, filtreFournisseur, filtreService, filtreCategorie]);

  const totauxFiltres = useMemo(() => {
    return filtrees.reduce((acc, l) => ({ ht: acc.ht + (Number(l.montant_ht) || 0), ttc: acc.ttc + (Number(l.montant_ttc) || 0) }), { ht: 0, ttc: 0 });
  }, [filtrees]);

  const dernierAchatParArticle = useMemo(() => {
    const map = {};
    for (const l of lignes) {
      const key = l.designation;
      if (!map[key] || new Date(l.bc_date) > new Date(map[key].bc_date)) map[key] = l;
    }
    return map;
  }, [lignes]);

  const exporter = async () => {
    setExporting(true);
    const rows = filtrees.map((l) => ({
      article: l.designation, categorie: l.categorie, fournisseur: l.fournisseur_nom, bc: l.bc_numero, dateBc: l.bc_date,
      demandeur: l.demandeur, usage: l.usage_projet, etat: l.etat_livraison,
      qte: Number(l.quantite), unite: l.unite, pu: Number(l.prix_unitaire_ht) || 0, remise: Number(l.remise_pct) || 0,
      montantHt: Number(l.montant_ht) || 0, montantTtc: Number(l.montant_ttc) || 0, totalBc: Number(l.bc_total_ttc) || 0,
    }));

    const parFournisseur = {};
    filtrees.forEach((l) => { parFournisseur[l.fournisseur_nom] = (parFournisseur[l.fournisseur_nom] || 0) + Number(l.montant_ht || 0); });
    const topFournisseurs = Object.entries(parFournisseur).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const kpiRows = [
      { label: "Montant total HT (filtré)", valeur: totauxFiltres.ht },
      { label: "Montant total TTC (filtré)", valeur: totauxFiltres.ttc },
      { label: "Nombre de lignes d'achat", valeur: filtrees.length },
      { label: "Nombre d'articles distincts", valeur: new Set(filtrees.map((l) => l.designation)).size },
      { label: "Nombre de fournisseurs distincts", valeur: new Set(filtrees.map((l) => l.fournisseur_nom)).size },
      { label: "", valeur: "" },
      { label: "Top fournisseurs (montant HT)", valeur: "" },
      ...topFournisseurs.map(([nom, montant]) => ({ label: nom, valeur: montant })),
    ];

    const parts = [];
    if (recherche) parts.push(slugify(recherche));
    if (filtreFournisseur) parts.push(slugify(filtreFournisseur));
    const slug = parts.length ? parts.join("_") : "tous-achats";

    await exportExcel({
      filename: `historique_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [
        {
          name: "Historique",
          columns: [
            { header: "Article", key: "article", width: 34 }, { header: "Catégorie", key: "categorie", width: 20 },
            { header: "Fournisseur", key: "fournisseur", width: 20 }, { header: "N° BC", key: "bc", width: 16 },
            { header: "Date BC", key: "dateBc", width: 12 }, { header: "Demandeur", key: "demandeur", width: 16 },
            { header: "Usage / Projet", key: "usage", width: 24 }, { header: "État livraison", key: "etat", width: 16 },
            { header: "Qté", key: "qte", width: 8 }, { header: "Unité", key: "unite", width: 10 },
            { header: "PU HT", key: "pu", width: 12 }, { header: "Remise %", key: "remise", width: 9 },
            { header: "Montant HT", key: "montantHt", width: 14 }, { header: "Montant TTC", key: "montantTtc", width: 14 },
            { header: "Total BC (TTC)", key: "totalBc", width: 14 },
          ],
          rows,
          currencyKeys: ["pu", "montantHt", "montantTtc", "totalBc"],
          percentKeys: ["remise"],
        },
        {
          name: "KPI",
          columns: [{ header: "Indicateur", key: "label", width: 38 }, { header: "Valeur", key: "valeur", width: 26 }],
          rows: kpiRows,
          currencyKeys: ["valeur"],
        },
      ],
    });
    setExporting(false);
  };

  const badgeEtat = (etat) => ({
    fontSize: 11, padding: "2px 7px", borderRadius: 5,
    background: etat === "Livré" ? "#EAF7EE" : etat === "Livré partiellement" ? "#FFF3D6" : "#F0EFEA",
    color: etat === "Livré" ? "#1B7A4C" : etat === "Livré partiellement" ? "#8A6100" : "#999",
  });

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Historique des achats — situation globale</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Rechercher un article ou un demandeur..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <select value={filtreFournisseur} onChange={(e) => setFiltreFournisseur(e.target.value)} style={inputStyle}>
            <option value="">Tous les fournisseurs</option>
            {fournisseursDistincts.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)} style={inputStyle}>
            <option value="">Tous les services</option>
            {servicesDistincts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} style={inputStyle}>
            <option value="">Toutes les catégories</option>
            {categoriesDistinctes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={exporter} disabled={exporting} style={buttonStyle}>
            {exporting ? "Génération..." : "Exporter en Excel"}
          </button>
        </div>

        {recherche && filtrees.length > 0 && dernierAchatParArticle[filtrees[0].designation] && (
          <div style={{ background: "#F5F4F1", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            <strong>Dernier achat de "{filtrees[0].designation}"</strong> : {Number(dernierAchatParArticle[filtrees[0].designation].prix_unitaire_ht).toLocaleString("fr-FR")} Ar
            chez {dernierAchatParArticle[filtrees[0].designation].fournisseur_nom}, le {dernierAchatParArticle[filtrees[0].designation].bc_date}
          </div>
        )}

        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucun achat enregistré pour le moment — l'historique se remplit automatiquement à chaque bon de commande créé.</p>}

        {filtrees.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Article</th>
                  <th style={thStyle}>Catégorie</th>
                  <th style={thStyle}>Fournisseur</th>
                  <th style={thStyle}>N° BC</th>
                  <th style={thStyle}>Date BC</th>
                  <th style={thStyle}>Demandeur</th>
                  <th style={thStyle}>Usage / Projet</th>
                  <th style={thStyle}>État</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>PU HT</th>
                  <th style={thStyle}>Remise</th>
                  <th style={thStyle}>Montant HT</th>
                  <th style={thStyle}>Montant TTC</th>
                  <th style={thStyle}>Total BC (TTC)</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={tdStyle}>{l.designation}</td>
                    <td style={tdStyle}>{l.categorie || "-"}</td>
                    <td style={tdStyle}>{l.fournisseur_nom}</td>
                    <td style={tdStyle}>{l.bc_numero}</td>
                    <td style={tdStyle}>{l.bc_date}</td>
                    <td style={tdStyle}>{l.demandeur || "-"}</td>
                    <td style={tdStyle}>{l.usage_projet || "-"}</td>
                    <td style={tdStyle}><span style={badgeEtat(l.etat_livraison)}>{l.etat_livraison}</span></td>
                    <td style={tdStyle}>{l.quantite} {l.unite}</td>
                    <td style={tdStyle}>{Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar</td>
                    <td style={tdStyle}>{l.remise_pct || 0}%</td>
                    <td style={tdStyle}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
                    <td style={tdStyle}>{Number(l.montant_ttc).toLocaleString("fr-FR")} Ar</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{Number(l.bc_total_ttc).toLocaleString("fr-FR")} Ar</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #ddd" }}>
                  <td colSpan={11} style={{ ...tdStyle, fontWeight: 700 }}>Total ({filtrees.length} ligne{filtrees.length > 1 ? "s" : ""} affichée{filtrees.length > 1 ? "s" : ""})</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ht.toLocaleString("fr-FR")} Ar</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ttc.toLocaleString("fr-FR")} Ar</td>
                  <td style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 6px", whiteSpace: "nowrap" };
