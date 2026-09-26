"use client";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";
import { linkBtn, inputStyle, thStyle, tdStyle } from "../components/ui";
import { IconCopy, IconBan, IconTrash } from "../components/Icons";
import { useRole } from "../../lib/useRole";
import TriMenu, { appliquerTri } from "../components/TriMenu";

const GROUPE_TERMINAL = new Set(["Basculée en commande", "Clôturée", "Annulée", "En stand-by"]);
const PAGE_SIZE = 100;
const STATUTS_CONNUS = ["A faire", "Partiellement traitée", "Basculée en commande", "En stand-by", "Clôturée", "Annulée"];

export default function DemandesListePage() {
  return (
    <Suspense fallback={<AuthGuard><p>Chargement...</p></AuthGuard>}>
      <DemandesInner />
    </Suspense>
  );
}

function DemandesInner() {
  const role = useRole();
  const searchParams = useSearchParams();
  const filtreATraiter = searchParams.get("filtre") === "a_traiter";
  const [liste, setListe] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [demandesAvecNonDispo, setDemandesAvecNonDispo] = useState(new Set());
  const [articlesParDemande, setArticlesParDemande] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPlus, setLoadingPlus] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [rechercheEffective, setRechercheEffective] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [tri, setTri] = useState({ colonne: "defaut", sens: "desc" });
  const anneeActuelle = new Date().getFullYear();
  const [filtreAnnee, setFiltreAnnee] = useState(String(anneeActuelle));
  const anneesDisponibles = useMemo(() => {
    const annees = [];
    for (let a = anneeActuelle; a >= anneeActuelle - 4; a--) annees.push(String(a));
    return annees;
  }, [anneeActuelle]);

  useEffect(() => {
    const t = setTimeout(() => setRechercheEffective(recherche.trim()), 350);
    return () => clearTimeout(t);
  }, [recherche]);

  // ---- Mode spécial (venu du Tableau de bord) : comportement inchangé,
  // tout chargé et filtré côté client — sous-ensemble déjà restreint. ----
  const chargerModeSpecial = async () => {
    const [{ data }, { data: nonDispo }, { data: toutesLignes }] = await Promise.all([
      supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(10000),
      supabase.from("lignes_demande").select("demande_id").eq("non_disponible_localement", true).limit(10000),
      supabase.from("lignes_demande").select("demande_id, designation, quantite, unite").limit(10000),
    ]);
    setListe(data || []);
    setTotalCount((data || []).length);
    setDemandesAvecNonDispo(new Set((nonDispo || []).map((x) => x.demande_id)));
    const articlesMap = {};
    (toutesLignes || []).forEach((l) => {
      if (!articlesMap[l.demande_id]) articlesMap[l.demande_id] = [];
      articlesMap[l.demande_id].push(`${l.designation} (${l.quantite} ${l.unite})`);
    });
    setArticlesParDemande(articlesMap);
    setLoading(false);
  };

  // ---- Mode normal : chargement par lots de 100 côté serveur, avec
  // chargement automatique de la suite au défilement. ----
  const chargerPage = async (remplacer) => {
    if (remplacer) setLoading(true); else setLoadingPlus(true);
    const decalage = remplacer ? 0 : liste.length;
    let requete = supabase.from("demandes").select("*", { count: "exact" });
    if (rechercheEffective) {
      const qSafe = rechercheEffective.replace(/[,()]/g, " ").trim();
      if (qSafe) requete = requete.or(`numero.ilike.%${qSafe}%,service.ilike.%${qSafe}%,demandeur.ilike.%${qSafe}%,motif_projet.ilike.%${qSafe}%`);
    }
    if (filtreStatut) requete = requete.eq("statut", filtreStatut);
    if (filtreAnnee !== "toutes") requete = requete.like("numero", `${filtreAnnee}%`);
    if (tri.colonne === "defaut") {
      requete = requete.order("numero", { ascending: false });
    } else {
      requete = requete.order(tri.colonne, { ascending: tri.sens === "asc" });
    }
    requete = requete.range(decalage, decalage + PAGE_SIZE - 1);

    const { data, count } = await requete;
    setListe(remplacer ? (data || []) : [...liste, ...(data || [])]);
    setTotalCount(count || 0);

    const demandeIds = (data || []).map((d) => d.id);
    if (demandeIds.length) {
      const { data: lignes } = await supabase.from("lignes_demande").select("demande_id, designation, quantite, unite, non_disponible_localement").in("demande_id", demandeIds);
      const nonDispoSet = new Set((lignes || []).filter((l) => l.non_disponible_localement).map((l) => l.demande_id));
      const articlesMap = {};
      (lignes || []).forEach((l) => {
        if (!articlesMap[l.demande_id]) articlesMap[l.demande_id] = [];
        articlesMap[l.demande_id].push(`${l.designation} (${l.quantite} ${l.unite})`);
      });
      setDemandesAvecNonDispo((prev) => (remplacer ? nonDispoSet : new Set([...prev, ...nonDispoSet])));
      setArticlesParDemande((prev) => (remplacer ? articlesMap : { ...prev, ...articlesMap }));
    } else if (remplacer) {
      setDemandesAvecNonDispo(new Set());
      setArticlesParDemande({});
    }
    setLoading(false);
    setLoadingPlus(false);
  };

  const charger = () => (filtreATraiter ? chargerModeSpecial() : chargerPage(true));

  useEffect(() => { if (filtreATraiter) chargerModeSpecial(); }, [filtreATraiter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!filtreATraiter) chargerPage(true); }, [filtreATraiter, rechercheEffective, filtreStatut, filtreAnnee, tri]); // eslint-disable-line react-hooks/exhaustive-deps

  const resteAcharger = Math.max(0, totalCount - liste.length);
  const sentinelleRef = useRef(null);
  const conteneurScrollRef = useRef(null);

  useEffect(() => {
    if (filtreATraiter || resteAcharger <= 0) return;
    const cible = sentinelleRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees[0].isIntersecting && !loadingPlus && !loading) chargerPage(false);
      },
      { root: conteneurScrollRef.current, rootMargin: "200px" }
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [filtreATraiter, resteAcharger, loadingPlus, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrees = useMemo(() => {
    if (!filtreATraiter) return liste;
    const q = recherche.trim().toLowerCase();
    const base = liste.filter((d) => {
      const okRecherche = !q || [d.numero, d.service, d.demandeur, d.motif_projet].some((v) => (v || "").toLowerCase().includes(q));
      const okStatut = !filtreStatut || d.statut === filtreStatut;
      if (filtreATraiter && GROUPE_TERMINAL.has(d.statut)) return false;
      return okRecherche && okStatut;
    });
    const preTrie = [...base].sort((a, b) => (b.numero || "").localeCompare(a.numero || ""));
    if (tri.colonne === "defaut") {
      return preTrie.sort((a, b) => (GROUPE_TERMINAL.has(a.statut) ? 1 : 0) - (GROUPE_TERMINAL.has(b.statut) ? 1 : 0));
    }
    return appliquerTri(preTrie, tri);
  }, [filtreATraiter, liste, recherche, filtreStatut, tri]);

  const copierPourDevis = async (d) => {
    const { data: lignesDeLaDemande } = await supabase.from("lignes_demande").select("*").eq("demande_id", d.id).order("created_at");
    const lignes = lignesDeLaDemande || [];

    const intros = [
      "Je vous prie de bien vouloir me faire parvenir votre meilleure offre pour les articles mentionnés ci-après.",
      "Pourriez-vous nous transmettre votre meilleure offre de prix pour les articles listés ci-dessous ?",
      "Nous souhaiterions recevoir votre devis pour les articles suivants.",
      "Merci de bien vouloir nous faire parvenir votre proposition tarifaire pour les articles ci-dessous.",
    ];
    const clotures = [
      "Je reste à votre disposition pour tout complément d'information.\nDans l'attente de votre réponse.",
      "N'hésitez pas à me contacter pour toute précision.\nBien cordialement.",
      "Je reste disponible pour toute question complémentaire.\nAu plaisir de vous lire.",
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const cloture = clotures[Math.floor(Math.random() * clotures.length)];

    const ligneHtml = (l) =>
      `<tr><td style="border:1px solid #ccc;padding:6px 10px;">${l.designation}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:center;">${l.quantite}</td><td style="border:1px solid #ccc;padding:6px 10px;">${l.unite}</td></tr>`;

    const html = `
      <p>Bonjour,</p>
      <p>${intro}</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
        <thead>
          <tr style="background:#F2F2F2;">
            <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;">Désignation</th>
            <th style="border:1px solid #ccc;padding:6px 10px;text-align:center;">Quantité</th>
            <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;">Unité</th>
          </tr>
        </thead>
        <tbody>${lignes.map(ligneHtml).join("")}</tbody>
      </table>
      <p>${cloture.replace(/\n/g, "<br/>")}</p>
    `;

    const texte = [
      "Bonjour,", "", intro, "",
      "Désignation | Quantité | Unité",
      ...lignes.map((l) => `${l.designation} | ${l.quantite} | ${l.unite}`),
      "", cloture,
    ].join("\n");

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([texte], { type: "text/plain" }),
        }),
      ]);
      alert("Copié — colle-le dans un e-mail (Outlook/Gmail), il ne reste qu'à mettre l'objet et le(s) destinataire(s).");
    } catch (e) {
      try {
        await navigator.clipboard.writeText(texte);
        alert("Copié en texte brut (le tableau formaté n'a pas pu être copié) — colle-le dans un e-mail.");
      } catch (e2) {
        alert("La copie a échoué. Réessaie.");
      }
    }
  };

  const majObservation = async (id, valeur) => {
    const observation = valeur.trim() || null;
    setListe((prev) => prev.map((d) => (d.id === id ? { ...d, observation } : d)));
    await supabase.from("demandes").update({ observation }).eq("id", id);
  };

  const annulerDemande = async (d) => {
    if (d.statut === "Annulée") {
      if (!confirm(`Réactiver la demande ${d.numero} (retirer le statut Annulée) ?`)) return;
      await supabase.from("demandes").update({ statut: "A faire" }).eq("id", d.id);
      charger();
      return;
    }
    const motif = prompt(`Pourquoi annuler la demande ${d.numero} ? (raison obligatoire)`);
    if (!motif || !motif.trim()) return;
    await supabase.from("demandes").update({ statut: "Annulée", observation: motif.trim() }).eq("id", d.id);
    charger();
  };

  const standByDemande = async (d) => {
    const dateDuJour = new Date().toLocaleDateString("fr-FR");
    if (d.statut === "En stand-by") {
      const ligne = `[${dateDuJour}] Reprise du traitement`;
      const trace = d.historique_stand_by ? `${d.historique_stand_by}\n${ligne}` : ligne;
      await supabase.from("demandes").update({ statut: "A faire", historique_stand_by: trace }).eq("id", d.id);
      charger();
      return;
    }
    const motif = prompt(`Pourquoi mettre en stand-by la demande ${d.numero} ? (optionnel)`);
    const ligne = `[${dateDuJour}] Mise en stand-by${motif?.trim() ? ` — ${motif.trim()}` : ""}`;
    const trace = d.historique_stand_by ? `${d.historique_stand_by}\n${ligne}` : ligne;
    await supabase.from("demandes").update({ statut: "En stand-by", historique_stand_by: trace }).eq("id", d.id);
    charger();
  };

  const supprimerDemande = async (d) => {
    const { data: bcLies } = await supabase.from("commandes").select("id, numero").eq("demande_id", d.id);
    if (bcLies && bcLies.length > 0) {
      const noms = bcLies.map((b) => b.numero).join(", ");
      if (!confirm(`La demande ${d.numero} a ${bcLies.length} bon(s) de commande lié(s) (${noms}). Les supprimer aussi (avec leur réception/historique) et supprimer la demande ?`)) return;
      await supabase.from("commandes").delete().eq("demande_id", d.id);
    } else {
      if (!confirm(`Supprimer définitivement la demande ${d.numero} ?`)) return;
    }
    await supabase.from("demandes").delete().eq("id", d.id);
    charger();
  };

  return (
    <AuthGuard>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <h1 style={{ fontSize: 18, marginBottom: 14, flexShrink: 0 }}>
          {filtreATraiter ? `Liste des demandes (${filtrees.length} / ${liste.length})` : `Liste des demandes (${liste.length} chargées / ${totalCount} au total${filtreAnnee !== "toutes" ? `, année ${filtreAnnee}` : ""})`}
        </h1>

        {filtreATraiter && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E8F0FA", color: "#1B4C7A", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, flexShrink: 0 }}>
            <span>Filtré depuis le Tableau de bord : seules les {filtrees.length} demande(s) à traiter sont affichées.</span>
            <Link href="/demandes" style={{ color: "#1B4C7A", textDecoration: "underline" }}>Voir toutes les demandes</Link>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <input data-search-field placeholder="Rechercher (N°, service, demandeur, motif...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
              {recherche && <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer">×</button>}
            </div>
            <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
              <option value="">Tous les statuts</option>
              {STATUTS_CONNUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {!filtreATraiter && (
              <select value={filtreAnnee} onChange={(e) => setFiltreAnnee(e.target.value)} style={inputStyle} title="Par défaut, seule l'année en cours est affichée">
                {anneesDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="toutes">Toutes les années</option>
              </select>
            )}
            <TriMenu
              colonnes={[
                { key: "created_at", label: "Date" },
                { key: "numero", label: "N°" },
                { key: "service", label: "Service" },
                { key: "statut", label: "Statut" },
              ]}
              tri={tri}
              onChange={setTri}
            />
          </div>

          {loading && <p style={{ color: "#888", fontSize: 13 }}>Chargement...</p>}
          {!loading && filtrees.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Aucune demande pour ces filtres.</p>}
          <div ref={conteneurScrollRef} style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date DA</th>
                  <th style={thStyle}>N° DA</th>
                  <th style={thStyle}>Service demandeur</th>
                  <th style={thStyle}>Nom demandeur</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Demande</th>
                  <th style={thStyle}>Observation</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={tdStyle}>{formatDate(d.date_da || d.created_at)}</td>
                    <td style={tdStyle}>{d.numero_da || "-"}</td>
                    <td style={tdStyle}>{d.service || "-"}</td>
                    <td style={tdStyle}>{d.demandeur || "-"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => setFiltreStatut(d.statut)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#FFF3D6", color: "#8A6100", border: "none", cursor: "pointer" }} title="Filtrer sur ce statut">{d.statut}</button>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        href={`/demandes/${d.id}`}
                        style={{ fontWeight: 600, color: "#1E3A34", textDecoration: "underline" }}
                        title={articlesParDemande[d.id]?.length ? articlesParDemande[d.id].join("\n") : "Aucun article saisi"}
                      >
                        {d.numero}
                      </Link>
                      <div style={{ fontSize: 12, color: "#888" }}>{d.motif_projet}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span title={`Priorité : ${d.priorite || "Moyenne"}`} style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: prioriteCouleur(d.priorite), flexShrink: 0, cursor: "help" }} />
                        {demandesAvecNonDispo.has(d.id) && (
                          <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 5, background: "#FDECEA", color: "#B3261E" }}>À rechercher import</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <input
                        defaultValue={d.observation || ""}
                        placeholder="—"
                        onBlur={(e) => majObservation(d.id, e.target.value)}
                        style={{ ...inputStyle, width: "100%", fontSize: 12.5, padding: "4px 6px" }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => copierPourDevis(d)} style={linkBtnBleu} title="Copier pour demande de devis">
                          <IconCopy /> Devis
                        </button>
                        <button onClick={() => annulerDemande(d)} style={{ ...linkBtn, color: d.statut === "Annulée" ? "#1B7A4C" : "#8A6100", display: "inline-flex", alignItems: "center" }} title={d.statut === "Annulée" ? "Réactiver" : "Annuler"}>
                          <IconBan />
                        </button>
                        {(d.statut === "En stand-by" || !["Basculée en commande", "Clôturée", "Annulée"].includes(d.statut)) && (
                          <button
                            onClick={() => standByDemande(d)}
                            style={{ ...linkBtn, color: d.statut === "En stand-by" ? "#1B7A4C" : "#8A6100" }}
                            title={
                              (d.statut === "En stand-by" ? "Réactiver (sortir du stand-by)" : "Mettre en stand-by")
                              + (d.historique_stand_by ? `\n\nHistorique :\n${d.historique_stand_by}` : "")
                            }
                          >
                            {d.statut === "En stand-by" ? "▶" : "⏸"}
                          </button>
                        )}
                        {role === "acheteur" && (
                          <button onClick={() => supprimerDemande(d)} style={{ ...linkBtn, color: "#B3261E", display: "inline-flex", alignItems: "center" }} title="Supprimer">
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtreATraiter && resteAcharger > 0 && (
              <div ref={sentinelleRef} style={{ display: "flex", justifyContent: "center", padding: 12, fontSize: 12, color: "#999" }}>
                {loadingPlus ? "Chargement de la suite..." : `${resteAcharger} de plus en bas...`}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function prioriteCouleur(p) {
  if (p === "Haute") return "#E4572E";
  if (p === "Basse") return "#B9B7AE";
  return "#F5A623";
}

const linkBtnBleu = { border: "1px solid #ddd", background: "#fff", color: "#1B2430", fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 6, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
