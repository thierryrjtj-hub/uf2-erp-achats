"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";

const UNITES = ["pcs", "kg", "litre", "fût", "unité", "autre"];
const empty = { designation: "", unite_defaut: "pcs", categorie: "", dernier_prix_ht: "" };

export default function ArticlesPage() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [historique, setHistorique] = useState({});
  const [exporting, setExporting] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from("articles").select("*").order("designation");
    setListe(data || []);
  };

  useEffect(() => { charger(); }, []);

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

  const voirHistorique = async (article) => {
    if (ouvert === article.id) { setOuvert(null); return; }
    setOuvert(article.id);
    if (historique[article.id]) return;
    const { data: lignes } = await supabase
      .from("lignes_bc")
      .select("*, commandes:bc_id(numero, date, fournisseur_nom, assujetti_tva)")
      .ilike("designation", article.designation);
    const rows = (lignes || [])
      .filter((l) => l.commandes)
      .map((l) => ({
        bc: l.commandes.numero, date: l.commandes.date, fournisseur: l.commandes.fournisseur_nom,
        pu: Number(l.prix_unitaire_ht) || 0,
        puTtc: (Number(l.prix_unitaire_ht) || 0) * (l.commandes.assujetti_tva === false ? 1 : 1.2),
        qte: l.quantite,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setHistorique((prev) => ({ ...prev, [article.id]: rows }));
  };

  const exporter = async () => {
    setExporting(true);
    const rows = liste.map((a) => ({
      designation: a.designation, unite: a.unite_defaut || "", categorie: a.categorie || "", prix: Number(a.dernier_prix_ht) || 0,
    }));
    await exportExcel({
      filename: `articles_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: "Articles",
        columns: [
          { header: "Désignation", key: "designation", width: 40 }, { header: "Unité", key: "unite", width: 12 },
          { header: "Catégorie", key: "categorie", width: 20 }, { header: "Dernier prix HT", key: "prix", width: 16 },
        ],
        rows, currencyKeys: ["prix"],
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
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Liste ({liste.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Désignation</th><th style={thStyle}>Unité</th><th style={thStyle}>Catégorie</th>
              <th style={thStyle}>Dernier prix HT</th><th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((a) => (
              <React.Fragment key={a.id}>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={tdBold}>{a.designation}</td>
                  <td style={tdStyle}>{a.unite_defaut || "-"}</td>
                  <td style={tdStyle}>{a.categorie}</td>
                  <td style={tdStyle}>{a.dernier_prix_ht ?? "-"}</td>
                  <td style={tdStyle}>
                    <button onClick={() => voirHistorique(a)} style={linkBtn}>{ouvert === a.id ? "Fermer" : "Historique achats"}</button>
                    <button onClick={() => modifier(a)} style={linkBtn}>Modifier</button>
                    <button onClick={() => supprimer(a.id)} style={{ ...linkBtn, color: "#B3261E" }}>Supprimer</button>
                  </td>
                </tr>
                {ouvert === a.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 6px 16px", background: "#FAFAF8" }}>
                      {!historique[a.id] && <span style={{ fontSize: 12, color: "#888" }}>Chargement...</span>}
                      {historique[a.id] && historique[a.id].length === 0 && <span style={{ fontSize: 12, color: "#888" }}>Aucun achat trouvé pour cet article.</span>}
                      {historique[a.id] && historique[a.id].length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Dernier achat : {historique[a.id][0].fournisseur} — {historique[a.id][0].pu.toLocaleString("fr-FR")} Ar HT
                            ({historique[a.id][0].puTtc.toLocaleString("fr-FR")} Ar TTC) le {historique[a.id][0].date}, qté {historique[a.id][0].qte}, BC {historique[a.id][0].bc}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            Autres fournisseurs consultés :{" "}
                            {[...new Map(historique[a.id].slice(1).map((h) => [h.fournisseur, h])).values()]
                              .slice(0, 4)
                              .map((h) => `${h.fournisseur} (${h.pu.toLocaleString("fr-FR")} Ar)`)
                              .join(", ") || "aucun autre pour l'instant"}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </AuthGuard>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee" };
const tdStyle = { padding: "8px 6px" };
const tdBold = { padding: "8px 6px", fontWeight: 600 };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 12, cursor: "pointer", marginRight: 10, textDecoration: "underline", padding: 0 };
