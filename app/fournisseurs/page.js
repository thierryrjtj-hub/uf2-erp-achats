"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { useRole } from "../../lib/useRole";
import { IconCopy, IconEdit, IconTrash } from "../components/Icons";
import { inputStyle, buttonStyle } from "../components/ui";
import TriMenu, { appliquerTri } from "../components/TriMenu";

function matchRecherche(f, q) {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return [f.nom, f.contact, f.activite, f.telephone, f.email, f.adresse, f.nif].some((v) => (v || "").toLowerCase().includes(s));
}

export default function FournisseursListePage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState({ colonne: "nom", sens: "asc" });

  const charger = async () => {
    const { data } = await supabase.from("fournisseurs").select("*").order("nom").limit(10000);
    setListe(data || []);
  };

  useEffect(() => { charger(); }, []);

  const filtrees = useMemo(() => appliquerTri(liste.filter((f) => matchRecherche(f, recherche)), tri), [liste, recherche, tri]);

  const supprimer = async (id) => {
    await supabase.from("fournisseurs").delete().eq("id", id);
    charger();
  };

  const copierFiche = async (f) => {
    const texte = [
      f.nom, f.contact && `Contact : ${f.contact}`, f.telephone && `Tél : ${f.telephone}`, f.email && `E-mail : ${f.email}`,
      f.adresse && `Adresse : ${f.adresse}${f.code_postal ? " " + f.code_postal : ""}`,
      f.nif && `NIF : ${f.nif}`, f.stat && `STAT : ${f.stat}`, f.rcs && `RCS : ${f.rcs}`, f.cin && `CIN : ${f.cin}`,
      f.type_reglement && `Règlement : ${f.type_reglement}`, `TVA : ${f.tva_defaut_pct === 0 ? "Non assujetti" : (f.tva_defaut_pct ?? 20) + "%"}`,
      f.activite && `Activité : ${f.activite}`,
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(texte); } catch (e) {}
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18 }}>Liste des fournisseurs ({filtrees.length} / {liste.length})</h1>
          <button onClick={exporter} disabled={exporting} style={buttonStyle}>{exporting ? "Génération..." : "Exporter en Excel"}</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <div style={{ position: "relative", width: 300 }}>
              <input placeholder="Rechercher un fournisseur (nom, contact, activité, tél...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
              {recherche && (
                <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer la recherche">×</button>
              )}
            </div>
            <TriMenu
              colonnes={[
                { key: "nom", label: "Nom" },
                { key: "activite", label: "Activité" },
                { key: "created_at", label: "Date de création" },
              ]}
              tri={tri}
              onChange={setTri}
            />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {filtrees.map((f) => (
            <div key={f.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{f.nom}</div>
              <div>
                <button onClick={() => copierFiche(f)} style={iconBtn} title="Copier toutes les infos">
                  <IconCopy />
                </button>
                <Link href={`/fournisseurs/nouveau?id=${f.id}`} style={{ ...iconBtn, textDecoration: "none" }} title="Modifier">
                  <IconEdit />
                </Link>
                {role === "acheteur" && (
                  <button onClick={() => supprimer(f.id)} style={{ ...iconBtn, color: "#B3261E" }} title="Supprimer">
                    <IconTrash />
                  </button>
                )}
              </div>
            </div>
            <div style={grid}>
              <Champ label="Nom du contact" value={f.contact} />
              <ChampCopiable label="Téléphone" value={f.telephone} />
              <ChampCopiable label="E-mail" value={f.email} />
              <Champ label="Adresse" value={f.adresse} />
              <Champ label="Code postal" value={f.code_postal} />
              <Champ label="NIF" value={f.nif} />
              <Champ label="STAT" value={f.stat} />
              <Champ label="RCS" value={f.rcs} />
              <Champ label="CIN" value={f.cin} />
              <Champ label="Type de règlement" value={f.type_reglement} />
              <Champ label="TVA" value={f.tva_defaut_pct === 0 ? "Non assujetti" : `${f.tva_defaut_pct ?? 20}%`} />
              <Champ label="Activité" value={f.activite} />
              <Champ label="Délai paiement" value={f.conditions_paiement_jours ? `${f.conditions_paiement_jours} jours` : ""} />
              <Champ label="Remise par défaut" value={f.remise_par_defaut_pct ? `${f.remise_par_defaut_pct}%` : ""} />
            </div>
          </div>
          ))}
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
      <div style={champValue}>{value}</div>
    </div>
  );
}

function ChampCopiable({ label, value }) {
  const [copie, setCopie] = useState(false);
  if (!value) return null;
  const copier = async () => {
    try { await navigator.clipboard.writeText(value); setCopie(true); setTimeout(() => setCopie(false), 1500); } catch (e) {}
  };
  return (
    <div>
      <div style={champLabel}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2, wordBreak: "break-word" }}>{value}</div>
      <button onClick={copier} style={{ ...copyBtn, marginTop: 4 }}>{copie ? "Copié !" : "Copier"}</button>
    </div>
  );
}

const cardStyle = { border: "1px solid #eee", borderRadius: 10, padding: 16, marginBottom: 12 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14, marginTop: 10 };
const champLabel = { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3 };
const champValue = { fontSize: 13, marginTop: 2, display: "flex", alignItems: "center", gap: 6 };
const copyBtn = { fontSize: 11, border: "1px solid #ddd", background: "#fff", borderRadius: 4, padding: "1px 6px", cursor: "pointer", color: "#1B2430" };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
const iconBtn = { border: "none", background: "none", color: "#1B2430", cursor: "pointer", padding: 4, marginLeft: 4, display: "inline-flex", alignItems: "center", borderRadius: 6 };
