"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";
import { useLangue, composerDesignation } from "../../../lib/i18n";

const UNITES_BASE = ["pcs", "kg", "litre", "fût", "unité", "boîte", "autre"];
const empty = { code_article: "", nom: "", marque: "", reference_fournisseur: "", unite_defaut: "pcs", categorie_id: "", dernier_prix_ht: "", nom_en: "", nom_mg: "", nom_hi: "", nom_mfe: "" };

export default function NouvelArticlePage() {
  const router = useRouter();
  const { t } = useLangue();
  const [liste, setListe] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from("articles").select("id, unite_defaut").limit(10000);
    setListe(data || []);
    const { data: cats } = await supabase.from("categories").select("id, nom").order("nom");
    setCategories(cats || []);
  };

  useEffect(() => { charger(); }, []);

  const uniteOptions = useMemo(() => {
    const depuisArticles = liste.map((a) => a.unite_defaut).filter(Boolean);
    return [...new Set([...UNITES_BASE, ...depuisArticles])].sort((a, b) => a.localeCompare(b));
  }, [liste]);

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    setEnvoi(true);
    const payload = {
      designation: composerDesignation({ code_article: form.code_article, nom: form.nom, marque: form.marque, reference_fournisseur: form.reference_fournisseur }),
      code_article: form.code_article.trim() || null, nom_article: form.nom.trim(),
      marque: form.marque.trim() || null, reference_fournisseur: form.reference_fournisseur.trim() || null,
      unite_defaut: form.unite_defaut,
      categorie_id: form.categorie_id || null,
      dernier_prix_ht: form.dernier_prix_ht === "" ? null : Number(form.dernier_prix_ht),
      nom_en: form.nom_en.trim() || null, nom_mg: form.nom_mg.trim() || null,
      nom_hi: form.nom_hi.trim() || null, nom_mfe: form.nom_mfe.trim() || null,
    };
    await supabase.from("articles").insert(payload);
    setEnvoi(false);
    router.push("/articles");
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>{t("nav_articles_ajouter")}</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder={t("art_ph_code")} value={form.code_article} onChange={(e) => setForm({ ...form, code_article: e.target.value })} style={{ ...inputStyle, width: 150 }} />
          <input placeholder={t("art_ph_nom")} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder={t("art_ph_marque")} value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} style={{ ...inputStyle, width: 160 }} />
          <input placeholder={t("art_ph_reference")} value={form.reference_fournisseur} onChange={(e) => setForm({ ...form, reference_fournisseur: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        </div>
        {form.nom.trim() && (
          <p style={{ fontSize: 12, color: "#1B7A4C", marginTop: 6 }}>
            {t("art_apercu_designation", { designation: composerDesignation({ code_article: form.code_article, nom: form.nom, marque: form.marque, reference_fournisseur: form.reference_fournisseur }) })}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Autocomplete
            placeholder={t("art_ph_unite_suggestions")}
            value={form.unite_defaut}
            onChange={(val) => setForm({ ...form, unite_defaut: val })}
            suggestions={uniteOptions}
            style={{ width: 190 }}
          />
          <select value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            <option value="">{t("art_choisir_categorie")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <input type="number" placeholder={t("art_l_dernier_prix_ht")} value={form.dernier_prix_ht} onChange={(e) => setForm({ ...form, dernier_prix_ht: e.target.value })} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("art_traductions_nom_titre")}</p>
          <p style={{ fontSize: 11.5, color: "#888", marginBottom: 10 }}>{t("art_traductions_nom_aide")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder="English" value={form.nom_en} onChange={(e) => setForm({ ...form, nom_en: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <input placeholder="Malagasy" value={form.nom_mg} onChange={(e) => setForm({ ...form, nom_mg: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <input placeholder="हिन्दी" value={form.nom_hi} onChange={(e) => setForm({ ...form, nom_hi: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <input placeholder="Kreol Morisien" value={form.nom_mfe} onChange={(e) => setForm({ ...form, nom_mfe: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={enregistrer} disabled={envoi} style={buttonStyle}>{envoi ? t("ncmd_creation") : t("btn_ajouter_simple")}</button>
          <Link href="/articles/categories" style={linkBtn}>{t("nav_articles_categories")}</Link>
        </div>
      </div>
    </AuthGuard>
  );
}
