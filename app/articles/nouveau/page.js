"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";

const UNITES_BASE = ["pcs", "kg", "litre", "fût", "unité", "boîte", "autre"];
const empty = { designation: "", unite_defaut: "pcs", categorie_id: "", dernier_prix_ht: "" };

export default function NouvelArticlePage() {
  const router = useRouter();
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
    if (!form.designation.trim()) return;
    setEnvoi(true);
    const payload = {
      designation: form.designation,
      unite_defaut: form.unite_defaut,
      categorie_id: form.categorie_id || null,
      dernier_prix_ht: form.dernier_prix_ht === "" ? null : Number(form.dernier_prix_ht),
    };
    await supabase.from("articles").insert(payload);
    setEnvoi(false);
    router.push("/articles");
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>Ajouter un article</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Désignation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <Autocomplete
            placeholder="Unité (tape pour voir les suggestions)"
            value={form.unite_defaut}
            onChange={(val) => setForm({ ...form, unite_defaut: val })}
            suggestions={uniteOptions}
            style={{ width: 190 }}
          />
          <select value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            <option value="">— Choisir une catégorie —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <input type="number" placeholder="Dernier prix HT" value={form.dernier_prix_ht} onChange={(e) => setForm({ ...form, dernier_prix_ht: e.target.value })} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={enregistrer} disabled={envoi} style={buttonStyle}>{envoi ? "Création..." : "Ajouter"}</button>
          <Link href="/articles/categories" style={linkBtn}>Gérer les catégories</Link>
        </div>
      </div>
    </AuthGuard>
  );
}
