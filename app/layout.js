export const metadata = {
  title: "UF2 - ERP Achats",
  description: "Gestion des achats UNIFOODS UF2",
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
            background: #F4F5F7;
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
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
