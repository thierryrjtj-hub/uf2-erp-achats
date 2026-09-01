"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

export default function DashboardPage() {
  const [nbFournisseurs, setNbFournisseurs] = useState(null);
  const [nbArticles, setNbArticles] = useState(null);
  const [dernieresActions, setDernieresActions] = useState([]);

  useEffect(() => {
    (async () => {
      const { count: cf } = await supabase.from("fournisseurs").select("*", { count: "exact", head: true });
      const { count: ca } = await supabase.from("articles").select("*", { count: "exact", head: true });
      setNbFournisseurs(cf ?? 0);
      setNbArticles(ca ?? 0);

      const { data } = await supabase
        .from("journal_audit")
        .select("action, entite, date_heure")
        .order("date_heure", { ascending: false })
        .limit(10);
      setDernieresActions(data || []);
    })();
  }, []);

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Tableau de bord</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Card label="Fournisseurs" value={nbFournisseurs} />
        <Card label="Articles" value={nbArticles} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Dernières actions (journal d'audit)</h2>
        {dernieresActions.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune action enregistrée pour le moment.</p>}
        {dernieresActions.map((a, i) => (
          <div key={i} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
            {a.action} — {a.entite} — {new Date(a.date_heure).toLocaleString("fr-FR")}
          </div>
        ))}
      </div>
    </AuthGuard>
  );
}

function Card({ label, value }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", minWidth: 140 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600 }}>{value ?? "…"}</div>
    </div>
  );
}
