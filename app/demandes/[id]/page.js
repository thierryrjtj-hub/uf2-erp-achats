"use client";
import { useEffect, useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import CadreExtensible from "../../components/CadreExtensible";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../../components/ui";
import { formatDate } from "../../../lib/format";

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

// Montant total de remise obtenue chez ce fournisseur, tous articles confondus
function remiseObtenueOffre(o, lignesDemande) {
  let total = 0;
  for (const ld of lignesDemande) {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) continue;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    total += qte * pu * (remise / 100);
  }
  return total;
}

// Articles dont la remise s'écarte du taux habituel du fournisseur (promo sans
// remise, ou remise exceptionnelle plus forte que d'habitude)
function remiseExceptionsOffre(o, lignesDemande, fournisseursDetailMap) {
  const defaut = fournisseursDetailMap[o.fournisseur_id]?.remise_par_defaut_pct;
  if (defaut === null || defaut === undefined) return [];
  const out = [];
  lignesDemande.forEach((ld, i) => {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) return;
    const remise = Number(lo.remise_pct) || 0;
    if (remise !== Number(defaut)) {
      out.push({ numero: i + 1, designation: ld.designation, remise, defaut: Number(defaut) });
    }
  });
  return out;
}

// Liste à la française : "3 et 5" / "1, 3 et 5" — plus lisible qu'une liste à virgules
function joinFrench(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return String(arr[0]);
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

function truncateTexte(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
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
  const [bcGeneres, setBcGeneres] = useState([]);
  const [notesTco, setNotesTco] = useState({ remarque: "", autres: "" });
  const [orientation, setOrientation] = useState("portrait");
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);
  const [rechercheFournisseur, setRechercheFournisseur] = useState("");

  const charger = async () => {
    const { data: d } = await supabase.from("demandes").select("*").eq("id", id).single();
    const { data: ld } = await supabase.from("lignes_demande").select("*").eq("demande_id", id).order("created_at");
    const { data: f } = await supabase.from("fournisseurs").select("*").order("nom").limit(10000);
    const { data: o } = await supabase.from("offres").select("*").eq("demande_id", id);
    let lo = [];
    if (o && o.length) {
      const { data } = await supabase.from("lignes_offre").select("*").in("offre_id", o.map((x) => x.id));
      lo = data || [];
    }
    setDemande(d);
    setNotesTco({ remarque: d?.tco_remarque || "", autres: d?.tco_autres_fournisseurs || "" });
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
    const { data: bcs } = await supabase.from("commandes").select("id, numero, fournisseur_nom, statut").eq("demande_id", id);
    setBcGeneres(bcs || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  const fournisseursDetailMap = useMemo(() => {
    const map = {};
    fournisseurs.forEach((f) => { map[f.id] = f; });
    return map;
  }, [fournisseurs]);

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

  // Total des articles au prix le moins cher sélectionné (point 18), avec TVA/TTC selon le fournisseur retenu par ligne
  const totalPreconisation = useMemo(() => {
    let ht = 0, tva = 0;
    for (const ld of lignesDemande) {
      const offreId = selection[ld.id];
      const offre = offresAvecTotaux.find((o) => o.id === offreId);
      if (offre) {
        const m = montantLigne(offre, ld);
        if (m != null) {
          ht += m;
          tva += offre.assujetti_tva !== false ? m * 0.2 : 0;
        }
      }
    }
    return { ht, tva, ttc: ht + tva };
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

  const majOffre = async (offreId, champ, valeur) => {
    setOffres((prev) => prev.map((o) => (o.id === offreId ? { ...o, [champ]: valeur } : o)));
    await supabase.from("offres").update({ [champ]: valeur || null }).eq("id", offreId);
  };

  const enregistrerNotesTco = async () => {
    await supabase.from("demandes").update({
      tco_remarque: notesTco.remarque || null,
      tco_autres_fournisseurs: notesTco.autres || null,
    }).eq("id", id);
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

  const marquerNonDisponible = async (ligne) => {
    const observation = `À rechercher à l'import — ${ligne.designation}`;
    if (lignesDemande.length <= 1) {
      // Seul article de la demande : on clôture directement cette demande
      await supabase.from("lignes_demande").update({ non_disponible_localement: true }).eq("id", ligne.id);
      await supabase.from("demandes").update({ statut: "Clôturée", observation }).eq("id", id);
    } else {
      // D'autres articles restent à traiter : on détache celui-ci dans une nouvelle demande clôturée
      const { data: nouvelleDemande } = await supabase.from("demandes").insert({
        service: demande.service, demandeur: demande.demandeur, priorite: demande.priorite,
        statut: "Clôturée", observation,
      }).select().single();
      if (nouvelleDemande) {
        await supabase.from("lignes_demande").update({
          demande_id: nouvelleDemande.id, non_disponible_localement: true,
        }).eq("id", ligne.id);
      }
    }
    charger();
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!demande) return <AuthGuard><p>Demande introuvable.</p></AuthGuard>;

  // Découpage des fournisseurs en pages de 4 pour l'impression (point 21)
  const pagesImpression = [];
  for (let i = 0; i < offresAvecTotaux.length; i += FOURNISSEURS_PAR_PAGE) {
    pagesImpression.push(offresAvecTotaux.slice(i, i + FOURNISSEURS_PAR_PAGE));
  }
  // Le tableau se resserre automatiquement s'il y a beaucoup d'articles
  const dense = lignesDemande.length > 10;
  const cozy = lignesDemande.length <= 3;
  const padCellule = dense ? "2px 4px" : cozy ? "7px 4px" : "4px 4px";

  return (
    <AuthGuard>
      <style>{`
        @page { size: A4 ${orientation}; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          .page-impression { page-break-after: always; }
          .page-impression:last-child { page-break-after: auto; }
          tr, td, th { break-inside: avoid; }
        }
        .tco-imprimable { display: none; }
        @media print { .tco-imprimable { display: block; } }
      `}</style>

      <div className="no-print">
      <button onClick={() => router.push("/demandes")} style={{ ...linkBtn, marginBottom: 16 }}>&larr; Retour aux demandes</button>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>{demande.numero}</h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{demande.service} — {demande.motif_projet}</p>
            {demande.numero_tco && <p style={{ fontSize: 12, color: "#1B7A4C", marginTop: -8, marginBottom: 12 }}>N° {demande.numero_tco}</p>}
            {bcGeneres.length > 0 && (
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>Bon(s) de commande généré(s) :</strong>{" "}
                {bcGeneres.map((bc, i) => (
                  <span key={bc.id}>
                    {i > 0 && ", "}
                    <Link href={`/commandes/${bc.id}`} style={{ color: "#1E3A34", textDecoration: "underline" }}>{bc.numero}</Link> ({bc.fournisseur_nom})
                  </span>
                ))}
              </p>
            )}
            {demande.observation && (
              <div style={{ background: "#FDECEA", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
                <strong>Observation :</strong> {demande.observation}
                {!demande.demandeur_avise && (
                  <button
                    onClick={async () => { await supabase.from("demandes").update({ demandeur_avise: true }).eq("id", id); charger(); }}
                    style={{ ...linkBtn, marginLeft: 12, color: "#B3261E" }}
                  >
                    Marquer le demandeur avisé
                  </button>
                )}
                {demande.demandeur_avise && <span style={{ marginLeft: 12, color: "#1B7A4C" }}>✓ Demandeur avisé</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={inputStyle} title="Orientation d'impression du TCO">
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
            <button onClick={() => window.print()} style={buttonStyle}>Imprimer le comparatif</button>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>N°</th>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté</th>
              <th style={thStyle}>Unité</th>
              <th style={thStyle}>Non dispo. localement</th>
            </tr>
          </thead>
          <tbody>
            {lignesDemande.map((l, i) => (
              <tr key={l.id}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>
                  {l.designation}
                  {l.non_disponible_localement && <span style={{ marginLeft: 8, fontSize: 11, color: "#B3261E" }}>— à rechercher à l'import</span>}
                </td>
                <td style={tdStyle}>{l.quantite.toLocaleString("fr-FR")}</td>
                <td style={tdStyle}>{l.unite}</td>
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    checked={!!l.non_disponible_localement}
                    onChange={(e) => { if (e.target.checked) marquerNonDisponible(l); }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CadreExtensible titre="Tableau comparatif (TCO)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Tableau comparatif (TCO)</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
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

        {offresAvecTotaux.length === 0 && (
          <div className="no-print" style={{ background: "#F5F4F1", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Comment veux-tu traiter cette demande ?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ ...buttonStyle, opacity: 0.6, cursor: "default" }}>↓ Comparer des fournisseurs (TCO) — ajoute-en un ci-dessous</span>
              <button onClick={() => router.push(`/commandes/nouveau?demande_id=${id}`)} style={{ ...buttonStyle, background: "#888" }}>
                Créer le BC directement (sans comparatif)
              </button>
            </div>
          </div>
        )}
        {offresAvecTotaux.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Ajoute au moins un fournisseur pour saisir ses prix.</p>}

        {/* ---- Vue écran : tableau unique interactif ---- */}
        {offresAvecTotaux.length > 0 && (
          <div className="ecran-seulement">
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
                      <div className="no-print" style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <input
                          placeholder="N° devis"
                          defaultValue={o.numero_devis || ""}
                          onBlur={(e) => majOffre(o.id, "numero_devis", e.target.value)}
                          style={{ ...inputStyle, width: 70, fontWeight: 400, fontSize: 11, padding: "4px 6px" }}
                        />
                        <input
                          type="date"
                          defaultValue={o.date_devis || ""}
                          onBlur={(e) => majOffre(o.id, "date_devis", e.target.value)}
                          style={{ ...inputStyle, width: 100, fontWeight: 400, fontSize: 11, padding: "4px 6px" }}
                        />
                      </div>
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
                            {montantRetenu != null ? (
                              <>
                                HT {montantRetenu.toLocaleString("fr-FR")} Ar<br />
                                {offreRetenue.assujetti_tva !== false
                                  ? `TTC ${(montantRetenu * 1.2).toLocaleString("fr-FR")} Ar`
                                  : "Non taxable"}
                              </>
                            ) : "-"}
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
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>Total des articles au prix le moins cher retenu (HT)</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#1B7A4C" }}>{totalPreconisation.ht.toLocaleString("fr-FR")} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalHT.toLocaleString("fr-FR")} Ar
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={4} style={tdStyle}>TVA</td>
                  <td style={{ ...tdStyle, color: "#1B7A4C" }}>{totalPreconisation.tva.toLocaleString("fr-FR")} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={tdStyle}>
                      {o.assujetti_tva === false ? <span style={{ color: "#999" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR")} Ar`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 600 }}>Total TTC</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#1B7A4C" }}>{totalPreconisation.ttc.toLocaleString("fr-FR")} Ar</td>
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


        {offresAvecTotaux.length > 0 && (
          <div className="no-print" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Notes pour le TCO imprimé</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              <textarea placeholder="Remarque (ex. article surligné en jaune abordable...)" value={notesTco.remarque} onChange={(e) => setNotesTco({ ...notesTco, remarque: e.target.value })} onBlur={enregistrerNotesTco} style={{ ...inputStyle, minHeight: 40 }} />
              <textarea placeholder="Autres fournisseurs consultés (ex. n'ont pas répondu à la demande de devis, ou ne vendent pas l'article)" value={notesTco.autres} onChange={(e) => setNotesTco({ ...notesTco, autres: e.target.value })} onBlur={enregistrerNotesTco} style={{ ...inputStyle, minHeight: 40 }} />
            </div>
          </div>
        )}

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
      </CadreExtensible>
      </div>

      <div className="tco-imprimable">
        {/* ---- Vue impression : modèle moderne validé (cadres arrondis séparés,
             en-têtes centrés, taux de remise, détection des remises hors norme) ---- */}
        {offresAvecTotaux.length > 0 && pagesImpression.map((page, pIdx) => {
          const derniere = pIdx === pagesImpression.length - 1;
          const rowSpanMotif = derniere ? 5 : 4;
          return (
          <div key={pIdx} className="page-impression" style={{ fontFamily: "Arial, sans-serif", color: "#1a1a1a" }}>
            {/* En-tête */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2px solid #3E7A52", paddingBottom: 10, marginBottom: 10 }}>
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="UNIFOODS" style={{ height: 34 }} />
                <div style={{ fontSize: 8.5, color: "#888", marginTop: 2 }}>Membre du groupe HV</div>
              </div>
              <div style={{ textAlign: "center", flex: 1, padding: "0 20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Tableau comparatif des offres fournisseurs</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Destinataire : Tous</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 9.5, color: "#888", minWidth: 130 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1a1a1a" }}>{demande.numero_tco || "—"}</div>
                <div>Créé le {formatDate(demande.created_at)}</div>
                <div>Page {pIdx + 1} sur {pagesImpression.length}</div>
              </div>
            </div>

            {/* Bandeau meta */}
            <div style={{ display: "flex", flexWrap: "wrap", background: "#FAFAF9", borderRadius: 8, padding: "8px 14px", marginBottom: 12, gap: 18 }}>
              <MetaItem label="Date DA" value={formatDate(demande.created_at)} />
              <MetaItem label="Service demandeur" value={demande.service || "—"} />
              <MetaItem label="Nom demandeur" value={demande.demandeur || "—"} />
              <MetaItem label="N° DA" value={demande.numero} />
              <MetaItem label="Émetteur" value="Judicaël RANDRIANAIVO" />
              <MetaItem label="Fonction" value="Buyer" />
              <MetaItem label="Signature" value="\u00A0" />
            </div>

            {/* Cadre 1 : tableau des articles */}
            <div style={cadreStyle}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: dense ? 9 : 10.5, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 24 }} /><col /><col style={{ width: 38 }} /><col style={{ width: 44 }} />
                  <col style={{ width: 118 }} />
                  {page.map((o) => (<Fragment key={o.id}><col style={{ width: 68 }} /><col style={{ width: 52 }} /><col style={{ width: 78 }} /></Fragment>))}
                </colgroup>
                <thead>
                  <tr>
                    <th style={thBlank}></th><th style={thBlank}></th><th style={thBlank}></th><th style={thBlank}></th>
                    <th style={{ ...thBlank, background: "#EAF7EE", color: "#1B7A4C", fontWeight: 700, fontSize: 11, textAlign: "center" }}>Préconisation</th>
                    {page.map((o) => {
                      const wins = [];
                      lignesDemande.forEach((ld, i) => { if (moinsCherParLigne[ld.id] === o.id) wins.push(i + 1); });
                      return (
                        <th key={o.id} colSpan={3} style={{ ...thGroupStart, padding: 0 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", padding: "3px 4px 0" }}>
                            {o.fournisseur_nom}
                            {o.assujetti_tva === false && <span style={{ fontSize: 8.5, color: "#888", fontStyle: "italic" }}> (non taxable)</span>}
                          </div>
                          <div style={{ fontSize: 8.5, color: "#888", textAlign: "center" }}>
                            {o.numero_devis ? `Devis ${o.numero_devis} · ` : ""}{o.date_devis ? formatDate(o.date_devis) : ""}
                          </div>
                          <div style={{ fontSize: 8, fontWeight: 600, color: "#1B7A4C", textAlign: "center", padding: "2px 4px 4px" }}>
                            {wins.length ? `Moins cher sur article${wins.length > 1 ? "s" : ""} n° ${joinFrench(wins)}` : "\u00A0"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    <th style={thTco}>N°</th>
                    <th style={{ ...thTco, textAlign: "center" }}>Article</th>
                    <th style={{ ...thTco, textAlign: "center" }}>Qté</th>
                    <th style={{ ...thTco, textAlign: "center" }}>Unité</th>
                    <th style={{ ...thTco, background: "#EAF7EE" }}></th>
                    {page.map((o) => {
                      const defaut = fournisseursDetailMap[o.fournisseur_id]?.remise_par_defaut_pct;
                      return (
                        <Fragment key={o.id}>
                          <th style={{ ...thTco, textAlign: "right", borderLeft: "1.25px solid #1a1a1a" }}>PU HT</th>
                          <th style={{ ...thTco, textAlign: "right" }}>{defaut !== null && defaut !== undefined ? `Remise ${defaut}%` : "Remise"}</th>
                          <th style={{ ...thTco, textAlign: "right" }}>Montant HT</th>
                        </Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {lignesDemande.map((ld, i) => {
                    const offreRetenue = offresAvecTotaux.find((o) => o.id === selection[ld.id]);
                    const montantRetenu = offreRetenue ? montantLigne(offreRetenue, ld) : null;
                    return (
                      <tr key={ld.id}>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule }}>{i + 1}</td>
                        <td style={{ ...tdTco, padding: padCellule }}>{ld.designation}</td>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule }}>{Number(ld.quantite).toLocaleString("fr-FR")}</td>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule }}>{ld.unite}</td>
                        <td style={{ ...tdTco, background: "#EAF7EE", textAlign: "center", padding: padCellule }}>
                          {offreRetenue ? (
                            <>
                              <div style={{ fontWeight: 700, color: "#1B7A4C" }}>{offreRetenue.fournisseur_nom}</div>
                              <div style={{ fontSize: 9, color: "#888" }}>HT {montantRetenu != null ? montantRetenu.toLocaleString("fr-FR") + " Ar" : "-"}</div>
                            </>
                          ) : "—"}
                        </td>
                        {page.map((o) => {
                          const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id) || {};
                          const m = montantLigne(o, ld);
                          const estMoinsCher = moinsCherParLigne[ld.id] === o.id && !!lo.prix_unitaire_ht;
                          const styleCell1 = { ...tdTco, padding: padCellule, textAlign: "right", borderLeft: "1.25px solid #1a1a1a", ...(estMoinsCher ? { background: "#EAF7EE" } : {}) };
                          const styleCell = { ...tdTco, padding: padCellule, textAlign: "right", ...(estMoinsCher ? { background: "#EAF7EE" } : {}) };
                          return (
                            <Fragment key={o.id}>
                              <td style={styleCell1}>{lo.prix_unitaire_ht ? `${Number(lo.prix_unitaire_ht).toLocaleString("fr-FR")} Ar` : ""}</td>
                              <td style={styleCell}>{lo.remise_pct ? `${lo.remise_pct}%` : ""}</td>
                              <td style={{ ...styleCell, fontWeight: estMoinsCher ? 700 : 400, color: estMoinsCher ? "#1B7A4C" : "#1a1a1a" }}>
                                {m != null ? `${m.toLocaleString("fr-FR")} Ar` : ""}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ height: 10 }} />

            {/* Cadre 2 : totaux (séparé du tableau des articles) */}
            <div style={cadreStyle}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: dense ? 9 : 10.5, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 24 }} /><col /><col style={{ width: 38 }} /><col style={{ width: 44 }} />
                  <col style={{ width: 118 }} />
                  {page.map((o) => (<Fragment key={o.id}><col style={{ width: 68 }} /><col style={{ width: 52 }} /><col style={{ width: 78 }} /></Fragment>))}
                </colgroup>
                <tbody>
                  <tr>
                    <td colSpan={4} rowSpan={rowSpanMotif} style={{ ...tdTco, verticalAlign: "top", padding: 10 }}>
                      <div style={lblStyle}>Motif de la demande</div>
                      <div style={{ marginBottom: 8 }}>{demande.motif_projet || "—"}</div>
                      {derniere && notesTco.remarque && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={lblStyle}>Remarque</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{notesTco.remarque}</div>
                        </div>
                      )}
                      {derniere && (
                        <div>
                          <div style={lblStyle}>Autres fournisseurs consultés</div>
                          <div style={{ whiteSpace: "pre-wrap", color: notesTco.autres ? "#1a1a1a" : "#bbb", fontStyle: notesTco.autres ? "normal" : "italic" }}>
                            {notesTco.autres || "ex. consultés mais n'ont pas répondu à la demande de devis, ou ne vendent pas l'article recherché"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td rowSpan={rowSpanMotif} style={{ ...tdTco, background: "#EAF7EE", verticalAlign: "top", padding: 10 }}>
                      <div style={lblStyle}>Total au prix le moins cher (HT)</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{totalPreconisation.ht.toLocaleString("fr-FR")} Ar</div>
                      <div style={{ ...lblStyle, marginTop: 6 }}>TVA</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{totalPreconisation.tva.toLocaleString("fr-FR")} Ar</div>
                      <div style={{ ...lblStyle, marginTop: 6 }}>Total TTC</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1B7A4C" }}>{totalPreconisation.ttc.toLocaleString("fr-FR")} Ar</div>
                    </td>
                    {page.map((o) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, borderLeft: "1.25px solid #1a1a1a" }}>Montant HT</td>
                        <td style={tdTco}>{o.totalHT.toLocaleString("fr-FR")} Ar</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o) => {
                      const remiseObt = remiseObtenueOffre(o, lignesDemande);
                      return (
                        <Fragment key={o.id}>
                          <td colSpan={2} style={{ ...tdTco, borderLeft: "1.25px solid #1a1a1a" }}>Remise obtenue</td>
                          <td style={tdTco}>{remiseObt ? `${remiseObt.toLocaleString("fr-FR")} Ar` : ""}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                  <tr>
                    {page.map((o) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, borderLeft: "1.25px solid #1a1a1a" }}>TVA</td>
                        <td style={tdTco}>{o.assujetti_tva === false ? <span style={{ color: "#999", fontStyle: "italic" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR")} Ar`}</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, borderLeft: "1.25px solid #1a1a1a", fontWeight: 600 }}>Total TTC</td>
                        <td style={{ ...tdTco, fontWeight: 700, color: "#1B7A4C" }}>{o.totalTTC.toLocaleString("fr-FR")} Ar</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o) => {
                      const exceptions = remiseExceptionsOffre(o, lignesDemande, fournisseursDetailMap);
                      const echeance = fournisseursDetailMap[o.fournisseur_id]?.conditions_paiement_jours;
                      const lignesObs = [];
                      if (echeance) lignesObs.push(`* Échéance ${echeance} jours`);
                      exceptions.forEach((e) => {
                        if (e.remise === 0) lignesObs.push(`* Pas de remise sur l'article n°${e.numero} (${truncateTexte(e.designation, 26)}) — habituellement ${e.defaut}%`);
                        else lignesObs.push(`* Remise de ${e.remise}% sur l'article n°${e.numero} (${truncateTexte(e.designation, 26)}), au lieu de ${e.defaut}% habituellement`);
                      });
                      return (
                        <td key={o.id} colSpan={3} style={{ ...tdTco, borderLeft: "1.25px solid #1a1a1a", verticalAlign: "top", fontSize: 8.8 }}>
                          <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>Observation</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{lignesObs.join("\n")}</div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {derniere && (
              <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
                <div style={{ flex: 1, maxWidth: 260 }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #1a1a1a", paddingBottom: 5, marginBottom: 40 }}>Validation technique</div>
                  <div style={{ fontSize: 8.5, color: "#888", borderTop: "0.75px solid #ddd", paddingTop: 4 }}>Date / Nom / Signature</div>
                </div>
                <div style={{ flex: 1, maxWidth: 260 }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid #1a1a1a", paddingBottom: 5, marginBottom: 40 }}>Validation direction</div>
                  <div style={{ fontSize: 8.5, color: "#888", borderTop: "0.75px solid #ddd", paddingTop: 4 }}>Date / Nom / Signature</div>
                </div>
              </div>
            )}
          </div>
        );})}
      </div>
    </AuthGuard>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 7.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const cadreStyle = { border: "1.5px solid #1a1a1a", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" };
const lblStyle = { fontSize: 8.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 };
const thBlank = { borderBottom: "none", padding: 0 };
const thGroupStart = { borderLeft: "1.25px solid #1a1a1a", borderBottom: "none" };
const thTco = { padding: "3px 5px 5px", fontSize: 8, fontWeight: 600, textAlign: "left", color: "#888", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1.2px solid #1a1a1a" };
const tdTco = { padding: "4px", fontSize: 10, borderBottom: "0.75px solid #eee" };
