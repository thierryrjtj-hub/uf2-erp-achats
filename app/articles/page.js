"use client";
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import Autocomplete from "../components/Autocomplete";
import { useRole } from "../../lib/useRole";
import { IconCopy, IconEdit, IconTrash } from "../components/Icons";
import { inputStyle, buttonStyle } from "../components/ui";
import TriMenu, { appliquerTri } from "../components/TriMenu";

function matchRecherche(a, q) {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return [a.designation, a.categorie].some((v) => (v || "").toLowerCase().includes(s));
}

export default function ArticlesListePage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [lignesBc, setLignesBc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState({ colonne: "designation", sens: "asc" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const charger = async () => {
    const { data } = await supabase.from("articles").select("*").order("designation").limit(10000);
    setListe(data || []);
    const { data: lignes } = await supabase
      .from("lignes_bc")
      .select("*, commandes:bc_id(numero, date, fournisseur_nom, assujetti_tva)")
      .limit(10000);
    setLignesBc((lignes || []).filter((l) => l.commandes));
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const filtrees = useMemo(() => appliquerTri(liste.filter((a) => matchRecherche(a, recherche)), tri), [liste, recherche, tri]);

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

  const uniteOptions = useMemo(() => [...new Set(liste.map((a) => a.unite_defaut).filter(Boolean))].sort(), [liste]);
  const categorieOptions = useMemo(() => [...new Set(liste.map((a) => a.categorie).filter(Boolean))].sort(), [liste]);

  const modifier = (a) => {
    setEditId(a.id);
    setEditForm({ designation: a.designation, unite_defaut: a.unite_defaut || "pcs", categorie: a.categorie || "", dernier_prix_ht: a.dernier_prix_ht ?? "" });
  };

  const enregistrerEdition = async () => {
    const payload = { ...editForm, dernier_prix_ht: editForm.dernier_prix_ht === "" ? null : Number(editForm.dernier_prix_ht) };
    await supabase.from("articles").update(payload).eq("id", editId);
    setEditId(null);
    setEditForm(null);
    charger();
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18 }}>Liste des articles ({loading ? "…" : filtrees.length} / {liste.length})</h1>
          <button onClick={exporter} disabled={exporting} style={buttonStyle}>{exporting ? "Génération..." : "Exporter en Excel"}</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <div style={{ position: "relative", width: 300 }}>
              <input placeholder="Rechercher un article (désignation, catégorie...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
              {recherche && (
                <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer la recherche">×</button>
              )}
            </div>
            <TriMenu
              colonnes={[
                { key: "designation", label: "Désignation" },
                { key: "categorie", label: "Catégorie" },
                { key: "dernier_prix_ht", label: "Dernier prix HT" },
              ]}
              tri={tri}
              onChange={setTri}
            />
          </div>

          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}

          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {filtrees.map((a) => {
              const hist = historiqueParArticle[a.id] || [];
              const dernier = hist[0];
              const autres = [...new Map(hist.slice(1).map((h) => [h.fournisseur, h])).values()].slice(0, 4);
              const enEdition = editId === a.id;
              return (
                <div key={a.id} style={cardStyle}>
                  {enEdition ? (
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <input placeholder="Désignation" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} style={{ ...inputStyle, flex: 2 }} />
                        <Autocomplete placeholder="Unité" value={editForm.unite_defaut} onChange={(val) => setEditForm({ ...editForm, unite_defaut: val })} suggestions={uniteOptions} style={{ width: 160 }} />
                        <Autocomplete placeholder="Catégorie" value={editForm.categorie} onChange={(val) => setEditForm({ ...editForm, categorie: val })} suggestions={categorieOptions} style={{ flex: 1 }} />
                        <input type="number" placeholder="Dernier prix HT" value={editForm.dernier_prix_ht} onChange={(e) => setEditForm({ ...editForm, dernier_prix_ht: e.target.value })} style={{ ...inputStyle, width: 140 }} />
                      </div>
                      <button onClick={enregistrerEdition} style={{ ...buttonStyle, marginRight: 8 }}>Enregistrer</button>
                      <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...buttonStyle, background: "#888" }}>Annuler</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{a.designation}</div>
                        <div>
                          <button onClick={() => copierFiche(a, dernier)} style={iconBtn} title="Copier toutes les infos"><IconCopy /></button>
                          <button onClick={() => modifier(a)} style={iconBtn} title="Modifier"><IconEdit /></button>
                          {role === "acheteur" && (
                            <button onClick={() => supprimer(a.id)} style={{ ...iconBtn, color: "#B3261E" }} title="Supprimer"><IconTrash /></button>
                          )}
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

const cardStyle = { border: "1px solid #eee", borderRadius: 10, padding: 16, marginBottom: 12 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 10 };
const champLabel = { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 };
const iconBtn = { border: "none", background: "none", color: "#1B2430", cursor: "pointer", padding: 4, marginLeft: 4, display: "inline-flex", alignItems: "center", borderRadius: 6 };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
