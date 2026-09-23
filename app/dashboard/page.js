"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";
import { calculerFrequenceAchats, articlesAReapprovisionner } from "../../lib/frequenceAchats";
import { useRole } from "../../lib/useRole";

async function enregistrerSignalementReappro(supabase, designation, joursAvantProchaine) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("reappro_signalements").upsert({
    designation,
    jours_avant_prochaine: joursAvantProchaine,
    signale_le: new Date().toISOString(),
    signale_par: user?.id || null,
  });
}

async function enregistrerRelanceLivraison(supabase, bcId, etapeActuelle, joursActuels) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("relance_livraison").upsert({
    bc_id: bcId,
    etape: etapeActuelle + 1,
    jours_au_signalement: joursActuels,
    date_signalement: new Date().toISOString(),
    signale_par: user?.id || null,
  });
}

const ORDINAUX = ["1ère", "2ème", "3ème", "4ème", "5ème"];

function joursDepuis(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
  const jours = Math.floor(diff);
  // Garde-fou : une date manifestement invalide (mal enregistrée) ne doit
  // jamais afficher un nombre de jours absurde dans une alerte.
  if (!Number.isFinite(jours) || jours < 0 || jours > 3650) return null;
  return jours;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function DashboardPage() {
  const role = useRole();
  const [alertesDevis, setAlertesDevis] = useState([]);
  const [alertesLivraison, setAlertesLivraison] = useState([]);
  const [alertesPaiement, setAlertesPaiement] = useState([]);
  const [alertesEstimation, setAlertesEstimation] = useState([]);
  const [alertesImport, setAlertesImport] = useState([]);
  const [alertesReappro, setAlertesReappro] = useState([]);
  const [alertesStandByReappro, setAlertesStandByReappro] = useState([]);
  const [resume, setResume] = useState({ demandesATraiter: 0, bcEnLivraison: 0, facturesImpayees: 0, bcEnAttenteSignature: 0 });
  const [tendance, setTendance] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);

  const chargerAgendaTaches = async () => {
    const { data: a } = await supabase.from("agenda_rdv").select("*").eq("fait", false).order("date_rdv").limit(200);
    setAgenda(a || []);
    const { data: t } = await supabase.from("taches_rapides").select("*").eq("fait", false).order("created_at", { ascending: false }).limit(200);
    setTaches(t || []);
  };

  useEffect(() => {
    (async () => {
      // ---- Demandes en attente de devis ----
      const { data: demandes } = await supabase.from("demandes").select("id, numero, service, statut, created_at").not("statut", "in", '("Basculée en commande","Clôturée","Annulée")').limit(10000);
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
      const { data: commandes } = await supabase.from("commandes").select("id, numero, fournisseur_nom, fournisseur_id, date, date_signature, date_envoi_signature, date_envoi_fournisseur, statut, statut_paiement, date_facture, date_estimee_reste, mode_envoi_fournisseur").limit(10000);
      const { data: fournisseursData } = await supabase.from("fournisseurs").select("id, conditions_paiement_jours").limit(10000);
      const delaiParFournisseur = {};
      (fournisseursData || []).forEach((f) => { delaiParFournisseur[f.id] = f.conditions_paiement_jours || 30; });
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

      // Un BC n'est "en attente de livraison" qu'une fois réellement envoyé au
      // fournisseur (date_envoi_fournisseur renseignée) — pas avant, même s'il
      // reste des quantités à livrer sur le papier.
      const enAttenteLivraisonBcId = {};
      (commandes || []).forEach((c) => {
        if (resteABcId[c.id] && c.date_envoi_fournisseur && c.statut !== "Annulée" && !c.statut?.startsWith("Clôturée")) {
          enAttenteLivraisonBcId[c.id] = true;
        }
      });

      const livraisonBrut = (commandes || []).filter((c) => {
        if (!enAttenteLivraisonBcId[c.id]) return false;
        const j = joursDepuis(c.date_envoi_fournisseur);
        return j !== null && j >= 1;
      });
      const { data: relancesData } = await supabase.from("relance_livraison").select("bc_id, etape, jours_au_signalement").limit(10000);
      const relanceParBc = {};
      (relancesData || []).forEach((r) => { relanceParBc[r.bc_id] = r; });
      const livraison = livraisonBrut
        .filter((c) => {
          const r = relanceParBc[c.id];
          if (!r) return true;
          return joursDepuis(c.date_envoi_fournisseur) > r.jours_au_signalement;
        })
        .map((c) => ({ ...c, relance: relanceParBc[c.id] || null }));
      setAlertesLivraison(livraison);

      // ---- Factures fournisseurs en retard de paiement ----
      // Un BC n'est considéré "impayé" à afficher ici que s'il a déjà été
      // réceptionné (livré) ET que la facture a été renseignée — pas avant.
      const bcRecuId = {};
      (receptions || []).forEach((r) => { bcRecuId[r.bc_id] = true; });
      const paiement = (commandes || []).filter((c) => {
        if (!bcRecuId[c.id] || c.statut_paiement === "Payé" || !c.date_facture) return false;
        const echeance = new Date(c.date_facture);
        echeance.setDate(echeance.getDate() + (delaiParFournisseur[c.fournisseur_id] || 30));
        return new Date() > echeance;
      });
      setAlertesPaiement(paiement);

      // ---- Date estimée du reste atteinte ----
      const estimation = (commandes || []).filter((c) => enAttenteLivraisonBcId[c.id] && c.date_estimee_reste && c.date_estimee_reste <= todayISO());
      setAlertesEstimation(estimation);

      // ---- Demandeurs à aviser (articles réellement non disponibles localement) ----
      const { data: lignesNonDispo } = await supabase.from("lignes_demande").select("demande_id").eq("non_disponible_localement", true).limit(10000);
      const demandeIdsNonDispo = [...new Set((lignesNonDispo || []).map((l) => l.demande_id))];
      let aAviser = [];
      if (demandeIdsNonDispo.length > 0) {
        const { data } = await supabase.from("demandes").select("id, numero, service, demandeur, observation").eq("demandeur_avise", false).in("id", demandeIdsNonDispo).limit(10000);
        aAviser = data || [];
      }
      setAlertesImport(aAviser);

      // ---- Réapprovisionnement à prévoir (articles au cycle habituel qui approche) ----
      const commandesParId = {};
      (commandes || []).forEach((c) => { commandesParId[c.id] = c; });
      const { data: articlesCategories } = await supabase.from("articles").select("id, designation, endormi, continue_par_id, categorie:categories(nom)").limit(10000);
      const categorieParDesignation = {};
      const endormiParDesignation = {};
      const idVersDesignation = {};
      (articlesCategories || []).forEach((a) => {
        categorieParDesignation[a.designation] = a.categorie?.nom;
        if (a.endormi) endormiParDesignation[a.designation] = true;
        idVersDesignation[a.id] = a.designation;
      });
      const chaineParDesignation = {};
      (articlesCategories || []).forEach((a) => {
        if (a.continue_par_id && idVersDesignation[a.continue_par_id]) {
          chaineParDesignation[a.designation.toLowerCase()] = idVersDesignation[a.continue_par_id];
        }
      });
      const { data: signalementsData } = await supabase.from("reappro_signalements").select("designation, jours_avant_prochaine").limit(10000);
      const signalements = {};
      (signalementsData || []).forEach((s) => { signalements[s.designation] = s.jours_avant_prochaine; });
      const frequences = calculerFrequenceAchats(lignesBc || [], commandesParId, chaineParDesignation);
      const alertesReapproCalculees = articlesAReapprovisionner(frequences, 3, categorieParDesignation, signalements, endormiParDesignation);
      setAlertesReappro(alertesReapproCalculees);

      // ---- Demandes en stand-by dont le cycle de réapprovisionnement habituel revient ----
      // (la décision de relancer ou non t'appartient — on ne fait que signaler)
      const { data: demandesStandBy } = await supabase.from("demandes").select("id, numero, demandeur, motif_projet, historique_stand_by").eq("statut", "En stand-by").limit(10000);
      let alertesStandByReappro = [];
      if (demandesStandBy && demandesStandBy.length) {
        const { data: lignesStandBy } = await supabase.from("lignes_demande").select("demande_id, designation").in("demande_id", demandesStandBy.map((d) => d.id));
        const designationsDues = new Set(alertesReapproCalculees.map((a) => a.designation.toLowerCase()));
        alertesStandByReappro = demandesStandBy
          .map((d) => {
            const articlesConcernes = (lignesStandBy || [])
              .filter((l) => l.demande_id === d.id && designationsDues.has(l.designation.toLowerCase()))
              .map((l) => l.designation);
            return { ...d, articlesConcernes };
          })
          .filter((d) => d.articlesConcernes.length > 0);
      }
      setAlertesStandByReappro(alertesStandByReappro);

      // ---- Résumé "à faire" en un coup d'œil ----
      const bcEnAttenteSignature = (commandes || []).filter((c) => c.date_envoi_signature && !c.date_signature && c.statut !== "Annulée").length;
      setResume({
        demandesATraiter: (demandes || []).length,
        bcEnLivraison: Object.keys(enAttenteLivraisonBcId).length,
        facturesImpayees: (commandes || []).filter((c) => bcRecuId[c.id] && c.statut_paiement !== "Payé").length,
        bcEnAttenteSignature,
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

      await chargerAgendaTaches();
      setLoading(false);
    })();
  }, []);

  const total = alertesDevis.length + alertesLivraison.length + alertesPaiement.length + alertesEstimation.length + alertesImport.length;

  const ajouterRdv = async (date_rdv, heure, titre) => {
    if (!date_rdv || !titre.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("agenda_rdv").insert({ date_rdv, heure: heure || null, titre: titre.trim(), created_by: user?.id || null });
    chargerAgendaTaches();
  };
  const marquerRdvFait = async (id) => {
    await supabase.from("agenda_rdv").update({ fait: true }).eq("id", id);
    setAgenda((prev) => prev.filter((r) => r.id !== id));
  };
  const ajouterTache = async (texte) => {
    if (!texte.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("taches_rapides").insert({ texte: texte.trim(), created_by: user?.id || null });
    chargerAgendaTaches();
  };
  const marquerTacheFaite = async (id) => {
    await supabase.from("taches_rapides").update({ fait: true, date_fait: new Date().toISOString() }).eq("id", id);
    setTaches((prev) => prev.filter((t) => t.id !== id));
  };


  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 4, flexShrink: 0 }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 14, flexShrink: 0 }}>À traiter aujourd'hui</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexShrink: 0, flexWrap: "wrap" }}>
          <ResumeCard href="/demandes?filtre=a_traiter" valeur={resume.demandesATraiter} label="demande(s) à traiter" couleur="#F5A623" />
          <ResumeCard href="/commandes?filtre=en_attente_livraison" valeur={resume.bcEnLivraison} label="BC en attente de livraison" couleur="#1B4C7A" />
          <ResumeCard href="/commandes?filtre=en_attente_signature" valeur={resume.bcEnAttenteSignature} label="BC en attente de signature direction" couleur="#8A6100" />
          <ResumeCard href="/commandes?filtre=impayees" valeur={resume.facturesImpayees} label="facture(s) impayée(s)" couleur="#B3261E" />
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
            <Section titre="Suivi livraison / enlèvement fournisseurs" couleur="#8A6100" fond="#FFF3D6">
              {alertesLivraison.map((c) => {
                const estEnlevement = c.mode_envoi_fournisseur === "Enlèvement par nos soins" || c.mode_envoi_fournisseur === "Prestation / Travaux";
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 10px", borderRadius: 6, background: "#FAFAF8", marginBottom: 6 }}>
                    <Link href={`/commandes/${c.id}`} style={{ flex: 1, color: "#1B2430", textDecoration: "none" }}>
                      <strong>{c.numero}</strong> — {c.fournisseur_nom} — {estEnlevement
                        ? `enlèvement par nos soins prévu — avez-vous déjà planifié la récupération avec le coursier ? (envoyé il y a ${joursDepuis(c.date_envoi_fournisseur)} jour(s))`
                        : `envoyé au fournisseur il y a ${joursDepuis(c.date_envoi_fournisseur)} jour(s), toujours pas reçu`}
                      {c.relance && <span style={{ marginLeft: 8, fontSize: 11.5, color: "#8A6100" }}>({ORDINAUX[c.relance.etape - 1] || `${c.relance.etape}ème`} {estEnlevement ? "vérification faite" : "relance envoyée"})</span>}
                    </Link>
                    {role === "acheteur" && (
                      <button
                        onClick={async () => {
                          const etapeActuelle = c.relance?.etape || 0;
                          const jours = joursDepuis(c.date_envoi_fournisseur);
                          await enregistrerRelanceLivraison(supabase, c.id, etapeActuelle, jours);
                          setAlertesLivraison((prev) => prev.filter((x) => x.id !== c.id));
                        }}
                        title={estEnlevement ? "Récupération déjà planifiée — masquer jusqu'à ce que le retard s'aggrave" : "J'ai relancé le fournisseur — masquer jusqu'à ce que le retard s'aggrave"}
                        style={{ border: "none", background: "#1E3A34", color: "#fff", borderRadius: 999, padding: "6px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {estEnlevement ? "Déjà planifié" : "Relancer"}
                      </button>
                    )}
                  </div>
                );
              })}
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
                <div key={a.designation} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 10px", borderRadius: 6, background: "#FAFAF8", marginBottom: 6 }}>
                  <Link href="/kpi" style={{ flex: 1, color: "#1B2430", textDecoration: "none" }}>
                    <strong>{a.designation}</strong> — commandé habituellement tous les {a.cycleJours} jours, dernière commande il y a {a.joursDepuisDernier} jours
                    {a.joursAvantProchaine <= 0 ? " — délai dépassé" : ` — prochaine échéance dans ${a.joursAvantProchaine} jour(s)`}
                  </Link>
                  {role === "acheteur" && (
                    <button
                      onClick={async () => {
                        await enregistrerSignalementReappro(supabase, a.designation, a.joursAvantProchaine);
                        setAlertesReappro((prev) => prev.filter((x) => x.designation !== a.designation));
                      }}
                      title="J'ai avisé les personnes concernées — masquer jusqu'à ce que le retard s'aggrave"
                      style={{ border: "none", background: "#1E3A34", color: "#fff", borderRadius: 999, padding: "6px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Traité
                    </button>
                  )}
                </div>
              ))}
            </Section>
          )}

          {alertesStandByReappro.length > 0 && (
            <Section titre="Demandes en stand-by dont le cycle habituel revient — décision à prendre" couleur="#C85A2A" fond="#FFEEE6">
              {alertesStandByReappro.map((d) => (
                <Link key={d.id} href={`/demandes/${d.id}`} style={{ display: "block", fontSize: 13, padding: "9px 12px", borderRadius: 10, background: "#F7F6F2", marginBottom: 6, color: "#1B2430", textDecoration: "none" }}>
                  <strong>{d.numero}</strong> ({d.demandeur || "-"}) — {d.motif_projet} — en stand-by, mais {d.articlesConcernes.join(", ")} {d.articlesConcernes.length > 1 ? "arrivent" : "arrive"} à échéance de réapprovisionnement habituelle : à toi de décider si tu relances ou pas
                </Link>
              ))}
            </Section>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <BlocAgenda agenda={agenda} onAjouter={ajouterRdv} onFait={marquerRdvFait} />
            <BlocTaches taches={taches} onAjouter={ajouterTache} onFait={marquerTacheFaite} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function ResumeCard({ href, valeur, label, couleur }) {
  return (
    <Link href={href} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(16,24,40,0.08), 0 1px 3px rgba(16,24,40,0.04)", padding: "16px 20px", textDecoration: "none", color: "inherit", minWidth: 170, display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 42, height: 42, borderRadius: "50%", background: `${couleur}1F`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: couleur }} />
      </span>
      <div>
        <div style={{ fontSize: 23, fontWeight: 700 }}>{valeur}</div>
        <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
      </div>
    </Link>
  );
}

function Section({ titre, couleur, fond, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(16,24,40,0.08), 0 1px 3px rgba(16,24,40,0.04)", padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10, color: couleur }}>{titre}</h2>
      {children}
    </div>
  );
}

function LigneAlerte({ href, children }) {
  return (
    <Link href={href} style={{ display: "block", fontSize: 13, padding: "9px 12px", borderRadius: 10, background: "#F7F6F2", marginBottom: 6, color: "#1B2430", textDecoration: "none" }}>
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
            {c.montant > 0 && <text x={c.x} y={c.y - 10} fontSize="10" fill="#1E3A34" textAnchor="middle">{Math.round(c.montant / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// Bloc agenda / rendez-vous rapide — un simple pense-bête, pas un vrai calendrier.
function BlocAgenda({ agenda, onAjouter, onFait }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [heure, setHeure] = useState("");
  const [titre, setTitre] = useState("");

  const soumettre = () => {
    onAjouter(date, heure, titre);
    setDate(new Date().toISOString().slice(0, 10)); setHeure(""); setTitre("");
  };

  return (
    <div style={{ flex: 1, minWidth: 280, background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10, color: "#1E3A34" }}>Agenda / rendez-vous rapide</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...miniInput, width: 130 }} />
        <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} style={{ ...miniInput, width: 90 }} />
        <input placeholder="Rendez-vous..." value={titre} onChange={(e) => setTitre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && soumettre()} style={{ ...miniInput, flex: 1, minWidth: 120 }} />
        <button onClick={soumettre} style={miniBtn}>+</button>
      </div>
      {agenda.length === 0 && <p style={{ fontSize: 12.5, color: "#999" }}>Aucun rendez-vous à venir.</p>}
      {agenda.map((r) => (
        <div key={r.id} style={ligneMini}>
          <input type="checkbox" onChange={() => onFait(r.id)} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <strong>{formatDate(r.date_rdv)}</strong>{r.heure ? ` à ${r.heure}` : ""} — {r.titre}
          </span>
        </div>
      ))}
    </div>
  );
}

// Bloc notes / tâches rapides — case "fait" = disparaît de la liste.
function BlocTaches({ taches, onAjouter, onFait }) {
  const [texte, setTexte] = useState("");

  const soumettre = () => {
    onAjouter(texte);
    setTexte("");
  };

  return (
    <div style={{ flex: 1, minWidth: 280, background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
      <h2 style={{ fontSize: 14, marginBottom: 10, color: "#1E3A34" }}>Notes / tâches rapides</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input placeholder="Nouvelle tâche..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => e.key === "Enter" && soumettre()} style={{ ...miniInput, flex: 1 }} />
        <button onClick={soumettre} style={miniBtn}>+</button>
      </div>
      {taches.length === 0 && <p style={{ fontSize: 12.5, color: "#999" }}>Aucune tâche en attente.</p>}
      {taches.map((t) => (
        <div key={t.id} style={ligneMini}>
          <input type="checkbox" onChange={() => onFait(t.id)} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{t.texte}</span>
        </div>
      ))}
    </div>
  );
}

const miniInput = { padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12.5 };
const miniBtn = { border: "none", background: "#1B7A4C", color: "#fff", borderRadius: 6, width: 30, fontSize: 16, cursor: "pointer", flexShrink: 0 };
const ligneMini = { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 8px", borderRadius: 6, background: "#FAFAF8", marginBottom: 5 };
