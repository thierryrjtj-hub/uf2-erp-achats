"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { useRole } from "../../lib/useRole";
import { thStyle, tdStyle, buttonStyle, cardStyle } from "../components/ui";
import { useLangue } from "../../lib/i18n";

export default function ErreursTechniquesPage() {
  const role = useRole();
  const { t } = useLangue();
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
        <h1 style={{ fontSize: 18 }}>{t("err_titre", { n: liste.length })}</h1>
        <button onClick={charger} disabled={loading} style={buttonStyle}>{loading ? "..." : t("err_actualiser")}</button>
      </div>

      <p style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>{t("err_aide")}</p>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={voirResolues} onChange={(e) => setVoirResolues(e.target.checked)} />
        {t("err_voir_resolues")}
      </label>

      <div style={cardStyle}>
        {loading && <p style={{ color: "#888", fontSize: 13 }}>{t("chargement")}</p>}
        {!loading && liste.length === 0 && <p style={{ color: "#1B7A4C", fontSize: 13 }}>{t("err_aucune", { suffixe: voirResolues ? "" : t("err_en_attente") })}</p>}
        {!loading && liste.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("col_date")}</th>
                <th style={thStyle}>{t("err_h_contexte")}</th>
                <th style={thStyle}>{t("err_h_message")}</th>
                <th style={thStyle}>{t("err_h_page")}</th>
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
                        {t("err_marquer_resolu")}
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
