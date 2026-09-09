"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { useRole } from "../../../lib/useRole";
import { thStyle, tdStyle, linkBtn, buttonStyle, inputStyle } from "../../components/ui";
import { IconPrint, IconTrash } from "../../components/Icons";
import { montantEnLettresAriary } from "../../../lib/nombreEnLettres";
import { formatDate } from "../../../lib/format";

const RECEPTIONNAIRES = ["Magasin", "Direction", "Site travaux", "Prestataire", "Autre"];
const TYPES_LIVRAISON = ["Livraison fournisseur", "Enlèvement par nos soins"];
const nouvelleSaisie = () => ({ receptionnaire: "Magasin", receptionnaireAutre: "", numeroBl: "", typeLivraison: "Livraison fournisseur", dateLivraisonTerrain: "" });

export default function CommandeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const role = useRole();
  const [articlesBase, setArticlesBase] = useState([]);
  const [modeEdition, setModeEdition] = useState(false);
  const [editLignes, setEditLignes] = useState([]);
  const [enregistrementEdition, setEnregistrementEdition] = useState(false);
  const [bc, setBc] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [demande, setDemande] = useState(null);
  const [fournisseurDetail, setFournisseurDetail] = useState(null);
  const [offreLiee, setOffreLiee] = useState(null);
  const [receptions, setReceptions] = useState([]); // historique complet, avec .lignes
  const [saisie, setSaisie] = useState(nouvelleSaisie());
  const [quantitesSaisie, setQuantitesSaisie] = useState({}); // ligne_bc_id -> qté livrée maintenant
  const [loading, setLoading] = useState(true);
  const [facture, setFacture] = useState({ numero_facture: "", date_facture: "", echeance_jours: 30, statut_paiement: "Impayé", date_paiement: "", mode_paiement: "" });
  const [emetteur, setEmetteur] = useState({ nom: "Judicaël RANDRIANAIVO", telephone: "+261 38 77 419 60", email: "judicael.randrianaivo@unifoods.mg" });
  const [transmission, setTransmission] = useState({ dateEnvoiSignature: "", dateRetourSignature: "", destinataireSignature: "", dateEnvoiPaiement: "", dateDisponibilitePaiement: "", destinatairePaiement: "" });
  const [accuses, setAccuses] = useState([]);
  const [nouvelAccuse, setNouvelAccuse] = useState({ date_accuse: "", date_facture: "", numero_facture: "", montant: "", demandeur: "", observation: "" });
  const [dateSignature, setDateSignature] = useState("");
  const [observation, setObservation] = useState("");
  const [dateEstimeeReste, setDateEstimeeReste] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [modeImpression, setModeImpression] = useState("bc");
  const [onglet, setOnglet] = useState("bc");

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").eq("id", id).single();
    const { data: l } = await supabase.from("lignes_bc").select("*").eq("bc_id", id);
    const { data: r } = await supabase.from("receptions").select("*").eq("bc_id", id).order("date_reception_reelle");
    let receptionsAvecLignes = [];
    if (r && r.length) {
      const { data: lr } = await supabase.from("lignes_reception").select("*").in("reception_id", r.map((x) => x.id));
      receptionsAvecLignes = r.map((rec) => ({ ...rec, lignes: (lr || []).filter((x) => x.reception_id === rec.id) }));
    }
    setBc(c);
    setLignes(l || []);
    setReceptions(receptionsAvecLignes);
    setDateEstimeeReste(c?.date_estimee_reste || "");

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
    if (c?.demande_id && c?.fournisseur_id) {
      const { data: off } = await supabase.from("offres").select("numero_devis, date_devis").eq("demande_id", c.demande_id).eq("fournisseur_id", c.fournisseur_id).maybeSingle();
      setOffreLiee(off || null);
    } else {
      setOffreLiee(null);
    }

    if (c) {
      setFacture({
        numero_facture: c.numero_facture || "",
        date_facture: c.date_facture || "",
        echeance_jours: c.echeance_jours ?? 30,
        statut_paiement: c.statut_paiement || "Impayé",
        date_paiement: c.date_paiement || "",
        mode_paiement: c.mode_paiement || "",
      });
      setDateSignature(c.date_signature || "");
      setObservation(c.observation || "");
      setTransmission({
        dateEnvoiSignature: c.date_envoi_signature || "", dateRetourSignature: c.date_retour_signature || "",
        destinataireSignature: c.destinataire_signature || "", dateEnvoiPaiement: c.date_envoi_paiement || "",
        dateDisponibilitePaiement: c.date_disponibilite_paiement || "", destinatairePaiement: c.destinataire_paiement || "",
      });
    }
    const { data: acc } = await supabase.from("accuses_reception_facture").select("*").eq("bc_id", id).order("date_accuse", { ascending: false });
    setAccuses(acc || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data: p } = await supabase.from("profiles").select("nom, telephone").eq("id", userData.user.id).maybeSingle();
      setEmetteur({
        nom: p?.nom || userData.user.email,
        telephone: p?.telephone || "",
        email: userData.user.email || "",
      });
    })();
  }, []);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("articles").select("id, designation, unite_defaut, dernier_prix_ht").limit(10000);
      setArticlesBase(data || []);
    })();
  }, []);

  // Cumul livré par ligne, toutes réceptions confondues
  const cumulLivre = (ligneBcId) => receptions.reduce((s, r) => s + (r.lignes.find((x) => x.ligne_bc_id === ligneBcId)?.quantite_livree ? Number(r.lignes.find((x) => x.ligne_bc_id === ligneBcId).quantite_livree) : 0), 0);

  const etatLivraison = () => {
    if (bc?.statut === "Clôturée (rupture)") return "Clôturé (rupture)";
    let toutLivre = true, unLivre = false;
    lignes.forEach((l) => {
      const c = cumulLivre(l.id);
      if (c > 0) unLivre = true;
      if (c < Number(l.quantite)) toutLivre = false;
    });
    if (toutLivre && unLivre) return "Livré";
    if (unLivre) return "Livré partiellement";
    return "Non livré";
  };

  const majQuantiteSaisie = (ligneBcId, val) => setQuantitesSaisie((prev) => ({ ...prev, [ligneBcId]: val }));

  const enregistrerReception = async () => {
    setEnregistrement(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "utilisateur";
    const receptionnaireFinal = saisie.receptionnaire === "Autre" ? saisie.receptionnaireAutre : saisie.receptionnaire;

    const lignesAvecSaisie = lignes.filter((l) => quantitesSaisie[l.id] !== undefined && quantitesSaisie[l.id] !== "");
    if (lignesAvecSaisie.length === 0) { setEnregistrement(false); return; }

    const toutLivreApres = lignes.every((l) => {
      const dejaCumul = cumulLivre(l.id);
      const nouveau = quantitesSaisie[l.id] !== undefined && quantitesSaisie[l.id] !== "" ? Number(quantitesSaisie[l.id]) : 0;
      return dejaCumul + nouveau >= Number(l.quantite);
    });

    const { data: nouvelle } = await supabase.from("receptions").insert({
      bc_id: id, receptionnaire: receptionnaireFinal, numero_bl: saisie.numeroBl, type_livraison: saisie.typeLivraison,
      date_livraison_terrain: saisie.dateLivraisonTerrain || null, confirme_par: email,
      statut: toutLivreApres ? "Totale" : "Partielle",
    }).select().single();

    if (nouvelle) {
      const payload = lignesAvecSaisie.map((l) => ({
        reception_id: nouvelle.id, ligne_bc_id: l.id, quantite_livree: Number(quantitesSaisie[l.id]) || 0,
      }));
      await supabase.from("lignes_reception").insert(payload);
    }

    await supabase.from("commandes").update({ statut: toutLivreApres ? "Clôturée" : "Livraison en cours" }).eq("id", id);
    setSaisie(nouvelleSaisie());
    setQuantitesSaisie({});
    setEnregistrement(false);
    charger();
  };

  const enregistrerDateEstimee = async () => {
    await supabase.from("commandes").update({ date_estimee_reste: dateEstimeeReste || null }).eq("id", id);
    charger();
  };

  const enregistrerSignatureObservation = async () => {
    await supabase.from("commandes").update({ date_signature: dateSignature || null, observation }).eq("id", id);
    charger();
  };

  const enregistrerTransmission = async () => {
    await supabase.from("commandes").update({
      date_envoi_signature: transmission.dateEnvoiSignature || null,
      date_retour_signature: transmission.dateRetourSignature || null,
      destinataire_signature: transmission.destinataireSignature,
      date_envoi_paiement: transmission.dateEnvoiPaiement || null,
      date_disponibilite_paiement: transmission.dateDisponibilitePaiement || null,
      destinataire_paiement: transmission.destinatairePaiement,
    }).eq("id", id);
    charger();
  };

  const ajouterAccuse = async () => {
    if (!nouvelAccuse.numero_facture.trim()) return;
    await supabase.from("accuses_reception_facture").insert({
      bc_id: id,
      date_accuse: nouvelAccuse.date_accuse || null,
      date_facture: nouvelAccuse.date_facture || null,
      numero_facture: nouvelAccuse.numero_facture,
      montant: nouvelAccuse.montant === "" ? null : Number(nouvelAccuse.montant),
      demandeur: nouvelAccuse.demandeur,
      observation: nouvelAccuse.observation,
    });
    setNouvelAccuse({ date_accuse: "", date_facture: "", numero_facture: "", montant: "", demandeur: "", observation: "" });
    charger();
  };

  const supprimerAccuse = async (accId) => {
    await supabase.from("accuses_reception_facture").delete().eq("id", accId);
    charger();
  };

  const arreterCommandeSurReste = async () => {
    const restantes = lignes.filter((l) => cumulLivre(l.id) < Number(l.quantite));
    if (restantes.length === 0) return;
    if (!confirm(`Arrêter cette commande sur le déjà-livré ? Une nouvelle demande d'achat sera créée avec les ${restantes.length} article(s) restant(s), à sourcer ailleurs.`)) return;

    const { data: nouvelleDemande } = await supabase.from("demandes").insert({
      service: demande?.service || "", demandeur: demande?.demandeur || "",
      motif_projet: `Reliquat non livré par ${bc.fournisseur_nom} sur ${bc.numero}`,
    }).select().single();

    if (nouvelleDemande) {
      const payload = restantes.map((l) => ({
        demande_id: nouvelleDemande.id, designation: l.designation,
        quantite: Number(l.quantite) - cumulLivre(l.id), unite: l.unite,
      }));
      await supabase.from("lignes_demande").insert(payload);
    }
    await supabase.from("commandes").update({ statut: "Clôturée (rupture)" }).eq("id", id);
    charger();
    if (nouvelleDemande) router.push(`/demandes/${nouvelleDemande.id}`);
  };

  const enregistrerFacture = async () => {
    await supabase.from("commandes").update({
      numero_facture: facture.numero_facture,
      date_facture: facture.date_facture || null,
      echeance_jours: Number(facture.echeance_jours) || 30,
      statut_paiement: facture.statut_paiement,
      mode_paiement: facture.statut_paiement === "Payé" ? facture.mode_paiement || null : null,
      date_paiement: facture.statut_paiement === "Payé" ? (facture.date_paiement || new Date().toISOString().slice(0, 10)) : null,
    }).eq("id", id);
    charger();
  };

  const commencerEdition = () => {
    setEditLignes(lignes.map((l) => ({
      key: l.id, designation: l.designation, quantite: l.quantite, unite: l.unite,
      prix_unitaire_ht: l.prix_unitaire_ht, remise_pct: l.remise_pct || 0,
    })));
    setModeEdition(true);
  };

  const majEditLigne = (key, field, val) => setEditLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const ajouterEditLigne = () => setEditLignes((prev) => [...prev, { key: `nouvelle-${Date.now()}`, designation: "", quantite: 1, unite: "pcs", prix_unitaire_ht: "", remise_pct: 0 }]);
  const retirerEditLigne = (key) => setEditLignes((prev) => prev.filter((l) => l.key !== key));

  const onDesignationEditChange = (key, val) => {
    majEditLigne(key, "designation", val);
    const match = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (match) {
      majEditLigne(key, "unite", match.unite_defaut || "pcs");
    }
  };

  const enregistrerEdition = async () => {
    const valides = editLignes.filter((l) => l.designation.trim() && l.prix_unitaire_ht !== "");
    if (valides.length === 0) return;
    setEnregistrementEdition(true);

    let montantHt = 0;
    valides.forEach((l) => {
      montantHt += (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
    });
    const assujetti = bc.assujetti_tva !== false;
    const tva = assujetti ? montantHt * 0.2 : 0;

    await supabase.from("lignes_bc").delete().eq("bc_id", id);
    await supabase.from("lignes_bc").insert(valides.map((l) => ({
      bc_id: id, designation: l.designation, quantite: Number(l.quantite) || 1, unite: l.unite,
      prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0, remise_pct: Number(l.remise_pct) || 0,
      montant_ht: (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100),
    })));
    await supabase.from("commandes").update({ montant_ht: montantHt, montant_tva: tva, montant_ttc: montantHt + tva }).eq("id", id);

    setModeEdition(false);
    setEnregistrementEdition(false);
    charger();
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!bc) return <AuthGuard><p>Bon de commande introuvable.</p></AuthGuard>;

  const resteGlobal = lignes.some((l) => cumulLivre(l.id) < Number(l.quantite));
  const derniere = receptions[receptions.length - 1];

  return (
    <AuthGuard>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .pv-template { display: none; }
        @media print { .pv-template.print-area { display: block; } }
        .bc-template { display: none; }
        @media print { .bc-template.print-area { display: block; } }
        .tableau-zebre tbody tr:nth-child(odd) { background: #F5F5F5; }
        .tableau-zebre tbody tr:nth-child(odd) td { border-bottom: 1px solid #E2E2E2; }
        .tableau-zebre tbody tr:nth-child(even) { background: #FFFFFF; }
        .tableau-zebre tbody tr:nth-child(even) td { border-bottom: 1px solid #F0F0F0; }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux commandes</button>

      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "bc", label: "Bon de commande" },
          { id: "reception", label: `Réception${resteGlobal ? "" : " ✓"}` },
          { id: "facture", label: "Facture & Paiement" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
              background: onglet === o.id ? "#1E3A34" : "#fff",
              color: onglet === o.id ? "#fff" : "#1B2430",
              fontWeight: onglet === o.id ? 600 : 400,
              boxShadow: onglet === o.id ? "none" : "0 1px 3px rgba(16,24,40,0.05)",
              border: "1px solid #ECEBE6",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ---- Bon de commande ---- */}
      {onglet === "bc" && (
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 24, marginBottom: 20 }} className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="UNIFOODS" style={{ height: 32 }} /> — Bon de commande
            </h1>
            <p style={{ fontSize: 14, color: "#666" }}>{bc.numero} — {bc.date}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }} className="no-print">
            {role === "acheteur" && !modeEdition && (
              <button onClick={commencerEdition} style={{ ...buttonStyle, background: "#888" }}>Modifier le BC</button>
            )}
            <button onClick={() => { setModeImpression("bc"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888", display: "inline-flex", alignItems: "center", gap: 6 }}><IconPrint /> Imprimer le BC</button>
          </div>
        </div>

        <p style={{ fontSize: 14, marginBottom: 16 }}><strong>Fournisseur :</strong> {bc.fournisseur_nom}</p>

        {demande && (
          <p className="no-print" style={{ fontSize: 13, marginBottom: 16 }}>
            <strong>Demande d'origine :</strong>{" "}
            <Link href={`/demandes/${demande.id}`} style={{ color: "#1E3A34", textDecoration: "underline" }}>{demande.numero}</Link>
            {demande.numero_tco && <> — TCO {demande.numero_tco}</>}
          </p>
        )}

        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#666" }}>Date de signature du BC :</label>
          <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} style={inputStyle} />
          <input placeholder="Observation" value={observation} onChange={(e) => setObservation(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button onClick={enregistrerSignatureObservation} style={{ ...buttonStyle, background: "#888" }}>Enregistrer</button>
        </div>

        {modeEdition ? (
          <div className="no-print">
            {editLignes.map((l) => (
              <div key={l.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <Autocomplete
                  placeholder="Désignation"
                  value={l.designation}
                  onChange={(val) => onDesignationEditChange(l.key, val)}
                  suggestions={articlesBase.map((a) => a.designation)}
                  style={{ flex: 2 }}
                />
                <input type="number" placeholder="Qté" value={l.quantite} onChange={(e) => majEditLigne(l.key, "quantite", e.target.value)} style={{ ...inputStyle, width: 80 }} />
                <input placeholder="unité" value={l.unite} onChange={(e) => majEditLigne(l.key, "unite", e.target.value)} style={{ ...inputStyle, width: 90 }} />
                <input type="number" placeholder="PU HT" value={l.prix_unitaire_ht} onChange={(e) => majEditLigne(l.key, "prix_unitaire_ht", e.target.value)} style={{ ...inputStyle, width: 110 }} />
                <input type="number" placeholder="remise %" value={l.remise_pct} onChange={(e) => majEditLigne(l.key, "remise_pct", e.target.value)} style={{ ...inputStyle, width: 90 }} />
                <button onClick={() => retirerEditLigne(l.key)} style={linkBtn}>Retirer</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 20 }}>
              <button onClick={ajouterEditLigne} style={{ ...buttonStyle, background: "#888" }}>+ Ajouter une ligne</button>
              <button onClick={enregistrerEdition} disabled={enregistrementEdition} style={buttonStyle}>
                {enregistrementEdition ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
              <button onClick={() => setModeEdition(false)} style={{ ...buttonStyle, background: "#fff", color: "#1B2430", border: "1px solid #ddd" }}>Annuler</button>
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={thStyle}>Article</th><th style={thStyle}>Qté</th><th style={thStyle}>Unité</th>
                <th style={thStyle}>PU HT</th><th style={thStyle}>Remise</th><th style={thStyle}>Montant HT</th>
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
        )}

        <div style={{ marginLeft: "auto", width: 260 }}>
          <div style={rowTotal}><span>Total HT</span><span>{Number(bc.montant_ht).toLocaleString("fr-FR")} Ar</span></div>
          <div style={rowTotal}><span>TVA</span><span>{bc.assujetti_tva === false ? "Non taxable" : `${Number(bc.montant_tva).toLocaleString("fr-FR")} Ar`}</span></div>
          <div style={{ ...rowTotal, fontWeight: 700, borderTop: "1px solid #ddd", paddingTop: 6 }}>
            <span>Total TTC</span><span>{Number(bc.montant_ttc).toLocaleString("fr-FR")} Ar</span>
          </div>
        </div>

        <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <div>Établi par : ____________________</div>
          <div>Signature Direction : ____________________</div>
        </div>
      </div>
      )}

      {/* ---- Réception ---- */}
      {onglet === "reception" && (
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15 }}>Réception</h2>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: etatLivraison() === "Livré" ? "#EAF7EE" : etatLivraison().startsWith("Livré partiellement") ? "#FFF3D6" : etatLivraison().startsWith("Clôturé") ? "#F0EFEA" : "#F0EFEA", color: etatLivraison() === "Livré" ? "#1B7A4C" : etatLivraison().startsWith("Livré partiellement") ? "#8A6100" : "#888" }}>
            {etatLivraison()}
          </span>
        </div>

        {receptions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Historique des réceptions</div>
            {receptions.map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                Le <strong>{new Date(r.date_reception_reelle).toLocaleString("fr-FR")}</strong> — {r.receptionnaire} ({r.type_livraison}{r.numero_bl ? `, BL ${r.numero_bl}` : ""}) —
                {" "}{r.lignes.map((x) => `${lignes.find((l) => l.id === x.ligne_bc_id)?.designation || "?"}: ${x.quantite_livree}`).join(", ")}
                {" "}— saisi par {r.confirme_par}
              </div>
            ))}
          </div>
        )}

        {resteGlobal ? (
          <>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Imprime le PV à l'avance pour le donner au magasin, ou saisis directement une nouvelle réception (partielle ou totale sur le reste).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select value={saisie.receptionnaire} onChange={(e) => setSaisie({ ...saisie, receptionnaire: e.target.value })} style={inputStyle}>
                {RECEPTIONNAIRES.map((r) => <option key={r}>{r}</option>)}
              </select>
              {saisie.receptionnaire === "Autre" && (
                <input placeholder="Préciser le réceptionnaire" value={saisie.receptionnaireAutre} onChange={(e) => setSaisie({ ...saisie, receptionnaireAutre: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              )}
              <select value={saisie.typeLivraison} onChange={(e) => setSaisie({ ...saisie, typeLivraison: e.target.value })} style={inputStyle}>
                {TYPES_LIVRAISON.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="N° de Bon de Livraison (BL)" value={saisie.numeroBl} onChange={(e) => setSaisie({ ...saisie, numeroBl: e.target.value })} style={{ ...inputStyle, width: 180 }} />
              <input type="date" value={saisie.dateLivraisonTerrain} onChange={(e) => setSaisie({ ...saisie, dateLivraisonTerrain: e.target.value })} style={inputStyle} />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Article</th><th style={thStyle}>Qté commandée</th><th style={thStyle}>Déjà livré</th>
                  <th style={thStyle}>Reste à livrer</th><th style={thStyle}>Qté livrée maintenant</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const deja = cumulLivre(l.id);
                  const reste = Math.max(0, Number(l.quantite) - deja);
                  if (reste === 0) return null;
                  return (
                    <tr key={l.id}>
                      <td style={tdStyle}>{l.designation}</td>
                      <td style={tdStyle}>{l.quantite} {l.unite}</td>
                      <td style={tdStyle}>{deja} {l.unite}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{reste} {l.unite}</td>
                      <td style={tdStyle}>
                        <input type="number" min="0" max={reste} value={quantitesSaisie[l.id] ?? ""} onChange={(e) => majQuantiteSaisie(l.id, e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => { setModeImpression("pv"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888", display: "inline-flex", alignItems: "center", gap: 6 }}><IconPrint /> Imprimer le PV de réception</button>
              <button onClick={enregistrerReception} disabled={enregistrement} style={buttonStyle}>
                {enregistrement ? "Enregistrement..." : "Enregistrer cette réception"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#666" }}>Date estimée du reste à livrer :</label>
                <input type="date" value={dateEstimeeReste} onChange={(e) => setDateEstimeeReste(e.target.value)} style={inputStyle} />
                <button onClick={enregistrerDateEstimee} style={{ ...buttonStyle, background: "#888" }}>Enregistrer</button>
                <button onClick={arreterCommandeSurReste} style={{ ...buttonStyle, background: "#B3261E", marginLeft: "auto" }}>
                  Arrêter la commande sur le déjà-livré (rupture fournisseur)
                </button>
              </div>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#1B7A4C" }}>✓ Commande entièrement livrée.</p>
        )}
      </div>
      )}

      {/* ---- Suivi transmission signature / paiement ---- */}
      {onglet === "facture" && (
      <>
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Suivi de transmission</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Pour signature</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div>
                <label style={miniLabel}>Date d'envoi</label>
                <input type="date" value={transmission.dateEnvoiSignature} onChange={(e) => setTransmission({ ...transmission, dateEnvoiSignature: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Date de retour signé</label>
                <input type="date" value={transmission.dateRetourSignature} onChange={(e) => setTransmission({ ...transmission, dateRetourSignature: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Destinataire</label>
                <input placeholder="ex: Mayuri" value={transmission.destinataireSignature} onChange={(e) => setTransmission({ ...transmission, destinataireSignature: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Pour paiement</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div>
                <label style={miniLabel}>Date d'envoi compta</label>
                <input type="date" value={transmission.dateEnvoiPaiement} onChange={(e) => setTransmission({ ...transmission, dateEnvoiPaiement: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Date disponibilité paiement</label>
                <input type="date" value={transmission.dateDisponibilitePaiement} onChange={(e) => setTransmission({ ...transmission, dateDisponibilitePaiement: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Destinataire</label>
                <input placeholder="ex: Compta" value={transmission.destinatairePaiement} onChange={(e) => setTransmission({ ...transmission, destinatairePaiement: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </div>
          </div>
        </div>
        <button onClick={enregistrerTransmission} style={{ ...buttonStyle, marginTop: 12 }}>Enregistrer</button>
      </div>

      {/* ---- Accusés de réception facture ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Accusés de réception facture</h2>
        {accuses.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date accusé</th><th style={thStyle}>Date facture</th><th style={thStyle}>N° facture</th>
                <th style={thStyle}>Montant</th><th style={thStyle}>Demandeur</th><th style={thStyle}>Observation</th><th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {accuses.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.date_accuse || "-"}</td>
                  <td style={tdStyle}>{a.date_facture || "-"}</td>
                  <td style={tdStyle}>{a.numero_facture}</td>
                  <td style={tdStyle}>{a.montant ? `${Number(a.montant).toLocaleString("fr-FR")} Ar` : "-"}</td>
                  <td style={tdStyle}>{a.demandeur || "-"}</td>
                  <td style={tdStyle}>{a.observation || "-"}</td>
                  <td style={tdStyle}><button onClick={() => supprimerAccuse(a.id)} style={{ ...linkBtn, display: "inline-flex", alignItems: "center" }} title="Supprimer"><IconTrash /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" placeholder="Date accusé" value={nouvelAccuse.date_accuse} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, date_accuse: e.target.value })} style={inputStyle} />
          <input type="date" placeholder="Date facture" value={nouvelAccuse.date_facture} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, date_facture: e.target.value })} style={inputStyle} />
          <input placeholder="N° facture" value={nouvelAccuse.numero_facture} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, numero_facture: e.target.value })} style={{ ...inputStyle, width: 140 }} />
          <input type="number" placeholder="Montant" value={nouvelAccuse.montant} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, montant: e.target.value })} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="Demandeur" value={nouvelAccuse.demandeur} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, demandeur: e.target.value })} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="Observation" value={nouvelAccuse.observation} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, observation: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={ajouterAccuse} style={buttonStyle}>+ Ajouter</button>
        </div>
      </div>

      {/* ---- Facture / paiement ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Facture et paiement</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input placeholder="N° de facture" value={facture.numero_facture} onChange={(e) => setFacture({ ...facture, numero_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="date" value={facture.date_facture} onChange={(e) => setFacture({ ...facture, date_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Échéance (jours)" value={facture.echeance_jours} onChange={(e) => setFacture({ ...facture, echeance_jours: e.target.value })} style={{ ...inputStyle, width: 150 }} />
          <select value={facture.statut_paiement} onChange={(e) => setFacture({ ...facture, statut_paiement: e.target.value })} style={inputStyle}>
            <option>Impayé</option>
            <option>Payé</option>
          </select>
          {facture.statut_paiement === "Payé" && (
            <select value={facture.mode_paiement} onChange={(e) => setFacture({ ...facture, mode_paiement: e.target.value })} style={inputStyle}>
              <option value="">Mode de règlement...</option>
              <option>Chèque</option>
              <option>Espèces</option>
              <option>Virement</option>
            </select>
          )}
        </div>
        <button onClick={enregistrerFacture} style={buttonStyle}>Enregistrer</button>
      </div>
      </>
      )}

      {/* ---- PV de réception (imprimable) ---- */}
      <div className={`bc-template ${modeImpression === "bc" ? "print-area" : ""}`} style={{ padding: 24, fontFamily: "Arial, sans-serif", color: "#1a1a1a", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <img src="/logo.png" alt="UNIFOODS" style={{ height: 46 }} />
          <div style={{ flex: 1, ...encadreDouble(), padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: VERT }}>Bon de Commande</span>
            <span style={{ fontSize: 12, color: GRIS_LABEL }}><strong style={{ color: GRIS_LABEL }}>N°</strong> &nbsp; {bc.numero}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <div style={infoBox}>
            <LigneInfo label="Date" value={formatDate(bc.date)} />
            <LigneInfo label="Emis par" value={emetteur.nom} />
            <LigneInfo label="Contact" value={emetteur.telephone} />
            <LigneInfo label="E-Mail" value={emetteur.email} />
            <div style={{ height: 8 }} />
            <LigneInfo label="Date DA" value={demande ? formatDate(demande.created_at) : ""} />
            <LigneInfo label="DA N°" value={demande?.numero || ""} />
            <LigneInfo label="Objet" value={demande?.motif_projet || ""} />
            <LigneInfo label="Utilisateur Final" value={demande?.demandeur || ""} />
          </div>
          <div style={infoBox}>
            <LigneInfo label="Destinataire" value={bc.fournisseur_nom} accent />
            <LigneInfo label="Adresse" value={fournisseurDetail?.adresse || ""} />
            <LigneInfo label="Code postal" value={fournisseurDetail?.code_postal || ""} />
            <LigneInfo label="NIF" value={fournisseurDetail?.nif || ""} />
            <LigneInfo label="STAT" value={fournisseurDetail?.stat || ""} />
            <LigneInfo label="RCS" value={fournisseurDetail?.rcs || ""} />
            <LigneInfo label="Contact" value={fournisseurDetail?.contact || ""} />
            <LigneInfo label="Tél" value={fournisseurDetail?.telephone || ""} />
            <LigneInfo label="E-Mail" value={fournisseurDetail?.email || ""} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={infoBoxPlate}>
            <LigneInfo label="Adresse de livraison" value="Lot AZ 122 AI ZI SANTILO ANOSIZATO OUEST" />
            <LigneInfo label="Réceptionnaire" value="Magasin" />
          </div>
          <div style={infoBoxVert}>
            <LigneInfo label="Type de règlement" value={fournisseurDetail?.type_reglement || ""} />
            <LigneInfo label="Modalité de paiement" value={fournisseurDetail?.conditions_paiement_jours ? `${fournisseurDetail.conditions_paiement_jours} Jours` : ""} />
          </div>
        </div>

        <div style={ombrePortee(false)} />
        <table className="tableau-zebre" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thPrint}>Réf. Devis n°</th><th style={thPrint}>Description</th><th style={thPrint}>Quantité</th>
              <th style={thPrint}>Unité</th><th style={thPrint}>PU</th><th style={thPrint}>Remise</th>
              <th style={thPrint}>PU Net</th><th style={{ ...thPrint, borderRight: "none" }}>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {offreLiee?.numero_devis && (
              <tr><td colSpan={8} style={{ padding: "6px 4px", fontWeight: 600, fontSize: 11 }}>
                {offreLiee.numero_devis}{offreLiee.date_devis ? ` du ${formatDate(offreLiee.date_devis)}` : ""}
              </td></tr>
            )}
            {avecLignesVides(lignes, 16).map((l) => {
              if (l.__vide) return (
                <tr key={l.id}><td style={tdPrint}>&nbsp;</td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td></tr>
              );
              const puNet = (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
              return (
                <tr key={l.id}>
                  <td style={tdPrint}></td>
                  <td style={tdPrint}>{l.designation}</td>
                  <td style={{ ...tdPrint, textAlign: "center" }}>{Number(l.quantite).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</td>
                  <td style={tdPrint}>{l.unite}</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{l.remise_pct ? `${l.remise_pct}%` : ""}</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{puNet.toLocaleString("fr-FR")} Ar</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ ...ombrePortee(true), display: "flex", alignItems: "center", justifyContent: "flex-end", position: "relative" }}>
          <span style={{ position: "absolute", right: 4, top: 4, fontSize: 8, color: "#fff" }}>Page 1/1</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 }}>
          <div style={{ fontSize: 12, color: NOIR_VALEUR }}>Signature :</div>
          <div style={{ width: 290, ...encadreDouble(), padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: GRIS_LABEL }}>
              <span>Montant Total HT</span><strong style={{ color: NOIR_VALEUR }}>{Number(bc.montant_ht).toLocaleString("fr-FR")} Ar</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: GRIS_LABEL }}>
              <span>Tva {bc.assujetti_tva === false ? "0%" : "20%"}</span>
              <strong style={{ color: NOIR_VALEUR }}>{bc.assujetti_tva === false ? "-" : `${Number(bc.montant_tva).toLocaleString("fr-FR")} Ar`}</strong>
            </div>
            <div style={{ marginTop: 8, background: "#fff", borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: NOIR_VALEUR }}>
              <span>NET A PAYER TTC</span><span>{Number(bc.montant_ttc).toLocaleString("fr-FR")} Ar</span>
            </div>
          </div>
        </div>

        <div style={{ height: 90 }} />

        <p style={{ textAlign: "center", fontStyle: "italic", fontSize: 12, color: NOIR_VALEUR }}>
          Arrêter le présent Bon de Commande à la somme de : {montantEnLettresAriary(bc.montant_ttc)}
        </p>

        <div style={doubleLigneVerte} />

        <div style={{ fontSize: 10, color: GRIS_LABEL }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong style={{ color: NOIR_VALEUR }}>UNIFOODS</strong><br />Siège Sociale<br />27, Rue Radama 1er Tsaralalana<br />101 Antananarivo<br />Madagascar
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ color: NOIR_VALEUR }}>Coordonnées fiscaux</strong><br />NIF : 3001453076<br />STAT : 10505 11 2013 1 11066<br />RCS : 21013 B 00860 2018 B 01049
            </div>
          </div>
          <div style={{ height: 10, background: VERT_FONCE, marginTop: 14, borderRadius: 2 }} />
        </div>
      </div>

      <div className={`pv-template ${modeImpression === "pv" ? "print-area" : ""}`} style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <img src="/logo.png" alt="UNIFOODS" style={{ height: 46 }} />
          <div style={{ flex: 1, ...encadreDouble(), padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: VERT }}>PV de Réception</span>
            <span style={{ fontSize: 12, color: GRIS_LABEL }}><strong style={{ color: GRIS_LABEL }}>N°</strong> &nbsp; {receptions[receptions.length - 1]?.numero || "—"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <div style={infoBox}>
            <LigneInfo label="Date" value={formatDate(new Date().toISOString())} />
            <LigneInfo label="Emis par" value={emetteur.nom} />
            <LigneInfo label="Contact" value={emetteur.telephone} />
            <LigneInfo label="E-Mail" value={emetteur.email} />
            <div style={{ height: 8 }} />
            <LigneInfo label="Date DA" value={demande ? formatDate(demande.created_at) : ""} />
            <LigneInfo label="DA N°" value={demande?.numero || ""} />
            <LigneInfo label="Destinataire" value={bc.fournisseur_nom} />
            <LigneInfo label="Utilisateur Final" value={demande?.demandeur || ""} />
          </div>
          <div style={infoBoxVert}>
            <LigneInfo label="Fournisseur" value={bc.fournisseur_nom} accent />
            <LigneInfo label="Adresse" value={fournisseurDetail?.adresse || ""} />
            <LigneInfo label="Code postal" value={fournisseurDetail?.code_postal || ""} />
            <LigneInfo label="NIF" value={fournisseurDetail?.nif || ""} />
            <LigneInfo label="STAT" value={fournisseurDetail?.stat || ""} />
            <LigneInfo label="RCS" value={fournisseurDetail?.rcs || ""} />
            <LigneInfo label="Contact" value={fournisseurDetail?.contact || ""} />
            <LigneInfo label="Tél" value={fournisseurDetail?.telephone || ""} />
            <LigneInfo label="E-Mail" value={fournisseurDetail?.email || ""} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={infoBoxPlate}>
            <LigneInfo label="Date de livraison" value="____________" />
            <LigneInfo label="Nom Réceptionnaire du Magasin" value="____________" />
          </div>
          <div style={infoBoxVert}>
            <LigneInfo label="Type de règlement" value={fournisseurDetail?.type_reglement || ""} />
            <LigneInfo label="Modalité de paiement" value={fournisseurDetail?.conditions_paiement_jours ? `${fournisseurDetail.conditions_paiement_jours} Jours` : ""} />
          </div>
        </div>

        <div style={ombrePortee(false)} />
        <table className="tableau-zebre" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thPrint}>BC UF2 n°</th><th style={thPrint}>Description</th><th style={thPrint}>Quantité</th>
              <th style={thPrint}>Unité</th><th style={thPrint}>Quantité livré</th><th style={thPrint}>Unité</th>
              <th style={thPrint}>Reste à Livrer</th><th style={{ ...thPrint, borderRight: "none" }}>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {avecLignesVides(lignes, 16).map((l, i) => {
              if (l.__vide) return (
                <tr key={l.id}><td style={tdPrint}>&nbsp;</td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td><td style={tdPrint}></td></tr>
              );
              return (
                <tr key={l.id}>
                  <td style={tdPrint}>{i === 0 ? bc.numero : ""}</td>
                  <td style={tdPrint}>{l.designation}</td>
                  <td style={{ ...tdPrint, textAlign: "center" }}>{l.quantite}</td>
                  <td style={tdPrint}>{l.unite}</td>
                  <td style={tdPrint}></td>
                  <td style={tdPrint}></td>
                  <td style={tdPrint}></td>
                  <td style={tdPrint}></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ ...ombrePortee(true), position: "relative" }}>
          <span style={{ position: "absolute", right: 4, top: 4, fontSize: 8, color: "#fff" }}>Page 1/1</span>
        </div>

        <div style={doubleLigneVerte} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 20 }}>
          {["RESPONSABLE MAGASIN", "MAGASINIER", "AGENT DE SECURITE", "LIVREUR ou TRANSPORTEUR"].map((s) => (
            <div key={s} style={{ flex: 1, ...encadreDouble(), minHeight: 80, padding: "10px 10px 6px", textAlign: "center", fontSize: 10.5, fontWeight: 700, color: NOIR_VALEUR }}>
              {s}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, fontSize: 10, color: GRIS_LABEL }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong style={{ color: NOIR_VALEUR }}>UNIFOODS</strong><br />Siège Sociale<br />27, Rue Radama 1er Tsaralalana<br />101 Antananarivo<br />Madagascar
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ color: NOIR_VALEUR }}>Coordonnées fiscaux</strong><br />NIF : 3001453076<br />STAT : 10505 11 2013 1 11066<br />RCS : 21013 B 00860 2018 B 01049
            </div>
          </div>
          <div style={{ height: 10, background: VERT_FONCE, marginTop: 14, borderRadius: 2 }} />
        </div>
      </div>
    </AuthGuard>
  );
}

const rowTotal = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 };
const miniLabel = { display: "block", fontSize: 11, color: "#999", marginBottom: 2 };

function LigneInfo({ label, value, accent }) {
  return (
    <div style={{ display: "flex", fontSize: 11, marginBottom: 3 }}>
      <span style={{ width: 130, fontWeight: 400, color: GRIS_LABEL, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? VERT : NOIR_VALEUR }}>{value}</span>
    </div>
  );
}

const VERT = "#74BC1F";
const VERT_FONCE = "#185640";
const GRIS_FOND = "#E7E6E6";
const GRIS_BORD = "#BFBFBF";
const GRIS_LABEL = "#4D4D4D";
const NOIR_VALEUR = "#262626";

// Encadré arrondi avec le double-liseré (contour gris + fin trait blanc à
// l'intérieur) utilisé pour tous les blocs d'information du document.
const encadreDouble = (fond = GRIS_FOND) => ({
  flex: 1, background: fond, borderRadius: 10, border: `1px solid ${GRIS_BORD}`,
  boxShadow: "inset 0 0 0 3px #fff", padding: "13px 18px",
});
const infoBox = encadreDouble();
const infoBoxPlate = encadreDouble();
const infoBoxVert = encadreDouble("#E3F1E7");
const thPrint = { padding: "6px 4px", fontSize: 10, textAlign: "left", fontWeight: 700, background: GRIS_FOND, color: GRIS_LABEL, borderRight: "1px solid #fff" };
const tdPrint = { padding: "4px 4px", fontSize: 10.5, color: NOIR_VALEUR };
const doubleLigneVerte = { borderTop: `2.5px double ${VERT}`, margin: "18px 0" };
// Ombre portée fine, couleur verte, au-dessus (haut=true) ou en dessous du tableau
const ombrePortee = (haut) => ({
  height: 3, background: VERT,
  boxShadow: haut ? `0 3px 4px -1px rgba(116,188,31,0.55)` : `0 -3px 4px -1px rgba(116,188,31,0.55)`,
});
// Complète une liste de lignes avec des lignes vides pour garder un tableau
// à hauteur fixe (effet visuel du modèle réel), même s'il y a peu d'articles.
function avecLignesVides(lignes, minimum = 8) {
  const vides = Math.max(0, minimum - lignes.length);
  return [...lignes, ...Array.from({ length: vides }, (_, i) => ({ __vide: true, id: `vide-${i}` }))];
}
