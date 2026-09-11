"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";
import { calculerFrequenceAchats, articlesAReapprovisionner } from "../../lib/frequenceAchats";

function joursDepuis(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function DashboardPage() {
  const [alertesDevis, setAlertesDevis] = useState([]);
  const [alertesLivraison, setAlertesLivraison] = useState([]);
  const [alertesPaiement, setAlertesPaiement] = useState([]);
  const [alertesEstimation, setAlertesEstimation] = useState([]);
  const [alertesImport, setAlertesImport] = useState([]);
  const [alertesReappro, setAlertesReappro] = useState([]);
  const [resume, setResume] = useState({ demandesATraiter: 0, bcEnLivraison: 0, facturesImpayees: 0 });
  const [tendance, setTendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // ---- Demandes en attente de devis ----
      const { data: demandes } = await supabase.from("demandes").select("id, numero, service, statut, created_at").not("statut", "in", '("Basculée en commande","Clôturée")').limit(10000);
      const { data: offres } = await supabase.from("offres").select("id, demande_id").limit(10000);
      const { data: lignesOffre } = await supabase.from("lignes_offre").select("offre_id, prix_unitaire_ht").limit(10000);

      const devis = (demandes || []).filter((d) => {
        const j = joursDepuis(d.created_at);
        if (j === null || j < 1) return false;
        const offresDeCetteDemande = (offres || []).filter((o) => o.demande_id === d.id);
        if (offresDeCetteDemande.length === 0) return true;
        const aUnPrix = offresDeCetteDemande.some((o) => (lignesOffre || []).some((l) => l.offre_id === o.id && l.prix_unitaire_ht != null));
        return !aUnPrix;
      });
      setAlertesDevis(devis);

      // ---- BC en attente de livraison ----
      const { data: commandes } = await supabase.from("commandes").select("id, numero, fournisseur_nom, date, date_signature, statut, statut_paiement, date_facture, echeance_jours, date_estimee_reste").limit(10000);
      const { data: lignesBc } = await supabase.from("lignes_bc").select("id, bc_id, designation, quantite").limit(10000);
      const { data: receptions } = await supabase.from("receptions").select("id, bc_id").limit(10000);
      const { data: lignesReception } = await supabase.from("lignes_reception").select("reception_id, ligne_bc_id, quantite_livree").limit(10000);

      const resteABcId = {};
      (lignesBc || []).forEach((l) => {
        const receptionsDeCeBc = (receptions || []).filter((r) => r.bc_id === l.bc_id).map((r) => r.id);
        const cumul = (lignesReception || [])
          .filter((lr) => receptionsDeCeBc.includes(lr.reception_id) && lr.ligne_bc_id === l.id)
          .reduce((s, lr) => s + (Number(lr.quantite_livree) || 0), 0);
        if (Number(l.quantite) - cumul > 0) resteABcId[l.bc_id] = true;
      });

      const livraison = (commandes || []).filter((c) => {
        if (!resteABcId[c.id]) return false;
        if (!c.date_signature) return false;
        const j = joursDepuis(c.date_signature);
        return j !== null && j >= 2;
      });
      setAlertesLivraison(livraison);

      // ---- Factures impayées en retard ----
      const paiement = (commandes || []).filter((c) => {
        if (c.statut_paiement === "Payé" || !c.date_facture) return false;
        const echeance = new Date(c.date_facture);
        echeance.setDate(echeance.getDate() + (c.echeance_jours || 30));
        return new Date() > echeance;
      });
      setAlertesPaiement(paiement);

      // ---- Date estimée du reste atteinte ----
      const estimation = (commandes || []).filter((c) => resteABcId[c.id] && c.date_estimee_reste && c.date_estimee_reste <= todayISO());
      setAlertesEstimation(estimation);

      // ---- Demandeurs à aviser (articles non disponibles localement) ----
      const { data: aAviser } = await supabase.from("demandes").select("id, numero, service, demandeur, observation").eq("demandeur_avise", false).not("observation", "is", null).limit(10000);
      setAlertesImport(aAviser || []);

      // ---- Réapprovisionnement à prévoir (articles au cycle habituel qui approche) ----
      const commandesParId = {};
      (commandes || []).forEach((c) => { commandesParId[c.id] = c; });
      const { data: articlesCategories } = await supabase.from("articles").select("designation, categorie").limit(10000);
      const categorieParDesignation = {};
      (articlesCategories || []).forEach((a) => { categorieParDesignation[a.designation] = a.categorie; });
      const frequences = calculerFrequenceAchats(lignesBc || [], commandesParId);
      setAlertesReappro(articlesAReapprovisionner(frequences, 3, categorieParDesignation));

      // ---- Résumé "à faire" en un coup d'œil ----
      setResume({
        demandesATraiter: (demandes || []).length,
        bcEnLivraison: Object.keys(resteABcId).length,
        facturesImpayees: (commandes || []).filter((c) => c.statut_paiement !== "Payé").length,
      });

      // ---- Tendance des achats, 6 derniers mois ----
      const MOIS_LABEL = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
      const points = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const cle = d.toISOString().slice(0, 7);
        const montant = (commandes || []).filter((c) => (c.date || "").slice(0, 7) === cle && c.statut !== "Annulée").reduce((s, c) => s + Number(c.montant_ttc || 0), 0);
        points.push({ label: MOIS_LABEL[d.getMonth()], montant });
      }
      setTendance(points);

      setLoading(false);
    })();
  }, []);

  const total = alertesDevis.length + alertesLivraison.length + alertesPaiement.length + alertesEstimation.length + alertesImport.length;

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 4, flexShrink: 0 }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 14, flexShrink: 0 }}>À traiter aujourd'hui</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexShrink: 0, flexWrap: "wrap" }}>
          <ResumeCard href="/demandes" valeur={resume.demandesATraiter} label="demande(s) à traiter" couleur="#F5A623" />
          <ResumeCard href="/commandes?filtre=en_attente_reception" valeur={resume.bcEnLivraison} label="BC en cours de livraison" couleur="#1B4C7A" />
          <ResumeCard href="/commandes" valeur={resume.facturesImpayees} label="facture(s) impayée(s)" couleur="#B3261E" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {tendance.some((p) => p.montant > 0) && <GraphiqueTendance points={tendance} />}

          {total === 0 && (
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#1B7A4C" }}>✓ Rien à signaler pour l'instant — tout est à jour.</p>
            </div>
          )}

          {alertesDevis.length > 0 && (
            <Section titre="Relances devis fournisseurs" couleur="#8A6100" fond="#FFF3D6">
              {alertesDevis.map((d) => (
                <LigneAlerte key={d.id} href={`/demandes/${d.id}`}>
                  <strong>{d.numero}</strong> ({d.service || "-"}) — créée il y a {joursDepuis(d.created_at)} jour(s), toujours sans prix saisi
                </LigneAlerte>
              ))}
            </Section>
          )}

          {alertesLivraison.length > 0 && (
            <Section titre="Relances livraison fournisseurs" couleur="#8A6100" fond="#FFF3D6">
              {alertesLivraison.map((c) => (
                <LigneAlerte key={c.id} href={`/commandes/${c.id}`}>
                  <strong>{c.numero}</strong> — {c.fournisseur_nom} — signé il y a {joursDepuis(c.date_signature)} jour(s), toujours pas reçu
                </LigneAlerte>
              ))}
            </Section>
          )}

          {alertesEstimation.length > 0 && (
            <Section titre="Reste à livrer — date estimée atteinte" couleur="#1B4C7A" fond="#E8F0FA">
              {alertesEstimation.map((c) => (
                <LigneAlerte key={c.id} href={`/commandes/${c.id}`}>
                  <strong>{c.numero}</strong> — {c.fournisseur_nom} — reste attendu pour le {formatDate(c.date_estimee_reste)}
                </LigneAlerte>
              ))}
            </Section>
          )}

          {alertesPaiement.length > 0 && (
            <Section titre="Factures fournisseurs en retard de paiement" couleur="#B3261E" fond="#FDECEA">
              {alertesPaiement.map((c) => (
                <LigneAlerte key={c.id} href={`/commandes/${c.id}`}>
                  <strong>{c.numero}</strong> — {c.fournisseur_nom} — échéance dépassée
                </LigneAlerte>
              ))}
            </Section>
          )}

          {alertesImport.length > 0 && (
            <Section titre="Demandeurs à aviser par mail (article non disponible localement)" couleur="#B3261E" fond="#FDECEA">
              {alertesImport.map((d) => (
                <LigneAlerte key={d.id} href={`/demandes/${d.id}`}>
                  <strong>{d.numero}</strong> ({d.service || d.demandeur || "-"}) — {d.observation}
                </LigneAlerte>
              ))}
            </Section>
          )}

          {alertesReappro.length > 0 && (
            <Section titre="Réapprovisionnement à prévoir (cycle d'achat habituel qui approche)" couleur="#8A6100" fond="#FFF3D6">
              {alertesReappro.map((a) => (
                <LigneAlerte key={a.designation} href="/kpi">
                  <strong>{a.designation}</strong> — commandé habituellement tous les {a.cycleJours} jours, dernière commande il y a {a.joursDepuisDernier} jours
                  {a.joursAvantProchaine <= 0 ? " — délai dépassé" : ` — prochaine échéance dans ${a.joursAvantProchaine} jour(s)`}
                </LigneAlerte>
              ))}
            </Section>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function ResumeCard({ href, valeur, label, couleur }) {
  return (
    <Link href={href} style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: "14px 20px", textDecoration: "none", color: "inherit", minWidth: 160, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: couleur, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{valeur}</div>
        <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
      </div>
    </Link>
  );
}

function Section({ titre, couleur, fond, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10, color: couleur }}>{titre}</h2>
      {children}
    </div>
  );
}

function LigneAlerte({ href, children }) {
  return (
    <Link href={href} style={{ display: "block", fontSize: 13, padding: "8px 10px", borderRadius: 6, background: "#FAFAF8", marginBottom: 6, color: "#1B2430", textDecoration: "none" }}>
      {children}
    </Link>
  );
}

// Courbe en aire lissée (dégradé vert), pour la tendance des achats des 6
// derniers mois — un aperçu visuel plus parlant qu'un simple tableau de chiffres.
function GraphiqueTendance({ points }) {
  const largeur = 600, hauteur = 150, marge = 26;
  const max = Math.max(...points.map((p) => p.montant), 1);
  const pas = points.length > 1 ? (largeur - marge * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: marge + i * pas,
    y: hauteur - marge - (p.montant / max) * (hauteur - marge * 2 - 14),
    ...p,
  }));

  let chemin = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const p0 = coords[i - 1], p1 = coords[i];
    const milieuX = (p0.x + p1.x) / 2;
    chemin += ` C ${milieuX} ${p0.y}, ${milieuX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const cheminAire = `${chemin} L ${coords[coords.length - 1].x} ${hauteur - marge} L ${coords[0].x} ${hauteur - marge} Z`;

  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10, color: "#1E3A34" }}>Tendance des achats (6 derniers mois, TTC)</h2>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} style={{ width: "100%", height: 150 }}>
        <defs>
          <linearGradient id="degradeTendance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#74BC1F" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#74BC1F" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={cheminAire} fill="url(#degradeTendance)" />
        <path d={chemin} fill="none" stroke="#1E3A34" strokeWidth="2.5" />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#1E3A34" />
            <text x={c.x} y={hauteur - 6} fontSize="10" fill="#888" textAnchor="middle">{c.label}</text>
            {c.montant > 0 && <text x={c.x} y={c.y - 10} fontSize="10" fill="#1E3A34" textAnchor="middle">{Math.round(c.montant / 1000).toLocaleString("fr-FR")}k</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
