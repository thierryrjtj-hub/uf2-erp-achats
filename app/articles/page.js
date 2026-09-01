"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

const empty = { designation: "", unite: "", categorie: "", dernier_prix_ht: "" };

export default function ArticlesPage() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

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
      designation: a.designation, unite: a.unite || "", categorie: a.categorie || "",
      dernier_prix_ht: a.dernier_prix_ht ?? "",
    });
    setEditId(a.id);
  };

  const supprimer = async (id) => {
    await supabase.from("articles").delete().eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Articles</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editId ? "Modifier l'article" : "Ajouter un article"}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Désignation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Unité" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} style={{ ...inputStyle, width: 100 }} />
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
              <th style={thStyle}>Désignation</th>
              <th style={thStyle}>Unité</th>
              <th style={thStyle}>Catégorie</th>
              <th style={thStyle}>Dernier prix HT</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={tdStyle}>{a.designation}</td>
                <td style={tdStyle}>{a.unite}</td>
                <td style={tdStyle}>{a.categorie}</td>
                <td style={tdStyle}>{a.dernier_prix_ht ?? "-"}</td>
                <td style={tdStyle}>
                  <button onClick={() => modifier(a)} style={linkBtn}>Modifier</button>
                  <button onClick={() => supprimer(a.id)} style={{ ...linkBtn, color: "#B3261E" }}>Supprimer</button>
                </td>
              </tr>
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
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 12, cursor: "pointer", marginRight: 10, textDecoration: "underline", padding: 0 };
