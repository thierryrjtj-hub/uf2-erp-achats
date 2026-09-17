"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import Autocomplete from "../components/Autocomplete";
import { useRole } from "../../lib/useRole";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../components/ui";
import { formatDate } from "../../lib/format";

const empty = {
  date_demande: new Date().toISOString().slice(0, 10), article: "", quantite: 1, unite: "pcs",
  fournisseur: "", motif: "", montant_demande: "",
  signataire_direction: "", date_signature: "", montant_depense: "", justificatif: "", observation: "",
};

function statutCalcule(p) {
  if (p.montant_depense && p.justificatif) return "Justifié";
  if (p.signataire_direction && p.date_signature) return "Décaissé";
  return "Demandé";
}

const COULEUR_STATUT = {
  "Demandé": { bg: "#F0EFEA", fg: "#888" },
  "Décaissé": { bg: "#FFF3D6", fg: "#8A6100" },
  "Justifié": { bg: "#EAF7EE", fg: "#1B7A4C" },
};

const OBSERVATION_PETITE_CAISSE = "Achat en petite caisse — Payé en espèce";
const NOM_FOURNISSEUR_DIVERS = "Fournisseurs divers";

export default function PetiteCaissePage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("");

  const charger = async () => {
    const { data } = await supabase.from("petite_caisse").select("*").order("date_demande", { ascending: false }).limit(5000);
    setListe(data || []);
    const { data: art } = await supabase.from("articles").select("id, designation, unite_defaut, continue_par_id").limit(10000);
    setArticlesBase(art || []);
    const { data: f } = await supabase.from("fournisseurs").select("id, nom, tva_defaut_pct").order("nom").limit(10000);
    setFournisseurs(f || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const resoudreSuccesseur = (article) => {
    let courant = article;
    const vus = new Set();
    while (courant?.continue_par_id && !vus.has(courant.id)) {
      vus.add(courant.id);
      const suivant = articlesBase.find((a) => a.id === courant.continue_par_id);
      if (!suivant) break;
      courant = suivant;
    }
    return courant;
  };

  const onArticleChange = (val) => {
    const matchBrut = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (matchBrut) {
      const final = resoudreSuccesseur(matchBrut);
      setForm((prev) => ({ ...prev, article: final.designation, unite: final.unite_defaut || "pcs" }));
      return;
    }
    setForm((prev) => ({ ...prev, article: val }));
  };

  const filtrees = useMemo(() => {
    if (!filtreStatut) return liste;
    return liste.filter((p) => statutCalcule(p) === filtreStatut);
  }, [liste, filtreStatut]);

  const total = useMemo(() => filtrees.reduce((s, p) => s + (Number(p.montant_depense) || Number(p.montant_demande) || 0), 0), [filtrees]);

  // Trouve ou crée le fournisseur "Fournisseurs divers" (utilisé si aucun
  // fournisseur précis n'a été sélectionné à la saisie)
  const idFournisseurDivers = async () => {
    const { data: existant } = await supabase.from("fournisseurs").select("id").eq("nom", NOM_FOURNISSEUR_DIVERS).maybeSingle();
    if (existant) return existant.id;
    const { data: cree } = await supabase.from("fournisseurs").insert({ nom: NOM_FOURNISSEUR_DIVERS, type_reglement: "Espèces" }).select().single();
    return cree?.id || null;
  };

  // Cette demande d'achat en petite caisse est déjà validée par la direction
  // (fiche de décaissement) avant même la saisie ici : pas besoin de re-signer
  // un BC, il est donc créé et clôturé directement, marqué payé en espèce.
  const creerDemandeEtBc = async (form, userId) => {
    const { data: demande } = await supabase.from("demandes").insert({
      demandeur: form.signataire_direction || null, motif_projet: form.motif || form.article,
      statut: "Basculée en commande", observation: OBSERVATION_PETITE_CAISSE, created_by: userId,
    }).select().single();
    if (!demande) return;

    await supabase.from("lignes_demande").insert({
      demande_id: demande.id, designation: form.article, quantite: Number(form.quantite) || 1, unite: form.unite,
    });

    const fournisseurChoisi = fournisseurs.find((f) => f.nom === form.fournisseur);
    const fournisseurId = fournisseurChoisi ? fournisseurChoisi.id : await idFournisseurDivers();
    const fournisseurNom = fournisseurChoisi ? fournisseurChoisi.nom : NOM_FOURNISSEUR_DIVERS;
    const assujetti = fournisseurChoisi ? fournisseurChoisi.tva_defaut_pct !== 0 : false;
    const montant = Number(form.montant_demande) || 0;
    const montantHt = assujetti ? montant / 1.2 : montant;
    const tva = assujetti ? montant - montantHt : 0;
    const { data: bc } = await supabase.from("commandes").insert({
      demande_id: demande.id, fournisseur_id: fournisseurId, fournisseur_nom: fournisseurNom,
      assujetti_tva: assujetti, montant_ht: montantHt, montant_tva: tva, montant_ttc: montant,
      statut_paiement: "Payé", observation: OBSERVATION_PETITE_CAISSE, created_by: userId,
    }).select().single();
    if (!bc) return;

    const { data: ligneBc } = await supabase.from("lignes_bc").insert({
      bc_id: bc.id, designation: form.article, quantite: Number(form.quantite) || 1, unite: form.unite,
      prix_unitaire_ht: montantHt / (Number(form.quantite) || 1), remise_pct: 0, montant_ht: montantHt,
    }).select().single();

    const { data: reception } = await supabase.from("receptions").insert({
      bc_id: bc.id, statut: "Totale", date_reception_reelle: form.date_demande,
      receptionnaire: "Achat direct (petite caisse)", confirme_par: form.signataire_direction || "Petite caisse",
    }).select().single();
    if (reception && ligneBc) {
      await supabase.from("lignes_reception").insert({ reception_id: reception.id, ligne_bc_id: ligneBc.id, quantite_livree: Number(form.quantite) || 1 });
    }
  };

  const creer = async () => {
    if (!form.article.trim() || !form.montant_demande) return;
    setEnvoi(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("petite_caisse").insert({
      date_demande: form.date_demande, motif: form.motif || form.article, montant_demande: Number(form.montant_demande),
      created_by: user?.id || null,
    });
    await creerDemandeEtBc(form, user?.id || null);
    setEnvoi(false);
    setForm(empty);
    setNouveauOuvert(false);
    charger();
  };

  const modifier = (p) => {
    setEditId(p.id);
    setEditForm({
      date_demande: p.date_demande, motif: p.motif, montant_demande: p.montant_demande,
      signataire_direction: p.signataire_direction || "", date_signature: p.date_signature || "",
      montant_depense: p.montant_depense ?? "", justificatif: p.justificatif || "", observation: p.observation || "",
    });
  };

  const enregistrerEdition = async () => {
    const payload = {
      date_demande: editForm.date_demande, motif: editForm.motif, montant_demande: Number(editForm.montant_demande) || 0,
      signataire_direction: editForm.signataire_direction || null, date_signature: editForm.date_signature || null,
      montant_depense: editForm.montant_depense === "" ? null : Number(editForm.montant_depense),
      justificatif: editForm.justificatif || null, observation: editForm.observation || null,
    };
    payload.statut = statutCalcule(payload);
    await supabase.from("petite_caisse").update(payload).eq("id", editId);
    setEditId(null);
    setEditForm(null);
    charger();
  };

  const supprimer = async (id) => {
    if (!confirm("Supprimer cette ligne de petite caisse ? (la demande et le BC déjà créés ne sont pas supprimés automatiquement)")) return;
    await supabase.from("petite_caisse").delete().eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Achat en petite caisse ({filtrees.length})</h1>
        <button onClick={() => setNouveauOuvert((o) => !o)} style={buttonStyle}>{nouveauOuvert ? "Fermer" : "+ Nouvel achat en petite caisse"}</button>
      </div>

      {nouveauOuvert && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Dès l'enregistrement, une demande et un bon de commande sont créés automatiquement (achat déjà validé
            par la direction via la fiche de décaissement — pas besoin de signature de BC), visibles dans les listes
            Demandes/Commandes et dans l'historique, marqués "payé en espèce".
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input type="date" value={form.date_demande} onChange={(e) => setForm({ ...form, date_demande: e.target.value })} style={{ ...inputStyle, width: 160 }} />
            <Autocomplete
              placeholder="Article (recherche dans la liste des articles)"
              value={form.article}
              onChange={onArticleChange}
              suggestions={articlesBase.filter((a) => !a.continue_par_id).map((a) => a.designation)}
              style={{ flex: 2 }}
            />
            <input type="number" placeholder="Qté" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} style={{ ...inputStyle, width: 80 }} />
            <input placeholder="Unité" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} style={{ ...inputStyle, width: 90 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Autocomplete
              placeholder="Fournisseur (laisser vide = Fournisseurs divers, à préciser plus tard)"
              value={form.fournisseur}
              onChange={(val) => setForm({ ...form, fournisseur: val })}
              suggestions={fournisseurs.map((f) => f.nom)}
              style={{ flex: 1 }}
            />
            <input placeholder="Motif / précision (optionnel)" value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" placeholder="Montant demandé (Ar)" value={form.montant_demande} onChange={(e) => setForm({ ...form, montant_demande: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          </div>
          <button onClick={creer} disabled={envoi} style={{ ...buttonStyle, marginTop: 10 }}>{envoi ? "Création..." : "Créer la demande"}</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
            <option value="">Tous les statuts</option>
            <option>Demandé</option>
            <option>Décaissé</option>
            <option>Justifié</option>
          </select>
          <span style={{ fontSize: 13, color: "#666" }}>Total {filtreStatut ? `(${filtreStatut})` : ""} : <strong>{total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</strong></span>
        </div>

        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune ligne pour ce filtre.</p>}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Motif</th>
              <th style={thStyle}>Montant demandé</th>
              <th style={thStyle}>Signataire direction</th>
              <th style={thStyle}>Montant dépensé</th>
              <th style={thStyle}>Pièce de caisse</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((p) => {
              const enEdition = editId === p.id;
              const st = statutCalcule(p);
              const c = COULEUR_STATUT[st];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {enEdition ? (
                    <>
                      <td style={tdStyle}><input type="date" value={editForm.date_demande} onChange={(e) => setEditForm({ ...editForm, date_demande: e.target.value })} style={{ ...inputStyle, width: 140 }} /></td>
                      <td style={tdStyle}><input value={editForm.motif} onChange={(e) => setEditForm({ ...editForm, motif: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_demande} onChange={(e) => setEditForm({ ...editForm, montant_demande: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}>
                        <input placeholder="Nom" value={editForm.signataire_direction} onChange={(e) => setEditForm({ ...editForm, signataire_direction: e.target.value })} style={{ ...inputStyle, width: 110, marginBottom: 4 }} />
                        <input type="date" value={editForm.date_signature} onChange={(e) => setEditForm({ ...editForm, date_signature: e.target.value })} style={{ ...inputStyle, width: 140 }} />
                      </td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_depense} onChange={(e) => setEditForm({ ...editForm, montant_depense: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}><input placeholder="N° pièce" value={editForm.justificatif} onChange={(e) => setEditForm({ ...editForm, justificatif: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle} colSpan={2}>
                        <button onClick={enregistrerEdition} style={{ ...buttonStyle, marginRight: 6 }}>Enregistrer</button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{formatDate(p.date_demande)}</td>
                      <td style={tdStyle}>{p.motif}</td>
                      <td style={tdStyle}>{Number(p.montant_demande).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                      <td style={tdStyle}>{p.signataire_direction ? `${p.signataire_direction}${p.date_signature ? ` (${formatDate(p.date_signature)})` : ""}` : "—"}</td>
                      <td style={tdStyle}>{p.montant_depense ? `${Number(p.montant_depense).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : "—"}</td>
                      <td style={tdStyle}>{p.justificatif || "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: c.bg, color: c.fg }}>{st}</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => modifier(p)} style={linkBtn}>Modifier</button>
                        {role === "acheteur" && <button onClick={() => supprimer(p.id)} style={{ ...linkBtn, color: "#B3261E" }}>Suppr.</button>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AuthGuard>
  );
}
