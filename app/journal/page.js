"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { inputStyle, thStyle, tdStyle } from "../components/ui";
import TriMenu, { appliquerTri } from "../components/TriMenu";
import { useLangue } from "../../lib/i18n";

const CLE_ACTION = { INSERT: "jour_action_creation", UPDATE: "jour_action_modification", DELETE: "jour_action_suppression" };
const CLE_ENTITE = {
  fournisseurs: "jour_ent_fournisseur", articles: "jour_ent_article", demandes: "jour_ent_demande", lignes_demande: "jour_ent_ligne_demande",
  offres: "jour_ent_offre_tco", lignes_offre: "jour_ent_ligne_offre", commandes: "jour_ent_bc", lignes_bc: "jour_ent_ligne_bc",
  receptions: "jour_ent_reception", lignes_reception: "jour_ent_ligne_reception", accuses_reception_facture: "jour_ent_accuse_facture",
};

function reference(details) {
  if (!details) return "";
  return details.numero || details.numero_tco || details.nom || details.designation || details.fournisseur_nom || details.numero_facture || "";
}

export default function JournalAuditPage() {
  const { t } = useLangue();
  const [entrees, setEntrees] = useState([]);
  const [profils, setProfils] = useState({});
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreEntite, setFiltreEntite] = useState("");
  const [filtreAction, setFiltreAction] = useState("");
  const [tri, setTri] = useState({ colonne: "date_heure", sens: "desc" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("journal_audit").select("*").order("date_heure", { ascending: false }).limit(500);
      setEntrees(data || []);
      const ids = [...new Set((data || []).map((e) => e.utilisateur_id).filter(Boolean))];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, nom").in("id", ids);
        const map = {};
        (p || []).forEach((x) => { map[x.id] = x.nom; });
        setProfils(map);
      }
      setLoading(false);
    })();
  }, []);

  const entitesDistinctes = useMemo(() => [...new Set(entrees.map((e) => e.entite))].sort(), [entrees]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = entrees.filter((e) => {
      const ref = reference(e.details);
      const okRecherche = !q || ref.toLowerCase().includes(q) || (profils[e.utilisateur_id] || "").toLowerCase().includes(q);
      const okEntite = !filtreEntite || e.entite === filtreEntite;
      const okAction = !filtreAction || e.action === filtreAction;
      return okRecherche && okEntite && okAction;
    });
    return appliquerTri(base, tri);
  }, [entrees, recherche, filtreEntite, filtreAction, profils, tri]);

  const libelleAction = (a) => (CLE_ACTION[a] ? t(CLE_ACTION[a]) : a);
  const libelleEntite = (e) => (CLE_ENTITE[e] ? t(CLE_ENTITE[e]) : e);

  const badgeAction = (a) => ({
    fontSize: 11, padding: "2px 8px", borderRadius: 5,
    background: a === "INSERT" ? "#EAF7EE" : a === "DELETE" ? "#FDECEA" : "#FFF3D6",
    color: a === "INSERT" ? "#1B7A4C" : a === "DELETE" ? "#B3261E" : "#8A6100",
  });

  if (loading) return <AuthGuard><p>{t("chargement")}</p></AuthGuard>;

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 4, flexShrink: 0 }}>{t("jour_titre")}</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 14, flexShrink: 0 }}>{t("jour_aide")}</p>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", flexShrink: 0 }}>
            <input
              placeholder={t("jour_ph_recherche")}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            />
            <select value={filtreEntite} onChange={(e) => setFiltreEntite(e.target.value)} style={inputStyle}>
              <option value="">{t("jour_toutes_entites")}</option>
              {entitesDistinctes.map((e) => <option key={e} value={e}>{libelleEntite(e)}</option>)}
            </select>
            <select value={filtreAction} onChange={(e) => setFiltreAction(e.target.value)} style={inputStyle}>
              <option value="">{t("jour_toutes_actions")}</option>
              <option value="INSERT">{t("jour_action_creation")}</option>
              <option value="UPDATE">{t("jour_action_modification")}</option>
              <option value="DELETE">{t("jour_action_suppression")}</option>
            </select>
            <TriMenu
              colonnes={[
                { key: "date_heure", label: t("jour_h_date_heure") },
                { key: "entite", label: t("jour_h_entite") },
                { key: "action", label: "Action" },
              ]}
              tri={tri}
              onChange={setTri}
            />
          </div>

          {filtrees.length === 0 ? (
            <p style={{ color: "#888", fontSize: 13 }}>{t("jour_aucune_entree")}</p>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("jour_h_date_heure")}</th>
                <th style={thStyle}>{t("jour_h_utilisateur")}</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>{t("jour_h_entite")}</th>
                <th style={thStyle}>{t("jour_h_reference")}</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={tdStyle}>{new Date(e.date_heure).toLocaleString("fr-FR")}</td>
                  <td style={tdStyle}>{profils[e.utilisateur_id] || "-"}</td>
                  <td style={tdStyle}><span style={badgeAction(e.action)}>{libelleAction(e.action)}</span></td>
                  <td style={tdStyle}>{libelleEntite(e.entite)}</td>
                  <td style={tdStyle}>{reference(e.details) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
