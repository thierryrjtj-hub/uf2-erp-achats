"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import { inputStyle, buttonStyle } from "../../components/ui";

const empty = {
  nom: "", contact: "", telephone: "", email: "", adresse: "", code_postal: "",
  nif: "", stat: "", rcs: "", cin: "", type_reglement: "Chèque",
  tva_defaut_pct: 20, activite: "", conditions_paiement_jours: 30, remise_par_defaut_pct: 0,
  moment_paiement: "À réception facture", acompte_pct: 0, solde_a: "À la livraison",
};

export default function NouveauFournisseurPage() {
  return (
    <Suspense fallback={<AuthGuard><p>Chargement...</p></AuthGuard>}>
      <NouveauFournisseurInner />
    </Suspense>
  );
}

function NouveauFournisseurInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);
  const [charge, setCharge] = useState(!editId);

  useState(() => {
    if (editId) {
      (async () => {
        const { data: f } = await supabase.from("fournisseurs").select("*").eq("id", editId).maybeSingle();
        if (f) {
          setForm({
            nom: f.nom, contact: f.contact || "", telephone: f.telephone || "", email: f.email || "",
            adresse: f.adresse || "", code_postal: f.code_postal || "", nif: f.nif || "", stat: f.stat || "",
            rcs: f.rcs || "", cin: f.cin || "", type_reglement: f.type_reglement || "Chèque",
            tva_defaut_pct: f.tva_defaut_pct ?? 20, activite: f.activite || "",
            conditions_paiement_jours: f.conditions_paiement_jours || 30, remise_par_defaut_pct: f.remise_par_defaut_pct || 0,
            moment_paiement: f.moment_paiement || "À réception facture", acompte_pct: f.acompte_pct || 0, solde_a: f.solde_a || "À la livraison",
          });
        }
        setCharge(true);
      })();
    }
  });

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    setEnvoi(true);
    if (editId) {
      await supabase.from("fournisseurs").update(form).eq("id", editId);
    } else {
      await supabase.from("fournisseurs").insert(form);
    }
    setEnvoi(false);
    router.push("/fournisseurs");
  };

  if (!charge) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>{editId ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={rowStyle}>
          <input placeholder="Nom ou raison sociale" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Nom du contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Code postal" value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} style={{ ...inputStyle, width: 120 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder="NIF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="STAT" value={form.stat} onChange={(e) => setForm({ ...form, stat: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="RCS" value={form.rcs} onChange={(e) => setForm({ ...form, rcs: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="CIN" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <select value={form.type_reglement} onChange={(e) => setForm({ ...form, type_reglement: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            <option>Chèque</option><option>Espèces</option><option>Chèque/Espèces</option><option>Virement</option>
          </select>
          <select value={form.tva_defaut_pct} onChange={(e) => setForm({ ...form, tva_defaut_pct: Number(e.target.value) })} style={{ ...inputStyle, flex: 1 }}>
            <option value={20}>TVA 20% (taxable)</option>
            <option value={0}>Non assujetti (0%)</option>
          </select>
          <input placeholder="Activité / secteur" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <input type="number" placeholder="Délai paiement (jours)" value={form.conditions_paiement_jours} onChange={(e) => setForm({ ...form, conditions_paiement_jours: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          <input type="number" placeholder="Remise par défaut (%)" value={form.remise_par_defaut_pct} onChange={(e) => setForm({ ...form, remise_par_defaut_pct: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={champLabel}>Moment du paiement</div>
            <select value={form.moment_paiement} onChange={(e) => setForm({ ...form, moment_paiement: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
              <option>À réception facture</option>
              <option>À la commande</option>
              <option>À la livraison</option>
            </select>
          </div>
          <div style={{ width: 180 }}>
            <div style={champLabel}>Acompte à la commande (%)</div>
            <input type="number" min="0" max="100" placeholder="0 = pas d'acompte" value={form.acompte_pct} onChange={(e) => setForm({ ...form, acompte_pct: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
          </div>
          {Number(form.acompte_pct) > 0 && (
            <div style={{ flex: 1 }}>
              <div style={champLabel}>Solde payé à</div>
              <select value={form.solde_a} onChange={(e) => setForm({ ...form, solde_a: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                <option>À la livraison</option>
                <option>À la fin des travaux</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={enregistrer} disabled={envoi} style={buttonStyle}>{envoi ? "Enregistrement..." : (editId ? "Enregistrer" : "Ajouter")}</button>
          <button onClick={() => router.push("/fournisseurs")} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>
        </div>
      </div>
    </AuthGuard>
  );
}

const rowStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 };
const champLabel = { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 };
