"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel, slugify } from "../../lib/exportExcel";
import { formatDate } from "../../lib/format";
import Autocomplete from "../components/Autocomplete";
import { inputStyle, buttonStyle } from "../components/ui";

export default function HistoriquePage() {
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [ligneSelectionnee, setLigneSelectionnee] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: bcList } = await supabase.from("commandes").select("id, numero, date, fournisseur_nom, demande_id, assujetti_tva, montant_ttc, statut, date_signature, observation").limit(10000);
      const { data: lignesBc } = await supabase.from("lignes_bc").select("*").limit(10000);
      const { data: receptionsList } = await supabase.from("receptions").select("id, bc_id, date_reception_reelle, receptionnaire").limit(10000);
      const { data: lignesReceptionList } = await supabase.from("lignes_reception").select("reception_id, ligne_bc_id, quantite_livree").limit(10000);
      const { data: demandesList } = await supabase.from("demandes").select("id, service, demandeur, motif_projet, statut, created_at").limit(10000);
      const { data: lignesDemandeList } = await supabase.from("lignes_demande").select("id, demande_id, designation, quantite, unite").limit(10000);
      const { data: articlesList } = await supabase.from("articles").select("designation, categorie").limit(10000);

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
    const actives = filtrees.filter((l) => l.statut !== "Annulée");
    const base = actives.reduce((acc, l) => ({ ht: acc.ht + (Number(l.montant_ht) || 0), ttc: acc.ttc + (Number(l.montant_ttc) || 0) }), { ht: 0, ttc: 0 });
    // Le total "par BC" ne doit compter qu'une seule fois chaque BC (sinon un BC à plusieurs lignes serait compté plusieurs fois)
    const bcVus = new Set();
    let totalBc = 0;
    actives.forEach((l) => {
      if (l.bc_numero !== "-" && !bcVus.has(l.bc_numero)) {
        bcVus.add(l.bc_numero);
        totalBc += Number(l.bc_total_ttc) || 0;
      }
    });
    return { ...base, totalBc };
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

  // Couleur de la ligne entière selon le statut, pour un repérage visuel rapide
  const couleurLigne = (l) => {
    if (l.statut === "Annulée") return "#B0AEA6";
    if (l.statut && l.statut.startsWith("Clôturée (rupture)")) return "#B3261E";
    if (l.etat_livraison === "Livré") return "#1B7A4C";
    if (l.etat_livraison === "Livré partiellement") return "#8A6100";
    if (l.statut === "A faire" || l.statut === "Partiellement traitée") return "#4A5A72";
    return "#242322";
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 10, flexShrink: 0 }}>Historique des achats — situation globale</h1>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
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
            <div style={{ background: "#F5F4F1", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, flexShrink: 0 }}>
              <strong>Dernier achat de "{filtrees[0].designation}"</strong> : {Number(dernierAchatParArticle[filtrees[0].designation].prix_unitaire_ht).toLocaleString("fr-FR")} Ar
              chez {dernierAchatParArticle[filtrees[0].designation].fournisseur_nom}, le {formatDate(dernierAchatParArticle[filtrees[0].designation].bc_date)}
            </div>
          )}

          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
          {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucun achat enregistré pour le moment.</p>}

          {filtrees.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 80 }} /><col style={{ width: 230 }} /><col style={{ width: 80 }} /><col style={{ width: 60 }} />
                  <col style={{ width: 170 }} /><col style={{ width: 140 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} />
                  <col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 100 }} /><col style={{ width: 120 }} />
                  <col style={{ width: 110 }} /><col style={{ width: 100 }} /><col style={{ width: 210 }} /><col style={{ width: 90 }} />
                  <col style={{ width: 70 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
                  <col style={{ width: 100 }} /><col style={{ width: 150 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thStyle}>Date DA</th>
                    <th style={thStyle}>Article</th>
                    <th style={thStyle}>Qté</th>
                    <th style={thStyle}>Unité</th>
                    <th style={thStyle}>Fournisseur</th>
                    <th style={thStyle}>N° BC</th>
                    <th style={thStyle}>Date BC</th>
                    <th style={thStyle}>Date signature</th>
                    <th style={thStyle}>Date réception</th>
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
                    <tr
                      key={l.id}
                      onClick={() => setLigneSelectionnee((prev) => (prev === l.id ? null : l.id))}
                      style={{
                        borderBottom: "1px solid #f0f0f0", color: couleurLigne(l), cursor: "pointer",
                        textDecoration: l.statut === "Annulée" ? "line-through" : "none",
                        ...(ligneSelectionnee === l.id ? { background: "#EFEEE9" } : {}),
                      }}
                    >
                      <td style={tdStyle}>{formatDate(l.date_da) || "-"}</td>
                      <td style={tdStyle}>{l.designation}</td>
                      <td style={tdStyle}>{l.quantite}</td>
                      <td style={tdStyle}>{l.unite}</td>
                      <td style={tdStyle}>{l.fournisseur_nom}</td>
                      <td style={tdStyle}>{l.bc_numero}</td>
                      <td style={tdStyle}>{formatDate(l.bc_date) || "-"}</td>
                      <td style={tdStyle}>{formatDate(l.date_signature) || "-"}</td>
                      <td style={tdStyle}>{formatDate(l.date_reception) || "-"}</td>
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
                    <td colSpan={17} style={{ ...tdStyle, fontWeight: 700 }}>Total ({filtrees.length})</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ht.toLocaleString("fr-FR")} Ar</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.ttc.toLocaleString("fr-FR")} Ar</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{totauxFiltres.totalBc.toLocaleString("fr-FR")} Ar</td>
                    <td colSpan={2} style={tdStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

const sousOnglet = { fontSize: 13, padding: "6px 14px", borderRadius: 8, color: "#888", textDecoration: "none", background: "transparent" };
const sousOngletActif = { fontSize: 13, padding: "6px 14px", borderRadius: 8, color: "#1B2430", fontWeight: 600, background: "#fff" };
const thStyle = { textAlign: "left", padding: "9px 10px", color: "#8A8F98", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid #ECEBE6", background: "#FAFAF8", whiteSpace: "normal", lineHeight: 1.3, position: "sticky", top: 0, zIndex: 1, verticalAlign: "bottom" };
const tdStyle = { padding: "8px 10px", whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word", verticalAlign: "top" };
