"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { useRole } from "../../lib/useRole";
import { inputStyle, thStyle, tdStyle, linkBtn } from "../components/ui";

export default function CommandesPage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [receptions, setReceptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").order("created_at", { ascending: false });
    const { data: r } = await supabase.from("receptions").select("*");
    setListe(c || []);
    setReceptions(r || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const changerStatut = async (id, statut) => {
    setListe((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    await supabase.from("commandes").update({ statut }).eq("id", id);
  };

  const supprimerBc = async (c) => {
    if (!confirm(`Supprimer définitivement le bon de commande ${c.numero} ? Sa réception et son historique seront aussi supprimés.`)) return;
    await supabase.from("commandes").delete().eq("id", c.id);
    charger();
  };

  const echeanceInfo = (c) => {
    if (!c.date_facture) return null;
    const d = new Date(c.date_facture);
    d.setDate(d.getDate() + (c.echeance_jours || 30));
    return d;
  };

  const [exporting, setExporting] = useState(false);
  const exporter = async () => {
    setExporting(true);
    const rows = liste.map((c) => {
      const reception = receptions.find((r) => r.bc_id === c.id);
      return {
        numero: c.numero,
        date: c.date,
        fournisseur: c.fournisseur_nom,
        statut: c.statut,
        montantHt: Number(c.montant_ht) || 0,
        montantTva: Number(c.montant_tva) || 0,
        montantTtc: Number(c.montant_ttc) || 0,
        numeroFacture: c.numero_facture || "",
        dateFacture: c.date_facture || "",
        statutPaiement: c.statut_paiement || "Impayé",
        recu: reception ? new Date(reception.date_reception_reelle).toLocaleString("fr-FR") : "",
        confirmePar: reception ? reception.confirme_par : "",
      };
    });
    await exportExcel({
      filename: `bons-de-commande_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: "Bons de commande",
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
        ],
        rows,
        currencyKeys: ["montantHt", "montantTva", "montantTtc"],
      }],
    });
    setExporting(false);
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Bons de commande</h1>
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
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Liste ({liste.length})</h2>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && liste.length === 0 && (
          <p style={{ color: "#888", fontSize: 13 }}>Aucun bon de commande pour le moment — génère-en un depuis une demande (onglet Demandes &amp; TCO).</p>
        )}
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>N° BC</th>
              <th style={thStyle}>Fournisseur</th>
              <th style={thStyle}>Total TTC</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}>Réception</th>
              <th style={thStyle}>Paiement</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => {
              const reception = receptions.find((r) => r.bc_id === c.id);
              const echeance = echeanceInfo(c);
              const enRetard = echeance && c.statut_paiement !== "Payé" && new Date() > echeance;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{c.numero}</td>
                  <td style={tdStyle}>{c.fournisseur_nom}</td>
                  <td style={tdStyle}>{Number(c.montant_ttc).toLocaleString("fr-FR")} Ar</td>
                  <td style={tdStyle}>
                    <select value={c.statut} onChange={(e) => changerStatut(c.id, e.target.value)} style={inputStyle}>
                      <option>A faire</option>
                      <option>Envoyée</option>
                      <option>Livraison en cours</option>
                      <option>Clôturée</option>
                      <option>Clôturée (rupture)</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {reception ? (
                      <span style={{ fontSize: 12, color: reception.statut === "Totale" ? "#1B7A4C" : "#8A6100" }}>
                        {reception.statut === "Totale" ? "Livré" : "Livré partiellement"}<br />
                        <span style={{ color: "#999" }}>par {reception.receptionnaire || reception.confirme_par}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#999" }}>Non livré</span>
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
                  <td style={tdStyle}>
                    <Link href={`/commandes/${c.id}`} style={linkBtn}>Voir / Facture</Link>
                    <button onClick={() => supprimerBc(c)} style={{ ...linkBtn, background: "none", border: "none", color: "#B3261E", cursor: "pointer", marginLeft: 10, display: role === "acheteur" ? "inline" : "none" }}>Supprimer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </AuthGuard>
  );
}

const smallBtn = { padding: "5px 10px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer" };
