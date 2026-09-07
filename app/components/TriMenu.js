"use client";
import { useState, useRef, useEffect } from "react";
import { inputStyle, BRAND } from "./ui";

// Icône de tri (façon "paramètres d'affichage") + menu déroulant pour choisir
// la colonne et le sens. `colonnes` = [{ key, label }]. `tri` = { colonne, sens: "asc"|"desc" }.
export default function TriMenu({ colonnes, tri, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fermer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);

  const colonneActuelle = colonnes.find((c) => c.key === tri.colonne);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOuvert((v) => !v)}
        title="Trier l'affichage"
        style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: "#fff" }}
      >
        <IconTri sens={tri.sens} />
        <span style={{ fontSize: 12 }}>{colonneActuelle ? colonneActuelle.label : "Trier"}</span>
      </button>

      {ouvert && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 20, minWidth: 200, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid #f0f0f0" }}>Trier par</div>
          {colonnes.map((c) => (
            <button
              key={c.key}
              onClick={() => { onChange({ colonne: c.key, sens: tri.colonne === c.key ? (tri.sens === "asc" ? "desc" : "asc") : "desc" }); setOuvert(false); }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                padding: "9px 12px", border: "none", background: tri.colonne === c.key ? "#F1F6F3" : "#fff",
                fontSize: 13, textAlign: "left", cursor: "pointer", color: tri.colonne === c.key ? BRAND : "#333",
              }}
            >
              {c.label}
              {tri.colonne === c.key && <IconTri sens={tri.sens} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconTri({ sens }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {sens === "asc"
        ? <path d="M3 16h6M3 12h10M3 8h14M18 6v12M18 6l4 4M18 6l-4 4" />
        : <path d="M3 8h6M3 12h10M3 16h14M18 18V6M18 18l4-4M18 18l-4-4" />}
    </svg>
  );
}

// Applique un tri générique sur un tableau, selon { colonne, sens }.
// Gère automatiquement les nombres, les dates ISO et le texte.
export function appliquerTri(lignes, tri) {
  if (!tri || !tri.colonne) return lignes;
  const copie = [...lignes];
  copie.sort((a, b) => {
    let va = a[tri.colonne];
    let vb = b[tri.colonne];
    if (va == null) va = "";
    if (vb == null) vb = "";
    if (typeof va === "number" && typeof vb === "number") {
      return tri.sens === "asc" ? va - vb : vb - va;
    }
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return tri.sens === "asc" ? -1 : 1;
    if (sa > sb) return tri.sens === "asc" ? 1 : -1;
    return 0;
  });
  return copie;
}

