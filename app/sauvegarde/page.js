"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { buttonStyle } from "../components/ui";

export const dynamic = "force-dynamic";

const TABLES = [
  { table: "fournisseurs", nom: "Fournisseurs" },
  { table: "articles", nom: "Articles" },
  { table: "demandes", nom: "Demandes" },
  { table: "lignes_demande", nom: "Lignes demande" },
  { table: "offres", nom: "Offres TCO" },
  { table: "lignes_offre", nom: "Lignes offre" },
  { table: "commandes", nom: "Commandes (BC)" },
  { table: "lignes_bc", nom: "Lignes BC" },
  { table: "receptions", nom: "Receptions" },
  { table: "lignes_reception", nom: "Lignes reception" },
  { table: "accuses_reception_facture", nom: "Accuses facture" },
];

// Transforme un tableau de lignes brutes Supabase en colonnes/lignes exploitables par exportExcel,
// sans mise en forme particulière (c'est une sauvegarde technique, pas un rapport à lire).
function versFeuille(nom, rows) {
  if (!rows || rows.length === 0) {
    return { name: nom, columns: [{ header: "Aucune donnée", key: "vide", width: 20 }], rows: [] };
  }
  const cles = Object.keys(rows[0]);
  const columns = cles.map((c) => ({ header: c, key: c, width: c.length > 14 ? 22 : 15 }));
  const propres = rows.map((r) => {
    const o = {};
    cles.forEach((c) => {
      const v = r[c];
      o[c] = v && typeof v === "object" ? JSON.stringify(v) : v;
    });
    return o;
  });
  return { name: nom, columns, rows: propres };
}

export default function SauvegardePage() {
  const [enCours, setEnCours] = useState(false);
  const [derniere, setDerniere] = useState(null);

  const lancerSauvegarde = async () => {
    setEnCours(true);
    const sheets = [];
    for (const t of TABLES) {
      const { data } = await supabase.from(t.table).select("*").limit(20000);
      sheets.push(versFeuille(t.nom, data || []));
    }
    await exportExcel({
      filename: `sauvegarde_UF2_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
    });
    setDerniere(new Date());
    setEnCours(false);
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Sauvegarde des données</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Génère un classeur Excel complet avec toutes tes données (fournisseurs, articles, demandes, BC, réceptions, factures).
        À faire régulièrement (par exemple toutes les semaines), et à garder à deux endroits : sur ton ordinateur et dans un cloud (OneDrive, Google Drive...).
      </p>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 24 }}>
        <button onClick={lancerSauvegarde} disabled={enCours} style={buttonStyle}>
          {enCours ? "Génération en cours..." : "Télécharger une sauvegarde complète maintenant"}
        </button>
        {derniere && (
          <p style={{ fontSize: 12, color: "#1B7A4C", marginTop: 12 }}>
            ✓ Sauvegarde générée le {derniere.toLocaleString("fr-FR")} — pense à la déplacer dans ton dossier de sauvegarde habituel.
          </p>
        )}

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #eee" }}>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>Bon à savoir</h2>
          <p style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6 }}>
            Le forfait gratuit de Supabase (celui utilisé pour cette appli) ne propose pas de sauvegarde automatique —
            c'est officiellement indiqué par Supabase eux-mêmes. Cette page comble ce manque, mais ça reste à toi de cliquer régulièrement.
            Si un jour tu veux une sauvegarde automatique quotidienne gérée par Supabase directement, ça existe à partir de leur
            forfait payant (environ 25$/mois) — à voir si ça vaut le coup selon la taille de l'appli à ce moment-là.
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}
