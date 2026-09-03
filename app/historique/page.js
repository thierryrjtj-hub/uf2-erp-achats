"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel, slugify } from "../../lib/exportExcel";
import Autocomplete from "../components/Autocomplete";

export default function HistoriquePage() {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: bcList } = await supabase.from("commandes").select("id, numero, date, fournisseur_nom, demande_id, assujetti_tva, montant_ttc, statut, date_signature, observation");
      const { data: lignesBc } = await supabase.from("lignes_bc").select("*");
      const { data: receptionsList } = await supabase.from("receptions").select("id, bc_id, date_reception_reelle, receptionnaire");
      const { data: lignesReceptionList } = await supabase.from("lignes_reception").select("reception_id, ligne_bc_id, quantite_livree");
      const { data: demandesList } = await supabase.from("demandes").select("id, service, demandeur, motif_projet, statut, created_at");
      const { data: lignesDemandeList } = await supabase.from("lignes_demande").select("id, demande_id, designation, quantite, unite");
      const { data: articlesList } = await supabase.from("articles").select("designation, categorie");

      // ---- Lignes déjà passées en BC ----
      const rowsBc = (lignesBc || []).map((l) => {
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
          id: `bc-${l.id}`,
          date_da: dmd?.created_at ? dmd.created_at.slice(0, 10) : "-",
          designation: l.designation, quantite: l.quantite, unite: l.unite,
          fournisseur_nom: bc?.fournisseur_nom || "-",
          bc_numero: bc?.numero || "-", bc_date: bc?.date || "-",
          date_signature: bc?.date_signature || "-",
          date_reception: derniereReception?.date_reception_reelle ? derniereReception.date_reception_reelle.slice(0, 10) : "-",
          receptionnaire: derniereReception?.receptionnaire || "-",
          categorie: art?.categorie || "", demandeur: dmd?.demandeur || "", service: dmd?.service || "", usage_projet: dmd?.motif_projet || "",
          demande_cloturee: dmd ? (dmd.statut === "Basculée en commande" ? "Oui" : "Non") : "-",
          prix_unitaire_ht: l.prix_unitaire_ht, remise_pct: l.remise_pct, montant_ht: montantHt, montant_ttc: montantTtc,
          bc_total_ttc: Number(bc?.montant_ttc) || 0, etat_livraison: etatLivraison,
          statut: bc?.statut || "-", observation: bc?.observation || "",
          date_tri: bc?.date || (dmd?.created_at ? dmd.created_at.slice(0, 10) : ""),
        };
      });

      // ---- Lignes de demande pas encore passées en BC (en attente) ----
      const ligneDemandeCouvertes = new Set((lignesBc || []).map((l) => l.ligne_demande_id).filter(Boolean));
      const rowsAttente = (lignesDemandeList || [])
        .filter((ld) => !ligneDemandeCouvertes.has(ld.id))
        .map((ld) => {
          const dmd = (demandesList || []).find((d) => d.id === ld.demande_id);
          const art = (articlesList || []).find((a) => a.designation.toLowerCase() === ld.designation.toLowerCase());
          return {
            id: `pending-${ld.id}`,
            date_da: dmd?.created_at ? dmd.created_at.slice(0, 10) : "-",
            designation: ld.designation, quantite: ld.quantite, unite: ld.unite,
            fournisseur_nom: "-", bc_numero: "-", bc_date: "-", date_signature: "-", date_reception: "-", receptionnaire: "-",
            categorie: art?.categorie || "", demandeur: dmd?.demandeur || "", service: dmd?.service || "", usage_projet: dmd?.motif_projet || "",
            demande_cloturee: dmd ? (dmd.statut === "Basculée en commande" ? "Oui" : "Non") : "-",
            prix_unitaire_ht: null, remise_pct: null, montant_ht: 0, montant_ttc: 0, bc_total_ttc: 0, etat_livraison: "-",
            statut: dmd?.statut === "Partiellement traitée" ? "Partiellement traitée" : "A faire",
            observation: dmd?.statut === "Partiellement traitée" ? "Reste à traiter — devis en cours" : "En attente de devis / TCO",
            date_tri: dmd?.created_at ? dmd.created_at.slice(0, 10) : "",
          };
        });

      const toutes = [...rowsBc, ...rowsAttente].sort((a, b) => new Date(b.date_tri) - new Date(a.date_tri));
      setLignes(toutes);
      setLoading(false);
    })();
  }, []);

  // Suggestions combinées de toutes les colonnes textuelles, pour la barre de recherche unique
  const suggestionsRecherche = useMemo(() => {
    const s = new Set();
    lignes.forEach((l) => {
      [l.designation, l.fournisseur_nom, l.service, l.demandeur, l.usage_projet, l.categorie, l.bc_numero, l.statut, l.receptionnaire]
        .forEach((v) => { if (v && v !== "-") s.add(v); });
    });
    return [...s].sort();
  }, [lignes]);

  const CHAMPS_RECHERCHABLES = ["designation", "fournisseur_nom", "service", "demandeur", "usage_projet", "categorie", "bc_numero", "statut", "observation", "receptionnaire"];

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      const okRecherche = !q || CHAMPS_RECHERCHABLES.some((champ) => (l[champ] || "").toString().toLowerCase().includes(q));
      const okDebut = !dateDebut || (l.date_tri && l.date_tri >= dateDebut);
      const okFin = !dateFin || (l.date_tri && l.date_tri <= dateFin);
      return okRecherche && okDebut && okFin;
    });
  }, [lignes, recherche, dateDebut, dateFin]);

  const totauxFiltres = useMemo(() => {
    return filtrees.reduce((acc, l) => ({ ht: acc.ht + (Number(l.montant_ht) || 0), ttc: acc.ttc + (Number(l.montant_ttc) || 0) }), { ht: 0, ttc: 0 });
  }, [filtrees]);

  const dernierAchatParArticle = useMemo(() => {
    const map = {};
    for (const l of lignes) {
      if (l.bc_numero === "-") continue;
      const key = l.designation;
      if (!map[key] || new Date(l.bc_date) > new Date(map[key].bc_date)) map[key] = l;
    }
    return map;
  }, [lignes]);

  const exporter = async () => {
    setExporting(true);
    const rows = filtrees.map((l) => ({
      dateDa: l.date_da, article: l.designation, qte: Number(l.quantite), unite: l.unite,
      fournisseur: l.fournisseur_nom, bc: l.bc_numero, dateBc: l.bc_date, dateSignature: l.date_signature, dateReception: l.date_reception,
      receptionnaire: l.receptionnaire, etat: l.etat_livraison, categorie: l.categorie, service: l.service, demandeur: l.demandeur, usage: l.usage_projet,
      pu: l.prix_unitaire_ht != null ? Number(l.prix_unitaire_ht) : "", remise: l.remise_pct != null ? Number(l.remise_pct) : "",
      montantHt: Number(l.montant_ht) || 0, montantTtc: Number(l.montant_ttc) || 0, totalBc: Number(l.bc_total_ttc) || 0,
      statut: l.statut, observation: l.observation,
    }));

    const kpiRows = [
      { label: "Montant total HT (filtré)", valeur: totauxFiltres.ht },
      { label: "Montant total TTC (filtré)", valeur: totauxFiltres.ttc },
      { label: "Nombre de lignes affichées", valeur: filtrees.length },
    ];

    const parts = [];
    if (recherche) parts.push(slugify(recherche));
    const slug = parts.length ? parts.join("_") : "tous-achats";

    await exportExcel({
      filename: `historique_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [
        {
          name: "Historique",
          columns: [
            { header: "Date DA", key: "dateDa", width: 12 }, { header: "Article", key: "article", width: 34 },
            { header: "Qté", key: "qte", width: 8 }, { header: "Unité", key: "unite", width: 10 },
            { header: "Fournisseur", key: "fournisseur", width: 20 }, { header: "N° BC", key: "bc", width: 16 },
            { header: "Date BC (création)", key: "dateBc", width: 14 }, { header: "Date signature (envoi commande)", key: "dateSignature", width: 16 },
            { header: "Date réception livraison", key: "dateReception", width: 15 }, { header: "Réceptionnaire", key: "receptionnaire", width: 15 },
            { header: "État livraison", key: "etat", width: 14 }, { header: "Catégorie", key: "categorie", width: 20 },
            { header: "Service demandeur", key: "service", width: 16 }, { header: "Demandeur", key: "demandeur", width: 16 },
            { header: "Usage / Projet", key: "usage", width: 22 }, { header: "PU HT", key: "pu", width: 12 },
            { header: "Remise %", key: "remise", width: 9 }, { header: "Montant HT", key: "montantHt", width: 14 },
            { header: "Montant TTC", key: "montantTtc", width: 14 }, { header: "Total BC (TTC)", key: "totalBc", width: 14 },
            { header: "Statut", key: "statut", width: 16 }, { header: "Observation", key: "observation", width: 26 },
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
          <Autocomplete
            placeholder="Rechercher — article, fournisseur, service, demandeur, catégorie, usage/projet, N° BC, statut..."
            value={recherche}
            onChange={setRecherche}
            suggestions={suggestionsRecherche}
            style={{ flex: 1, minWidth: 320 }}
          />
          <label style={{ fontSize: 12, color: "#666" }}>Du</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 12, color: "#666" }}>au</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={inputStyle} />
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
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucun achat enregistré pour le moment.</p>}

        {filtrees.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date DA</th>
                  <th style={thStyle}>Article</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>Unité</th>
                  <th style={thStyle}>Fournisseur</th>
                  <th style={thStyle}>N° BC</th>
                  <th style={thStyle}>Date BC (création)</th>
                  <th style={thStyle}>Date signature (envoi commande)</th>
                  <th style={thStyle}>Date réception livraison</th>
                  <th style={thStyle}>Réceptionnaire</th>
                  <th style={thStyle}>État livraison</th>
                  <th style={thStyle}>Catégorie</th>
                  <th style={thStyle}>Service demandeur</th>
                  <th style={thStyle}>Demandeur</th>
                  <th style={thStyle}>Usage / Projet</th>
                  <th style={thStyle}>PU HT</th>
                  <th style={thStyle}>Remise</th>
                  <th style={thStyle}>Montant HT</th>
                  <th style={thStyle}>Montant TTC</th>
                  <th style={thStyle}>Total BC (TTC)</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Observation</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={tdStyle}>{l.date_da}</td>
                    <td style={tdStyle}>{l.designation}</td>
                    <td style={tdStyle}>{l.quantite} {l.unite}</td>
                    <td style={tdStyle}>{l.unite}</td>
                    <td style={tdStyle}>{l.fournisseur_nom}</td>
                    <td style={tdStyle}>{l.bc_numero}</td>
                    <td style={tdStyle}>{l.bc_date}</td>
                    <td style={tdStyle}>{l.date_signature}</td>
                    <td style={tdStyle}>{l.date_reception}</td>
                    <td style={tdStyle}>{l.receptionnaire}</td>
                    <td style={tdStyle}>{l.etat_livraison !== "-" ? <span style={badgeEtat(l.etat_livraison)}>{l.etat_livraison}</span> : "-"}</td>
                    <td style={tdStyle}>{l.categorie || "-"}</td>
                    <td style={tdStyle}>{l.service || "-"}</td>
                    <td style={tdStyle}>{l.demandeur || "-"}</td>
                    <td style={tdStyle}>{l.usage_projet || "-"}</td>
                    <td style={tdStyle}>{l.prix_unitaire_ht != null ? `${Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar` : "-"}</td>
                    <td style={tdStyle}>{l.remise_pct != null ? `${l.remise_pct}%` : "-"}</td>
                    <td style={tdStyle}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
                    <td style={tdStyle}>{Number(l.montant_ttc).toLocaleString("fr-FR")} Ar</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{l.bc_total_ttc ? `${Number(l.bc_total_ttc).toLocaleString("fr-FR")} Ar` : "-"}</td>
                    <td style={tdStyle}>{l.statut}</td>
                    <td style={tdStyle}>{l.observation}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #ddd" }}>
                  <td colSpan={17} style={{ ...tdStyle, fontWeight: 700 }}>Total ({filtrees.length} ligne{filtrees.length > 1 ? "s" : ""} affichée{filtrees.length > 1 ? "s" : ""})</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ht.toLocaleString("fr-FR")} Ar</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ttc.toLocaleString("fr-FR")} Ar</td>
                  <td colSpan={3} style={tdStyle}></td>
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
