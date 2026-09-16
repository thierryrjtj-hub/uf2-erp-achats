"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { useRole } from "../../lib/useRole";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../components/ui";

const empty = {
  date_demande: new Date().toISOString().slice(0, 10), motif: "", montant_demande: "",
  signataire_direction: "", date_signature: "", montant_depense: "", justificatif: "", observation: "",
};

function statutCalcule(p) {
  if (p.montant_depense && p.justificatif) return "Justifié";
  if (p.signataire_direction && p.date_signature) return "Décaissé";
  return "Demandé";
}

const COULEUR_STATUT = {
  "Demandé": { bg: "#F0EFEA", fg: "#888" },
  "Décaissé": { bg: "#FFF3D6", fg: "#8A6100" },
  "Justifié": { bg: "#EAF7EE", fg: "#1B7A4C" },
};

export default function PetiteCaissePage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [form, setForm] = useState(empty);
  const [envoi, setEnvoi] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("");

  const charger = async () => {
    const { data } = await supabase.from("petite_caisse").select("*").order("date_demande", { ascending: false }).limit(5000);
    setListe(data || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const filtrees = useMemo(() => {
    if (!filtreStatut) return liste;
    return liste.filter((p) => statutCalcule(p) === filtreStatut);
  }, [liste, filtreStatut]);

  const total = useMemo(() => filtrees.reduce((s, p) => s + (Number(p.montant_depense) || Number(p.montant_demande) || 0), 0), [filtrees]);

  const creer = async () => {
    if (!form.motif.trim() || !form.montant_demande) return;
    setEnvoi(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("petite_caisse").insert({
      date_demande: form.date_demande, motif: form.motif, montant_demande: Number(form.montant_demande),
      created_by: user?.id || null,
    });
    setEnvoi(false);
    setForm(empty);
    setNouveauOuvert(false);
    charger();
  };

  const modifier = (p) => {
    setEditId(p.id);
    setEditForm({
      date_demande: p.date_demande, motif: p.motif, montant_demande: p.montant_demande,
      signataire_direction: p.signataire_direction || "", date_signature: p.date_signature || "",
      montant_depense: p.montant_depense ?? "", justificatif: p.justificatif || "", observation: p.observation || "",
    });
  };

  const enregistrerEdition = async () => {
    const payload = {
      date_demande: editForm.date_demande, motif: editForm.motif, montant_demande: Number(editForm.montant_demande) || 0,
      signataire_direction: editForm.signataire_direction || null, date_signature: editForm.date_signature || null,
      montant_depense: editForm.montant_depense === "" ? null : Number(editForm.montant_depense),
      justificatif: editForm.justificatif || null, observation: editForm.observation || null,
    };
    payload.statut = statutCalcule(payload);
    await supabase.from("petite_caisse").update(payload).eq("id", editId);
    setEditId(null);
    setEditForm(null);
    charger();
  };

  const supprimer = async (id) => {
    if (!confirm("Supprimer cette ligne de petite caisse ?")) return;
    await supabase.from("petite_caisse").delete().eq("id", id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 18 }}>Petite caisse ({filtrees.length})</h1>
        <button onClick={() => setNouveauOuvert((o) => !o)} style={buttonStyle}>{nouveauOuvert ? "Fermer" : "+ Nouvelle demande"}</button>
      </div>

      {nouveauOuvert && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={form.date_demande} onChange={(e) => setForm({ ...form, date_demande: e.target.value })} style={{ ...inputStyle, width: 160 }} />
            <input placeholder="Motif de l'achat" value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
            <input type="number" placeholder="Montant demandé (Ar)" value={form.montant_demande} onChange={(e) => setForm({ ...form, montant_demande: e.target.value })} style={{ ...inputStyle, width: 180 }} />
          </div>
          <button onClick={creer} disabled={envoi} style={{ ...buttonStyle, marginTop: 10 }}>{envoi ? "Création..." : "Créer la demande"}</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
            <option value="">Tous les statuts</option>
            <option>Demandé</option>
            <option>Décaissé</option>
            <option>Justifié</option>
          </select>
          <span style={{ fontSize: 13, color: "#666" }}>Total {filtreStatut ? `(${filtreStatut})` : ""} : <strong>{total.toLocaleString("fr-FR")} Ar</strong></span>
        </div>

        {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
        {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune ligne pour ce filtre.</p>}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Motif</th>
              <th style={thStyle}>Montant demandé</th>
              <th style={thStyle}>Signataire direction</th>
              <th style={thStyle}>Montant dépensé</th>
              <th style={thStyle}>Pièce de caisse</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((p) => {
              const enEdition = editId === p.id;
              const st = statutCalcule(p);
              const c = COULEUR_STATUT[st];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {enEdition ? (
                    <>
                      <td style={tdStyle}><input type="date" value={editForm.date_demande} onChange={(e) => setEditForm({ ...editForm, date_demande: e.target.value })} style={{ ...inputStyle, width: 140 }} /></td>
                      <td style={tdStyle}><input value={editForm.motif} onChange={(e) => setEditForm({ ...editForm, motif: e.target.value })} style={{ ...inputStyle, width: "100%" }} /></td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_demande} onChange={(e) => setEditForm({ ...editForm, montant_demande: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}>
                        <input placeholder="Nom" value={editForm.signataire_direction} onChange={(e) => setEditForm({ ...editForm, signataire_direction: e.target.value })} style={{ ...inputStyle, width: 110, marginBottom: 4 }} />
                        <input type="date" value={editForm.date_signature} onChange={(e) => setEditForm({ ...editForm, date_signature: e.target.value })} style={{ ...inputStyle, width: 140 }} />
                      </td>
                      <td style={tdStyle}><input type="number" value={editForm.montant_depense} onChange={(e) => setEditForm({ ...editForm, montant_depense: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle}><input placeholder="N° pièce" value={editForm.justificatif} onChange={(e) => setEditForm({ ...editForm, justificatif: e.target.value })} style={{ ...inputStyle, width: 110 }} /></td>
                      <td style={tdStyle} colSpan={2}>
                        <button onClick={enregistrerEdition} style={{ ...buttonStyle, marginRight: 6 }}>Enregistrer</button>
                        <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{p.date_demande}</td>
                      <td style={tdStyle}>{p.motif}</td>
                      <td style={tdStyle}>{Number(p.montant_demande).toLocaleString("fr-FR")} Ar</td>
                      <td style={tdStyle}>{p.signataire_direction ? `${p.signataire_direction}${p.date_signature ? ` (${p.date_signature})` : ""}` : "—"}</td>
                      <td style={tdStyle}>{p.montant_depense ? `${Number(p.montant_depense).toLocaleString("fr-FR")} Ar` : "—"}</td>
                      <td style={tdStyle}>{p.justificatif || "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: c.bg, color: c.fg }}>{st}</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => modifier(p)} style={linkBtn}>Modifier</button>
                        {role === "acheteur" && <button onClick={() => supprimer(p.id)} style={{ ...linkBtn, color: "#B3261E" }}>Suppr.</button>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AuthGuard>
  );
}

