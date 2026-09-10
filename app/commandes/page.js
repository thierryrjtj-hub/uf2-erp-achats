"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { exportExcel } from "../../lib/exportExcel";
import { useRole } from "../../lib/useRole";
import { inputStyle, thStyle, tdStyle, linkBtn } from "../components/ui";
import { IconTrash, IconBan } from "../components/Icons";
import { formatDate } from "../../lib/format";
import TriMenu, { appliquerTri } from "../components/TriMenu";

export default function CommandesPage() {
  return (
    <Suspense fallback={<AuthGuard><p>Chargement...</p></AuthGuard>}>
      <CommandesInner />
    </Suspense>
  );
}

function CommandesInner() {
  const role = useRole();
  const searchParams = useSearchParams();
  const filtreDepuisTableauDeBord = searchParams.get("filtre") === "en_attente_reception";
  const [liste, setListe] = useState([]);
  const [receptions, setReceptions] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [prestationParBc, setPrestationParBc] = useState({});
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [tri, setTri] = useState({ colonne: "created_at", sens: "desc" });

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").order("created_at", { ascending: false }).limit(10000);
    const { data: r } = await supabase.from("receptions").select("*").limit(10000);
    const { data: d } = await supabase.from("demandes").select("id, service, demandeur, motif_projet").limit(10000);
    const { data: lb } = await supabase.from("lignes_bc").select("bc_id, designation").limit(10000);
    const { data: art } = await supabase.from("articles").select("designation, categorie").limit(10000);
    setListe(c || []);
    setReceptions(r || []);
    setDemandes(d || []);
    // Un BC est considéré "prestation" si toutes ses lignes correspondent à des articles catégorie "Services & Prestations"
    const catParDesignation = {};
    (art || []).forEach((a) => { catParDesignation[a.designation.toLowerCase()] = a.categorie; });
    const map = {};
    (lb || []).forEach((l) => {
      if (!map[l.bc_id]) map[l.bc_id] = [];
      map[l.bc_id].push(catParDesignation[l.designation.toLowerCase()] === "Services & Prestations");
    });
    const prestation = {};
    Object.entries(map).forEach(([bcId, arr]) => { prestation[bcId] = arr.length > 0 && arr.every(Boolean); });
    setPrestationParBc(prestation);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const demandeParId = useMemo(() => {
    const m = {};
    demandes.forEach((d) => { m[d.id] = d; });
    return m;
  }, [demandes]);

  const statutsDistincts = useMemo(() => [...new Set(liste.map((c) => c.statut).filter(Boolean))].sort(), [liste]);
  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = liste.filter((c) => {
      const dmd = demandeParId[c.demande_id];
      const okRecherche = !q || [c.numero, c.fournisseur_nom, dmd?.service, dmd?.demandeur].some((v) => (v || "").toLowerCase().includes(q));
      const okStatut = !filtreStatut || c.statut === filtreStatut;
      if (filtreDepuisTableauDeBord) {
        const receptionsOfC = receptions.filter((r) => r.bc_id === c.id);
        const dejaComplet = receptionsOfC.some((r) => r.statut === "Totale");
        const enAttente = !dejaComplet && c.statut !== "Annulée" && !c.statut?.startsWith("Clôturée");
        if (!enAttente) return false;
      }
      return okRecherche && okStatut;
    });
    return appliquerTri(base, tri);
  }, [liste, recherche, filtreStatut, tri, demandeParId, filtreDepuisTableauDeBord, receptions]);

  const changerStatut = async (id, statut) => {
    setListe((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    await supabase.from("commandes").update({ statut }).eq("id", id);
  };

  const supprimerBc = async (c) => {
    if (!confirm(`Supprimer définitivement le bon de commande ${c.numero} ? Sa réception et son historique seront aussi supprimés.`)) return;
    await supabase.from("commandes").delete().eq("id", c.id);
    if (c.demande_id) {
      const { data: autresBc } = await supabase.from("commandes").select("id").eq("demande_id", c.demande_id);
      if (!autresBc || autresBc.length === 0) {
        await supabase.from("demandes").delete().eq("id", c.demande_id);
      }
    }
    charger();
  };

  const annulerBc = async (c) => {
    if (c.statut === "Annulée") {
      if (!confirm(`Réactiver le BC ${c.numero} (retirer le statut Annulée) ?`)) return;
      await supabase.from("commandes").update({ statut: "Clôturée" }).eq("id", c.id);
      charger();
      return;
    }
    const motif = prompt(`Pourquoi annuler le BC ${c.numero} ? (raison obligatoire)`);
    if (!motif || !motif.trim()) return;
    await supabase.from("commandes").update({ statut: "Annulée", observation: motif.trim() }).eq("id", c.id);
    charger();
  };

  const echeanceInfo = (c) => {
    if (!c.date_facture) return null;
    const d = new Date(c.date_facture);
    d.setDate(d.getDate() + (c.echeance_jours || 30));
    return d;
  };

  const [exporting, setExporting] = useState(false);
  const exporter = async () => {
    setExporting(true);
    const rows = liste.map((c) => {
      const reception = receptions.find((r) => r.bc_id === c.id);
      return {
        numero: c.numero,
        date: c.date,
        fournisseur: c.fournisseur_nom,
        statut: c.statut,
        montantHt: Number(c.montant_ht) || 0,
        montantTva: Number(c.montant_tva) || 0,
        montantTtc: Number(c.montant_ttc) || 0,
        numeroFacture: c.numero_facture || "",
        dateFacture: c.date_facture || "",
        statutPaiement: c.statut_paiement || "Impayé",
        recu: reception ? new Date(reception.date_reception_reelle).toLocaleString("fr-FR") : "",
        confirmePar: reception ? reception.confirme_par : "",
      };
    });
    await exportExcel({
      filename: `bons-de-commande_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: "UNIFOODS — Bons de commande",
      sheets: [{
        name: "Bons de commande",
        sousTitre: "Liste complète des bons de commande",
        columns: [
          { header: "N° BC", key: "numero", width: 18 },
          { header: "Date", key: "date", width: 13 },
          { header: "Fournisseur", key: "fournisseur", width: 22 },
          { header: "Statut", key: "statut", width: 16 },
          { header: "Montant HT", key: "montantHt", width: 15 },
          { header: "TVA", key: "montantTva", width: 13 },
          { header: "Montant TTC", key: "montantTtc", width: 15 },
          { header: "N° facture", key: "numeroFacture", width: 16 },
          { header: "Date facture", key: "dateFacture", width: 13 },
          { header: "Statut paiement", key: "statutPaiement", width: 15 },
          { header: "Reçu le", key: "recu", width: 20 },
          { header: "Confirmé par", key: "confirmePar", width: 24 },
        ],
        rows,
        currencyKeys: ["montantHt", "montantTva", "montantTtc"],
        totalsKeys: ["montantHt", "montantTva", "montantTtc"],
      }],
    });
    setExporting(false);
  };

  const [exportingImpayees, setExportingImpayees] = useState(false);
  const exporterFacturesImpayees = async () => {
    setExportingImpayees(true);
    const impayees = liste.filter((c) => c.statut_paiement !== "Payé" && c.statut !== "Annulée" && c.numero_facture);
    const rows = impayees.map((c) => {
      const echeance = echeanceInfo(c);
      const joursRetard = echeance ? Math.max(0, Math.floor((new Date() - echeance) / (1000 * 60 * 60 * 24))) : 0;
      const dmd = demandeParId[c.demande_id];
      return {
        numero: c.numero,
        fournisseur: c.fournisseur_nom,
        numeroFacture: c.numero_facture || "",
        dateFacture: c.date_facture || "",
        echeance: echeance ? echeance.toLocaleDateString("fr-FR") : "",
        joursRetard,
        montantTtc: Number(c.montant_ttc) || 0,
        service: dmd?.service || "",
        observation: c.observation_facture || c.observation || "",
      };
    }).sort((a, b) => b.joursRetard - a.joursRetard);

    await exportExcel({
      filename: `factures-impayees_${new Date().toISOString().slice(0, 10)}.xlsx`,
      titre: "UNIFOODS — Factures fournisseurs impayées",
      sheets: [{
        name: "Factures impayées",
        sousTitre: "À l'attention du service Finance",
        columns: [
          { header: "N° BC", key: "numero", width: 18 },
          { header: "Fournisseur", key: "fournisseur", width: 24 },
          { header: "N° facture", key: "numeroFacture", width: 18 },
          { header: "Date facture", key: "dateFacture", width: 14 },
          { header: "Échéance", key: "echeance", width: 14 },
          { header: "Jours de retard", key: "joursRetard", width: 15 },
          { header: "Montant TTC", key: "montantTtc", width: 16 },
          { header: "Service demandeur", key: "service", width: 20 },
          { header: "Observation", key: "observation", width: 28 },
        ],
        rows,
        currencyKeys: ["montantTtc"],
        totalsKeys: ["montantTtc"],
      }],
    });
    setExportingImpayees(false);
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
          <h1 style={{ fontSize: 18 }}>Bons de commande</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/commandes/nouveau" style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
              + Créer un BC directement
            </Link>
            <Link href="/commandes/pv-vierge" style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
              PV vierge
            </Link>
            <button onClick={exporter} disabled={exporting} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" }}>
              {exporting ? "Génération..." : "Exporter en Excel"}
            </button>
            <button onClick={exporterFacturesImpayees} disabled={exportingImpayees} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #B3261E", background: "#fff", color: "#B3261E", fontSize: 13, cursor: "pointer" }} title="Rapport à envoyer au service Finance">
              {exportingImpayees ? "Génération..." : "Rapport factures impayées"}
            </button>
          </div>
        </div>

        {filtreDepuisTableauDeBord && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E8F0FA", color: "#1B4C7A", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, flexShrink: 0 }}>
            <span>Filtré depuis le Tableau de bord : seuls les {filtrees.length} BC en attente de réception sont affichés.</span>
            <Link href="/commandes" style={{ color: "#1B4C7A", textDecoration: "underline" }}>Voir tous les BC</Link>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <h2 style={{ fontSize: 15 }}>Liste ({filtrees.length} / {liste.length})</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", width: 260 }}>
                <input placeholder="Rechercher (N° BC, fournisseur...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
                {recherche && <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer">×</button>}
              </div>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
                <option value="">Tous les statuts</option>
                {statutsDistincts.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <TriMenu
                colonnes={[
                  { key: "created_at", label: "Date" },
                  { key: "numero", label: "N° BC" },
                  { key: "fournisseur_nom", label: "Fournisseur" },
                  { key: "montant_ttc", label: "Montant TTC" },
                  { key: "statut", label: "Statut" },
                ]}
                tri={tri}
                onChange={setTri}
              />
            </div>
          </div>
          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
          {!loading && filtrees.length === 0 && (
            <p style={{ color: "#888", fontSize: 13 }}>Aucun bon de commande pour ces filtres.</p>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Date BC</th>
              <th style={{ ...thStyle, minWidth: 190 }}>N° BC</th>
              <th style={thStyle}>Fournisseur</th>
              <th style={thStyle}>Total TTC</th>
              <th style={thStyle}>Service / Demandeur</th>
              <th style={thStyle}>Statut</th>
              <th style={thStyle}>Réception</th>
              <th style={thStyle}>Paiement</th>
              <th style={thStyle}>Observation</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((c) => {
              const reception = receptions.find((r) => r.bc_id === c.id);
              const echeance = echeanceInfo(c);
              const enRetard = echeance && c.statut_paiement !== "Payé" && new Date() > echeance;
              const dmd = demandeParId[c.demande_id];
              const estPrestation = !!prestationParBc[c.id];
              const couleurLigne = c.statut?.startsWith("Clôturée (rupture)") ? "#B3261E"
                : reception?.statut === "Totale" ? "#1B7A4C"
                : enRetard ? "#B3261E"
                : "#242322";
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0", color: couleurLigne }}>
                  <td style={tdStyle}>{formatDate(c.date)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <Link href={`/commandes/${c.id}`} style={{ color: "#1E3A34", textDecoration: "underline" }}>{c.numero}</Link>
                    {dmd?.motif_projet && <div style={{ fontSize: 12, color: "#888", fontWeight: 400, whiteSpace: "normal" }}>{dmd.motif_projet}</div>}
                  </td>
                  <td style={tdStyle}>{c.fournisseur_nom}</td>
                  <td style={tdStyle}>{Number(c.montant_ttc).toLocaleString("fr-FR")} Ar</td>
                  <td style={tdStyle}>
                    {dmd ? <>{dmd.service || "-"}<div style={{ fontSize: 12, color: "#888" }}>{dmd.demandeur || ""}</div></> : "-"}
                  </td>
                  <td style={tdStyle}>
                    <select value={c.statut} onChange={(e) => changerStatut(c.id, e.target.value)} style={inputStyle}>
                      <option>A faire</option>
                      <option>Envoyée</option>
                      <option>Livraison en cours</option>
                      <option>Clôturée</option>
                      <option>Clôturée (rupture)</option>
                      <option>Annulée</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {reception ? (
                      <span style={{ fontSize: 12, color: reception.statut === "Totale" ? "#1B7A4C" : "#8A6100" }}>
                        {estPrestation
                          ? (reception.statut === "Totale" ? "Prestation effectuée" : "Prestation partielle")
                          : (reception.statut === "Totale" ? "Livré" : "Livré partiellement")}<br />
                        <span style={{ color: "#999" }}>par {reception.receptionnaire || reception.confirme_par}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#999" }}>{estPrestation ? "Prestation non effectuée" : "Non livré"}</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 12, padding: "3px 8px", borderRadius: 6,
                      background: c.statut_paiement === "Payé" ? "#EAF7EE" : enRetard ? "#FDECEA" : "#FFF3D6",
                      color: c.statut_paiement === "Payé" ? "#1B7A4C" : enRetard ? "#B3261E" : "#8A6100",
                    }}>
                      {c.statut_paiement === "Payé" ? "Payé" : enRetard ? "Échéance dépassée" : "Impayé"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "#666" }}>{c.observation || "-"}</td>
                  <td style={tdStyle}>
                    <button onClick={() => annulerBc(c)} style={{ ...linkBtn, background: "none", border: "none", color: c.statut === "Annulée" ? "#1B7A4C" : "#8A6100", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, marginRight: 8 }} title={c.statut === "Annulée" ? "Réactiver" : "Annuler"}><IconBan /></button>
                    <button onClick={() => supprimerBc(c)} style={{ ...linkBtn, background: "none", border: "none", color: "#B3261E", cursor: "pointer", display: role === "acheteur" ? "inline-flex" : "none", alignItems: "center", gap: 5 }} title="Supprimer"><IconTrash /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        </div>
      </div>
    </AuthGuard>
  );
}

const smallBtn = { padding: "5px 10px", borderRadius: 6, border: "1px solid #1B2430", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer" };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
