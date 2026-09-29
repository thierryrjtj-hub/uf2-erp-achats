"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import { inputStyle, buttonStyle, boutonSelonModif, linkBtn } from "../../components/ui";
import { useDirty } from "../../../lib/useDirty";
import { useLangue } from "../../../lib/i18n";

const empty = {
  nom: "", contact: "", telephone: "", email: "", adresse: "", code_postal: "",
  nif: "", stat: "", rcs: "", cin: "", type_reglement: "Chèque",
  tva_defaut_pct: 20, activite: "", conditions_paiement_jours: 30, remise_par_defaut_pct: 0,
  moment_paiement: "À réception facture", acompte_pct: 0, solde_a: "À la livraison",
};

export default function NouveauFournisseurPage() {
  const { t } = useLangue();
  return (
    <Suspense fallback={<AuthGuard><p>{t("chargement")}</p></AuthGuard>}>
      <NouveauFournisseurInner />
    </Suspense>
  );
}

function NouveauFournisseurInner() {
  const router = useRouter();
  const { t } = useLangue();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [form, setForm] = useState(empty);
  const suiviForm = useDirty(form);
  const [envoi, setEnvoi] = useState(false);
  const [charge, setCharge] = useState(!editId);
  const [tvaOrigine, setTvaOrigine] = useState(null);

  useState(() => {
    if (editId) {
      (async () => {
        const { data: f } = await supabase.from("fournisseurs").select("*").eq("id", editId).maybeSingle();
        if (f) {
          const formCharge = {
            nom: f.nom, contact: f.contact || "", telephone: f.telephone || "", email: f.email || "",
            adresse: f.adresse || "", code_postal: f.code_postal || "", nif: f.nif || "", stat: f.stat || "",
            rcs: f.rcs || "", cin: f.cin || "", type_reglement: f.type_reglement || "Chèque",
            tva_defaut_pct: f.tva_defaut_pct ?? 20, activite: f.activite || "",
            conditions_paiement_jours: f.conditions_paiement_jours || 30, remise_par_defaut_pct: f.remise_par_defaut_pct || 0,
            moment_paiement: f.moment_paiement || "À réception facture", acompte_pct: f.acompte_pct || 0, solde_a: f.solde_a || "À la livraison",
          };
          setForm(formCharge);
          suiviForm.reinitialiser(formCharge);
          setTvaOrigine(f.tva_defaut_pct ?? 20);
        }
        setCharge(true);
      })();
    }
  });

  // Si le statut taxable/non-taxable du fournisseur change, tous ses BC déjà
  // créés (hors "Annulée") sont resynchronisés automatiquement — toujours à
  // partir de la somme de leurs lignes, jamais d'un montant global du BC qui
  // pourrait déjà être faux (même principe que le Contrôle qualité).
  const resynchroniserBcExistants = async () => {
    const assujetti = Number(form.tva_defaut_pct) !== 0;
    const { data: commandes } = await supabase.from("commandes").select("id").eq("fournisseur_id", editId).neq("statut", "Annulée");
    for (const c of commandes || []) {
      const { data: lignes } = await supabase.from("lignes_bc").select("montant_ht").eq("bc_id", c.id);
      const sommeLignes = (lignes || []).reduce((s, l) => s + (Number(l.montant_ht) || 0), 0);
      const montantHt = Math.round(sommeLignes * 100) / 100;
      const montantTva = assujetti ? Math.round(montantHt * 0.2 * 100) / 100 : 0;
      const montantTtc = Math.round((montantHt + montantTva) * 100) / 100;
      await supabase.from("commandes").update({
        assujetti_tva: assujetti, montant_ht: montantHt, montant_tva: montantTva, montant_ttc: montantTtc,
      }).eq("id", c.id);
    }
  };

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    setEnvoi(true);
    if (editId) {
      await supabase.from("fournisseurs").update(form).eq("id", editId);
      const etaitAssujetti = tvaOrigine !== null && tvaOrigine !== 0;
      const estAssujetti = Number(form.tva_defaut_pct) !== 0;
      if (tvaOrigine !== null && etaitAssujetti !== estAssujetti) {
        await resynchroniserBcExistants();
      }
    } else {
      await supabase.from("fournisseurs").insert(form);
    }
    setEnvoi(false);
    router.back();
  };

  if (!charge) return <AuthGuard><p>{t("chargement")}</p></AuthGuard>;

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => router.back()} style={linkBtn}>&larr; {t("retour")}</button>
        <Link href="/fournisseurs" style={{ fontSize: 13, color: "#888" }}>{t("fournv_voir_tous")}</Link>
      </div>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>{editId ? t("fournv_titre_modifier") : t("nav_fournisseurs_ajouter")}</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={rowStyle}>
          <input placeholder={t("fournv_ph_nom")} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder={t("fournv_ph_contact")} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder={t("fournv_ph_telephone")} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder={t("fournv_ph_adresse")} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder={t("fournv_ph_code_postal")} value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} style={{ ...inputStyle, width: 120 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder="NIF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="STAT" value={form.stat} onChange={(e) => setForm({ ...form, stat: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="RCS" value={form.rcs} onChange={(e) => setForm({ ...form, rcs: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="CIN" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <select value={form.type_reglement} onChange={(e) => setForm({ ...form, type_reglement: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            <option value="Chèque">{t("fournv_reg_cheque")}</option><option value="Espèces">{t("fournv_reg_especes")}</option><option value="Chèque/Espèces">{t("fournv_reg_cheque_especes")}</option><option value="Virement">{t("fournv_reg_virement")}</option>
          </select>
          <select value={form.tva_defaut_pct} onChange={(e) => setForm({ ...form, tva_defaut_pct: Number(e.target.value) })} style={{ ...inputStyle, flex: 1 }}>
            <option value={20}>{t("fournv_tva_taxable")}</option>
            <option value={0}>{t("fournv_tva_non_assujetti")}</option>
          </select>
          <input placeholder={t("fournv_ph_activite")} value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <div>
            <label style={miniLabel}>{t("fournv_l_delai")}</label>
            <input type="number" placeholder={t("fournv_l_delai")} value={form.conditions_paiement_jours} onChange={(e) => setForm({ ...form, conditions_paiement_jours: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          </div>
          <div>
            <label style={miniLabel}>{t("fournv_l_remise")}</label>
            <input type="number" placeholder={t("fournv_l_remise")} value={form.remise_par_defaut_pct} onChange={(e) => setForm({ ...form, remise_par_defaut_pct: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={champLabel}>{t("fournv_l_moment_paiement")}</div>
            <select value={form.moment_paiement} onChange={(e) => setForm({ ...form, moment_paiement: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
              <option value="À réception facture">{t("fournv_moment_reception")}</option>
              <option value="À la commande">{t("fournv_moment_commande")}</option>
              <option value="À la livraison">{t("fournv_moment_livraison")}</option>
            </select>
          </div>
          <div style={{ width: 180 }}>
            <div style={champLabel}>{t("fournv_l_acompte")}</div>
            <input type="number" min="0" max="100" placeholder={t("fournv_ph_pas_acompte")} value={form.acompte_pct} onChange={(e) => setForm({ ...form, acompte_pct: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
          </div>
          {Number(form.acompte_pct) > 0 && (
            <div style={{ flex: 1 }}>
              <div style={champLabel}>{t("fournv_l_solde")}</div>
              <select value={form.solde_a} onChange={(e) => setForm({ ...form, solde_a: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                <option value="À la livraison">{t("fournv_solde_livraison")}</option>
                <option value="À la fin des travaux">{t("fournv_solde_fin_travaux")}</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={enregistrer} disabled={envoi} style={boutonSelonModif(suiviForm.modifie)}>{envoi ? t("enregistrement") : (editId ? t("btn_enregistrer") : t("btn_ajouter_simple"))}</button>
          <button onClick={() => router.back()} style={{ ...buttonStyle, background: "#888" }}>{t("btn_annuler")}</button>
        </div>
      </div>
    </AuthGuard>
  );
}

const rowStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 };
const miniLabel = { display: "block", fontSize: 11, color: "#888", marginBottom: 3 };
const champLabel = { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 };
