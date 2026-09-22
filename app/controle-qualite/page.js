"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { useRole } from "../../lib/useRole";
import { inputStyle, thStyle, tdStyle, buttonStyle, cardStyle } from "../components/ui";

const REGLES = [
  { id: "tva_incoherente", label: "TVA du BC ne correspond pas au statut réel du fournisseur", corrigeable: true },
  { id: "non_taxable_montants", label: "BC non taxable avec montant_ht ≠ montant_ttc ou montant_tva ≠ 0", corrigeable: true },
  { id: "taxable_montants", label: "BC taxable avec montant_ttc incohérent (≠ HT × 1,2)", corrigeable: true },
  { id: "somme_lignes", label: "Somme des lignes ≠ montant_ht du BC", corrigeable: true },
];

export default function ControleQualitePage() {
  const role = useRole();
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [filtreRegle, setFiltreRegle] = useState("");
  const [derniereVerif, setDerniereVerif] = useState(null);
  const [correctionEnCours, setCorrectionEnCours] = useState(null);

  const verifier = async () => {
    setLoading(true);
    const { data: commandes } = await supabase.from("commandes").select("id, numero, fournisseur_id, fournisseur_nom, assujetti_tva, montant_ht, montant_tva, montant_ttc, statut").limit(10000);
    const { data: fournisseurs } = await supabase.from("fournisseurs").select("id, nom, tva_defaut_pct").limit(10000);
    const { data: lignes } = await supabase.from("lignes_bc").select("bc_id, montant_ht").limit(20000);

    const fournisseurParId = {};
    (fournisseurs || []).forEach((f) => { fournisseurParId[f.id] = f; });
    const sommeLignesParBc = {};
    (lignes || []).forEach((l) => {
      sommeLignesParBc[l.bc_id] = (sommeLignesParBc[l.bc_id] || 0) + (Number(l.montant_ht) || 0);
    });

    const trouvees = [];
    (commandes || []).filter((c) => c.statut !== "Annulée").forEach((c) => {
      const f = fournisseurParId[c.fournisseur_id];
      const ht = Number(c.montant_ht) || 0;
      const tva = Number(c.montant_tva) || 0;
      const ttc = Number(c.montant_ttc) || 0;
      const nonTaxableReel = f ? f.tva_defaut_pct === 0 : null;

      if (f && nonTaxableReel !== null && c.assujetti_tva === nonTaxableReel) {
        trouvees.push({
          regle: "tva_incoherente", bcId: c.id, numero: c.numero, fournisseur: c.fournisseur_nom,
          detail: `Fournisseur ${nonTaxableReel ? "non taxable" : "taxable"} sur sa fiche, mais BC marqué ${c.assujetti_tva ? "taxable" : "non taxable"}`,
        });
      }
      if (c.assujetti_tva === false && (Math.abs(ht - ttc) > 1 || Math.abs(tva) > 1)) {
        trouvees.push({
          regle: "non_taxable_montants", bcId: c.id, numero: c.numero, fournisseur: c.fournisseur_nom,
          detail: `Non taxable mais HT=${ht.toLocaleString("fr-FR")} / TTC=${ttc.toLocaleString("fr-FR")} / TVA=${tva.toLocaleString("fr-FR")}`,
        });
      }
      if (c.assujetti_tva !== false && Math.abs(ttc - Math.round(ht * 1.2 * 100) / 100) > 1) {
        trouvees.push({
          regle: "taxable_montants", bcId: c.id, numero: c.numero, fournisseur: c.fournisseur_nom,
          detail: `TTC=${ttc.toLocaleString("fr-FR")} attendu ≈ ${(ht * 1.2).toLocaleString("fr-FR")} (HT×1,2)`,
        });
      }
      const sommeLignes = Math.round((sommeLignesParBc[c.id] || 0) * 100) / 100;
      if (sommeLignesParBc[c.id] !== undefined && Math.abs(sommeLignes - ht) > 1) {
        trouvees.push({
          regle: "somme_lignes", bcId: c.id, numero: c.numero, fournisseur: c.fournisseur_nom,
          detail: `Somme des lignes=${sommeLignes.toLocaleString("fr-FR")} ≠ montant_ht du BC=${ht.toLocaleString("fr-FR")}`,
        });
      }
    });

    setAnomalies(trouvees);
    setDerniereVerif(new Date());
    setLoading(false);
  };

  useEffect(() => { verifier(); }, []);

  const filtrees = useMemo(() => {
    if (!filtreRegle) return anomalies;
    return anomalies.filter((a) => a.regle === filtreRegle);
  }, [anomalies, filtreRegle]);

  const compteParRegle = useMemo(() => {
    const m = {};
    anomalies.forEach((a) => { m[a.regle] = (m[a.regle] || 0) + 1; });
    return m;
  }, [anomalies]);

  // Corrige un BC en se basant TOUJOURS sur la somme réelle de ses lignes
  // (jamais sur un montant global du BC, qui peut déjà être faux — la leçon
  // de l'incident TVA précédent) et sur le vrai statut TVA du fournisseur.
  const corrigerAnomalie = async (a) => {
    if (!confirm(`Corriger automatiquement le BC ${a.numero} ? Les montants seront recalculés à partir de ses lignes et du statut TVA réel du fournisseur.`)) return;
    setCorrectionEnCours(a.bcId + a.regle);
    const { data: commande } = await supabase.from("commandes").select("fournisseur_id").eq("id", a.bcId).single();
    const { data: fournisseur } = commande ? await supabase.from("fournisseurs").select("tva_defaut_pct").eq("id", commande.fournisseur_id).single() : { data: null };
    const { data: lignes } = await supabase.from("lignes_bc").select("montant_ht").eq("bc_id", a.bcId);
    const sommeLignes = (lignes || []).reduce((s, l) => s + (Number(l.montant_ht) || 0), 0);
    const assujetti = fournisseur ? fournisseur.tva_defaut_pct !== 0 : true;
    const montantHt = Math.round(sommeLignes * 100) / 100;
    const montantTva = assujetti ? Math.round(montantHt * 0.2 * 100) / 100 : 0;
    const montantTtc = Math.round((montantHt + montantTva) * 100) / 100;
    await supabase.from("commandes").update({
      assujetti_tva: assujetti, montant_ht: montantHt, montant_tva: montantTva, montant_ttc: montantTtc,
    }).eq("id", a.bcId);
    setCorrectionEnCours(null);
    verifier();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Contrôle qualité des données ({anomalies.length} anomalie{anomalies.length > 1 ? "s" : ""})</h1>
        <button onClick={verifier} disabled={loading} style={buttonStyle}>{loading ? "Vérification..." : "Relancer la vérification"}</button>
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          Règles vérifiées (BC hors "Annulée") :
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {REGLES.map((r) => (
            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name="filtre-regle" checked={filtreRegle === r.id} onChange={() => setFiltreRegle(r.id)} />
              {r.label}
              {compteParRegle[r.id] > 0 && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#FDECEA", color: "#B3261E" }}>{compteParRegle[r.id]}</span>
              )}
            </label>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
            <input type="radio" name="filtre-regle" checked={filtreRegle === ""} onChange={() => setFiltreRegle("")} />
            Toutes les règles
          </label>
        </div>
        {derniereVerif && <p style={{ fontSize: 11, color: "#999", marginTop: 10 }}>Dernière vérification : {derniereVerif.toLocaleString("fr-FR")}</p>}
      </div>

      <div style={cardStyle}>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Vérification en cours...</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#1B7A4C", fontSize: 13 }}>✓ Aucune anomalie détectée{filtreRegle ? " pour cette règle" : ""}.</p>}
        {!loading && filtrees.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>N° BC</th>
                <th style={thStyle}>Fournisseur</th>
                <th style={thStyle}>Règle violée</th>
                <th style={thStyle}>Détail</th>
                <th style={thStyle}></th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((a, i) => {
                const regle = REGLES.find((r) => r.id === a.regle);
                const enCours = correctionEnCours === a.bcId + a.regle;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={tdStyle}>{a.numero}</td>
                    <td style={tdStyle}>{a.fournisseur}</td>
                    <td style={tdStyle}>{regle?.label}</td>
                    <td style={{ ...tdStyle, color: "#666" }}>{a.detail}</td>
                    <td style={tdStyle}><Link href={`/commandes/${a.bcId}`} style={{ color: "#1B4C7A" }}>Ouvrir le BC</Link></td>
                    <td style={tdStyle}>
                      {role === "acheteur" && regle?.corrigeable && (
                        <button
                          onClick={() => corrigerAnomalie(a)}
                          disabled={enCours}
                          style={{ border: "none", background: "#1E3A34", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          {enCours ? "Correction..." : "Corriger"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AuthGuard>
  );
}
