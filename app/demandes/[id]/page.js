"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";

function computeTotal(lignesOffre, lignesDemande, assujettiTva) {
  let totalHT = 0;
  for (const ld of lignesDemande) {
    const lo = lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) continue;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    totalHT += qte * pu * (1 - remise / 100);
  }
  const tva = assujettiTva ? totalHT * 0.2 : 0;
  return { totalHT, tva, totalTTC: totalHT + tva };
}

export default function TCODetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [demande, setDemande] = useState(null);
  const [lignesDemande, setLignesDemande] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [offres, setOffres] = useState([]);
  const [lignesOffre, setLignesOffre] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);

  const charger = async () => {
    const { data: d } = await supabase.from("demandes").select("*").eq("id", id).single();
    const { data: ld } = await supabase.from("lignes_demande").select("*").eq("demande_id", id).order("created_at");
    const { data: f } = await supabase.from("fournisseurs").select("*").order("nom");
    const { data: o } = await supabase.from("offres").select("*").eq("demande_id", id);
    let lo = [];
    if (o && o.length) {
      const { data } = await supabase.from("lignes_offre").select("*").in("offre_id", o.map((x) => x.id));
      lo = data || [];
    }
    setDemande(d);
    setLignesDemande(ld || []);
    setFournisseurs(f || []);
    setOffres(o || []);
    setLignesOffre(lo);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  const offresAvecTotaux = useMemo(() => {
    return offres.map((o) => {
      const lo = lignesOffre.filter((x) => x.offre_id === o.id);
      return { ...o, lignesOffre: lo, ...computeTotal(lo, lignesDemande, o.assujetti_tva !== false) };
    });
  }, [offres, lignesOffre, lignesDemande]);

  const bestId = useMemo(() => {
    const valides = offresAvecTotaux.filter((o) => o.totalHT > 0);
    if (valides.length === 0) return null;
    return valides.reduce((a, b) => (b.totalHT < a.totalHT ? b : a)).id;
  }, [offresAvecTotaux]);

  const montantLigne = (o, ld) => {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) return null;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    return qte * pu * (1 - remise / 100);
  };

  // Sélection par défaut : le fournisseur le moins cher, article par article
  useEffect(() => {
    setSelection((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const ld of lignesDemande) {
        const valide = next[ld.id] && offresAvecTotaux.some((o) => o.id === next[ld.id] && montantLigne(o, ld) != null);
        if (!valide) {
          const candidats = offresAvecTotaux.filter((o) => montantLigne(o, ld) != null);
          if (candidats.length) {
            const meilleur = candidats.reduce((a, b) => (montantLigne(b, ld) < montantLigne(a, ld) ? b : a));
            next[ld.id] = meilleur.id;
            changed = true;
          } else if (next[ld.id]) {
            delete next[ld.id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [offresAvecTotaux, lignesDemande]);

  const ajouterFournisseur = async (fournisseurId) => {
    const f = fournisseurs.find((x) => x.id === fournisseurId);
    if (!f) return;
    const { data: offre } = await supabase
      .from("offres")
      .insert({ demande_id: id, fournisseur_id: f.id, fournisseur_nom: f.nom })
      .select()
      .single();
    if (offre) {
      const payload = lignesDemande.map((ld) => ({
        offre_id: offre.id,
        ligne_demande_id: ld.id,
        prix_unitaire_ht: null,
        remise_pct: f.remise_par_defaut_pct || 0,
      }));
      if (payload.length) await supabase.from("lignes_offre").insert(payload);
    }
    charger();
  };

  const retirerOffre = async (offreId) => {
    await supabase.from("offres").delete().eq("id", offreId);
    charger();
  };

  const toggleTva = async (offreId, valeurActuelle) => {
    const nouvelle = !(valeurActuelle !== false);
    setOffres((prev) => prev.map((o) => (o.id === offreId ? { ...o, assujetti_tva: nouvelle } : o)));
    await supabase.from("offres").update({ assujetti_tva: nouvelle }).eq("id", offreId);
  };

  const majPrix = async (offreId, ligneDemandeId, field, value) => {
    const existante = lignesOffre.find((x) => x.offre_id === offreId && x.ligne_demande_id === ligneDemandeId);
    // mise à jour optimiste locale
    setLignesOffre((prev) =>
      prev.map((x) => (x.offre_id === offreId && x.ligne_demande_id === ligneDemandeId ? { ...x, [field]: value } : x))
    );
    if (existante) {
      await supabase.from("lignes_offre").update({ [field]: value === "" ? null : Number(value) }).eq("id", existante.id);
    }
  };

  const genererBC = async () => {
    const groupes = {};
    for (const ld of lignesDemande) {
      const offreId = selection[ld.id];
      if (!offreId) continue;
      if (!groupes[offreId]) groupes[offreId] = [];
      groupes[offreId].push(ld);
    }
    if (Object.keys(groupes).length === 0) return;
    setGenerating(true);

    for (const [offreId, lignes] of Object.entries(groupes)) {
      const offre = offresAvecTotaux.find((o) => o.id === offreId);
      if (!offre) continue;
      let montantHT = 0;
      const lignesBcPayload = [];
      for (const ld of lignes) {
        const m = montantLigne(offre, ld);
        if (m == null) continue;
        const lo = offre.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
        montantHT += m;
        lignesBcPayload.push({
          ligne_demande_id: ld.id,
          designation: ld.designation,
          quantite: ld.quantite,
          unite: ld.unite,
          prix_unitaire_ht: Number(lo.prix_unitaire_ht) || 0,
          remise_pct: Number(lo.remise_pct) || 0,
          montant_ht: m,
        });
      }
      if (lignesBcPayload.length === 0) continue;

      const assujetti = offre.assujetti_tva !== false;
      const tva = assujetti ? montantHT * 0.2 : 0;

      const { data: bc } = await supabase
        .from("commandes")
        .insert({
          demande_id: id,
          fournisseur_id: offre.fournisseur_id,
          fournisseur_nom: offre.fournisseur_nom,
          assujetti_tva: assujetti,
          montant_ht: montantHT,
          montant_tva: tva,
          montant_ttc: montantHT + tva,
        })
        .select()
        .single();

      if (bc) {
        await supabase.from("lignes_bc").insert(lignesBcPayload.map((l) => ({ ...l, bc_id: bc.id })));
      }
    }

    await supabase.from("demandes").update({ statut: "Basculée en commande" }).eq("id", id);
    setGenerating(false);
    router.push("/commandes");
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!demande) return <AuthGuard><p>Demande introuvable.</p></AuthGuard>;

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

      <button onClick={() => router.push("/demandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux demandes</button>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }} className="print-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>{demande.numero}</h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{demande.service} — {demande.motif_projet}</p>
          </div>
          <button onClick={() => window.print()} style={{ ...buttonStyle }} className="no-print">Imprimer le comparatif</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté</th>
              <th style={thStyle}>Unité</th>
            </tr>
          </thead>
          <tbody>
            {lignesDemande.map((l) => (
              <tr key={l.id}>
                <td style={tdStyle}>{l.designation}</td>
                <td style={tdStyle}>{l.quantite}</td>
                <td style={tdStyle}>{l.unite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }} className="print-area">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Tableau comparatif (TCO)</h2>

        <select
          value=""
          onChange={(e) => e.target.value && ajouterFournisseur(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16, width: 320 }}
          className="no-print"
        >
          <option value="">+ Ajouter un fournisseur à comparer...</option>
          {fournisseurs.filter((f) => !offres.some((o) => o.fournisseur_id === f.id)).map((f) => (
            <option key={f.id} value={f.id}>{f.nom}</option>
          ))}
        </select>

        {offresAvecTotaux.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Ajoute au moins un fournisseur pour saisir ses prix.</p>}

        {offresAvecTotaux.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Article</th>
                  {offresAvecTotaux.map((o) => (
                    <th key={o.id} style={{ ...thStyle, ...(o.id === bestId ? { color: "#1B7A4C" } : {}) }}>
                      {o.fournisseur_nom}
                      {o.id === bestId && <span style={{ fontSize: 11, color: "#1B7A4C" }}> — mora indrindra</span>}
                      <button onClick={() => retirerOffre(o.id)} style={{ ...linkBtn, marginLeft: 8 }} className="no-print">x</button>
                      <div style={{ display: "flex", gap: 4, fontWeight: 400, color: "#aaa", fontSize: 11, marginTop: 4 }}>
                        <span style={{ width: 85 }}>Prix unitaire HT</span>
                        <span style={{ width: 70 }}>Remise %</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, color: "#666", fontSize: 11, marginTop: 6 }} className="no-print">
                        <input
                          type="checkbox"
                          checked={o.assujetti_tva === false}
                          onChange={() => toggleTva(o.id, o.assujetti_tva)}
                        />
                        Fournisseur non taxable
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignesDemande.map((ld) => (
                  <tr key={ld.id}>
                    <td style={tdStyle}>{ld.designation} <span style={{ color: "#999" }}>({ld.quantite} {ld.unite})</span></td>
                    {offresAvecTotaux.map((o) => {
                      const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id) || {};
                      const disponible = lo.prix_unitaire_ht != null && lo.prix_unitaire_ht !== "";
                      const retenu = selection[ld.id] === o.id;
                      return (
                        <td key={o.id} style={{ ...tdStyle, ...(retenu ? { background: "#EAF7EE" } : {}) }}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                              type="radio"
                              name={`ligne-${ld.id}`}
                              checked={retenu}
                              disabled={!disponible}
                              onChange={() => setSelection((prev) => ({ ...prev, [ld.id]: o.id }))}
                              className="no-print"
                              title="Retenir ce fournisseur pour cet article"
                            />
                            <input
                              type="number"
                              placeholder="PU HT"
                              defaultValue={lo.prix_unitaire_ht ?? ""}
                              onBlur={(e) => majPrix(o.id, ld.id, "prix_unitaire_ht", e.target.value)}
                              style={{ ...inputStyle, width: 80 }}
                            />
                            <input
                              type="number"
                              placeholder="remise %"
                              defaultValue={lo.remise_pct ?? 0}
                              onBlur={(e) => majPrix(o.id, ld.id, "remise_pct", e.target.value)}
                              style={{ ...inputStyle, width: 65 }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #eee" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Total HT</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(o.id === bestId ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalHT.toLocaleString("fr-FR")} Ar
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={tdStyle}>TVA {offresAvecTotaux.some((o) => o.assujetti_tva !== false) ? "20%" : ""}</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={tdStyle}>
                      {o.assujetti_tva === false ? <span style={{ color: "#999" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR")} Ar`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>Total TTC</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(o.id === bestId ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalTTC.toLocaleString("fr-FR")} Ar
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {offresAvecTotaux.length > 0 && (
          <div className="no-print" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              Le point (radio) coché sur chaque article indique le fournisseur retenu pour cet article (par défaut le moins cher). Change-le si besoin avant de générer les bons de commande — un BC distinct sera créé par fournisseur retenu.
            </p>
            <button onClick={genererBC} disabled={generating} style={buttonStyle}>
              {generating ? "Génération..." : "Générer le(s) bon(s) de commande"}
            </button>
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
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };
