"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

export default function DashboardPage() {
  const [nbFournisseurs, setNbFournisseurs] = useState(null);
  const [nbArticles, setNbArticles] = useState(null);
  const [enAttente, setEnAttente] = useState(null);
  const [impayes, setImpayes] = useState({ count: 0, total: 0 });
  const [dernieresActions, setDernieresActions] = useState([]);

  useEffect(() => {
    (async () => {
      const { count: cf } = await supabase.from("fournisseurs").select("*", { count: "exact", head: true });
      const { count: ca } = await supabase.from("articles").select("*", { count: "exact", head: true });
      setNbFournisseurs(cf ?? 0);
      setNbArticles(ca ?? 0);

      const { data: demandesData } = await supabase.from("demandes").select("id, statut");
      const nbEnAttente = (demandesData || []).filter((d) => d.statut !== "Basculée en commande").length;
      setEnAttente(nbEnAttente);

      const { data: commandesData } = await supabase.from("commandes").select("montant_ttc, statut_paiement");
      const listeImpayes = (commandesData || []).filter((c) => c.statut_paiement !== "Payé");
      setImpayes({ count: listeImpayes.length, total: listeImpayes.reduce((s, c) => s + Number(c.montant_ttc || 0), 0) });

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

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <Card label="Fournisseurs" value={nbFournisseurs} />
        <Card label="Articles" value={nbArticles} />
        <Card label="Demandes en attente de BC" value={enAttente} />
        <Card label="Factures impayées" value={impayes.count} sub={impayes.total ? `${impayes.total.toLocaleString("fr-FR")} Ar` : null} />
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

function Card({ label, value, sub }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", minWidth: 160 }}>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600 }}>{value ?? "…"}</div>
      {sub && <div style={{ fontSize: 12, color: "#B3261E", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
