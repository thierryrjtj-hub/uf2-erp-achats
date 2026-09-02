"use client";
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";

const UNITES = ["pcs", "kg", "litre", "fût", "unité", "autre"];
const empty = { designation: "", unite_defaut: "pcs", categorie: "", dernier_prix_ht: "" };

function matchRecherche(a, q) {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return [a.designation, a.categorie].some((v) => (v || "").toLowerCase().includes(s));
}

export default function ArticlesPage() {
  const [liste, setListe] = useState([]);
  const [lignesBc, setLignesBc] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [recherche, setRecherche] = useState("");

  const charger = async () => {
    const { data } = await supabase.from("articles").select("*").order("designation");
    setListe(data || []);
    const { data: lignes } = await supabase
      .from("lignes_bc")
      .select("*, commandes:bc_id(numero, date, fournisseur_nom, assujetti_tva)");
    setLignesBc((lignes || []).filter((l) => l.commandes));
  };

  useEffect(() => { charger(); }, []);

  const historiqueParArticle = useMemo(() => {
    const map = {};
    for (const a of liste) {
      const rows = lignesBc
        .filter((l) => l.designation.toLowerCase() === a.designation.toLowerCase())
        .map((l) => ({
          bc: l.commandes.numero, date: l.commandes.date, fournisseur: l.commandes.fournisseur_nom,
          pu: Number(l.prix_unitaire_ht) || 0,
          puTtc: (Number(l.prix_unitaire_ht) || 0) * (l.commandes.assujetti_tva === false ? 1 : 1.2),
          qte: l.quantite,
        }))
        .sort((x, y) => new Date(y.date) - new Date(x.date));
      map[a.id] = rows;
    }
    return map;
  }, [liste, lignesBc]);

  const enregistrer = async () => {
    if (!form.designation.trim()) return;
    const payload = { ...form, dernier_prix_ht: form.dernier_prix_ht === "" ? null : Number(form.dernier_prix_ht) };
    if (editId) {
      await supabase.from("articles").update(payload).eq("id", editId);
    } else {
      await supabase.from("articles").insert(payload);
    }
    setForm(empty);
    setEditId(null);
    charger();
  };

  const modifier = (a) => {
    setForm({
      designation: a.designation, unite_defaut: a.unite_defaut || "pcs", categorie: a.categorie || "",
      dernier_prix_ht: a.dernier_prix_ht ?? "",
    });
    setEditId(a.id);
  };

  const supprimer = async (id) => {
    await supabase.from("articles").delete().eq("id", id);
    charger();
  };

  const copierFiche = async (a, dernier) => {
    const texte = [
      a.designation, a.unite_defaut && `Unité : ${a.unite_defaut}`, a.categorie && `Catégorie : ${a.categorie}`,
      a.dernier_prix_ht && `Dernier prix HT (référence) : ${Number(a.dernier_prix_ht).toLocaleString("fr-FR")} Ar`,
      dernier && `Dernier achat réel : ${dernier.fournisseur} — ${dernier.pu.toLocaleString("fr-FR")} Ar HT le ${dernier.date} (BC ${dernier.bc})`,
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(texte); } catch (e) {}
  };

  const exporter = async () => {
    setExporting(true);
    const rows = liste.map((a) => {
      const h = historiqueParArticle[a.id]?.[0];
      return {
        designation: a.designation, unite: a.unite_defaut || "", categorie: a.categorie || "",
        prix: Number(a.dernier_prix_ht) || 0,
        dernierFournisseur: h?.fournisseur || "", dernierBc: h?.bc || "", dernierePrixTtc: h?.puTtc || 0,
      };
    });
    await exportExcel({
      filename: `articles_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: "Articles",
        columns: [
          { header: "Désignation", key: "designation", width: 40 }, { header: "Unité", key: "unite", width: 12 },
          { header: "Catégorie", key: "categorie", width: 20 }, { header: "Dernier prix HT", key: "prix", width: 16 },
          { header: "Dernier fournisseur", key: "dernierFournisseur", width: 22 }, { header: "Dernier N° BC", key: "dernierBc", width: 18 },
          { header: "Dernier prix TTC", key: "dernierePrixTtc", width: 16 },
        ],
        rows, currencyKeys: ["prix", "dernierePrixTtc"],
      }],
    });
    setExporting(false);
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Articles</h1>
        <button onClick={exporter} disabled={exporting} style={buttonStyle}>{exporting ? "Génération..." : "Exporter en Excel"}</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editId ? "Modifier l'article" : "Ajouter un article"}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Désignation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <select value={form.unite_defaut} onChange={(e) => setForm({ ...form, unite_defaut: e.target.value })} style={{ ...inputStyle, width: 120 }}>
            {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input placeholder="Catégorie" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Dernier prix HT" value={form.dernier_prix_ht} onChange={(e) => setForm({ ...form, dernier_prix_ht: e.target.value })} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={enregistrer} style={buttonStyle}>{editId ? "Enregistrer" : "Ajouter"}</button>
          {editId && <button onClick={() => { setForm(empty); setEditId(null); }} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15 }}>Liste ({liste.filter(a => matchRecherche(a, recherche)).length} / {liste.length})</h2>
          <input placeholder="Rechercher un article (désignation, catégorie...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: 340 }} />
        </div>
        {liste.filter((a) => matchRecherche(a, recherche)).map((a) => {
          const hist = historiqueParArticle[a.id] || [];
          const dernier = hist[0];
          const autres = [...new Map(hist.slice(1).map((h) => [h.fournisseur, h])).values()].slice(0, 4);
          return (
            <div key={a.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.designation}</div>
                <div>
                  <button onClick={() => copierFiche(a, dernier)} style={linkBtn}>Copier tout</button>
                  <button onClick={() => modifier(a)} style={linkBtn}>Modifier</button>
                  <button onClick={() => supprimer(a.id)} style={{ ...linkBtn, color: "#B3261E" }}>Supprimer</button>
                </div>
              </div>
              <div style={grid}>
                <Champ label="Unité d'achat" value={a.unite_defaut} />
                <Champ label="Catégorie" value={a.categorie} />
                <Champ label="Dernier prix HT (référence)" value={a.dernier_prix_ht ? `${Number(a.dernier_prix_ht).toLocaleString("fr-FR")} Ar` : ""} />
              </div>

              {dernier ? (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
                  <div style={champLabel}>Dernier achat réel</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    <strong>{dernier.fournisseur}</strong> — {dernier.pu.toLocaleString("fr-FR")} Ar HT
                    ({dernier.puTtc.toLocaleString("fr-FR")} Ar TTC) — qté {dernier.qte} — le {dernier.date} — BC {dernier.bc}
                  </div>
                  {autres.length > 0 && (
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      Autres fournisseurs consultés : {autres.map((h) => `${h.fournisseur} (${h.pu.toLocaleString("fr-FR")} Ar)`).join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#999", marginTop: 10 }}>Aucun achat enregistré pour l'instant sur cet article.</div>
              )}
            </div>
          );
        })}
      </div>
    </AuthGuard>
  );
}

function Champ({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={champLabel}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 12, cursor: "pointer", marginRight: 10, textDecoration: "underline", padding: 0 };
const cardStyle = { border: "1px solid #eee", borderRadius: 10, padding: 16, marginBottom: 12 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 10 };
const champLabel = { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 };
