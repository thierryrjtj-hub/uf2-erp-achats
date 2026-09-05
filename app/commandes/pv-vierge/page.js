"use client";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import { linkBtn, buttonStyle } from "../../components/ui";

const LIGNES_VIDES = Array.from({ length: 8 });

export default function PVViergePage() {
  const router = useRouter();

  return (
    <AuthGuard>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux commandes</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }} className="no-print">
        <h1 style={{ fontSize: 20 }}>PV de réception vierge</h1>
        <button onClick={() => window.print()} style={buttonStyle}>Imprimer</button>
      </div>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }} className="no-print">
        Pour les livraisons qui ne passent pas par une demande créée dans l'appli — à remplir entièrement à la main.
      </p>

      <div style={{ background: "#fff", padding: 20 }} className="print-area">
        <h1 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="UNIFOODS" style={{ height: 28 }} /> — PV de Réception
        </h1>
        <p style={{ fontSize: 13 }}>N° : ______________________ — Date : ______________________</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <tbody>
            <tr><td style={pvLabel}>Fournisseur</td><td style={pvVal}></td><td style={pvLabel}>Adresse</td><td style={pvVal}></td></tr>
            <tr><td style={pvLabel}>NIF</td><td style={pvVal}></td><td style={pvLabel}>STAT</td><td style={pvVal}></td></tr>
            <tr><td style={pvLabel}>Contact</td><td style={pvVal}></td><td style={pvLabel}>Tél</td><td style={pvVal}></td></tr>
            <tr><td style={pvLabel}>N° BC UF2 (si connu)</td><td style={pvVal}></td><td style={pvLabel}>Demande liée</td><td style={pvVal}></td></tr>
            <tr><td style={pvLabel}>Type de livraison</td><td style={pvVal}></td><td style={pvLabel}>N° BL</td><td style={pvVal}></td></tr>
            <tr><td style={pvLabel}>Date de livraison</td><td style={pvVal}></td><td style={pvLabel}>Nom Réceptionnaire du Magasin</td><td style={pvVal}></td></tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr>
              <th style={pvTh}>BC UF2 n°</th><th style={pvTh}>Description</th><th style={pvTh}>Quantité</th>
              <th style={pvTh}>Unité</th><th style={pvTh}>Quantité livré</th><th style={pvTh}>Unité</th>
              <th style={pvTh}>Reste à Livrer</th><th style={pvTh}>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES_VIDES.map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => <td key={j} style={{ ...pvTd, height: 26 }}></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 50, fontSize: 12 }}>Signatures, Date, Nom :</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
          {["RESPONSABLE MAGASIN", "MAGASINIER", "AGENT DE SECURITE", "LIVREUR ou TRANSPORTEUR"].map((s) => (
            <div key={s} style={{ width: "22%", borderTop: "1px solid #333", paddingTop: 6, textAlign: "center", fontSize: 11 }}>{s}</div>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}

const pvLabel = { padding: "4px 6px", color: "#666", fontWeight: 600, border: "1px solid #eee", width: "15%" };
const pvVal = { padding: "4px 6px", border: "1px solid #eee", width: "35%" };
const pvTh = { border: "1px solid #ccc", padding: "6px 4px", background: "#F0F7F2" };
const pvTd = { border: "1px solid #ddd", padding: "6px 4px" };
