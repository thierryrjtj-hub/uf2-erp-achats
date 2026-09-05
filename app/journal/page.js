"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { inputStyle, thStyle, tdStyle } from "../components/ui";

const ACTIONS_LABEL = { INSERT: "Création", UPDATE: "Modification", DELETE: "Suppression" };
const ENTITES_LABEL = {
  fournisseurs: "Fournisseur", articles: "Article", demandes: "Demande d'achat", lignes_demande: "Ligne de demande",
  offres: "Offre TCO", lignes_offre: "Ligne d'offre", commandes: "Bon de commande", lignes_bc: "Ligne de BC",
  receptions: "Réception", lignes_reception: "Ligne de réception", accuses_reception_facture: "Accusé facture",
};

function reference(details) {
  if (!details) return "";
  return details.numero || details.numero_tco || details.nom || details.designation || details.fournisseur_nom || details.numero_facture || "";
}

export default function JournalAuditPage() {
  const [entrees, setEntrees] = useState([]);
  const [profils, setProfils] = useState({});
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreEntite, setFiltreEntite] = useState("");
  const [filtreAction, setFiltreAction] = useState("");

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
    return entrees.filter((e) => {
      const ref = reference(e.details);
      const okRecherche = !q || ref.toLowerCase().includes(q) || (profils[e.utilisateur_id] || "").toLowerCase().includes(q);
      const okEntite = !filtreEntite || e.entite === filtreEntite;
      const okAction = !filtreAction || e.action === filtreAction;
      return okRecherche && okEntite && okAction;
    });
  }, [entrees, recherche, filtreEntite, filtreAction, profils]);

  const badgeAction = (a) => ({
    fontSize: 11, padding: "2px 8px", borderRadius: 5,
    background: a === "INSERT" ? "#EAF7EE" : a === "DELETE" ? "#FDECEA" : "#FFF3D6",
    color: a === "INSERT" ? "#1B7A4C" : a === "DELETE" ? "#B3261E" : "#8A6100",
  });

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Journal d'audit</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Historique chronologique de toutes les actions effectuées dans l'application (500 dernières).</p>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            placeholder="Rechercher (référence, utilisateur...)"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <select value={filtreEntite} onChange={(e) => setFiltreEntite(e.target.value)} style={inputStyle}>
            <option value="">Toutes les entités</option>
            {entitesDistinctes.map((e) => <option key={e} value={e}>{ENTITES_LABEL[e] || e}</option>)}
          </select>
          <select value={filtreAction} onChange={(e) => setFiltreAction(e.target.value)} style={inputStyle}>
            <option value="">Toutes les actions</option>
            <option value="INSERT">Création</option>
            <option value="UPDATE">Modification</option>
            <option value="DELETE">Suppression</option>
          </select>
        </div>

        {filtrees.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13 }}>Aucune entrée pour ces filtres.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date / heure</th>
                <th style={thStyle}>Utilisateur</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Entité</th>
                <th style={thStyle}>Référence</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={tdStyle}>{new Date(e.date_heure).toLocaleString("fr-FR")}</td>
                  <td style={tdStyle}>{profils[e.utilisateur_id] || "-"}</td>
                  <td style={tdStyle}><span style={badgeAction(e.action)}>{ACTIONS_LABEL[e.action] || e.action}</span></td>
                  <td style={tdStyle}>{ENTITES_LABEL[e.entite] || e.entite}</td>
                  <td style={tdStyle}>{reference(e.details) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AuthGuard>
  );
}

