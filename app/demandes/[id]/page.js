"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";

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

const FOURNISSEURS_PAR_PAGE = 4;

export default function TCODetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [demande, setDemande] = useState(null);
  const [lignesDemande, setLignesDemande] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [offres, setOffres] = useState([]);
  const [lignesOffre, setLignesOffre] = useState([]);
  const [dejaCouvertes, setDejaCouvertes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);
  const [rechercheFournisseur, setRechercheFournisseur] = useState("");

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
    if (ld && ld.length) {
      const { data: dejaBc } = await supabase.from("lignes_bc").select("ligne_demande_id").in("ligne_demande_id", ld.map((x) => x.id));
      setDejaCouvertes(new Set((dejaBc || []).map((x) => x.ligne_demande_id)));
    } else {
      setDejaCouvertes(new Set());
    }
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  const offresAvecTotaux = useMemo(() => {
    return offres.map((o) => {
      const lo = lignesOffre.filter((x) => x.offre_id === o.id);
      return { ...o, lignesOffre: lo, ...computeTotal(lo, lignesDemande, o.assujetti_tva !== false) };
    });
  }, [offres, lignesOffre, lignesDemande]);

  const montantLigne = (o, ld) => {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) return null;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    return qte * pu * (1 - remise / 100);
  };

  // Pour chaque ligne article, quel fournisseur est le moins cher (indépendant de la sélection manuelle)
  const moinsCherParLigne = useMemo(() => {
    const map = {};
    for (const ld of lignesDemande) {
      const candidats = offresAvecTotaux.filter((o) => montantLigne(o, ld) != null);
      if (candidats.length) {
        const meilleur = candidats.reduce((a, b) => (montantLigne(b, ld) < montantLigne(a, ld) ? b : a));
        map[ld.id] = meilleur.id;
      }
    }
    return map;
  }, [offresAvecTotaux, lignesDemande]);

  // Étiquette "moins cher" par fournisseur (point 1) : liste des numéros de ligne où il est le moins cher
  const etiquetteParOffre = useMemo(() => {
    const map = {};
    offresAvecTotaux.forEach((o) => {
      const numeros = [];
      lignesDemande.forEach((ld, i) => {
        if (moinsCherParLigne[ld.id] === o.id) numeros.push(i + 1);
      });
      if (numeros.length === 0) { map[o.id] = null; return; }
      if (numeros.length === lignesDemande.length) { map[o.id] = "moins cher"; return; }
      map[o.id] = `moins cher — article n°${numeros.join(", n°")}`;
    });
    return map;
  }, [offresAvecTotaux, lignesDemande, moinsCherParLigne]);

  // Total des articles au prix le moins cher sélectionné (point 18)
  const totalPreconisation = useMemo(() => {
    let total = 0;
    for (const ld of lignesDemande) {
      const offreId = selection[ld.id];
      const offre = offresAvecTotaux.find((o) => o.id === offreId);
      if (offre) {
        const m = montantLigne(offre, ld);
        if (m != null) total += m;
      }
    }
    return total;
  }, [selection, offresAvecTotaux, lignesDemande]);

  // Sélection par défaut : le fournisseur le moins cher, article par article
  useEffect(() => {
    setSelection((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const ld of lignesDemande) {
        const valide = next[ld.id] && offresAvecTotaux.some((o) => o.id === next[ld.id] && montantLigne(o, ld) != null);
        if (!valide) {
          if (moinsCherParLigne[ld.id]) {
            next[ld.id] = moinsCherParLigne[ld.id];
            changed = true;
          } else if (next[ld.id]) {
            delete next[ld.id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [offresAvecTotaux, lignesDemande, moinsCherParLigne]);

  const ajouterFournisseur = async (fournisseurId) => {
    const f = fournisseurs.find((x) => x.id === fournisseurId);
    if (!f) return;
    const { data: offre } = await supabase
      .from("offres")
      .insert({ demande_id: id, fournisseur_id: f.id, fournisseur_nom: f.nom, assujetti_tva: f.tva_defaut_pct !== 0 })
      .select()
      .single();
    if (offre) {
      // Pré-remplissage avec le dernier prix connu pour ce couple article + fournisseur (point 2)
      const designations = lignesDemande.map((ld) => ld.designation);
      let derniersPrix = {};
      if (designations.length) {
        const { data: histBc } = await supabase
          .from("lignes_bc")
          .select("designation, prix_unitaire_ht, remise_pct, commandes:bc_id(fournisseur_id, date)")
          .in("designation", designations);
        (histBc || [])
          .filter((h) => h.commandes && h.commandes.fournisseur_id === f.id)
          .sort((a, b) => new Date(a.commandes.date) - new Date(b.commandes.date))
          .forEach((h) => { derniersPrix[h.designation.toLowerCase()] = h; });
      }
      const payload = lignesDemande.map((ld) => {
        const hist = derniersPrix[ld.designation.toLowerCase()];
        return {
          offre_id: offre.id,
          ligne_demande_id: ld.id,
          prix_unitaire_ht: hist ? hist.prix_unitaire_ht : null,
          remise_pct: hist ? hist.remise_pct : (f.remise_par_defaut_pct || 0),
        };
      });
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
    setLignesOffre((prev) =>
      prev.map((x) => (x.offre_id === offreId && x.ligne_demande_id === ligneDemandeId ? { ...x, [field]: value } : x))
    );
    if (existante) {
      await supabase.from("lignes_offre").update({ [field]: value === "" ? null : Number(value) }).eq("id", existante.id);
      // Le prix saisi devient le nouveau "dernier prix HT" de référence de l'article (point 2)
      if (field === "prix_unitaire_ht" && value !== "") {
        const ld = lignesDemande.find((l) => l.id === ligneDemandeId);
        if (ld) await supabase.from("articles").update({ dernier_prix_ht: Number(value) }).ilike("designation", ld.designation);
      }
    }
  };

  const genererBC = async () => {
    const groupes = {};
    for (const ld of lignesDemande) {
      if (dejaCouvertes.has(ld.id)) continue;
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

    // Une demande n'est marquée "Basculée en commande" que si TOUS ses articles ont désormais un BC (point 19)
    const nouvellesCouvertes = new Set(Object.values(groupes).flat().map((l) => l.id));
    const restants = lignesDemande.filter((ld) => !dejaCouvertes.has(ld.id) && !nouvellesCouvertes.has(ld.id));
    await supabase.from("demandes").update({ statut: restants.length === 0 ? "Basculée en commande" : "Partiellement traitée" }).eq("id", id);
    setGenerating(false);
    router.push("/commandes");
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!demande) return <AuthGuard><p>Demande introuvable.</p></AuthGuard>;

  // Découpage des fournisseurs en pages de 4 pour l'impression (point 21)
  const pagesImpression = [];
  for (let i = 0; i < offresAvecTotaux.length; i += FOURNISSEURS_PAR_PAGE) {
    pagesImpression.push(offresAvecTotaux.slice(i, i + FOURNISSEURS_PAR_PAGE));
  }

  return (
    <AuthGuard>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .ecran-seulement { display: none !important; }
          .page-impression { page-break-after: always; }
          .page-impression:last-child { page-break-after: auto; }
          tr, td, th { break-inside: avoid; }
        }
        @media screen {
          .impression-seulement { display: none !important; }
        }
      `}</style>

      <button onClick={() => router.push("/demandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux demandes</button>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }} className="print-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>{demande.numero}</h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{demande.service} — {demande.motif_projet}</p>
          </div>
          <button onClick={() => window.print()} style={buttonStyle} className="no-print">Imprimer le comparatif</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>N°</th>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté</th>
              <th style={thStyle}>Unité</th>
            </tr>
          </thead>
          <tbody>
            {lignesDemande.map((l, i) => (
              <tr key={l.id}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{l.designation}</td>
                <td style={tdStyle}>{l.quantite.toLocaleString("fr-FR")}</td>
                <td style={tdStyle}>{l.unite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }} className="print-area">
        <h2 style={{ fontSize: 15, marginBottom: 12 }} className="no-print">Tableau comparatif (TCO)</h2>

        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Autocomplete
            placeholder="Taper le nom du fournisseur à comparer..."
            value={rechercheFournisseur}
            onChange={setRechercheFournisseur}
            onSelect={(nom) => {
              const f = fournisseurs.find((x) => x.nom === nom);
              if (f) { ajouterFournisseur(f.id); setRechercheFournisseur(""); }
            }}
            suggestions={fournisseurs.filter((f) => !offres.some((o) => o.fournisseur_id === f.id)).map((f) => f.nom)}
            style={{ width: 320 }}
          />
          <button
            onClick={() => {
              const f = fournisseurs.find((x) => x.nom.toLowerCase() === rechercheFournisseur.trim().toLowerCase());
              if (f) { ajouterFournisseur(f.id); setRechercheFournisseur(""); }
            }}
            style={buttonStyle}
          >
            + Ajouter
          </button>
        </div>

        {offresAvecTotaux.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Ajoute au moins un fournisseur pour saisir ses prix.</p>}

        {/* ---- Vue écran : tableau unique interactif ---- */}
        {offresAvecTotaux.length > 0 && (
          <div className="ecran-seulement" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>N°</th>
                  <th style={thStyle}>Article</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>Unité</th>
                  <th style={{ ...thStyle, color: "#1B7A4C" }}>Préconisation</th>
                  {offresAvecTotaux.map((o) => (
                    <th key={o.id} style={{ ...thStyle, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.fournisseur_nom}
                      {etiquetteParOffre[o.id] && <span style={{ fontSize: 11, color: "#1B7A4C" }}> — {etiquetteParOffre[o.id]}</span>}
                      <button onClick={() => retirerOffre(o.id)} style={{ ...linkBtn, marginLeft: 8 }}>x</button>
                      <div style={{ display: "flex", gap: 4, fontWeight: 400, color: "#aaa", fontSize: 11, marginTop: 4 }}>
                        <span style={{ width: 30 }}></span>
                        <span style={{ width: 80 }}>Prix unitaire HT</span>
                        <span style={{ width: 65 }}>Remise %</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, color: "#666", fontSize: 11, marginTop: 6 }}>
                        <input type="checkbox" checked={o.assujetti_tva === false} onChange={() => toggleTva(o.id, o.assujetti_tva)} />
                        Fournisseur non taxable
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignesDemande.map((ld, i) => {
                  const offreRetenue = offresAvecTotaux.find((o) => o.id === selection[ld.id]);
                  const montantRetenu = offreRetenue ? montantLigne(offreRetenue, ld) : null;
                  const couverte = dejaCouvertes.has(ld.id);
                  return (
                    <tr key={ld.id} style={couverte ? { opacity: 0.55 } : {}}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>
                        {ld.designation}
                        {couverte && <span style={{ marginLeft: 6, fontSize: 11, color: "#1B7A4C" }}>✓ BC déjà généré</span>}
                      </td>
                      <td style={tdStyle}>{ld.quantite.toLocaleString("fr-FR")}</td>
                      <td style={tdStyle}>{ld.unite}</td>
                      <td style={{ ...tdStyle, background: "#EAF7EE", fontSize: 12 }}>
                        {offreRetenue ? (
                          <>
                            <strong>{offreRetenue.fournisseur_nom}</strong><br />
                            {montantRetenu != null ? `${montantRetenu.toLocaleString("fr-FR")} Ar` : "-"}
                          </>
                        ) : "-"}
                      </td>
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
                                disabled={!disponible || couverte}
                                onChange={() => setSelection((prev) => ({ ...prev, [ld.id]: o.id }))}
                                title="Retenir ce fournisseur pour cet article"
                              />
                              <input
                                type="number"
                                placeholder="PU HT"
                                defaultValue={lo.prix_unitaire_ht ?? ""}
                                onBlur={(e) => majPrix(o.id, ld.id, "prix_unitaire_ht", e.target.value)}
                                disabled={couverte}
                                style={{ ...inputStyle, width: 80 }}
                              />
                              <input
                                type="number"
                                placeholder="remise %"
                                defaultValue={lo.remise_pct ?? 0}
                                onBlur={(e) => majPrix(o.id, ld.id, "remise_pct", e.target.value)}
                                disabled={couverte}
                                style={{ ...inputStyle, width: 65 }}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid #eee" }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>Total des articles au prix le moins cher retenu</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#1B7A4C" }}>{totalPreconisation.toLocaleString("fr-FR")} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalHT.toLocaleString("fr-FR")} Ar
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={5} style={tdStyle}>TVA {offresAvecTotaux.some((o) => o.assujetti_tva !== false) ? "20%" : ""}</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={tdStyle}>
                      {o.assujetti_tva === false ? <span style={{ color: "#999" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR")} Ar`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, fontWeight: 600 }}>Total TTC</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalTTC.toLocaleString("fr-FR")} Ar
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Vue impression : pages de 4 fournisseurs, colonnes fixes répétées (point 21) ---- */}
        {offresAvecTotaux.length > 0 && pagesImpression.map((page, pIdx) => (
          <div key={pIdx} className="impression-seulement page-impression">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>N°</th>
                  <th style={thStyle}>Article</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>Unité</th>
                  <th style={{ ...thStyle, color: "#1B7A4C" }}>Préconisation</th>
                  {page.map((o) => (
                    <th key={o.id} style={{ ...thStyle, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.fournisseur_nom}{etiquetteParOffre[o.id] ? ` — ${etiquetteParOffre[o.id]}` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignesDemande.map((ld, i) => {
                  const offreRetenue = offresAvecTotaux.find((o) => o.id === selection[ld.id]);
                  const montantRetenu = offreRetenue ? montantLigne(offreRetenue, ld) : null;
                  return (
                    <tr key={ld.id}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>{ld.designation}</td>
                      <td style={tdStyle}>{ld.quantite.toLocaleString("fr-FR")}</td>
                      <td style={tdStyle}>{ld.unite}</td>
                      <td style={tdStyle}>{offreRetenue ? `${offreRetenue.fournisseur_nom} — ${montantRetenu != null ? montantRetenu.toLocaleString("fr-FR") : "-"} Ar` : "-"}</td>
                      {page.map((o) => {
                        const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id) || {};
                        const m = montantLigne(o, ld);
                        return (
                          <td key={o.id} style={tdStyle}>
                            {lo.prix_unitaire_ht ? `${Number(lo.prix_unitaire_ht).toLocaleString("fr-FR")} Ar (-${lo.remise_pct || 0}%) = ${m != null ? m.toLocaleString("fr-FR") : "-"} Ar` : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid #eee" }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totalPreconisation.toLocaleString("fr-FR")} Ar</td>
                  {page.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600 }}>HT {o.totalHT.toLocaleString("fr-FR")} / TTC {o.totalTTC.toLocaleString("fr-FR")} Ar</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {offresAvecTotaux.length > 0 && lignesDemande.some((ld) => !dejaCouvertes.has(ld.id)) && (
          <div className="no-print" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              Le point (radio) coché sur chaque article indique le fournisseur retenu pour cet article (par défaut le moins cher). Change-le si besoin avant de générer les bons de commande — un BC distinct sera créé par fournisseur retenu, seulement pour les articles pas encore attribués.
            </p>
            <button onClick={genererBC} disabled={generating} style={buttonStyle}>
              {generating ? "Génération..." : "Générer le(s) bon(s) de commande"}
            </button>
          </div>
        )}
        {offresAvecTotaux.length > 0 && lignesDemande.length > 0 && lignesDemande.every((ld) => dejaCouvertes.has(ld.id)) && (
          <p className="no-print" style={{ fontSize: 13, color: "#1B7A4C", marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            ✓ Tous les articles de cette demande ont déjà un bon de commande.
          </p>
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
