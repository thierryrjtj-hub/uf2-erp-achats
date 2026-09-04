"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import { exportExcel } from "../../../lib/exportExcel";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function premierJourMois() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function premierJourAnnee() { return `${new Date().getFullYear()}-01-01`; }

export default function BoisChauffagePage() {
  const [evenements, setEvenements] = useState([]); // { date, fournisseur, m3, montant }
  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState(premierJourMois());
  const [dateFin, setDateFin] = useState(todayISO());
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lignesBc } = await supabase.from("lignes_bc").select("id, bc_id, designation, prix_unitaire_ht, remise_pct");
      const boisLignes = (lignesBc || []).filter((l) => l.designation.toLowerCase().includes("bois de chauffage") || l.designation.toLowerCase().includes("bois chauffage"));
      if (boisLignes.length === 0) { setEvenements([]); setLoading(false); return; }

      const bcIds = [...new Set(boisLignes.map((l) => l.bc_id))];
      const { data: commandesList } = await supabase.from("commandes").select("id, fournisseur_nom").in("id", bcIds);
      const { data: receptionsList } = await supabase.from("receptions").select("id, bc_id, date_reception_reelle").in("bc_id", bcIds);
      const receptionIds = (receptionsList || []).map((r) => r.id);
      let lignesReceptionList = [];
      if (receptionIds.length) {
        const { data } = await supabase.from("lignes_reception").select("reception_id, ligne_bc_id, quantite_livree").in("reception_id", receptionIds).in("ligne_bc_id", boisLignes.map((l) => l.id));
        lignesReceptionList = data || [];
      }

      const evts = lignesReceptionList.map((lr) => {
        const reception = (receptionsList || []).find((r) => r.id === lr.reception_id);
        const commande = reception ? (commandesList || []).find((c) => c.id === reception.bc_id) : null;
        const ligneBc = boisLignes.find((l) => l.id === lr.ligne_bc_id);
        const qte = Number(lr.quantite_livree) || 0;
        const pu = ligneBc ? Number(ligneBc.prix_unitaire_ht) || 0 : 0;
        const remise = ligneBc ? Number(ligneBc.remise_pct) || 0 : 0;
        return {
          date: reception?.date_reception_reelle ? reception.date_reception_reelle.slice(0, 10) : null,
          fournisseur: commande?.fournisseur_nom || "Inconnu",
          m3: qte,
          montant: qte * pu * (1 - remise / 100),
        };
      }).filter((e) => e.date && e.m3 > 0);

      setEvenements(evts);
      setLoading(false);
    })();
  }, []);

  const fournisseurs = useMemo(() => [...new Set(evenements.map((e) => e.fournisseur))].sort(), [evenements]);

  // ---- Vue journalière (période choisie) ----
  const evenementsPeriode = useMemo(() => evenements.filter((e) => e.date >= dateDebut && e.date <= dateFin), [evenements, dateDebut, dateFin]);
  const joursDistincts = useMemo(() => [...new Set(evenementsPeriode.map((e) => e.date))].sort(), [evenementsPeriode]);

  const tableauJournalier = useMemo(() => {
    return joursDistincts.map((date) => {
      const parFournisseur = {};
      let total = 0;
      fournisseurs.forEach((f) => {
        const somme = evenementsPeriode.filter((e) => e.date === date && e.fournisseur === f).reduce((s, e) => s + e.m3, 0);
        parFournisseur[f] = somme;
        total += somme;
      });
      return { date, parFournisseur, total };
    });
  }, [joursDistincts, evenementsPeriode, fournisseurs]);

  const totauxParFournisseurPeriode = useMemo(() => {
    const map = {};
    fournisseurs.forEach((f) => { map[f] = evenementsPeriode.filter((e) => e.fournisseur === f).reduce((s, e) => s + e.m3, 0); });
    return map;
  }, [fournisseurs, evenementsPeriode]);
  const totalGeneralPeriode = useMemo(() => evenementsPeriode.reduce((s, e) => s + e.m3, 0), [evenementsPeriode]);

  // ---- Récapitulatif annuel (fournisseur x mois) ----
  const evenementsAnnee = useMemo(() => evenements.filter((e) => e.date.startsWith(String(annee))), [evenements, annee]);
  const recapAnnuel = useMemo(() => {
    return fournisseurs.map((f) => {
      const parMois = MOIS.map((_, i) => {
        const moisStr = String(i + 1).padStart(2, "0");
        return evenementsAnnee.filter((e) => e.fournisseur === f && e.date.slice(5, 7) === moisStr).reduce((s, e) => s + e.m3, 0);
      });
      const totalM3 = parMois.reduce((a, b) => a + b, 0);
      const totalMontant = evenementsAnnee.filter((e) => e.fournisseur === f).reduce((s, e) => s + e.montant, 0);
      return { fournisseur: f, parMois, totalM3, totalMontant };
    }).filter((r) => r.totalM3 > 0);
  }, [fournisseurs, evenementsAnnee]);

  const anneesDisponibles = useMemo(() => {
    const ans = [...new Set(evenements.map((e) => e.date.slice(0, 4)))].sort();
    return ans.length ? ans : [String(new Date().getFullYear())];
  }, [evenements]);

  const exporter = async () => {
    setExporting(true);
    const rowsJournalier = tableauJournalier.map((j) => ({
      date: j.date, ...Object.fromEntries(fournisseurs.map((f) => [f, j.parFournisseur[f] || 0])), total: j.total,
    }));
    const rowsAnnuel = recapAnnuel.map((r) => ({
      fournisseur: r.fournisseur, ...Object.fromEntries(MOIS.map((m, i) => [m, r.parMois[i]])), total: r.totalM3, montant: r.totalMontant,
    }));

    await exportExcel({
      filename: `bois-de-chauffage_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets: [
        {
          name: "Journalier",
          columns: [{ header: "Date", key: "date", width: 14 }, ...fournisseurs.map((f) => ({ header: f, key: f, width: 14 })), { header: "Total journalier (m3)", key: "total", width: 16 }],
          rows: rowsJournalier,
        },
        {
          name: "Récap annuel",
          columns: [{ header: "Fournisseur", key: "fournisseur", width: 22 }, ...MOIS.map((m) => ({ header: m, key: m, width: 9 })), { header: "Total (m3)", key: "total", width: 12 }, { header: "Montant total", key: "montant", width: 16 }],
          rows: rowsAnnuel,
          currencyKeys: ["montant"],
        },
      ],
    });
    setExporting(false);
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  return (
    <AuthGuard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Bois de chauffage — livraisons</h1>
        <button onClick={exporter} disabled={exporting} style={buttonStyle}>{exporting ? "Génération..." : "Exporter en Excel"}</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Link href="/historique" style={sousOnglet}>Vue globale</Link>
        <span style={sousOngletActif}>Bois de chauffage</span>
      </div>

      {evenements.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
          <p style={{ color: "#888", fontSize: 13 }}>Aucune livraison de bois de chauffage réceptionnée pour l'instant. Ce rapport se remplit automatiquement dès qu'une réception est enregistrée sur un article "Bois de chauffage".</p>
        </div>
      )}

      {evenements.length > 0 && (
        <>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 15 }}>Détail journalier</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => { setDateDebut(todayISO()); setDateFin(todayISO()); }} style={smallBtn}>Aujourd'hui</button>
                <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setDateDebut(d.toISOString().slice(0, 10)); setDateFin(todayISO()); }} style={smallBtn}>Cette semaine</button>
                <button onClick={() => { setDateDebut(premierJourMois()); setDateFin(todayISO()); }} style={smallBtn}>Ce mois</button>
                <button onClick={() => { setDateDebut(premierJourAnnee()); setDateFin(todayISO()); }} style={smallBtn}>Cette année</button>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={inputStyle} />
                <span style={{ alignSelf: "center", fontSize: 12 }}>au</span>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {joursDistincts.length === 0 ? (
              <p style={{ color: "#888", fontSize: 13 }}>Aucune livraison sur cette période.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      {fournisseurs.map((f) => <th key={f} style={thStyle}>{f}</th>)}
                      <th style={thStyle}>Total journalier (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableauJournalier.map((j) => (
                      <tr key={j.date}>
                        <td style={tdStyle}>{j.date}</td>
                        {fournisseurs.map((f) => <td key={f} style={tdStyle}>{j.parFournisseur[f] ? j.parFournisseur[f].toLocaleString("fr-FR") : "-"}</td>)}
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{j.total.toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #ddd" }}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                      {fournisseurs.map((f) => <td key={f} style={{ ...tdStyle, fontWeight: 700 }}>{(totauxParFournisseurPeriode[f] || 0).toLocaleString("fr-FR")}</td>)}
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{totalGeneralPeriode.toLocaleString("fr-FR")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15 }}>Récapitulatif annuel</h2>
              <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} style={inputStyle}>
                {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {recapAnnuel.length === 0 ? (
              <p style={{ color: "#888", fontSize: 13 }}>Aucune livraison sur {annee}.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Fournisseur</th>
                      {MOIS.map((m) => <th key={m} style={thStyle}>{m}</th>)}
                      <th style={thStyle}>Total (m³)</th>
                      <th style={thStyle}>Montant total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapAnnuel.map((r) => (
                      <tr key={r.fournisseur}>
                        <td style={tdStyle}>{r.fournisseur}</td>
                        {r.parMois.map((v, i) => <td key={i} style={tdStyle}>{v ? v.toLocaleString("fr-FR") : "-"}</td>)}
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.totalM3.toLocaleString("fr-FR")}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.totalMontant.toLocaleString("fr-FR")} Ar</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AuthGuard>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const smallBtn = { padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer" };
const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 6px", whiteSpace: "nowrap" };
const sousOnglet = { fontSize: 13, padding: "6px 14px", borderRadius: 8, color: "#888", textDecoration: "none", background: "transparent" };
const sousOngletActif = { fontSize: 13, padding: "6px 14px", borderRadius: 8, color: "#1B2430", fontWeight: 600, background: "#fff" };

