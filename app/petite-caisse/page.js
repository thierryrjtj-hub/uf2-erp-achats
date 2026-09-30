"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import Autocomplete from "../components/Autocomplete";
import { useRole } from "../../lib/useRole";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn, boutonSelonModif } from "../components/ui";
import { formatDate } from "../../lib/format";
import { chargerAvecCache, invaliderCache } from "../../lib/cache";
import { useDirty } from "../../lib/useDirty";
import { useLangue } from "../../lib/i18n";

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
const CLE_STATUT_PC = { "Demandé": "pc_st_demande", "Décaissé": "pc_st_decaisse", "Justifié": "pc_st_justifie" };
function libelleStatutPc(t, valeur) { return CLE_STATUT_PC[valeur] ? t(CLE_STATUT_PC[valeur]) : valeur; }

const OBSERVATION_PETITE_CAISSE = "Achat en petite caisse — Payé en espèce";
const NOM_FOURNISSEUR_DIVERS = "Fournisseurs divers";

export default function PetiteCaissePage() {
  const role = useRole();
  const { t } = useLangue();
  const [liste, setListe] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const suiviEditForm = useDirty(editForm);
  const [filtreStatut, setFiltreStatut] = useState("");

  const anneeActuelle = new Date().getFullYear();
  const [filtreAnnee, setFiltreAnnee] = useState(String(anneeActuelle));
  const anneesDisponibles = [];
  for (let a = anneeActuelle; a >= anneeActuelle - 4; a--) anneesDisponibles.push(String(a));

  const charger = async () => {
    const [{ data }, art, f] = await Promise.all([
      (() => {
        let q = supabase.from("petite_caisse").select("*, demande:demande_id(id, numero), commande:commande_id(id, numero)").order("date_demande", { ascending: false }).limit(5000);
        if (filtreAnnee !== "toutes") q = q.gte("date_demande", `${filtreAnnee}-01-01`).lte("date_demande", `${filtreAnnee}-12-31`);
        return q;
      })(),
      chargerAvecCache("articles", () => supabase.from("articles").select("id, designation, unite_defaut, continue_par_id, endormi").limit(10000).then((r) => r.data)),
      chargerAvecCache("fournisseurs", () => supabase.from("fournisseurs").select("id, nom, tva_defaut_pct").order("nom").limit(10000).then((r) => r.data)),
    ]);
    setListe(data || []);
    setArticlesBase(art || []);
    setFournisseurs(f || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [filtreAnnee]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (cree) invaliderCache("fournisseurs");
    return cree?.id || null;
  };

  // Cette demande d'achat en petite caisse est déjà validée par la direction
  // (fiche de décaissement) avant même la saisie ici : pas besoin de re-signer
  // un BC, il est donc créé et clôturé directement, marqué payé en espèce.
  const creerDemandeEtBc = async (form, userId) => {
    let numeroDa = null;
    const annee = Number(new Date().getFullYear().toString().slice(-2));
    const { data: n } = await supabase.rpc("next_numero_da", { p_prefixe: "CAIS", p_annee: annee });
    if (n != null) numeroDa = `CAIS-${String(n).padStart(4, "0")}-${annee}`;

    const { data: demande } = await supabase.from("demandes").insert({
      demandeur: form.signataire_direction || null, motif_projet: form.motif || form.article,
      statut: "Basculée en commande", observation: OBSERVATION_PETITE_CAISSE, created_by: userId,
      date_da: form.date_demande || null, numero_da: numeroDa,
    }).select().single();
    if (!demande) return {};

    const { data: ligneDemande } = await supabase.from("lignes_demande").insert({
      demande_id: demande.id, designation: form.article, quantite: Number(form.quantite) || 1, unite: form.unite,
    }).select().single();

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
    if (!bc) return { demande };

    const { data: ligneBc } = await supabase.from("lignes_bc").insert({
      bc_id: bc.id, ligne_demande_id: ligneDemande?.id || null, designation: form.article, quantite: Number(form.quantite) || 1, unite: form.unite,
      prix_unitaire_ht: montantHt / (Number(form.quantite) || 1), remise_pct: 0, montant_ht: montantHt,
    }).select().single();

    // Une petite caisse est toujours un enlèvement direct sur place (jamais
    // une livraison fournisseur), et le réceptionnaire est le demandeur lui-
    // même : l'achat est utilisé directement, pas stocké au magasin.
    const { data: reception } = await supabase.from("receptions").insert({
      bc_id: bc.id, statut: "Totale", date_reception_reelle: form.date_demande, type_livraison: "Enlèvement par nos soins",
      receptionnaire: form.signataire_direction || "N/A",
      observation: `Achat direct par petite caisse, pour ${form.motif || form.article}`,
      confirme_par: form.signataire_direction || "Petite caisse",
    }).select().single();
    if (reception && ligneBc) {
      await supabase.from("lignes_reception").insert({ reception_id: reception.id, ligne_bc_id: ligneBc.id, quantite_livree: Number(form.quantite) || 1 });
    }
    return { demande, bc };
  };

  const creer = async () => {
    if (!form.article.trim() || !form.montant_demande) return;
    setEnvoi(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: ligne } = await supabase.from("petite_caisse").insert({
      date_demande: form.date_demande, motif: form.motif || form.article,
      article: form.article, quantite: Number(form.quantite) || 1, unite: form.unite,
      prix_unitaire: (Number(form.montant_demande) || 0) / (Number(form.quantite) || 1),
      montant_demande: Number(form.montant_demande),
      created_by: user?.id || null,
    }).select().single();
    const { demande, bc } = (await creerDemandeEtBc(form, user?.id || null)) || {};
    if (ligne && demande && bc) {
      await supabase.from("petite_caisse").update({ demande_id: demande.id, commande_id: bc.id }).eq("id", ligne.id);
    }
    setEnvoi(false);
    setForm(empty);
    setNouveauOuvert(false);
    charger();
  };

  const modifier = (p) => {
    setEditId(p.id);
    const initial = {
      date_demande: p.date_demande, motif: p.motif, montant_demande: p.montant_demande,
      article: p.article || p.motif || "", quantite: p.quantite ?? 1, unite: p.unite || "pcs", prix_unitaire: p.prix_unitaire ?? "",
      signataire_direction: p.signataire_direction || "", date_signature: p.date_signature || "",
      montant_depense: p.montant_depense ?? "", justificatif: p.justificatif || "", observation: p.observation || "",
    };
    setEditForm(initial);
    suiviEditForm.reinitialiser(initial);
  };

  const enregistrerEdition = async () => {
    const payload = {
      date_demande: editForm.date_demande, motif: editForm.motif || editForm.article, montant_demande: Number(editForm.montant_demande) || 0,
      article: editForm.article, quantite: Number(editForm.quantite) || 1, unite: editForm.unite,
      prix_unitaire: editForm.prix_unitaire === "" ? null : Number(editForm.prix_unitaire),
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

  const supprimer = async (p) => {
    if (!confirm(p.demande_id ? t("pc_confirm_suppr_avec_bc") : t("pc_confirm_suppr"))) return;
    if (p.commande_id) {
      const { data: receptionsC } = await supabase.from("receptions").select("id").eq("bc_id", p.commande_id);
      for (const r of receptionsC || []) {
        await supabase.from("lignes_reception").delete().eq("reception_id", r.id);
      }
      await supabase.from("receptions").delete().eq("bc_id", p.commande_id);
      await supabase.from("lignes_bc").delete().eq("bc_id", p.commande_id);
      await supabase.from("commandes").delete().eq("id", p.commande_id);
    }
    if (p.demande_id) {
      await supabase.from("lignes_demande").delete().eq("demande_id", p.demande_id);
      await supabase.from("demandes").delete().eq("id", p.demande_id);
    }
    await supabase.from("petite_caisse").delete().eq("id", p.id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>{t("pc_titre", { n: filtrees.length })}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)} style={inputStyle} title={t("annee_defaut_info")}>
            {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="toutes">{t("toutes_annees")}</option>
          </select>
          <button onClick={() => setNouveauOuvert((o) => !o)} style={buttonStyle}>{nouveauOuvert ? t("pc_fermer") : t("pc_btn_nouveau")}</button>
        </div>
      </div>

      {nouveauOuvert && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            {t("pc_aide_creation")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input type="date" value={form.date_demande} onChange={(e) => setForm({ ...form, date_demande: e.target.value })} style={{ ...inputStyle, width: 160 }} />
            <Autocomplete
              placeholder={t("pc_ph_article")}
              value={form.article}
              onChange={onArticleChange}
              suggestions={articlesBase.filter((a) => !a.continue_par_id && !a.endormi).map((a) => a.designation)}
              style={{ flex: 2 }}
            />
            <input type="number" placeholder={t("ph_qte")} value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} style={{ ...inputStyle, width: 80 }} />
            <input placeholder={t("col_unite")} value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} style={{ ...inputStyle, width: 90 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Autocomplete
              placeholder={t("pc_ph_fournisseur")}
              value={form.fournisseur}
              onChange={(val) => setForm({ ...form, fournisseur: val })}
              suggestions={fournisseurs.map((f) => f.nom)}
              style={{ flex: 1 }}
            />
            <input placeholder={t("pc_ph_motif")} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" placeholder={t("pc_ph_montant_demande")} value={form.montant_demande} onChange={(e) => setForm({ ...form, montant_demande: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          </div>
          <button onClick={creer} disabled={envoi} style={{ ...buttonStyle, marginTop: 10 }}>{envoi ? t("ncmd_creation") : t("pc_btn_creer")}</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
            <option value="">{t("tous_statuts")}</option>
            <option value="Demandé">{t("pc_st_demande")}</option>
            <option value="Décaissé">{t("pc_st_decaisse")}</option>
            <option value="Justifié">{t("pc_st_justifie")}</option>
          </select>
          <span style={{ fontSize: 13, color: "#666" }}>{t("pc_total", { filtre: filtreStatut ? `(${libelleStatutPc(t, filtreStatut)})` : "" })} <strong>{total.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</strong></span>
        </div>

        {loading && <p style={{ color: "#888", fontSize: 13 }}>{t("chargement")}</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>{t("pc_aucune_ligne")}</p>}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t("col_date")}</th>
              <th style={thStyle}>{t("col_article")}</th>
              <th style={thStyle}>{t("ph_qte")}</th>
              <th style={thStyle}>{t("col_unite")}</th>
              <th style={thStyle}>{t("col_pu_ht")}</th>
              <th style={thStyle}>{t("pc_h_montant_demande")}</th>
              <th style={thStyle}>{t("pc_h_signataire")}</th>
              <th style={thStyle}>{t("pc_h_montant_depense")}</th>
              <th style={thStyle}>{t("pc_h_piece_caisse")}</th>
              <th style={thStyle}>{t("pc_h_da_bc_lies")}</th>
              <th style={thStyle}>{t("col_statut")}</th>
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
                      <td style={tdStyle}><input value={editForm.article} onChange={(e) => setEditForm({ ...editForm, article: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle}><input type="number" value={editForm.quantite} onChange={(e) => setEditForm({ ...editForm, quantite: e.target.value })} style={{ ...inputStyle, width: 70 }} /></td>
                      <td style={tdStyle}><input value={editForm.unite} onChange={(e) => setEditForm({ ...editForm, unite: e.target.value })} style={{ ...inputStyle, width: 80 }} /></td>
                      <td style={tdStyle}><input type="number" value={editForm.prix_unitaire} onChange={(e) => setEditForm({ ...editForm, prix_unitaire: e.target.value })} style={{ ...inputStyle, width: 100 }} /></td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_demande} onChange={(e) => setEditForm({ ...editForm, montant_demande: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}>
                        <input placeholder={t("bc_ph_nom")} value={editForm.signataire_direction} onChange={(e) => setEditForm({ ...editForm, signataire_direction: e.target.value })} style={{ ...inputStyle, width: 110, marginBottom: 4 }} />
                        <input type="date" value={editForm.date_signature} onChange={(e) => setEditForm({ ...editForm, date_signature: e.target.value })} style={{ ...inputStyle, width: 140 }} />
                      </td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_depense} onChange={(e) => setEditForm({ ...editForm, montant_depense: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}><input placeholder={t("pc_ph_num_piece")} value={editForm.justificatif} onChange={(e) => setEditForm({ ...editForm, justificatif: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}>
                        {p.demande?.numero && <Link href={`/demandes/${p.demande.id}`} style={{ display: "block", fontSize: 12 }}>{p.demande.numero}</Link>}
                        {p.commande?.numero && <Link href={`/commandes/${p.commande.id}`} style={{ display: "block", fontSize: 12 }}>{p.commande.numero}</Link>}
                      </td>
                      <td style={tdStyle} colSpan={2}>
                        <button onClick={enregistrerEdition} style={{ ...boutonSelonModif(suiviEditForm.modifie), marginRight: 6 }}>{t("btn_enregistrer")}</button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...buttonStyle, background: "#888" }}>{t("btn_annuler")}</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{formatDate(p.date_demande)}</td>
                      <td style={tdStyle}>{p.article || p.motif}</td>
                      <td style={tdStyle}>{p.quantite ?? 1}</td>
                      <td style={tdStyle}>{p.unite || "—"}</td>
                      <td style={tdStyle}>{p.prix_unitaire ? `${Number(p.prix_unitaire).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : "—"}</td>
                      <td style={tdStyle}>{Number(p.montant_demande).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                      <td style={tdStyle}>{p.signataire_direction ? `${p.signataire_direction}${p.date_signature ? ` (${formatDate(p.date_signature)})` : ""}` : "—"}</td>
                      <td style={tdStyle}>{p.montant_depense ? `${Number(p.montant_depense).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : "—"}</td>
                      <td style={tdStyle}>{p.justificatif || "—"}</td>
                      <td style={tdStyle}>
                        {p.demande?.numero && <Link href={`/demandes/${p.demande.id}`} style={{ display: "block", fontSize: 12 }}>{p.demande.numero}</Link>}
                        {p.commande?.numero && <Link href={`/commandes/${p.commande.id}`} style={{ display: "block", fontSize: 12 }}>{p.commande.numero}</Link>}
                        {!p.demande?.numero && !p.commande?.numero && "—"}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: c.bg, color: c.fg }}>{libelleStatutPc(t, st)}</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => modifier(p)} style={linkBtn}>{t("btn_modifier")}</button>
                        {role === "acheteur" && <button onClick={() => supprimer(p)} style={{ ...linkBtn, color: "#B3261E" }}>{t("pc_suppr")}</button>}
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
