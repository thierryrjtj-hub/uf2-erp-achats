"use client";
import { useState, useEffect } from "react";

// Enveloppe un cadre pour lui donner un bouton "Agrandir" qui l'affiche
// temporairement en plein écran, avec un bouton "Réduire" pour revenir.
// Usage : <CadreExtensible titre="Tableau comparatif"><table>...</table></CadreExtensible>
export default function CadreExtensible({ titre, children, style, contentStyle, className }) {
  const [etendu, setEtendu] = useState(false);

  useEffect(() => {
    if (!etendu) return;
    const surEchap = (e) => { if (e.key === "Escape") setEtendu(false); };
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [etendu]);

  if (etendu) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 1000, display: "flex", flexDirection: "column" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #ECEBE6", flexShrink: 0 }}>
          {titre && <h2 style={{ fontSize: 15, margin: 0 }}>{titre}</h2>}
          <button onClick={() => setEtendu(false)} title="Réduire (Échap)" style={boutonStyle}>
            <IconReduire /> Réduire
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 20, ...contentStyle }}>
          {typeof children === "function" ? children(true) : children}
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <button onClick={() => setEtendu(true)} title="Agrandir en plein écran" style={{ ...boutonPetit }} className="no-print">
        <IconAgrandir />
      </button>
      {typeof children === "function" ? children(false) : children}
    </div>
  );
}

function IconAgrandir() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    </svg>
  );
}
function IconReduire() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v4a1 1 0 0 1-1 1H4M15 3v4a1 1 0 0 0 1 1h4M4 15h4a1 1 0 0 1 1 1v4M15 21v-4a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

const boutonPetit = {
  position: "absolute", top: 4, right: 4, zIndex: 5, border: "1px solid #ddd", background: "#fff",
  color: "#1B2430", cursor: "pointer", padding: 6, borderRadius: 6, display: "inline-flex", alignItems: "center",
};
const boutonStyle = {
  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7,
  border: "1px solid #ddd", background: "#fff", color: "#1B2430", fontSize: 13, cursor: "pointer",
};
