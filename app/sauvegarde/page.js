"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { buttonStyle } from "../components/ui";
import { useLangue } from "../../lib/i18n";

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
  const { t } = useLangue();
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
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>{t("sauv_titre")}</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>{t("sauv_aide")}</p>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 24 }}>
        <button onClick={lancerSauvegarde} disabled={enCours} style={buttonStyle}>
          {enCours ? t("sauv_generation") : t("sauv_btn_telecharger")}
        </button>
        {derniere && (
          <p style={{ fontSize: 12, color: "#1B7A4C", marginTop: 12 }}>
            {t("sauv_confirmation", { date: derniere.toLocaleString("fr-FR") })}
          </p>
        )}

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #eee" }}>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>{t("sauv_bon_a_savoir")}</h2>
          <p style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6 }}>{t("sauv_explication")}</p>
        </div>
      </div>
    </AuthGuard>
  );
}
