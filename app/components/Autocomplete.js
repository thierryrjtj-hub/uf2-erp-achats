"use client";
import { useState, useRef, useEffect } from "react";

// Champ texte avec liste de suggestions cliquable, fiable (remplace <input list="..."> natif
// qui pose parfois problème avec React : le clic sur une suggestion ne se validait pas toujours).
//
// Navigation clavier standard (comme dans Windows) : dès que 2-3 suggestions
// apparaissent, la première est surlignée automatiquement ; flèche bas/haut
// pour changer de suggestion ; Entrée pour valider celle surlignée et fermer
// la liste (on peut ensuite continuer la saisie vers le champ suivant avec
// Tab) ; Échap pour fermer sans rien choisir.
export default function Autocomplete({ value, onChange, onSelect, suggestions, placeholder, style, inputAttrs }) {
  const [ouvert, setOuvert] = useState(false);
  const [surligne, setSurligne] = useState(0);
  const blurTimeout = useRef(null);
  const itemRefs = useRef([]);
  const dropdownRef = useRef(null);

  const filtrees = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  // Dès que la liste s'ouvre ou que son contenu change (nouvelle frappe), la
  // première suggestion redevient celle surlignée par défaut.
  useEffect(() => {
    setSurligne(0);
  }, [value, ouvert]);

  // La liste défile automatiquement pour garder la suggestion surlignée au
  // clavier visible, sans devoir manipuler la barre de défilement à la main.
  // Calcul manuel (plutôt que scrollIntoView, peu fiable ici selon les
  // navigateurs) : on ne fait défiler que si l'élément surligné dépasse la
  // zone actuellement visible du conteneur, dans un sens ou dans l'autre.
  useEffect(() => {
    const conteneur = dropdownRef.current;
    const item = itemRefs.current[surligne];
    if (!conteneur || !item) return;
    const hautItem = item.offsetTop;
    const basItem = hautItem + item.offsetHeight;
    if (hautItem < conteneur.scrollTop) {
      conteneur.scrollTop = hautItem;
    } else if (basItem > conteneur.scrollTop + conteneur.clientHeight) {
      conteneur.scrollTop = basItem - conteneur.clientHeight;
    }
  }, [surligne, filtrees.length]);

  const choisir = (s) => {
    if (onSelect) onSelect(s); else onChange(s);
    setOuvert(false);
  };

  const onKeyDown = (e) => {
    if (!ouvert || filtrees.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurligne((i) => Math.min(i + 1, filtrees.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurligne((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choisir(filtrees[surligne]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  };

  return (
    <div style={{ position: "relative", flex: style?.flex, width: style?.width }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => { blurTimeout.current = setTimeout(() => setOuvert(false), 150); }}
        onKeyDown={onKeyDown}
        style={{ ...inputStyle, ...style, width: "100%", paddingRight: value ? 26 : inputStyle.padding.split(" ")[1] }}
        {...inputAttrs}
      />
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); onChange(""); }}
          aria-label="Effacer"
          title="Effacer"
          style={{
            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            border: "none", background: "none", color: "#999", cursor: "pointer",
            fontSize: 15, lineHeight: 1, padding: 2, display: "flex",
          }}
        >
          ×
        </button>
      )}
      {ouvert && filtrees.length > 0 && (
        <div ref={dropdownRef} style={dropdownStyle}>
          {filtrees.map((s, i) => (
            <div
              key={i}
              ref={(el) => { itemRefs.current[i] = el; }}
              onMouseDown={(e) => { e.preventDefault(); if (blurTimeout.current) clearTimeout(blurTimeout.current); choisir(s); }}
              onMouseEnter={() => setSurligne(i)}
              style={{ ...itemStyle, background: i === surligne ? "#F5F4F1" : "#fff" }}
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
