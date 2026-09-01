"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

export default function HistoriquePage() {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreFournisseur, setFiltreFournisseur] = useState("");

  useEffect(() => {
    (async () => {
      const { data: bcList } = await supabase.from("commandes").select("id, numero, date, fournisseur_nom");
      const { data: lignesBc } = await supabase.from("lignes_bc").select("*");
      const { data: receptionsList } = await supabase.from("receptions").select("bc_id, date_reception_reelle");

      const enrichies = (lignesBc || []).map((l) => {
        const bc = (bcList || []).find((b) => b.id === l.bc_id);
        const reception = (receptionsList || []).find((r) => r.bc_id === l.bc_id);
        return {
          ...l,
          bc_numero: bc?.numero || "-",
          bc_date: bc?.date || "-",
          fournisseur_nom: bc?.fournisseur_nom || "-",
          date_reception: reception?.date_reception_reelle || null,
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

  const filtrees = useMemo(() => {
    return lignes.filter((l) => {
      const okRecherche = !recherche || l.designation.toLowerCase().includes(recherche.toLowerCase());
      const okFournisseur = !filtreFournisseur || l.fournisseur_nom === filtreFournisseur;
      return okRecherche && okFournisseur;
    });
  }, [lignes, recherche, filtreFournisseur]);

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

  const exporterCSV = () => {
    const header = ["Article", "Fournisseur", "N° BC", "Date BC", "Date réception", "Qté", "Unité", "PU HT", "Remise %", "Montant HT"];
    const rows = filtrees.map((l) => [
      l.designation, l.fournisseur_nom, l.bc_numero, l.bc_date,
      l.date_reception ? new Date(l.date_reception).toLocaleDateString("fr-FR") : "",
      l.quantite, l.unite, l.prix_unitaire_ht, l.remise_pct, l.montant_ht,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v ?? ""}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historique-achats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Historique des achats</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Rechercher un article..."
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
          <button onClick={exporterCSV} style={buttonStyle}>Exporter en CSV</button>
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

