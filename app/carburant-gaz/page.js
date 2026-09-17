"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import Autocomplete from "../components/Autocomplete";
import { useRole } from "../../lib/useRole";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../components/ui";
import { formatDate } from "../../lib/format";

const empty = {
  date_operation: new Date().toISOString().slice(0, 10), type: "Carburant", vehicule_equipement: "",
  article: "", carte_fournisseur: "", quantite: "", unite: "L", montant: "", responsable: "", observation: "",
};

export default function CarburantGazPage() {
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
  const [filtreType, setFiltreType] = useState("");
  const [filtreVehicule, setFiltreVehicule] = useState("");

  const charger = async () => {
    const { data } = await supabase.from("carburant_gaz").select("*").order("date_operation", { ascending: false }).limit(5000);
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
      setForm((prev) => ({ ...prev, article: final.designation, unite: final.unite_defaut || prev.unite }));
      return;
    }
    setForm((prev) => ({ ...prev, article: val }));
  };

  const vehicules = useMemo(() => [...new Set(liste.map((p) => p.vehicule_equipement).filter(Boolean))].sort(), [liste]);

  const filtrees = useMemo(() => {
    return liste.filter((p) => (!filtreType || p.type === filtreType) && (!filtreVehicule || p.vehicule_equipement === filtreVehicule));
  }, [liste, filtreType, filtreVehicule]);

  const totalMontant = useMemo(() => filtrees.reduce((s, p) => s + (Number(p.montant) || 0), 0), [filtrees]);

  // Trouve ou crée le fournisseur "Fournisseurs divers" (utilisé si aucun
  // fournisseur précis n'a été sélectionné à la saisie)
  const idFournisseurDivers = async () => {
    const { data: existant } = await supabase.from("fournisseurs").select("id").eq("nom", "Fournisseurs divers").maybeSingle();
    if (existant) return existant.id;
    const { data: cree } = await supabase.from("fournisseurs").insert({ nom: "Fournisseurs divers" }).select().single();
    return cree?.id || null;
  };

  // Achat déjà autorisé via la carte (ticket gardé par l'assistante de direction) :
  // pas de signature de BC à faire, mais reste à facturer/payer via la facture
  // mensuelle du fournisseur — donc statut paiement laissé "Impayé" par défaut.
  const creerDemandeEtBc = async (form, userId) => {
    const observation = `Achat par carte ${form.type.toLowerCase()} — ${form.vehicule_equipement}`;
    const { data: demande } = await supabase.from("demandes").insert({
      demandeur: form.responsable || null, motif_projet: `${form.type} — ${form.vehicule_equipement}`,
      statut: "Basculée en commande", observation, created_by: userId,
    }).select().single();
    if (!demande) return;

    const designation = form.article || form.type;
    await supabase.from("lignes_demande").insert({
      demande_id: demande.id, designation, quantite: Number(form.quantite) || 1, unite: form.unite,
    });

    const fournisseurChoisi = fournisseurs.find((f) => f.nom === form.carte_fournisseur);
    const fournisseurId = fournisseurChoisi ? fournisseurChoisi.id : await idFournisseurDivers();
    const fournisseurNom = fournisseurChoisi ? fournisseurChoisi.nom : "Fournisseurs divers";
    const assujetti = fournisseurChoisi ? fournisseurChoisi.tva_defaut_pct !== 0 : true;
    const montant = Number(form.montant) || 0;
    const montantHt = assujetti ? montant / 1.2 : montant;
    const tva = assujetti ? montant - montantHt : 0;
    const { data: bc } = await supabase.from("commandes").insert({
      demande_id: demande.id, fournisseur_id: fournisseurId, fournisseur_nom: fournisseurNom,
      assujetti_tva: assujetti, montant_ht: montantHt, montant_tva: tva, montant_ttc: montant,
      statut_paiement: "Impayé", observation, created_by: userId,
    }).select().single();
    if (!bc) return;

    const { data: ligneBc } = await supabase.from("lignes_bc").insert({
      bc_id: bc.id, designation, quantite: Number(form.quantite) || 1, unite: form.unite,
      prix_unitaire_ht: montantHt / (Number(form.quantite) || 1), remise_pct: 0, montant_ht: montantHt,
    }).select().single();

    const { data: reception } = await supabase.from("receptions").insert({
      bc_id: bc.id, statut: "Totale", date_reception_reelle: form.date_operation,
      receptionnaire: `Achat direct (carte ${form.type.toLowerCase()})`, confirme_par: form.responsable || form.type,
    }).select().single();
    if (reception && ligneBc) {
      await supabase.from("lignes_reception").insert({ reception_id: reception.id, ligne_bc_id: ligneBc.id, quantite_livree: Number(form.quantite) || 1 });
    }
  };

  const creer = async () => {
    if (!form.vehicule_equipement.trim() || !form.article.trim()) return;
    setEnvoi(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("carburant_gaz").insert({
      date_operation: form.date_operation, type: form.type, vehicule_equipement: form.vehicule_equipement,
      article: form.article, carte_fournisseur: form.carte_fournisseur || null, quantite: form.quantite === "" ? null : Number(form.quantite),
      unite: form.unite, montant: form.montant === "" ? null : Number(form.montant),
      responsable: form.responsable || null, observation: form.observation || null, created_by: user?.id || null,
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
      date_operation: p.date_operation, type: p.type, vehicule_equipement: p.vehicule_equipement,
      article: p.article || "", carte_fournisseur: p.carte_fournisseur || "", quantite: p.quantite ?? "", unite: p.unite || "L",
      montant: p.montant ?? "", responsable: p.responsable || "", observation: p.observation || "",
    });
  };

  const enregistrerEdition = async () => {
    const payload = {
      date_operation: editForm.date_operation, type: editForm.type, vehicule_equipement: editForm.vehicule_equipement,
      article: editForm.article || null, carte_fournisseur: editForm.carte_fournisseur || null, quantite: editForm.quantite === "" ? null : Number(editForm.quantite),
      unite: editForm.unite, montant: editForm.montant === "" ? null : Number(editForm.montant),
      responsable: editForm.responsable || null, observation: editForm.observation || null,
    };
    await supabase.from("carburant_gaz").update(payload).eq("id", editId);
    setEditId(null);
    setEditForm(null);
    charger();
  };

  const supprimer = async (id) => {
    if (!confirm("Supprimer cette ligne ? (la demande et le BC déjà créés ne sont pas supprimés automatiquement)")) return;
    await supabase.from("carburant_gaz").delete().eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Carburant / Gaz ({filtrees.length})</h1>
        <button onClick={() => setNouveauOuvert((o) => !o)} style={buttonStyle}>{nouveauOuvert ? "Fermer" : "+ Nouvelle opération"}</button>
      </div>

      {nouveauOuvert && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Dès l'enregistrement, une demande et un bon de commande sont créés automatiquement (achat déjà
            autorisé via la carte, pas de signature à faire), visibles dans les listes Demandes/Commandes et
            dans l'historique.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input type="date" value={form.date_operation} onChange={(e) => setForm({ ...form, date_operation: e.target.value })} style={{ ...inputStyle, width: 150 }} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, width: 130 }}>
              <option>Carburant</option>
              <option>Gaz</option>
            </select>
            <input placeholder="Véhicule / équipement (ex: 4107 TCD, Groupe électrogène...)" value={form.vehicule_equipement} onChange={(e) => setForm({ ...form, vehicule_equipement: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
            <Autocomplete
              placeholder="Fournisseur (Jovena, Galana... vide = Fournisseurs divers)"
              value={form.carte_fournisseur}
              onChange={(val) => setForm({ ...form, carte_fournisseur: val })}
              suggestions={fournisseurs.map((f) => f.nom)}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Autocomplete
              placeholder="Article (recherche dans la liste des articles)"
              value={form.article}
              onChange={onArticleChange}
              suggestions={articlesBase.filter((a) => !a.continue_par_id).map((a) => a.designation)}
              style={{ flex: 2 }}
            />
            <input type="number" placeholder="Quantité" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} style={{ ...inputStyle, width: 100 }} />
            <input placeholder="Unité" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} style={{ ...inputStyle, width: 90 }} />
            <input type="number" placeholder="Montant TTC (Ar)" title="Montant total payé, TVA comprise (le HT est recalculé automatiquement selon le fournisseur)" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} style={{ ...inputStyle, width: 160 }} />
            <input placeholder="Responsable / chauffeur" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <button onClick={creer} disabled={envoi} style={{ ...buttonStyle, marginTop: 10 }}>{envoi ? "Création..." : "Enregistrer"}</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} style={inputStyle}>
            <option value="">Tous les types</option>
            <option>Carburant</option>
            <option>Gaz</option>
          </select>
          <select value={filtreVehicule} onChange={(e) => setFiltreVehicule(e.target.value)} style={inputStyle}>
            <option value="">Tous les véhicules/équipements</option>
            {vehicules.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "#666" }}>Total : <strong>{totalMontant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</strong></span>
        </div>

        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune opération pour ce filtre.</p>}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Véhicule / équipement</th>
              <th style={thStyle}>Carte / fournisseur</th>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Quantité</th>
              <th style={thStyle}>Montant</th>
              <th style={thStyle}>Responsable</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((p) => {
              const enEdition = editId === p.id;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {enEdition ? (
                    <>
                      <td style={tdStyle}><input type="date" value={editForm.date_operation} onChange={(e) => setEditForm({ ...editForm, date_operation: e.target.value })} style={{ ...inputStyle, width: 140 }} /></td>
                      <td style={tdStyle}>
                        <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} style={{ ...inputStyle, width: 110 }}>
                          <option>Carburant</option><option>Gaz</option>
                        </select>
                      </td>
                      <td style={tdStyle}><input value={editForm.vehicule_equipement} onChange={(e) => setEditForm({ ...editForm, vehicule_equipement: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle}><input value={editForm.carte_fournisseur} onChange={(e) => setEditForm({ ...editForm, carte_fournisseur: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle}><input value={editForm.article} onChange={(e) => setEditForm({ ...editForm, article: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle} colSpan={2}>
                        <input type="number" value={editForm.quantite} onChange={(e) => setEditForm({ ...editForm, quantite: e.target.value })} style={{ ...inputStyle, width: 80, marginRight: 4 }} />
                        {editForm.unite}
                      </td>
                      <td style={tdStyle}><input type="number" value={editForm.montant} onChange={(e) => setEditForm({ ...editForm, montant: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}><input value={editForm.responsable} onChange={(e) => setEditForm({ ...editForm, responsable: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}>
                        <button onClick={enregistrerEdition} style={{ ...buttonStyle, marginRight: 6 }}>OK</button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{formatDate(p.date_operation)}</td>
                      <td style={tdStyle}>{p.type}</td>
                      <td style={tdStyle}>{p.vehicule_equipement}</td>
                      <td style={tdStyle}>{p.carte_fournisseur || "—"}</td>
                      <td style={tdStyle}>{p.article || "—"}</td>
                      <td style={tdStyle}>{p.quantite ? `${p.quantite} ${p.unite || ""}` : "—"}</td>
                      <td style={tdStyle}>{p.montant ? `${Number(p.montant).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : "—"}</td>
                      <td style={tdStyle}>{p.responsable || "—"}</td>
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
