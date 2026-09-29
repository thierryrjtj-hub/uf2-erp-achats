"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import { useRole } from "../../../lib/useRole";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../../components/ui";
import { useLangue } from "../../../lib/i18n";

export default function CategoriesPage() {
  const role = useRole();
  const { t } = useLangue();
  const [liste, setListe] = useState([]);
  const [comptes, setComptes] = useState({});
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [renommage, setRenommage] = useState({}); // { [id]: valeur en cours d'édition }
  const [loading, setLoading] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const { data: cats } = await supabase.from("categories").select("*").order("nom");
    const { data: arts } = await supabase.from("articles").select("categorie_id").limit(10000);
    const c = {};
    (arts || []).forEach((a) => { if (a.categorie_id) c[a.categorie_id] = (c[a.categorie_id] || 0) + 1; });
    setListe(cats || []);
    setComptes(c);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const ajouter = async () => {
    const nom = nouvelleCategorie.trim();
    if (!nom) return;
    setEnvoi(true);
    const { error } = await supabase.from("categories").insert({ nom });
    setEnvoi(false);
    if (error) {
      alert(error.code === "23505" ? t("cat_deja_existe") : t("cat_erreur_creation"));
      return;
    }
    setNouvelleCategorie("");
    charger();
  };

  const renommer = async (id) => {
    const nom = (renommage[id] || "").trim();
    if (!nom) return;
    const { error } = await supabase.from("categories").update({ nom }).eq("id", id);
    if (error) {
      alert(error.code === "23505" ? t("cat_meme_nom") : t("cat_erreur_renommage"));
      return;
    }
    setRenommage((prev) => { const c = { ...prev }; delete c[id]; return c; });
    charger();
  };

  const supprimer = async (cat) => {
    const nb = comptes[cat.id] || 0;
    if (nb > 0) {
      alert(t("cat_confirm_supprimer_utilisee", { nom: cat.nom, n: nb }));
      return;
    }
    if (!confirm(t("cat_confirm_supprimer", { nom: cat.nom }))) return;
    await supabase.from("categories").delete().eq("id", cat.id);
    charger();
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>{t("cat_titre")}</h1>

      {role === "acheteur" && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder={t("cat_ph_nouvelle")}
              value={nouvelleCategorie}
              onChange={(e) => setNouvelleCategorie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ajouter(); }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={ajouter} disabled={envoi} style={buttonStyle}>{envoi ? t("cat_creation") : t("btn_ajouter_simple")}</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>{t("chargement")}</p>}
        {!loading && liste.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>{t("cat_aucune")}</p>}
        {!loading && liste.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("cat_h_nom")}</th>
                <th style={thStyle}>{t("cat_h_articles")}</th>
                {role === "acheteur" && <th style={thStyle}></th>}
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={tdStyle}>
                    {role === "acheteur" ? (
                      <input
                        value={renommage[c.id] ?? c.nom}
                        onChange={(e) => setRenommage((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        onBlur={() => { if ((renommage[c.id] ?? c.nom) !== c.nom) renommer(c.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                        style={{ ...inputStyle, width: "100%" }}
                      />
                    ) : c.nom}
                  </td>
                  <td style={tdStyle}>{comptes[c.id] || 0}</td>
                  {role === "acheteur" && (
                    <td style={tdStyle}>
                      <button onClick={() => supprimer(c)} style={{ ...linkBtn, color: "#B3261E" }} title={t("btn_supprimer")}>{t("btn_supprimer")}</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AuthGuard>
  );
}
