"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

export default function CommandesPage() {
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

  const confirmerReception = async (bcId) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "utilisateur";
    await supabase.from("receptions").insert({ bc_id: bcId, confirme_par: email });
    await supabase.from("commandes").update({ statut: "Clôturée" }).eq("id", bcId);
    charger();
  };

  const echeanceInfo = (c) => {
    if (!c.date_facture) return null;
    const d = new Date(c.date_facture);
    d.setDate(d.getDate() + (c.echeance_jours || 30));
    return d;
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Bons de commande</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Liste ({liste.length})</h2>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && liste.length === 0 && (
          <p style={{ color: "#888", fontSize: 13 }}>Aucun bon de commande pour le moment — génère-en un depuis une demande (onglet Demandes &amp; TCO).</p>
        )}
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
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {reception ? (
                      <span style={{ fontSize: 12, color: "#1B7A4C" }}>
                        Reçu le {new Date(reception.date_reception_reelle).toLocaleString("fr-FR")}<br />
                        <span style={{ color: "#999" }}>par {reception.confirme_par}</span>
                      </span>
                    ) : (
                      <button onClick={() => confirmerReception(c.id)} style={smallBtn}>Marquer reçu maintenant</button>
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AuthGuard>
  );
}

const inputStyle = { padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const smallBtn = { padding: "5px 10px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer" };
const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee" };
const tdStyle = { padding: "8px 6px" };
const linkBtn = { color: "#1B2430", fontSize: 13, textDecoration: "underline" };
