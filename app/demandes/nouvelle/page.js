"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";

const ligneVide = () => ({ key: Math.random().toString(36).slice(2), designation: "", quantite: 1, unite: "pcs" });

export default function NouvelleDemandePage() {
  const router = useRouter();
  const [articlesBase, setArticlesBase] = useState([]);
  const [service, setService] = useState("");
  const [demandeur, setDemandeur] = useState("");
  const [motif, setMotif] = useState("");
  const [priorite, setPriorite] = useState("Moyenne");
  const [lignes, setLignes] = useState([ligneVide()]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("articles").select("id, designation, unite_defaut").limit(10000);
      setArticlesBase(data || []);
    })();
  }, []);

  // Si la désignation tapée correspond à un article existant, pré-remplit son unité automatiquement
  const onDesignationChange = (key, val) => {
    updateLigne(key, "designation", val);
    const match = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (match && match.unite_defaut) updateLigne(key, "unite", match.unite_defaut);
  };

  // Si l'unité est modifiée à la main, on met aussi à jour la fiche article correspondante
  const onUniteBlur = async (key, designation, unite) => {
    const match = articlesBase.find((a) => a.designation.toLowerCase() === designation.toLowerCase());
    if (match && unite && unite !== match.unite_defaut) {
      await supabase.from("articles").update({ unite_defaut: unite }).eq("id", match.id);
      setArticlesBase((prev) => prev.map((a) => (a.id === match.id ? { ...a, unite_defaut: unite } : a)));
    }
  };

  const addLigne = () => setLignes([...lignes, ligneVide()]);
  const updateLigne = (key, field, val) => setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const removeLigne = (key) => setLignes(lignes.filter((l) => l.key !== key));

  const creer = async () => {
    const lignesValides = lignes.filter((l) => l.designation.trim());
    if (lignesValides.length === 0) return;
    setEnvoi(true);

    const { data: demande, error } = await supabase
      .from("demandes")
      .insert({ service, demandeur, motif_projet: motif, priorite })
      .select()
      .single();

    if (error || !demande) {
      setEnvoi(false);
      return;
    }

    const payload = [];
    for (const l of lignesValides) {
      let article = articlesBase.find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
      if (!article) {
        const { data: nouvel } = await supabase
          .from("articles")
          .insert({ designation: l.designation, unite_defaut: l.unite || "pcs" })
          .select()
          .single();
        article = nouvel;
      }
      payload.push({
        demande_id: demande.id,
        article_id: article ? article.id : null,
        designation: l.designation,
        quantite: Number(l.quantite) || 1,
        unite: l.unite,
      });
    }
    await supabase.from("lignes_demande").insert(payload);

    router.push(`/demandes/${demande.id}`);
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>Nouvelle demande</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input placeholder="Service demandeur" value={service} onChange={(e) => setService(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Nom du demandeur" value={demandeur} onChange={(e) => setDemandeur(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Motif / projet" value={motif} onChange={(e) => setMotif(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)} style={inputStyle}>
            <option>Haute</option><option>Moyenne</option><option>Basse</option>
          </select>
        </div>

        {lignes.map((l) => (
          <div key={l.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Autocomplete
              placeholder="Désignation de l'article (tape pour voir les suggestions)"
              value={l.designation}
              onChange={(val) => onDesignationChange(l.key, val)}
              suggestions={articlesBase.map((a) => a.designation)}
              style={{ flex: 3 }}
            />
            <input type="number" min="0" value={l.quantite} onChange={(e) => updateLigne(l.key, "quantite", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input
              placeholder="unité"
              value={l.unite}
              onChange={(e) => updateLigne(l.key, "unite", e.target.value)}
              onBlur={(e) => onUniteBlur(l.key, l.designation, e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => removeLigne(l.key)} style={linkBtn}>Retirer</button>
          </div>
        ))}
        <button onClick={addLigne} style={{ ...buttonStyle, background: "#888", marginTop: 4 }}>+ Ajouter une ligne</button>

        <div style={{ marginTop: 16 }}>
          <button onClick={creer} disabled={envoi} style={buttonStyle}>
            {envoi ? "Création..." : "Créer la demande et ouvrir le TCO"}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}

