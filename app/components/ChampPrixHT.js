"use client";
import { useRef, useState } from "react";

// Champ de saisie de prix unitaire HT, avec un petit bouton calculatrice à côté :
// permet de taper un montant TTC connu et de le convertir automatiquement en HT
// directement dans le champ, sans sortir de l'appli.
//
// Deux modes d'utilisation, selon comment l'appelant gère déjà son état :
// - Contrôlé : passer value + onChange (comme un <input> classique)
// - Non contrôlé / "onBlur" : passer defaultValue + onCommit (appelé au blur
//   ET quand la calculatrice valide, pour rester cohérent avec les champs qui
//   n'enregistrent qu'à la perte de focus)
export default function ChampPrixHT({
  value, defaultValue, onChange, onCommit, tvaPct = 20, style, placeholder = "PU HT", disabled = false,
}) {
  const inputRef = useRef(null);
  const [ouvert, setOuvert] = useState(false);
  const [ttc, setTtc] = useState("");

  const appliquer = () => {
    const t = Number(ttc);
    if (!isNaN(t) && t > 0) {
      const ht = Math.round((t / (1 + tvaPct / 100)) * 100) / 100;
      const htStr = String(ht);
      if (onChange) {
        onChange(htStr);
      } else {
        if (inputRef.current) inputRef.current.value = htStr;
        if (onCommit) onCommit(htStr);
      }
    }
    setOuvert(false);
    setTtc("");
  };

  const inputProps = onChange
    ? { value, onChange: (e) => onChange(e.target.value) }
    : { defaultValue, onBlur: (e) => onCommit && onCommit(e.target.value) };

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input ref={inputRef} type="number" placeholder={placeholder} disabled={disabled} style={style} {...inputProps} />
      {!disabled && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          title="Convertir depuis un montant TTC connu"
          style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 12, flexShrink: 0, lineHeight: 1, padding: 0 }}
        >
          🧮
        </button>
      )}
      {ouvert && (
        <span style={{ position: "absolute", top: "115%", left: 0, zIndex: 30, background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          <input
            type="number"
            autoFocus
            placeholder={`Montant TTC (${tvaPct}%)`}
            value={ttc}
            onChange={(e) => setTtc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") appliquer(); if (e.key === "Escape") setOuvert(false); }}
            style={{ ...style, width: 130 }}
          />
          <button type="button" onClick={appliquer} style={{ border: "none", background: "#1B7A4C", color: "#fff", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>OK</button>
        </span>
      )}
    </span>
  );
}

