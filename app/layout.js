export const metadata = {
  title: "Achats Locaux",
  description: "Gestion des achats UNIFOODS UF2",
  manifest: "/manifest.json",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport = {
  themeColor: "#1E3A34",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #F1F6F3;
            color: #1B2430;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar { width: 10px; height: 10px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #d8d8d4; border-radius: 6px; }
          table tbody tr:hover { background: #FAFAF8; }
          button { transition: opacity 0.12s ease, background 0.12s ease; }
          button:hover:not(:disabled) { opacity: 0.85; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #1B2430 !important;
            box-shadow: 0 0 0 2px rgba(27,36,48,0.08);
          }
          a { color: inherit; }

          /* ---- Menu latéral : surbrillance au survol des titres cliquables ---- */
          .nav-sidebar a:hover { background: rgba(255,255,255,0.1) !important; }

          /* ---- Boutons : retour visuel clair au survol et au clic, partout ---- */
          button:not(:disabled) { cursor: pointer; transition: filter 0.12s ease, transform 0.06s ease; }
          button:not(:disabled):hover { filter: brightness(0.94); }
          button:not(:disabled):active { filter: brightness(0.85); transform: translateY(1px); }

          /* ---- Impression : le menu ne doit jamais apparaître, et le contenu doit occuper toute la page ---- */
          .no-print { }
          @media print {
            .no-print { display: none !important; }
            .content-pane { max-width: none !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
            html, body { background: #fff !important; }
          }

          /* ---- Adaptation mobile ---- */
          @media (max-width: 680px) {
            .nav-sidebar { width: 60px !important; }
            .nav-label, .nav-footer { display: none !important; }
            .nav-logo-chip { padding: 6px !important; }
            .nav-logo-chip img { height: 22px !important; }
            .content-pane { padding: 14px 12px !important; }
            table { font-size: 12px !important; }

            /* Sous-onglets : au lieu d'être cachés (donc inaccessibles), ils
               s'affichent en petit panneau flottant à côté de l'icône du
               parent, assez large pour lire les libellés en entier. */
            .nav-parent-item { position: relative; }
            .nav-souslabel {
              display: flex !important;
              position: absolute !important;
              left: 58px;
              top: 0;
              width: 200px;
              z-index: 9999;
              opacity: 1 !important;
              border-radius: 0 8px 8px 0;
              box-shadow: 2px 2px 10px rgba(0,0,0,0.3);
              padding: 4px !important;
            }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
