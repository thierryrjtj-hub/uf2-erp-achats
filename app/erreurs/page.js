"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { useRole } from "../../lib/useRole";
import { thStyle, tdStyle, buttonStyle, cardStyle } from "../components/ui";

export default function ErreursTechniquesPage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voirResolues, setVoirResolues] = useState(false);

  const charger = async () => {
    setLoading(true);
    let requete = supabase.from("erreurs_techniques").select("*").order("created_at", { ascending: false }).limit(500);
    if (!voirResolues) requete = requete.eq("resolu", false);
    const { data } = await requete;
    setListe(data || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [voirResolues]);

  const marquerResolu = async (id) => {
    await supabase.from("erreurs_techniques").update({ resolu: true }).eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Journal des erreurs techniques ({liste.length})</h1>
        <button onClick={charger} disabled={loading} style={buttonStyle}>{loading ? "..." : "Actualiser"}</button>
      </div>

      <p style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
        Capture automatique des erreurs techniques non gérées côté appli (bugs de code, requêtes échouées de façon inattendue).
        Ne capture pas encore les messages d'erreur affichés directement par un formulaire — à étendre progressivement.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={voirResolues} onChange={(e) => setVoirResolues(e.target.checked)} />
        Voir aussi les erreurs déjà marquées résolues
      </label>

      <div style={cardStyle}>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && liste.length === 0 && <p style={{ color: "#1B7A4C", fontSize: 13 }}>✓ Aucune erreur technique {voirResolues ? "" : "en attente"}.</p>}
        {!loading && liste.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Contexte</th>
                <th style={thStyle}>Message</th>
                <th style={thStyle}>Page</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0", opacity: e.resolu ? 0.5 : 1 }}>
                  <td style={tdStyle}>{new Date(e.created_at).toLocaleString("fr-FR")}</td>
                  <td style={tdStyle}>{e.contexte || "—"}</td>
                  <td style={{ ...tdStyle, color: "#666", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.message}>{e.message}</td>
                  <td style={tdStyle}>{e.url || "—"}</td>
                  <td style={tdStyle}>
                    {role === "acheteur" && !e.resolu && (
                      <button onClick={() => marquerResolu(e.id)} style={{ border: "none", background: "#1E3A34", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
                        Marquer résolu
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AuthGuard>
  );
}

