"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";

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
  const [resume, setResume] = useState({ demandesATraiter: 0, bcEnLivraison: 0, facturesImpayees: 0 });
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
      const { data: commandes } = await supabase.from("commandes").select("id, numero, fournisseur_nom, date_signature, statut, statut_paiement, date_facture, echeance_jours, date_estimee_reste").limit(10000);
      const { data: lignesBc } = await supabase.from("lignes_bc").select("id, bc_id, quantite").limit(10000);
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

      // ---- Résumé "à faire" en un coup d'œil ----
      setResume({
        demandesATraiter: (demandes || []).length,
        bcEnLivraison: Object.keys(resteABcId).length,
        facturesImpayees: (commandes || []).filter((c) => c.statut_paiement !== "Payé").length,
      });

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
          <ResumeCard href="/commandes" valeur={resume.bcEnLivraison} label="BC en cours de livraison" couleur="#1B4C7A" />
          <ResumeCard href="/commandes" valeur={resume.facturesImpayees} label="facture(s) impayée(s)" couleur="#B3261E" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
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
