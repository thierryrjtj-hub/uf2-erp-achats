"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";

export default function CommandeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [bc, setBc] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [reception, setReception] = useState(null);
  const [loading, setLoading] = useState(true);
  const [facture, setFacture] = useState({ numero_facture: "", date_facture: "", echeance_jours: 30, statut_paiement: "Impayé", date_paiement: "" });

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").eq("id", id).single();
    const { data: l } = await supabase.from("lignes_bc").select("*").eq("bc_id", id);
    const { data: r } = await supabase.from("receptions").select("*").eq("bc_id", id).maybeSingle();
    setBc(c);
    setLignes(l || []);
    setReception(r || null);
    if (c) {
      setFacture({
        numero_facture: c.numero_facture || "",
        date_facture: c.date_facture || "",
        echeance_jours: c.echeance_jours ?? 30,
        statut_paiement: c.statut_paiement || "Impayé",
        date_paiement: c.date_paiement || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  const confirmerReception = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "utilisateur";
    await supabase.from("receptions").insert({ bc_id: id, confirme_par: email });
    await supabase.from("commandes").update({ statut: "Clôturée" }).eq("id", id);
    charger();
  };

  const enregistrerFacture = async () => {
    await supabase.from("commandes").update({
      numero_facture: facture.numero_facture,
      date_facture: facture.date_facture || null,
      echeance_jours: Number(facture.echeance_jours) || 30,
      statut_paiement: facture.statut_paiement,
      date_paiement: facture.statut_paiement === "Payé" ? (facture.date_paiement || new Date().toISOString().slice(0, 10)) : null,
    }).eq("id", id);
    charger();
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!bc) return <AuthGuard><p>Bon de commande introuvable.</p></AuthGuard>;

  return (
    <AuthGuard>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux commandes</button>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24 }} className="print-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>UNIFOODS — Bon de commande</h1>
            <p style={{ fontSize: 14, color: "#666" }}>{bc.numero} — {bc.date}</p>
          </div>
          <button onClick={() => window.print()} style={buttonStyle} className="no-print">Imprimer</button>
        </div>

        <p style={{ fontSize: 14, marginBottom: 16 }}><strong>Fournisseur :</strong> {bc.fournisseur_nom}</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté</th>
              <th style={thStyle}>Unité</th>
              <th style={thStyle}>PU HT</th>
              <th style={thStyle}>Remise</th>
              <th style={thStyle}>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td style={tdStyle}>{l.designation}</td>
                <td style={tdStyle}>{l.quantite}</td>
                <td style={tdStyle}>{l.unite}</td>
                <td style={tdStyle}>{Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar</td>
                <td style={tdStyle}>{l.remise_pct} %</td>
                <td style={tdStyle}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: "auto", width: 260 }}>
          <div style={rowTotal}><span>Total HT</span><span>{Number(bc.montant_ht).toLocaleString("fr-FR")} Ar</span></div>
          <div style={rowTotal}>
            <span>TVA</span>
            <span>{bc.assujetti_tva === false ? "Non taxable" : `${Number(bc.montant_tva).toLocaleString("fr-FR")} Ar`}</span>
          </div>
          <div style={{ ...rowTotal, fontWeight: 700, borderTop: "1px solid #ddd", paddingTop: 6 }}>
            <span>Total TTC</span><span>{Number(bc.montant_ttc).toLocaleString("fr-FR")} Ar</span>
          </div>
        </div>

        <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <div>Établi par : ____________________</div>
          <div>Signature Direction : ____________________</div>
        </div>
      </div>

      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Réception</h2>
        {reception ? (
          <p style={{ fontSize: 13, color: "#1B7A4C" }}>
            Marchandise reçue le <strong>{new Date(reception.date_reception_reelle).toLocaleString("fr-FR")}</strong>, confirmé par {reception.confirme_par}.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
              À faire confirmer par le magasin au moment réel de l'arrivée de la marchandise — la date et l'heure s'enregistrent automatiquement à cet instant.
            </p>
            <button onClick={confirmerReception} style={buttonStyle}>Marquer comme reçu maintenant</button>
          </div>
        )}
      </div>

      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Facture et paiement</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input placeholder="N° de facture" value={facture.numero_facture} onChange={(e) => setFacture({ ...facture, numero_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="date" value={facture.date_facture} onChange={(e) => setFacture({ ...facture, date_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Échéance (jours)" value={facture.echeance_jours} onChange={(e) => setFacture({ ...facture, echeance_jours: e.target.value })} style={{ ...inputStyle, width: 150 }} />
          <select value={facture.statut_paiement} onChange={(e) => setFacture({ ...facture, statut_paiement: e.target.value })} style={inputStyle}>
            <option>Impayé</option>
            <option>Payé</option>
          </select>
        </div>
        <button onClick={enregistrerFacture} style={buttonStyle}>Enregistrer</button>
      </div>
    </AuthGuard>
  );
}

const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee" };
const tdStyle = { padding: "8px 6px", borderBottom: "1px solid #f5f5f5" };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const rowTotal = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 };
const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
