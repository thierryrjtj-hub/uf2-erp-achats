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
      const { data: bcList } = await supabase.from("commandes").select("id, numero, date, fournisseur_nom, demande_id");
      const { data: lignesBc } = await supabase.from("lignes_bc").select("*");
      const { data: receptionsList } = await supabase.from("receptions").select("bc_id, date_reception_reelle");
      const { data: demandesList } = await supabase.from("demandes").select("id, service, demandeur");
      const { data: articlesList } = await supabase.from("articles").select("designation, categorie");

      const enrichies = (lignesBc || []).map((l) => {
        const bc = (bcList || []).find((b) => b.id === l.bc_id);
        const reception = (receptionsList || []).find((r) => r.bc_id === l.bc_id);
        const dmd = bc?.demande_id ? (demandesList || []).find((d) => d.id === bc.demande_id) : null;
        const art = (articlesList || []).find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
        return {
          ...l,
          bc_numero: bc?.numero || "-",
          bc_date: bc?.date || "-",
          fournisseur_nom: bc?.fournisseur_nom || "-",
          date_reception: reception?.date_reception_reelle || null,
          service: dmd?.service || "",
          demandeur: dmd?.demandeur || "",
          categorie: art?.categorie || "",
        };
      });
      enrichies.sort((a, b) => new Date(b.bc_date) - new Date(a.bc_date));
      setLignes(enrichies);
      setLoading(false);
    })();
  }, []);

  const fournisseursDistincts = useMemo(
    () => [...new Set(lignes.map((l) => l.fournisseur_nom))].sort(),
    [lignes]
  );
  const servicesDistincts = useMemo(
    () => [...new Set(lignes.map((l) => l.service).filter(Boolean))].sort(),
    [lignes]
  );
  const categoriesDistinctes = useMemo(
    () => [...new Set(lignes.map((l) => l.categorie).filter(Boolean))].sort(),
    [lignes]
  );

  const filtrees = useMemo(() => {
    return lignes.filter((l) => {
      const okRecherche = !recherche || l.designation.toLowerCase().includes(recherche.toLowerCase()) || (l.demandeur || "").toLowerCase().includes(recherche.toLowerCase());
      const okFournisseur = !filtreFournisseur || l.fournisseur_nom === filtreFournisseur;
      const okService = !filtreService || l.service === filtreService;
      const okCategorie = !filtreCategorie || l.categorie === filtreCategorie;
      return okRecherche && okFournisseur && okService && okCategorie;
    });
  }, [lignes, recherche, filtreFournisseur, filtreService, filtreCategorie]);

  const dernierAchatParArticle = useMemo(() => {
    const map = {};
    for (const l of lignes) {
      const key = l.designation;
      if (!map[key] || new Date(l.bc_date) > new Date(map[key].bc_date)) {
        map[key] = l;
      }
    }
    return map;
  }, [lignes]);

  const exporter = async () => {
    setExporting(true);
    const rows = filtrees.map((l) => ({
      article: l.designation,
      fournisseur: l.fournisseur_nom,
      bc: l.bc_numero,
      dateBc: l.bc_date,
      recu: l.date_reception ? new Date(l.date_reception).toLocaleDateString("fr-FR") : "",
      qte: Number(l.quantite),
      unite: l.unite,
      pu: Number(l.prix_unitaire_ht) || 0,
      remise: Number(l.remise_pct) || 0,
      montant: Number(l.montant_ht) || 0,
    }));

    const totalHT = filtrees.reduce((s, l) => s + Number(l.montant_ht || 0), 0);
    const parFournisseur = {};
    filtrees.forEach((l) => { parFournisseur[l.fournisseur_nom] = (parFournisseur[l.fournisseur_nom] || 0) + Number(l.montant_ht || 0); });
    const topFournisseurs = Object.entries(parFournisseur).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const kpiRows = [
      { label: "Montant total HT", valeur: totalHT },
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
            { header: "Article", key: "article", width: 38 },
            { header: "Fournisseur", key: "fournisseur", width: 22 },
            { header: "N° BC", key: "bc", width: 18 },
            { header: "Date BC", key: "dateBc", width: 13 },
            { header: "Reçu le", key: "recu", width: 13 },
            { header: "Qté", key: "qte", width: 10 },
            { header: "Unité", key: "unite", width: 12 },
            { header: "PU HT", key: "pu", width: 14 },
            { header: "Remise %", key: "remise", width: 10 },
            { header: "Montant HT", key: "montant", width: 16 },
          ],
          rows,
          currencyKeys: ["pu", "montant"],
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

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Historique des achats</h1>

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
            {fournisseursDistincts.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)} style={inputStyle}>
            <option value="">Tous les services</option>
            {servicesDistincts.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} style={inputStyle}>
            <option value="">Toutes les catégories</option>
            {categoriesDistinctes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
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
                  <th style={thStyle}>Fournisseur</th>
                  <th style={thStyle}>N° BC</th>
                  <th style={thStyle}>Date BC</th>
                  <th style={thStyle}>Reçu le</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>PU HT</th>
                  <th style={thStyle}>Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={tdStyle}>{l.designation}</td>
                    <td style={tdStyle}>{l.fournisseur_nom}</td>
                    <td style={tdStyle}>{l.bc_numero}</td>
                    <td style={tdStyle}>{l.bc_date}</td>
                    <td style={tdStyle}>{l.date_reception ? new Date(l.date_reception).toLocaleDateString("fr-FR") : "-"}</td>
                    <td style={tdStyle}>{l.quantite} {l.unite}</td>
                    <td style={tdStyle}>{Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar</td>
                    <td style={tdStyle}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
                  </tr>
                ))}
              </tbody>
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
const tdStyle = { padding: "8px 6px" };
