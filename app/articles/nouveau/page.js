"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { useRole } from "../../../lib/useRole";
import { inputStyle, buttonStyle } from "../../components/ui";

const UNITES_BASE = ["pcs", "kg", "litre", "fût", "unité", "boîte", "autre"];
const CATEGORIES_BASE = [
  "Produits Chimiques",
  "Produits de Nettoyage / Hygiène",
  "Équipements de Protection (EPI)",
  "Consommables de Production",
  "Emballages & Conditionnement",
  "Pièces Détachées / Maintenance",
  "Équipements Électriques",
  "Matériaux de Construction",
  "Carburants & Lubrifiants",
  "Fournitures de Bureau",
  "Bois de Chauffage",
  "Matériel Informatique",
  "Services & Prestations",
  "Autre",
];
const empty = { designation: "", unite_defaut: "pcs", categorie: "", dernier_prix_ht: "" };

export default function NouvelArticlePage() {
  const router = useRouter();
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from("articles").select("id, unite_defaut, categorie").limit(10000);
    setListe(data || []);
  };

  useEffect(() => { charger(); }, []);

  const uniteOptions = useMemo(() => {
    const depuisArticles = liste.map((a) => a.unite_defaut).filter(Boolean);
    return [...new Set([...UNITES_BASE, ...depuisArticles])].sort((a, b) => a.localeCompare(b));
  }, [liste]);

  const categorieOptions = useMemo(() => {
    const depuisArticles = liste.map((a) => a.categorie).filter(Boolean);
    return [...new Set([...CATEGORIES_BASE, ...depuisArticles])].sort((a, b) => a.localeCompare(b));
  }, [liste]);

  const supprimerCategorie = async (cat) => {
    if (!confirm(`Supprimer la catégorie "${cat}" ? Elle sera retirée de tous les articles qui l'utilisent (ils redeviendront sans catégorie).`)) return;
    await supabase.from("articles").update({ categorie: null }).eq("categorie", cat);
    charger();
  };

  const enregistrer = async () => {
    if (!form.designation.trim()) return;
    setEnvoi(true);
    const payload = { ...form, dernier_prix_ht: form.dernier_prix_ht === "" ? null : Number(form.dernier_prix_ht) };
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
          <Autocomplete
            placeholder="Catégorie (tape pour voir les suggestions)"
            value={form.categorie}
            onChange={(val) => setForm({ ...form, categorie: val })}
            suggestions={categorieOptions}
            style={{ flex: 1 }}
          />
          <input type="number" placeholder="Dernier prix HT" value={form.dernier_prix_ht} onChange={(e) => setForm({ ...form, dernier_prix_ht: e.target.value })} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={enregistrer} disabled={envoi} style={buttonStyle}>{envoi ? "Création..." : "Ajouter"}</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Catégories existantes</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 200, overflow: "auto" }}>
          {categorieOptions.map((c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "#F5F4F1", borderRadius: 6, padding: "4px 8px" }}>
              {c}
              {role === "acheteur" && (
                <button onClick={() => supprimerCategorie(c)} style={{ border: "none", background: "none", color: "#B3261E", cursor: "pointer", fontSize: 13, padding: 0 }} title="Supprimer cette catégorie">×</button>
              )}
            </span>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}

