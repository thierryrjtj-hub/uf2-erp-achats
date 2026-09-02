"use client";
import { useState, useRef } from "react";

// Champ texte avec liste de suggestions cliquable, fiable (remplace <input list="..."> natif
// qui pose parfois problème avec React : le clic sur une suggestion ne se validait pas toujours).
export default function Autocomplete({ value, onChange, onSelect, suggestions, placeholder, style }) {
  const [ouvert, setOuvert] = useState(false);
  const blurTimeout = useRef(null);

  const filtrees = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  const choisir = (s) => {
    if (onSelect) onSelect(s); else onChange(s);
    setOuvert(false);
  };

  return (
    <div style={{ position: "relative", flex: style?.flex, width: style?.width }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => { blurTimeout.current = setTimeout(() => setOuvert(false), 150); }}
        style={{ ...inputStyle, ...style, width: "100%" }}
      />
      {ouvert && filtrees.length > 0 && (
        <div style={dropdownStyle}>
          {filtrees.map((s, i) => (
            <div
              key={i}
              onMouseDown={(e) => { e.preventDefault(); if (blurTimeout.current) clearTimeout(blurTimeout.current); choisir(s); }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F4F1")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" };
const dropdownStyle = {
  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
  background: "#fff", border: "1px solid #ddd", borderRadius: 6, marginTop: 2,
  maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
};
const itemStyle = { padding: "8px 10px", fontSize: 13, cursor: "pointer", background: "#fff" };
