"use client";
import { useState } from "react";

// Affichage d'erreur cohérent avec le reste de l'appli (carte arrondie, ombre
// douce, icône ronde colorée) au lieu d'un bandeau plat avec le message brut
// de la base de données. Le détail technique reste accessible (replié par
// défaut) pour le débogage, sans être imposé à l'utilisateur.
//
// messageClair : phrase compréhensible pour l'utilisateur final
// detailTechnique : message brut d'origine (ex. erreur Postgres/Supabase),
// affiché replié sous un bouton "Détail technique"
export default function ErreurCard({ messageClair, detailTechnique, onFermer }) {
  const [detailOuvert, setDetailOuvert] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(16,24,40,0.08), 0 1px 3px rgba(16,24,40,0.04)", padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ width: 42, height: 42, borderRadius: "50%", background: "#FDECEA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
        ⚠️
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "#1B2430", fontWeight: 500, marginBottom: 4 }}>{messageClair}</div>
        {detailTechnique && (
          <>
            <button
              type="button"
              onClick={() => setDetailOuvert((o) => !o)}
              style={{ border: "none", background: "none", color: "#B3261E", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              {detailOuvert ? "Masquer le détail technique" : "Détail technique"}
            </button>
            {detailOuvert && (
              <pre style={{ marginTop: 8, background: "#FAFAF8", borderRadius: 10, padding: 10, fontSize: 11.5, color: "#666", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {detailTechnique}
              </pre>
            )}
          </>
        )}
      </div>
      {onFermer && (
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: "none", background: "none", color: "#999", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
          ×
        </button>
      )}
    </div>
  );
}

