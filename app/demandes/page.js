"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import Autocomplete from "../components/Autocomplete";

const ligneVide = () => ({ key: Math.random().toString(36).slice(2), designation: "", quantite: 1, unite: "pcs" });

export default function DemandesPage() {
  const [liste, setListe] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [demandesAvecNonDispo, setDemandesAvecNonDispo] = useState(new Set());
  const [service, setService] = useState("");
  const [demandeur, setDemandeur] = useState("");
  const [motif, setMotif] = useState("");
  const [lignes, setLignes] = useState([ligneVide()]);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from("demandes").select("*").order("created_at", { ascending: false });
    setListe(data || []);
    const { data: arts } = await supabase.from("articles").select("id, designation, unite_defaut");
    setArticlesBase(arts || []);
    const { data: nonDispo } = await supabase.from("lignes_demande").select("demande_id").eq("non_disponible_localement", true);
    setDemandesAvecNonDispo(new Set((nonDispo || []).map((x) => x.demande_id)));
  };

  useEffect(() => { charger(); }, []);

  // Si la désignation tapée correspond à un article existant, pré-remplit son unité automatiquement
  const onDesignationChange = (key, val) => {
    updateLigne(key, "designation", val);
    const match = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (match && match.unite_defaut) updateLigne(key, "unite", match.unite_defaut);
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
      .insert({ service, demandeur, motif_projet: motif })
      .select()
      .single();

    if (error || !demande) {
      setEnvoi(false);
      return;
    }

    // Lie chaque ligne à un article existant, ou crée l'article automatiquement s'il n'existe pas encore
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

    setService(""); setDemandeur(""); setMotif("");
    setLignes([ligneVide()]);
    setEnvoi(false);
    charger();
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Demandes d'achat</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Nouvelle demande</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input placeholder="Service demandeur" value={service} onChange={(e) => setService(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Nom du demandeur" value={demandeur} onChange={(e) => setDemandeur(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Motif / projet" value={motif} onChange={(e) => setMotif(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
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
            <input placeholder="unité" value={l.unite} onChange={(e) => updateLigne(l.key, "unite", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
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

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Liste des demandes ({liste.length})</h2>
        {liste.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune demande pour le moment.</p>}
        {liste.map((d) => (
          <Link key={d.id} href={`/demandes/${d.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.numero}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{d.motif_projet}</div>
              </div>
              <div style={{ fontSize: 13, color: "#666", width: 150 }}>{d.service || "-"}</div>
              <div style={{ fontSize: 13, color: "#666", width: 110 }}>{d.date}</div>
              {demandesAvecNonDispo.has(d.id) && (
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#FDECEA", color: "#B3261E" }}>À rechercher import</span>
              )}
              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#FFF3D6", color: "#8A6100" }}>{d.statut}</span>
            </div>
          </Link>
        ))}
      </div>
    </AuthGuard>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const linkBtn = { border: "none", background: "none", color: "#B3261E", fontSize: 12, cursor: "pointer" };
const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid #f0f0f0" };
