"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Réutilise le même client Supabase que le reste de l'appli si tu en as déjà
// un exporté quelque part — remplace les deux lignes ci-dessous par
// `import { supabase } from "..."` si c'est le cas, pour ne pas dupliquer la config.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* ===========================================================================
   CALCULS DU TCO — fonctions pures, tout est ici, rien à importer d'ailleurs
   =========================================================================== */

function money(n) {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n) + " Ar";
}

function montantHT(ligne, qte) {
  if (!ligne || ligne.pu === null || ligne.pu === undefined) return null;
  return (ligne.pu - (ligne.remise || 0)) * qte;
}

function calculerPreconisation(fournisseurs, articles, articleIndex) {
  const qte = articles[articleIndex].quantite;
  let min = null;
  let gagnants = [];
  fournisseurs.forEach((f) => {
    const m = montantHT(f.lignes[articleIndex], qte);
    if (m !== null) {
      if (min === null || m < min) {
        min = m;
        gagnants = [f.nom];
      } else if (m === min) {
        gagnants.push(f.nom);
      }
    }
  });
  if (min === null) return { fournisseurs: [], totalNetHT: null, montantTTC: null };
  const nonTax = fournisseurs.find((f) => gagnants.includes(f.nom) && f.nonTaxable);
  const ttc = nonTax ? min : min * 1.2;
  return { fournisseurs: gagnants, totalNetHT: min, montantTTC: ttc };
}

function calculerToutesPreconisations(fournisseurs, articles) {
  return articles.map((_, i) => calculerPreconisation(fournisseurs, articles, i));
}

function winningArticleNumbers(f, articles, preconisations) {
  return articles
    .filter((a, i) => preconisations[i].fournisseurs.includes(f.nom))
    .map((a) => a.numero);
}

function joinFrench(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return String(arr[0]);
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

function totauxFournisseur(f, articles) {
  const montantHTTotal = articles.reduce(
    (s, a, i) => s + (montantHT(f.lignes[i], a.quantite) || 0),
    0
  );
  const tva = f.nonTaxable ? 0 : montantHTTotal * 0.2;
  const remiseTotale = articles.reduce(
    (s, a, i) => s + ((f.lignes[i].remise || 0) * a.quantite),
    0
  );
  return { montantHTTotal, tva, totalTTC: montantHTTotal + tva, remiseTotale };
}

function tauxRemiseLigne(ligne) {
  if (ligne.pu === null || ligne.pu === undefined || !ligne.pu) return null;
  return Math.round(((ligne.remise || 0) / ligne.pu) * 100);
}

function remiseExceptions(f, articles) {
  if (f.tauxRemiseDefaut === null || f.tauxRemiseDefaut === undefined) return [];
  const out = [];
  articles.forEach((a, i) => {
    const ligne = f.lignes[i];
    if (ligne.pu === null || ligne.pu === undefined) return;
    const taux = tauxRemiseLigne(ligne);
    if (taux !== f.tauxRemiseDefaut) {
      out.push({ numero: a.numero, designation: a.designation, taux, tauxDefaut: f.tauxRemiseDefaut });
    }
  });
  return out;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function observationAffichee(f, articles) {
  const auto = remiseExceptions(f, articles).map((e) => {
    if (e.taux === 0) {
      return `* Pas de remise sur l'article n°${e.numero} (${truncate(e.designation, 28)}) — habituellement ${e.tauxDefaut}%`;
    }
    return `* Remise de ${e.taux}% sur l'article n°${e.numero} (${truncate(e.designation, 28)}), au lieu de ${e.tauxDefaut}% habituellement`;
  });
  return [f.observation, ...auto].filter(Boolean).join("\n");
}

function totauxRetenus(preconisations) {
  const totalHTRetenu = preconisations.reduce((s, p) => s + (p.totalNetHT || 0), 0);
  const totalTTCRetenu = preconisations.reduce((s, p) => s + (p.montantTTC || 0), 0);
  const totalTVARetenu = totalTTCRetenu - totalHTRetenu;
  return { totalHTRetenu, totalTVARetenu, totalTTCRetenu };
}

function fournisseursAvecOffre(fournisseurs) {
  return fournisseurs.filter((f) => f.lignes.some((l) => l.pu !== null && l.pu !== undefined));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getLayoutPlan(fournisseurs, suppliersPerPageMax = 4) {
  const avecOffre = fournisseursAvecOffre(fournisseurs);
  const orientation = avecOffre.length < 2 ? "portrait" : "landscape";
  const suppliersPerPage = orientation === "portrait" ? 1 : suppliersPerPageMax;
  const pages = chunk(avecOffre, suppliersPerPage);
  return { avecOffre, orientation, suppliersPerPage, pages };
}

function getDensityClass(articleCount) {
  if (articleCount > 10) return "density-compact";
  if (articleCount <= 3) return "density-cozy";
  return "";
}

/* ===========================================================================
   RECUPERATION DES DONNEES SUPABASE
   Noms de tables/colonnes à ajuster à ton schéma réel si besoin.
   =========================================================================== */

function formatDateFr(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("fr-FR");
}

async function getTCOPrintData(demandeId) {
  const { data: demande, error: e1 } = await supabase
    .from("demandes")
    .select("*")
    .eq("id", demandeId)
    .single();
  if (e1) throw e1;

  const { data: lignesDemande, error: e2 } = await supabase
    .from("lignes_demande")
    .select("*")
    .eq("demande_id", demandeId)
    .order("numero", { ascending: true });
  if (e2) throw e2;

  const { data: devis, error: e3 } = await supabase
    .from("devis_fournisseurs")
    .select("*, fournisseur:fournisseurs(nom, taux_remise_defaut), lignes_devis(*)")
    .eq("demande_id", demandeId);
  if (e3) throw e3;

  const doc = {
    numero: demande.numero_tco,
    dateCreation: formatDateFr(demande.date_creation),
    destinataire: demande.destinataire || "Tous",
    emetteur: demande.emetteur_nom,
    fonction: demande.emetteur_fonction || "Buyer",
    dateDA: formatDateFr(demande.date_da),
    serviceDemandeur: demande.service_demandeur,
    nomDemandeur: demande.nom_demandeur,
    numeroDA: demande.numero_da,
    motifDemande: demande.motif,
    remarque: demande.remarque,
    autresFournisseursConsultes: demande.autres_fournisseurs_consultes,
  };

  const articles = lignesDemande.map((l) => ({
    numero: l.numero,
    designation: l.designation,
    quantite: l.quantite,
    unite: l.unite,
  }));

  const fournisseurs = devis.map((d) => ({
    nom: d.fournisseur?.nom || d.nom_fournisseur,
    numeroDevis: d.numero_devis,
    dateDevis: formatDateFr(d.date_devis),
    nonTaxable: !!d.non_taxable,
    tauxRemiseDefaut: d.fournisseur?.taux_remise_defaut ?? null,
    observation: d.observation || "",
    lignes: lignesDemande.map((l) => {
      const ligneDevis = d.lignes_devis.find((ld) => ld.ligne_demande_id === l.id);
      return {
        pu: ligneDevis?.prix_unitaire_ht ?? null,
        remise: ligneDevis?.remise_montant ?? 0,
      };
    }),
  }));

  return { doc, articles, fournisseurs };
}

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function ImprimerTCOPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let annule = false;
    getTCOPrintData(id)
      .then((d) => { if (!annule) setData(d); })
      .catch((e) => { if (!annule) setError(e); });
    return () => { annule = true; };
  }, [id]);

  if (error) {
    return <div style={{ padding: "8mm", fontFamily: "sans-serif" }}>Erreur de chargement du TCO : {error.message}</div>;
  }
  if (!data) {
    return <div style={{ padding: "8mm", fontFamily: "sans-serif" }}>Chargement du TCO…</div>;
  }

  return <TCODocument doc={data.doc} articles={data.articles} fournisseurs={data.fournisseurs} />;
}

/* ===========================================================================
   AFFICHAGE
   =========================================================================== */

function TCODocument({ doc, articles, fournisseurs, logoSrc = "/logo.png", suppliersPerPageMax = 4 }) {
  const preconisations = calculerToutesPreconisations(fournisseurs, articles);
  const { totalHTRetenu, totalTVARetenu, totalTTCRetenu } = totauxRetenus(preconisations);
  const { orientation, pages } = getLayoutPlan(fournisseurs, suppliersPerPageMax);
  const density = getDensityClass(articles.length);

  return (
    <div className="tco-print-doc">
      <style>{TCO_PRINT_CSS}</style>

      <div className="no-print">
        Aperçu du TCO — <button onClick={() => window.print()}>Imprimer / Exporter en PDF</button>
      </div>

      {pages.map((pageFournisseurs, idx) => (
        <div key={idx} className={`page-wrapper print-page${orientation === "portrait" ? " portrait" : ""}`}>
          <div className="doc-header">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="UNIFOODS"
                className="brand-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling.style.display = "block";
                }}
              />
              <div className="logo" style={{ display: "none" }}>UNIFOODS</div>
              <div className="sub">Membre du groupe HV</div>
            </div>
            <div className="title-block">
              <div className="titre">Tableau comparatif des offres fournisseurs</div>
              <div className="dest">Destinataire : {doc.destinataire}</div>
            </div>
            <div className="doc-meta">
              <div className="num">{doc.numero}</div>
              <div>Créé le {doc.dateCreation}</div>
              <div>Page {idx + 1} sur {pages.length}</div>
            </div>
          </div>
          <div className="meta-strip">
            <div className="item"><div className="lbl">Date DA</div><div className="val">{doc.dateDA}</div></div>
            <div className="item"><div className="lbl">Service demandeur</div><div className="val">{doc.serviceDemandeur || "—"}</div></div>
            <div className="item"><div className="lbl">Nom demandeur</div><div className="val">{doc.nomDemandeur || "—"}</div></div>
            <div className="item"><div className="lbl">N° DA</div><div className="val">{doc.numeroDA || "—"}</div></div>
            <div className="item"><div className="lbl">Émetteur</div><div className="val">{doc.emetteur}</div></div>
            <div className="item"><div className="lbl">Fonction</div><div className="val">{doc.fonction}</div></div>
            <div className="item"><div className="lbl">Signature</div><div className="val">&nbsp;</div></div>
          </div>

          <div className={`tco-frame-wrap ${density}`}>
            <ArticleTable articles={articles} fournisseursPage={pageFournisseurs} preconisations={preconisations} />
            <RecapTable
              doc={doc}
              articles={articles}
              fournisseursPage={pageFournisseurs}
              totalHTRetenu={totalHTRetenu}
              totalTVARetenu={totalTVARetenu}
              totalTTCRetenu={totalTTCRetenu}
            />
          </div>

          {idx === pages.length - 1 && (
            <div className="validation-section">
              <div className="box"><div className="lbl">Validation technique</div><div className="sign-line">Date / Nom / Signature</div></div>
              <div className="box"><div className="lbl">Validation direction</div><div className="sign-line">Date / Nom / Signature</div></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ColGroup({ fournisseursPage }) {
  return (
    <colgroup>
      <col className="col-num" /><col className="col-desig" /><col className="col-qte" />
      <col className="col-unite" /><col className="col-preco" />
      {fournisseursPage.map((f, idx) => (
        <>
          <col className="col-sup-pu" key={`pu-${idx}`} />
          <col className="col-sup-remise" key={`re-${idx}`} />
          <col className="col-sup-montant" key={`mo-${idx}`} />
        </>
      ))}
    </colgroup>
  );
}

function ArticleTable({ articles, fournisseursPage, preconisations }) {
  return (
    <div className="tco-frame">
      <table className="tco">
        <ColGroup fournisseursPage={fournisseursPage} />
        <thead>
          <tr>
            <th style={{ borderBottom: "none" }}></th>
            <th style={{ borderBottom: "none" }}></th>
            <th style={{ borderBottom: "none" }}></th>
            <th style={{ borderBottom: "none" }}></th>
            <th className="fill-preco preco-title" style={{ borderBottom: "none" }}>Préconisation</th>
            {fournisseursPage.map((f, idx) => {
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              const wins = winningArticleNumbers(f, articles, preconisations);
              return (
                <th key={f.nom} colSpan={3} className={`${alt} group-start`} style={{ padding: 0, borderBottom: "none" }}>
                  <div className="supplier-head-name">
                    {f.nom}
                    {f.nonTaxable && <span className="non-taxable-tag"> (non taxable)</span>}
                  </div>
                  <div className="supplier-head-devis">
                    {f.numeroDevis ? `Devis ${f.numeroDevis} · ` : ""}{f.dateDevis}
                  </div>
                  <div className={`supplier-head-winlist${alt}`}>
                    {wins.length ? `Moins cher sur article${wins.length > 1 ? "s" : ""} n° ${joinFrench(wins)}` : ""}
                  </div>
                </th>
              );
            })}
          </tr>
          <tr>
            <th>N°</th>
            <th className="text-center">Article</th>
            <th className="text-center">Qté</th>
            <th className="text-center">Unité</th>
            <th className="fill-preco"></th>
            {fournisseursPage.map((f, idx) => {
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              return (
                <>
                  <th key={`h-pu-${f.nom}`} className={`text-right group-start${alt}`}>PU HT</th>
                  <th key={`h-re-${f.nom}`} className={`text-right${alt}`}>
                    {f.tauxRemiseDefaut !== null && f.tauxRemiseDefaut !== undefined ? `Remise ${f.tauxRemiseDefaut}%` : "Remise"}
                  </th>
                  <th key={`h-mo-${f.nom}`} className={`text-right${alt}`}>Montant HT</th>
                </>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {articles.map((a, i) => {
            const preco = preconisations[i];
            return (
              <tr key={a.numero}>
                <td className="text-center">{a.numero}</td>
                <td>{a.designation}</td>
                <td className="text-center">{a.quantite}</td>
                <td className="text-center">{a.unite}</td>
                <td className="preco-cell fill-preco">
                  <div className="fournisseur">{preco.fournisseurs.join(" / ") || "—"}</div>
                  <div className="amounts">HT <b>{money(preco.totalNetHT)}</b></div>
                </td>
                {fournisseursPage.map((f, idx) => {
                  const ligne = f.lignes[i];
                  const mht = montantHT(ligne, a.quantite);
                  const hasOffer = ligne.pu !== null && ligne.pu !== undefined;
                  const isWinner = hasOffer && preco.fournisseurs.includes(f.nom);
                  const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
                  const winCls = isWinner ? " winner-block" : "";
                  return (
                    <>
                      <td key={`pu-${f.nom}`} className={`text-right group-start${alt}${winCls}`}>
                        {hasOffer && (
                          <>
                            <span className={`dot ${isWinner ? "dot-on" : "dot-off"}`}></span>
                            {money(ligne.pu)}
                          </>
                        )}
                      </td>
                      <td key={`re-${f.nom}`} className={`text-right${alt}${winCls}`}>
                        {ligne.remise ? money(ligne.remise) : ""}
                      </td>
                      <td key={`mo-${f.nom}`} className={`text-right${alt}${winCls}`}>
                        <span className={isWinner ? "amount-value winner" : ""}>{mht !== null ? money(mht) : ""}</span>
                      </td>
                    </>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecapTable({ doc, articles, fournisseursPage, totalHTRetenu, totalTVARetenu, totalTTCRetenu }) {
  return (
    <div className="tco-frame">
      <table className="tco">
        <ColGroup fournisseursPage={fournisseursPage} />
        <tbody>
          <tr className="recap-row">
            <td colSpan={4} className="motif-cell" rowSpan={5}>
              <div className="bloc">
                <div className="lbl">Motif de la demande</div>
                <div className="txt">{doc.motifDemande || "—"}</div>
              </div>
              <div className="bloc">
                <div className="lbl">Remarque</div>
                <div className={`txt${doc.remarque ? "" : " hint"}`}>{doc.remarque || "—"}</div>
              </div>
              <div className="bloc">
                <div className="lbl">Autres fournisseurs consultés</div>
                <div className={`txt${doc.autresFournisseursConsultes ? "" : " hint"}`}>
                  {doc.autresFournisseursConsultes || "ex. consultés mais n'ont pas répondu à la demande de devis, ou ne vendent pas l'article recherché"}
                </div>
              </div>
            </td>
            <td className="recap-total-cell fill-preco" rowSpan={5}>
              <div className="lbl">Total au prix le moins cher (HT)</div>
              <div className="val">{money(totalHTRetenu)}</div>
              <div className="lbl" style={{ marginTop: "1.8mm" }}>TVA</div>
              <div className="val">{money(totalTVARetenu)}</div>
              <div className="lbl" style={{ marginTop: "1.8mm" }}>Total TTC</div>
              <div className="val big">{money(totalTTCRetenu)}</div>
            </td>
            {fournisseursPage.map((f, idx) => {
              const t = totauxFournisseur(f, articles);
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              return (
                <>
                  <td key={`mh-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>Montant HT</td>
                  <td key={`mhv-${f.nom}`} className={`recap-value${alt}`}>{money(t.montantHTTotal)}</td>
                </>
              );
            })}
          </tr>

          <tr className="recap-row">
            {fournisseursPage.map((f, idx) => {
              const t = totauxFournisseur(f, articles);
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              return (
                <>
                  <td key={`rem-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>Remise obtenue</td>
                  <td key={`remv-${f.nom}`} className={`recap-value${alt}`}>{t.remiseTotale ? money(t.remiseTotale) : ""}</td>
                </>
              );
            })}
          </tr>

          <tr className="recap-row">
            {fournisseursPage.map((f, idx) => {
              const t = totauxFournisseur(f, articles);
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              return (
                <>
                  <td key={`tva-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>TVA</td>
                  <td key={`tvav-${f.nom}`} className={`recap-value${alt}`}>
                    {f.nonTaxable ? <span className="non-taxable-tag">Non taxable</span> : money(t.tva)}
                  </td>
                </>
              );
            })}
          </tr>

          <tr className="recap-row">
            {fournisseursPage.map((f, idx) => {
              const t = totauxFournisseur(f, articles);
              const alt = idx > 0 && idx % 2 === 1  ? " supplier-alt" : "";
              return (
                <>
                  <td key={`ttc-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`} style={{ fontWeight: 600 }}>Total TTC</td>
                  <td key={`ttcv-${f.nom}`} className={`recap-value${alt}`} style={{ color: "var(--brand-dark)", fontWeight: 700 }}>{money(t.totalTTC)}</td>
                </>
              );
            })}
          </tr>

          <tr className="recap-row">
            {fournisseursPage.map((f, idx) => {
              const alt = idx > 0 && idx % 2 === 1  ? " supplier-alt" : "";
              return (
                <td key={`obs-${f.nom}`} colSpan={3} className={`observation-cell group-start${alt}`}>
                  <div className="lbl">Observation</div>
                  <div className="txt">{observationAffichee(f, articles)}</div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ===========================================================================
   STYLES — un seul bloc CSS, injecté via <style> ci-dessus (pas de fichier
   .css séparé, comme dans le reste de l'appli). Scopé sous .tco-print-doc
   pour ne jamais entrer en collision avec le reste des styles de l'appli.
   =========================================================================== */
const TCO_PRINT_CSS = `

.tco-print-doc {
    --brand:#0F7A54;
    --brand-dark:#0B5C3F;
    --brand-bg:#EAF7EE;
    --ink:#1A1D1F;
    --muted:#8A8F98;
    --line:#E7E7E4;
    --bg-soft:#FAFAF9;
  }
.tco-print-doc * { box-sizing:border-box; }
.tco-print-doc {
    font-family:"Inter", -apple-system, "Segoe UI", Arial, sans-serif;
    color:var(--ink);
    margin:0;
    background:#888;
    -webkit-font-smoothing:antialiased;
  }
.tco-print-doc .page-wrapper {
    background:#fff;
    width:297mm;
    min-height:210mm;
    margin:10mm auto;
    padding:12mm;
    box-shadow:0 0 10px rgba(0,0,0,.35);
  }
.tco-print-doc .page-wrapper.portrait { width:210mm; min-height:297mm; page:portrait-page; }
.tco-print-doc .doc-header {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    padding-bottom:4mm;
    border-bottom:2px solid var(--brand);
    margin-bottom:4mm;
  }
.tco-print-doc .doc-header .brand { display:flex; flex-direction:column; }
.tco-print-doc .doc-header .brand .brand-logo-img { height:11mm; width:auto; object-fit:contain; }
.tco-print-doc .doc-header .brand .logo {
    font-size:16pt; font-weight:700; color:var(--brand); letter-spacing:-0.02em;
  }
.tco-print-doc .doc-header .brand .sub { font-size:7.5pt; color:var(--muted); margin-top:0.5mm; }
.tco-print-doc .doc-header .title-block { text-align:center; flex:1; padding:0 8mm; }
.tco-print-doc .doc-header .title-block .titre { font-size:13pt; font-weight:600; color:var(--ink); }
.tco-print-doc .doc-header .title-block .dest { font-size:8.5pt; color:var(--muted); margin-top:1mm; }
.tco-print-doc .doc-header .doc-meta { text-align:right; font-size:8pt; color:var(--muted); min-width:48mm; }
.tco-print-doc .doc-header .doc-meta .num { font-size:10pt; font-weight:600; color:var(--ink); margin-bottom:1mm; }
.tco-print-doc .doc-header .doc-meta div { margin-top:0.5mm; }
.tco-print-doc .meta-strip {
    display:flex;
    flex-wrap:wrap;
    background:var(--bg-soft);
    border-radius:3mm;
    padding:3mm 5mm;
    margin-bottom:5mm;
  }
.tco-print-doc .meta-strip .item { min-width:30mm; margin-right:6mm; }
.tco-print-doc .meta-strip .lbl {
    font-size:6.8pt; color:var(--muted); text-transform:uppercase; letter-spacing:.04em;
  }
.tco-print-doc .meta-strip .val { font-size:9pt; font-weight:600; color:var(--ink); margin-top:0.4mm; }
.tco-print-doc .tco-frame {
    border:1.25px solid var(--ink);
    border-radius:3.5mm;
    overflow:hidden;
    box-shadow:0 1px 3px rgba(0,0,0,.06);
  }
.tco-print-doc .tco-frame + .tco-frame { margin-top:4mm; }
.tco-print-doc .tco-frame-wrap { margin-bottom:5mm; }
.tco-print-doc table.tco {
    width:100%;
    border-collapse:collapse;
    table-layout:fixed;
  }
.tco-print-doc table.tco th {
    font-size:6.6pt; font-weight:600; text-transform:uppercase; letter-spacing:.03em;
    color:var(--muted); text-align:left; vertical-align:bottom;
    padding:1mm 1.5mm 1.5mm;
    border-bottom:1.2px solid var(--ink);
  }
.tco-print-doc table.tco td {
    font-size:7.6pt; color:var(--ink);
    padding:1.6mm 1.5mm;
    border-bottom:0.75px solid var(--line);
    vertical-align:top;
  }
.tco-print-doc table.tco .supplier-head-name {
    font-size:8pt; font-weight:700; color:var(--ink); text-transform:none;
    padding:1.5mm 1.5mm 0;
    border-bottom:none;
    text-align:center;
  }
.tco-print-doc table.tco .supplier-head-devis {
    font-size:6.6pt; font-weight:400; color:var(--muted); text-transform:none;
    padding:0 1.5mm 1.5mm;
    border-bottom:none;
    letter-spacing:0;
    text-align:center;
  }
.tco-print-doc .col-preco, .tco-print-doc th.col-preco-h {
    border-left:1.25px solid var(--ink) !important;
    border-right:1.25px solid var(--ink) !important;
  }
.tco-print-doc .group-start { border-left:1.25px solid var(--ink) !important; }
.tco-print-doc .fill-preco { background:var(--brand-bg); }
.tco-print-doc .supplier-alt td, .tco-print-doc .supplier-alt th { background:#FBFBFA; }
.tco-print-doc .col-num { width:8mm; text-align:center; }
.tco-print-doc .col-desig { width:46mm; }
.tco-print-doc .col-qte { width:11mm; text-align:center; }
.tco-print-doc .col-unite { width:12mm; text-align:center; }
.tco-print-doc .col-preco { width:30mm; }
.tco-print-doc .col-sup-pu { width:18mm; text-align:right; }
.tco-print-doc .col-sup-remise { width:15mm; text-align:right; }
.tco-print-doc .col-sup-montant { width:24mm; text-align:right; }
.tco-print-doc .text-center { text-align:center; }
.tco-print-doc .text-right { text-align:right; }
.tco-print-doc table.tco th.text-center { text-align:center; }
.tco-print-doc table.tco th.text-right { text-align:right; }
.tco-print-doc .preco-title {
    font-size:8pt; font-weight:700; color:var(--brand-dark); text-transform:none;
    letter-spacing:0; text-align:center;
  }
.tco-print-doc .preco-cell { text-align:center; }
.tco-print-doc .preco-cell .fournisseur { font-weight:700; color:var(--brand-dark); }
.tco-print-doc .preco-cell .amounts { color:var(--muted); font-size:6.8pt; margin-top:0.6mm; line-height:1.5; }
.tco-print-doc .preco-cell .amounts b { color:var(--ink); font-weight:600; }
.tco-print-doc .winner-block { background:var(--brand-bg); border-radius:1.5mm; }
.tco-print-doc .dot { display:inline-block; width:1.6mm; height:1.6mm; border-radius:50%; margin-right:1mm; vertical-align:middle; }
.tco-print-doc .dot-on { background:var(--brand); }
.tco-print-doc .dot-off { border:0.5px solid #C6C8CC; }
.tco-print-doc .amount-value.winner { color:var(--brand-dark); font-weight:700; white-space:nowrap; }
.tco-print-doc .badge-cheapest {
    display:block; font-size:5.6pt; font-weight:700; color:var(--brand-dark);
    text-transform:uppercase; letter-spacing:.03em; margin-top:0.4mm;
  }
.tco-print-doc .supplier-head-winlist {
    font-size:6.2pt; font-weight:600; color:var(--brand-dark);
    padding:0.8mm 1.5mm 1.5mm; text-transform:none; letter-spacing:0; border-bottom:none;
    min-height:2.6mm; text-align:center;
  }
.tco-print-doc .non-taxable-tag {
    font-size:6.2pt; color:var(--muted); font-style:italic;
  }
.tco-print-doc .density-compact table.tco th { padding:0.7mm 1.5mm 1mm; }
.tco-print-doc .density-compact table.tco td { padding:1mm 1.5mm; font-size:7.2pt; }
.tco-print-doc .density-compact .supplier-head-name { padding-top:1mm; font-size:7.6pt; }
.tco-print-doc .density-cozy table.tco td { padding:2.6mm 1.5mm; }
.tco-print-doc .density-cozy .preco-cell .amounts, .tco-print-doc .density-cozy .motif-cell .bloc { margin-top:1mm; }
.tco-print-doc .recap-row td { border-bottom:none; padding-top:1mm; padding-bottom:1mm; }
.tco-print-doc .recap-label { font-size:7.3pt; color:var(--ink); }
.tco-print-doc .recap-label.total { font-weight:700; }
.tco-print-doc .recap-value { font-size:8.2pt; font-weight:600; text-align:right; }
.tco-print-doc .recap-value.total { font-weight:700; color:var(--brand-dark); font-size:9pt; }
.tco-print-doc .motif-cell { font-size:7.6pt; vertical-align:top; padding-top:3mm; }
.tco-print-doc .motif-cell .bloc { margin-bottom:3mm; }
.tco-print-doc .motif-cell .lbl { font-size:6.8pt; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:1mm; }
.tco-print-doc .motif-cell .txt { line-height:1.5; }
.tco-print-doc .motif-cell .txt.hint { color:#B9BCC2; font-style:italic; }
.tco-print-doc .recap-total-cell { vertical-align:top; padding-top:3mm; background:var(--bg-soft); border-radius:2mm; }
.tco-print-doc .recap-total-cell .lbl { font-size:6.6pt; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
.tco-print-doc .recap-total-cell .val { font-size:8.4pt; font-weight:700; color:var(--ink); margin-top:0.3mm; }
.tco-print-doc .recap-total-cell .val.big { font-size:10pt; color:var(--brand-dark); }
.tco-print-doc .observation-cell { vertical-align:top; padding-top:2mm; }
.tco-print-doc .observation-cell .lbl { font-size:6.2pt; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:0.8mm; }
.tco-print-doc .observation-cell .txt { font-size:6.8pt; color:var(--ink); line-height:1.5; white-space:pre-line; }
.tco-print-doc .observation-cell .txt:empty::after { content:"—"; color:#C6C8CC; }
.tco-print-doc .validation-section {
    display:flex; gap:10mm; margin-top:8mm;
  }
.tco-print-doc .validation-section .box {
    flex:1; max-width:75mm;
  }
.tco-print-doc .validation-section .box .lbl {
    font-size:7.5pt; font-weight:600; color:var(--ink); text-transform:uppercase; letter-spacing:.04em;
    border-bottom:1px solid var(--ink); padding-bottom:1.5mm; margin-bottom:12mm;
  }
.tco-print-doc .validation-section .box .sign-line {
    font-size:6.6pt; color:var(--muted); border-top:0.75px solid var(--line); padding-top:1mm;
  }
.tco-print-doc .no-print {
    text-align:center; padding:6mm; background:#1A1D1F; color:#fff;
  }
.tco-print-doc .no-print button {
    font-size:11pt; padding:2mm 6mm; cursor:pointer; border:none; border-radius:2mm;
    background:var(--brand); color:#fff; font-weight:600;
  }
.tco-print-doc .no-print .hint { font-size:8.5pt; color:#aaa; margin-top:2mm; }
@media print {
  .tco-print-doc { background:#fff; }
  .tco-print-doc .page-wrapper { box-shadow:none; margin:0; width:auto; min-height:auto; padding:0; }
  .tco-print-doc .print-page { page-break-after:always; }
  .tco-print-doc .print-page:last-child { page-break-after:auto; }
  .tco-print-doc .no-print { display:none !important; }
}
@page { size:A4 landscape; margin:8mm; }
@page portrait-page { size:A4 portrait; margin:8mm; }
`;
