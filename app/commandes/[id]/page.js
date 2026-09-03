"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";

const RECEPTIONNAIRES = ["Magasin", "Direction", "Site travaux", "Prestataire", "Autre"];
const TYPES_LIVRAISON = ["Livraison fournisseur", "Enlèvement par nos soins"];

export default function CommandeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [bc, setBc] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [demande, setDemande] = useState(null);
  const [fournisseurDetail, setFournisseurDetail] = useState(null);
  const [reception, setReception] = useState(null);
  const [lignesReception, setLignesReception] = useState({}); // ligne_bc_id -> { quantite_livree, remarque }
  const [loading, setLoading] = useState(true);
  const [facture, setFacture] = useState({ numero_facture: "", date_facture: "", echeance_jours: 30, statut_paiement: "Impayé", date_paiement: "" });

  const [receptionnaire, setReceptionnaire] = useState("Magasin");
  const [receptionnaireAutre, setReceptionnaireAutre] = useState("");
  const [numeroBl, setNumeroBl] = useState("");
  const [typeLivraison, setTypeLivraison] = useState("Livraison fournisseur");
  const [dateLivraisonTerrain, setDateLivraisonTerrain] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [modeImpression, setModeImpression] = useState("bc");

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").eq("id", id).single();
    const { data: l } = await supabase.from("lignes_bc").select("*").eq("bc_id", id);
    const { data: r } = await supabase.from("receptions").select("*").eq("bc_id", id).maybeSingle();
    setBc(c);
    setLignes(l || []);
    setReception(r || null);

    if (c?.demande_id) {
      const { data: d } = await supabase.from("demandes").select("*").eq("id", c.demande_id).maybeSingle();
      setDemande(d || null);
    } else {
      setDemande(null);
    }
    if (c?.fournisseur_id) {
      const { data: f } = await supabase.from("fournisseurs").select("*").eq("id", c.fournisseur_id).maybeSingle();
      setFournisseurDetail(f || null);
    }

    const map = {};
    (l || []).forEach((ligne) => { map[ligne.id] = { quantite_livree: "", remarque: "" }; });
    if (r) {
      const { data: lr } = await supabase.from("lignes_reception").select("*").eq("reception_id", r.id);
      (lr || []).forEach((row) => {
        map[row.ligne_bc_id] = { quantite_livree: row.quantite_livree ?? "", remarque: row.remarque || "" };
      });
      setReceptionnaire(RECEPTIONNAIRES.includes(r.receptionnaire) ? r.receptionnaire : (r.receptionnaire ? "Autre" : "Magasin"));
      setReceptionnaireAutre(RECEPTIONNAIRES.includes(r.receptionnaire) ? "" : (r.receptionnaire || ""));
      setNumeroBl(r.numero_bl || "");
      setTypeLivraison(r.type_livraison || "Livraison fournisseur");
      setDateLivraisonTerrain(r.date_livraison_terrain || "");
    }
    setLignesReception(map);

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

  const majLigneReception = (ligneBcId, field, val) => {
    setLignesReception((prev) => ({ ...prev, [ligneBcId]: { ...prev[ligneBcId], [field]: val } }));
  };

  const etatLivraison = () => {
    let touteLivree = true, uneLivree = false;
    lignes.forEach((l) => {
      const q = Number(lignesReception[l.id]?.quantite_livree);
      if (!isNaN(q) && q > 0) uneLivree = true;
      if (isNaN(q) || q < Number(l.quantite)) touteLivree = false;
    });
    if (touteLivree && uneLivree) return "Livré";
    if (uneLivree) return "Livré partiellement";
    return "Non livré";
  };

  const enregistrerReception = async () => {
    setEnregistrement(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "utilisateur";
    const receptionnaireFinal = receptionnaire === "Autre" ? receptionnaireAutre : receptionnaire;
    const statut = etatLivraison() === "Livré" ? "Totale" : "Partielle";

    let receptionId = reception?.id;
    if (receptionId) {
      await supabase.from("receptions").update({
        receptionnaire: receptionnaireFinal, numero_bl: numeroBl, type_livraison: typeLivraison,
        date_livraison_terrain: dateLivraisonTerrain || null, confirme_par: email, statut,
      }).eq("id", receptionId);
      await supabase.from("lignes_reception").delete().eq("reception_id", receptionId);
    } else {
      const { data: nouvelle } = await supabase.from("receptions").insert({
        bc_id: id, receptionnaire: receptionnaireFinal, numero_bl: numeroBl, type_livraison: typeLivraison,
        date_livraison_terrain: dateLivraisonTerrain || null, confirme_par: email, statut,
      }).select().single();
      receptionId = nouvelle?.id;
    }

    if (receptionId) {
      const payload = lignes
        .filter((l) => lignesReception[l.id]?.quantite_livree !== "")
        .map((l) => ({
          reception_id: receptionId, ligne_bc_id: l.id,
          quantite_livree: Number(lignesReception[l.id].quantite_livree) || 0,
          remarque: lignesReception[l.id].remarque || "",
        }));
      if (payload.length) await supabase.from("lignes_reception").insert(payload);
    }

    await supabase.from("commandes").update({ statut: etatLivraison() === "Livré" ? "Clôturée" : "Livraison en cours" }).eq("id", id);
    setEnregistrement(false);
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
        .pv-template { display: none; }
        @media print {
          .pv-template.print-area { display: block; }
        }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux commandes</button>

      {/* ---- Bon de commande ---- */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20 }} className={modeImpression === "bc" ? "print-area" : "no-print"}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>UNIFOODS — Bon de commande</h1>
            <p style={{ fontSize: 14, color: "#666" }}>{bc.numero} — {bc.date}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }} className="no-print">
            <button onClick={() => { setModeImpression("bc"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888" }}>Imprimer le BC</button>
          </div>
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

      {/* ---- Réception ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15 }}>Réception</h2>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: etatLivraison() === "Livré" ? "#EAF7EE" : etatLivraison() === "Livré partiellement" ? "#FFF3D6" : "#F0EFEA", color: etatLivraison() === "Livré" ? "#1B7A4C" : etatLivraison() === "Livré partiellement" ? "#8A6100" : "#888" }}>
            {etatLivraison()}
          </span>
        </div>

        <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
          Imprime le PV à l'avance pour le donner au magasin (quantités vierges), ou saisis directement les quantités reçues ci-dessous.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select value={receptionnaire} onChange={(e) => setReceptionnaire(e.target.value)} style={inputStyle}>
            {RECEPTIONNAIRES.map((r) => <option key={r}>{r}</option>)}
          </select>
          {receptionnaire === "Autre" && (
            <input placeholder="Préciser le réceptionnaire" value={receptionnaireAutre} onChange={(e) => setReceptionnaireAutre(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          )}
          <select value={typeLivraison} onChange={(e) => setTypeLivraison(e.target.value)} style={inputStyle}>
            {TYPES_LIVRAISON.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="N° de Bon de Livraison (BL)" value={numeroBl} onChange={(e) => setNumeroBl(e.target.value)} style={{ ...inputStyle, width: 180 }} />
          <input type="date" placeholder="Date de livraison" value={dateLivraisonTerrain} onChange={(e) => setDateLivraisonTerrain(e.target.value)} style={inputStyle} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté commandée</th>
              <th style={thStyle}>Qté livrée</th>
              <th style={thStyle}>Reste à livrer</th>
              <th style={thStyle}>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const q = lignesReception[l.id]?.quantite_livree ?? "";
              const reste = q !== "" ? Math.max(0, Number(l.quantite) - Number(q)) : "";
              return (
                <tr key={l.id}>
                  <td style={tdStyle}>{l.designation}</td>
                  <td style={tdStyle}>{l.quantite} {l.unite}</td>
                  <td style={tdStyle}>
                    <input type="number" min="0" value={q} onChange={(e) => majLigneReception(l.id, "quantite_livree", e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="0" />
                  </td>
                  <td style={tdStyle}>{reste !== "" ? `${reste} ${l.unite}` : "-"}</td>
                  <td style={tdStyle}>
                    <input value={lignesReception[l.id]?.remarque || ""} onChange={(e) => majLigneReception(l.id, "remarque", e.target.value)} style={{ ...inputStyle, width: "100%" }} placeholder="ex: article manquant" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {reception && (
          <p style={{ fontSize: 12, color: "#1B7A4C", marginBottom: 12 }}>
            Dernier enregistrement le {new Date(reception.date_reception_reelle).toLocaleString("fr-FR")} par {reception.confirme_par}.
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setModeImpression("pv"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888" }}>Imprimer le PV de réception</button>
          <button onClick={enregistrerReception} disabled={enregistrement} style={buttonStyle}>
            {enregistrement ? "Enregistrement..." : "Enregistrer la réception"}
          </button>
        </div>
      </div>

      {/* ---- Facture / paiement ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
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

      {/* ---- PV de réception (imprimable) ---- */}
      <div className={`pv-template ${modeImpression === "pv" ? "print-area" : ""}`} style={{ padding: 20 }}>
        <h1 style={{ fontSize: 18 }}>UNIFOODS — PV de Réception</h1>
        <p style={{ fontSize: 13 }}>N° {bc.numero.replace("BC-", "PVR-")} — Date : {new Date().toLocaleDateString("fr-FR")}</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <tbody>
            <tr><td style={pvLabel}>Fournisseur</td><td style={pvVal}>{bc.fournisseur_nom}</td>
                <td style={pvLabel}>Adresse</td><td style={pvVal}>{fournisseurDetail?.adresse || ""}</td></tr>
            <tr><td style={pvLabel}>NIF</td><td style={pvVal}>{fournisseurDetail?.nif || ""}</td>
                <td style={pvLabel}>STAT</td><td style={pvVal}>{fournisseurDetail?.stat || ""}</td></tr>
            <tr><td style={pvLabel}>Contact</td><td style={pvVal}>{fournisseurDetail?.contact || ""}</td>
                <td style={pvLabel}>Tél</td><td style={pvVal}>{fournisseurDetail?.telephone || ""}</td></tr>
            <tr><td style={pvLabel}>N° BC UF2</td><td style={pvVal}>{bc.numero}</td>
                <td style={pvLabel}>Demande liée</td><td style={pvVal}>{demande ? `${demande.numero} — ${demande.service}` : "BC direct"}</td></tr>
            <tr><td style={pvLabel}>Type de livraison</td><td style={pvVal}>{typeLivraison}</td>
                <td style={pvLabel}>N° BL</td><td style={pvVal}>{numeroBl}</td></tr>
            <tr><td style={pvLabel}>Date de livraison</td><td style={pvVal}>{dateLivraisonTerrain || "____________"}</td>
                <td style={pvLabel}>Nom Réceptionnaire du Magasin</td><td style={pvVal}>{receptionnaire === "Autre" ? receptionnaireAutre : (receptionnaire === "Magasin" ? "" : receptionnaire) || "____________"}</td></tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr>
              <th style={pvTh}>BC UF2 n°</th><th style={pvTh}>Description</th><th style={pvTh}>Quantité</th>
              <th style={pvTh}>Unité</th><th style={pvTh}>Quantité livré</th><th style={pvTh}>Unité</th>
              <th style={pvTh}>Reste à Livrer</th><th style={pvTh}>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const q = lignesReception[l.id]?.quantite_livree ?? "";
              const reste = q !== "" ? Math.max(0, Number(l.quantite) - Number(q)) : "";
              return (
                <tr key={l.id}>
                  <td style={pvTd}>{i === 0 ? bc.numero : ""}</td>
                  <td style={pvTd}>{l.designation}</td>
                  <td style={pvTd}>{l.quantite}</td>
                  <td style={pvTd}>{l.unite}</td>
                  <td style={pvTd}>{q}</td>
                  <td style={pvTd}>{l.unite}</td>
                  <td style={pvTd}>{reste}</td>
                  <td style={pvTd}>{lignesReception[l.id]?.remarque || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 50, fontSize: 12 }}>Signatures, Date, Nom :</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
          {["RESPONSABLE MAGASIN", "MAGASINIER", "AGENT DE SECURITE", "LIVREUR ou TRANSPORTEUR"].map((s) => (
            <div key={s} style={{ width: "22%", borderTop: "1px solid #333", paddingTop: 6, textAlign: "center", fontSize: 11 }}>{s}</div>
          ))}
        </div>
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
const pvLabel = { padding: "4px 6px", color: "#666", fontWeight: 600, border: "1px solid #eee", width: "15%" };
const pvVal = { padding: "4px 6px", border: "1px solid #eee", width: "35%" };
const pvTh = { border: "1px solid #ccc", padding: "6px 4px", background: "#F0F7F2" };
const pvTd = { border: "1px solid #ddd", padding: "6px 4px" };
