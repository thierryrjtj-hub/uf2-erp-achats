export const metadata = {
  title: "UF2 - ERP Achats",
  description: "Gestion des achats UNIFOODS UF2",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#F5F4F1", color: "#1B2430" }}>
        {children}
      </body>
    </html>
  );
}
