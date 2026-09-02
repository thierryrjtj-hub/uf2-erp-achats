"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";

const empty = {
  nom: "", contact: "", telephone: "", email: "", adresse: "", code_postal: "",
  nif: "", stat: "", rcs: "", cin: "", type_reglement: "Chèque",
  tva_defaut_pct: 20, activite: "", conditions_paiement_jours: 30, remise_par_defaut_pct: 0,
};

export default function FournisseursPage() {
  const [liste, setListe] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [exporting, setExporting] = useState(false);

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
      adresse: f.adresse || "", code_postal: f.code_postal || "", nif: f.nif || "", stat: f.stat || "",
      rcs: f.rcs || "", cin: f.cin || "", type_reglement: f.type_reglement || "Chèque",
      tva_defaut_pct: f.tva_defaut_pct ?? 20, activite: f.activite || "",
      conditions_paiement_jours: f.conditions_paiement_jours || 30, remise_par_defaut_pct: f.remise_par_defaut_pct || 0,
    });
    setEditId(f.id);
  };

  const supprimer = async (id) => {
    await supabase.from("fournisseurs").delete().eq("id", id);
    charger();
  };

  const exporter = async () => {
    setExporting(true);
    const rows = liste.map((f) => ({
      nom: f.nom, contact: f.contact || "", tel: f.telephone || "", email: f.email || "",
      adresse: f.adresse || "", cp: f.code_postal || "", nif: f.nif || "", stat: f.stat || "",
      rcs: f.rcs || "", cin: f.cin || "", reglement: f.type_reglement || "", tva: f.tva_defaut_pct ?? 20,
      activite: f.activite || "", echeance: f.conditions_paiement_jours || 30, remise: f.remise_par_defaut_pct || 0,
    }));
    await exportExcel({
      filename: `fournisseurs_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [{
        name: "Fournisseurs",
        columns: [
          { header: "Nom", key: "nom", width: 28 }, { header: "Nom du contact", key: "contact", width: 20 },
          { header: "Tél", key: "tel", width: 15 }, { header: "E-mail", key: "email", width: 22 },
          { header: "Adresse", key: "adresse", width: 26 }, { header: "Code postal", key: "cp", width: 12 },
          { header: "NIF", key: "nif", width: 16 }, { header: "STAT", key: "stat", width: 16 },
          { header: "RCS", key: "rcs", width: 16 }, { header: "CIN", key: "cin", width: 16 },
          { header: "Règlement", key: "reglement", width: 14 }, { header: "TVA %", key: "tva", width: 8 },
          { header: "Activité", key: "activite", width: 20 }, { header: "Échéance (j)", key: "echeance", width: 12 },
          { header: "Remise %", key: "remise", width: 10 },
        ],
        rows, percentKeys: ["tva", "remise"],
      }],
    });
    setExporting(false);
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Fournisseurs</h1>
        <button onClick={exporter} disabled={exporting} style={buttonStyle}>{exporting ? "Génération..." : "Exporter en Excel"}</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editId ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h2>

        <div style={rowStyle}>
          <input placeholder="Nom ou raison sociale" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Nom du contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
          <input placeholder="Code postal" value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} style={{ ...inputStyle, width: 120 }} />
        </div>

        <div style={rowStyle}>
          <input placeholder="NIF" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="STAT" value={form.stat} onChange={(e) => setForm({ ...form, stat: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="RCS" value={form.rcs} onChange={(e) => setForm({ ...form, rcs: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="CIN" value={form.cin} onChange={(e) => setForm({ ...form, cin: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <select value={form.type_reglement} onChange={(e) => setForm({ ...form, type_reglement: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
            <option>Chèque</option><option>Espèces</option><option>Chèque/Espèces</option><option>Virement</option>
          </select>
          <select value={form.tva_defaut_pct} onChange={(e) => setForm({ ...form, tva_defaut_pct: Number(e.target.value) })} style={{ ...inputStyle, flex: 1 }}>
            <option value={20}>TVA 20% (taxable)</option>
            <option value={0}>Non assujetti (0%)</option>
          </select>
          <input placeholder="Activité / secteur" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <div style={rowStyle}>
          <input type="number" placeholder="Délai paiement (jours)" value={form.conditions_paiement_jours} onChange={(e) => setForm({ ...form, conditions_paiement_jours: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          <input type="number" placeholder="Remise par défaut (%)" value={form.remise_par_defaut_pct} onChange={(e) => setForm({ ...form, remise_par_defaut_pct: e.target.value })} style={{ ...inputStyle, width: 180 }} />
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
              <th style={thStyle}>Nom</th><th style={thStyle}>Contact</th><th style={thStyle}>Tél</th>
              <th style={thStyle}>Activité</th><th style={thStyle}>TVA</th><th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={tdBold}>{f.nom}</td>
                <td style={tdStyle}>{f.contact}</td>
                <td style={tdStyle}>{f.telephone}</td>
                <td style={tdStyle}>{f.activite}</td>
                <td style={tdStyle}>{f.tva_defaut_pct === 0 ? "Non assujetti" : `${f.tva_defaut_pct ?? 20}%`}</td>
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
const rowStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 };
const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee" };
const tdStyle = { padding: "8px 6px" };
const tdBold = { padding: "8px 6px", fontWeight: 600 };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 12, cursor: "pointer", marginRight: 10, textDecoration: "underline", padding: 0 };
