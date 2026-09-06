"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";
import { linkBtn } from "../components/ui";
import { IconCopy } from "../components/Icons";

export default function DemandesListePage() {
  const [liste, setListe] = useState([]);
  const [demandesAvecNonDispo, setDemandesAvecNonDispo] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const charger = async () => {
    const { data } = await supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(10000);
    setListe(data || []);
    const { data: nonDispo } = await supabase.from("lignes_demande").select("demande_id").eq("non_disponible_localement", true);
    setDemandesAvecNonDispo(new Set((nonDispo || []).map((x) => x.demande_id)));
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const copierPourDevis = async (d) => {
    const { data: lignesDeLaDemande } = await supabase.from("lignes_demande").select("*").eq("demande_id", d.id).order("created_at");
    const texte = [
      `Demande de devis — ${d.numero}`,
      `Service : ${d.service || "-"}  |  Demandeur : ${d.demandeur || "-"}`,
      d.motif_projet ? `Motif / projet : ${d.motif_projet}` : "",
      "",
      "Articles souhaités :",
      ...(lignesDeLaDemande || []).map((l, i) => `${i + 1}. ${l.designation} — ${l.quantite} ${l.unite}`),
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(texte).then(() => alert("Copié — colle-le dans un e-mail pour demander les devis aux fournisseurs."));
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 14, flexShrink: 0 }}>Liste des demandes ({liste.length})</h1>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
          {!loading && liste.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune demande pour le moment.</p>}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {liste.map((d) => (
              <div key={d.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <Link href={`/demandes/${d.id}`} style={{ fontWeight: 600, fontSize: 13, color: "#1E3A34", textDecoration: "underline" }}>{d.numero}</Link>
                  <div style={{ fontSize: 12, color: "#888" }}>{d.motif_projet}</div>
                </div>
                <div style={{ fontSize: 13, color: "#666", width: 150 }}>{d.service || "-"}</div>
                <div style={{ fontSize: 13, color: "#666", width: 110 }}>{formatDate(d.date)}</div>
                <span title={`Priorité : ${d.priorite || "Moyenne"}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: prioriteCouleur(d.priorite), flexShrink: 0, cursor: "help" }} />
                {demandesAvecNonDispo.has(d.id) && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#FDECEA", color: "#B3261E" }}>À rechercher import</span>
                )}
                <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#FFF3D6", color: "#8A6100" }}>{d.statut}</span>
                <button onClick={() => copierPourDevis(d)} style={linkBtnBleu} title="Copier pour demande de devis">
                  <IconCopy /> Devis
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function prioriteCouleur(p) {
  if (p === "Haute") return "#E4572E";
  if (p === "Basse") return "#B9B7AE";
  return "#F5A623";
}

const linkBtnBleu = { border: "1px solid #ddd", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 6, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 };
const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid #f0f0f0" };
