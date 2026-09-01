"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";

const empty = { nom: "", contact: "", telephone: "", email: "", conditions_paiement_jours: 30, remise_par_defaut_pct: 0 };

export default function FournisseursPage() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const charger = async () => {
    const { data } = await supabase.from("fournisseurs").select("*").order("nom");
    setListe(data || []);
  };

  useEffect(() => { charger(); }, []);

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    if (editId) {
      await supabase.from("fournisseurs").update(form).eq("id", editId);
    } else {
      await supabase.from("fournisseurs").insert(form);
    }
    setForm(empty);
    setEditId(null);
    charger();
  };

  const modifier = (f) => {
    setForm({
      nom: f.nom, contact: f.contact || "", telephone: f.telephone || "", email: f.email || "",
      conditions_paiement_jours: f.conditions_paiement_jours || 30, remise_par_defaut_pct: f.remise_par_defaut_pct || 0,
    });
    setEditId(f.id);
  };

  const supprimer = async (id) => {
    await supabase.from("fournisseurs").delete().eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Fournisseurs</h1>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editId ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Délai paiement (jours)" value={form.conditions_paiement_jours} onChange={(e) => setForm({ ...form, conditions_paiement_jours: e.target.value })} style={{ ...inputStyle, width: 150 }} />
          <input type="number" placeholder="Remise par défaut (%)" value={form.remise_par_defaut_pct} onChange={(e) => setForm({ ...form, remise_par_defaut_pct: e.target.value })} style={{ ...inputStyle, width: 160 }} />
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
              <th style={thStyle}>Nom</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Téléphone</th>
              <th style={thStyle}>Délai paiement</th>
              <th style={thStyle}>Remise</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={tdStyle}>{f.nom}</td>
                <td style={tdStyle}>{f.contact}</td>
                <td style={tdStyle}>{f.telephone}</td>
                <td style={tdStyle}>{f.conditions_paiement_jours} j</td>
                <td style={tdStyle}>{f.remise_par_defaut_pct} %</td>
                <td style={tdStyle}>
                  <button onClick={() => modifier(f)} style={linkBtn}>Modifier</button>
                  <button onClick={() => supprimer(f.id)} style={{ ...linkBtn, color: "#B3261E" }}>Supprimer</button>
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
