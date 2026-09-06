// Styles partagés par toutes les pages, pour une apparence cohérente dans toute l'appli.
// Garder les mêmes noms qu'avant (inputStyle, buttonStyle, thStyle, tdStyle, cardStyle...)
// pour que chaque page n'ait qu'à importer ce fichier au lieu de redéfinir ses propres styles.

// Palette UNIFOODS — chaleureuse et motivante (vert profond + touche corail)
export const BRAND = "#1E3A34";      // vert profond (sidebar, boutons principaux)
export const ACCENT = "#FF7A45";     // corail chaud (accents, éléments actifs, priorité haute)
export const TEXT = "#242322";       // gris-brun chaud pour le texte (au lieu du bleu-nuit froid)

export const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 3px rgba(16,24,40,0.05)",
  border: "1px solid #ECEBE6",
};

export const inputStyle = {
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid #DDDBD3",
  fontSize: 13,
  background: "#fff",
  color: TEXT,
};

export const buttonStyle = {
  padding: "8px 16px",
  borderRadius: 7,
  border: "none",
  background: BRAND,
  color: "#fff",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

export const buttonSecondaryStyle = {
  padding: "8px 16px",
  borderRadius: 7,
  border: "1px solid #DDDBD3",
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

export const buttonDangerStyle = {
  padding: "8px 16px",
  borderRadius: 7,
  border: "none",
  background: "#B3261E",
  color: "#fff",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

export const linkBtn = {
  border: "none",
  background: "none",
  color: BRAND,
  fontSize: 12.5,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};

export const thStyle = {
  textAlign: "left",
  padding: "9px 10px",
  color: "#8A8F98",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  borderBottom: "1px solid #ECEBE6",
  background: "#FAFAF8",
  whiteSpace: "normal",
  lineHeight: 1.3,
  position: "sticky",
  top: 0,
  zIndex: 1,
  verticalAlign: "bottom",
};

export const tdStyle = {
  padding: "10px 10px",
  fontSize: 13,
  borderBottom: "1px solid #F2F1ED",
};

export const pageTitleStyle = {
  fontSize: 20,
  fontWeight: 700,
  color: TEXT,
  marginBottom: 4,
};

export const pageSubtitleStyle = {
  fontSize: 13,
  color: "#8A8F98",
  marginBottom: 20,
};

export const sectionTitleStyle = {
  fontSize: 14.5,
  fontWeight: 600,
  color: TEXT,
  marginBottom: 14,
};

export const badge = (bg, color) => ({
  fontSize: 11.5,
  padding: "3px 10px",
  borderRadius: 6,
  background: bg,
  color,
  fontWeight: 500,
  display: "inline-block",
});

export const COLORS = {
  vert: { bg: "#E8F5EC", text: "#1B7A4C" },
  jaune: { bg: "#FFF3D6", text: "#8A6100" },
  rouge: { bg: "#FDECEA", text: "#B3261E" },
  bleu: { bg: "#E8F0FA", text: "#1B4C7A" },
  gris: { bg: "#F0EFEA", text: "#8A8F98" },
  corail: { bg: "#FFEEE6", text: "#C85A2A" },
};
