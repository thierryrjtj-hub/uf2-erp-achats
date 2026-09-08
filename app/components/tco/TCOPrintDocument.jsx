"use client";

import {
  money,
  montantHT,
  calculerToutesPreconisations,
  winningArticleNumbers,
  joinFrench,
  totauxFournisseur,
  totauxRetenus,
  observationAffichee,
  getLayoutPlan,
  getDensityClass,
} from "@/lib/tco/tcoCalculations";
import "./tco-print.css";

/**
 * Modèle d'impression du TCO.
 *
 * Props :
 * - doc: { numero, dateCreation, destinataire, emetteur, fonction, dateDA,
 *          serviceDemandeur, nomDemandeur, numeroDA, motifDemande, remarque,
 *          autresFournisseursConsultes }
 * - articles: [{ numero, designation, quantite, unite }]
 * - fournisseurs: [{ nom, numeroDevis, dateDevis, nonTaxable, observation, lignes }]
 * - logoSrc: chemin du logo (par défaut "/logo.png" — la version SANS "HV",
 *   c'est la convention déjà en place pour les documents imprimés ; la version
 *   "Membre du groupe HV" est réservée à l'en-tête de l'appli elle-même)
 * - suppliersPerPageMax: nombre max de fournisseurs par page en paysage (def. 4)
 * - showPrintButton: affiche le bouton "Imprimer" en haut (masqué à l'impression)
 *
 * Usage typique : cette page se suffit à elle-même, on l'ouvre dans un onglet
 * dédié et on imprime avec Ctrl+P / le bouton fourni.
 */
export default function TCOPrintDocument({
  doc,
  articles,
  fournisseurs,
  logoSrc = "/logo.png",
  suppliersPerPageMax = 4,
  showPrintButton = true,
}) {
  const preconisations = calculerToutesPreconisations(fournisseurs, articles);
  const { totalHTRetenu, totalTVARetenu, totalTTCRetenu } = totauxRetenus(preconisations);
  const { orientation, pages } = getLayoutPlan(fournisseurs, { suppliersPerPageMax });
  const density = getDensityClass(articles.length);

  return (
    <div className="tco-print-doc">
      {showPrintButton && (
        <div className="no-print">
          Aperçu du TCO — <button onClick={() => window.print()}>Imprimer / Exporter en PDF</button>
        </div>
      )}

      {pages.map((pageFournisseurs, idx) => (
        <div
          key={idx}
          className={`page-wrapper print-page${orientation === "portrait" ? " portrait" : ""}`}
        >
          <DocHeader doc={doc} logoSrc={logoSrc} pageNum={idx + 1} totalPages={pages.length} />

          <div className={`tco-frame-wrap ${density}`}>
            <ArticleTable
              articles={articles}
              fournisseursPage={pageFournisseurs}
              preconisations={preconisations}
            />
            <RecapTable
              doc={doc}
              articles={articles}
              fournisseursPage={pageFournisseurs}
              totalHTRetenu={totalHTRetenu}
              totalTVARetenu={totalTVARetenu}
              totalTTCRetenu={totalTTCRetenu}
            />
          </div>

          {idx === pages.length - 1 && <ValidationSection />}
        </div>
      ))}
    </div>
  );
}

function DocHeader({ doc, logoSrc, pageNum, totalPages }) {
  return (
    <>
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
          <div className="logo" style={{ display: "none" }}>
            UNIFOODS
          </div>
          <div className="sub">Membre du groupe HV</div>
        </div>
        <div className="title-block">
          <div className="titre">Tableau comparatif des offres fournisseurs</div>
          <div className="dest">Destinataire : {doc.destinataire}</div>
        </div>
        <div className="doc-meta">
          <div className="num">{doc.numero}</div>
          <div>Créé le {doc.dateCreation}</div>
          <div>
            Page {pageNum} sur {totalPages}
          </div>
        </div>
      </div>
      <div className="meta-strip">
        <div className="item">
          <div className="lbl">Date DA</div>
          <div className="val">{doc.dateDA}</div>
        </div>
        <div className="item">
          <div className="lbl">Service demandeur</div>
          <div className="val">{doc.serviceDemandeur || "—"}</div>
        </div>
        <div className="item">
          <div className="lbl">Nom demandeur</div>
          <div className="val">{doc.nomDemandeur || "—"}</div>
        </div>
        <div className="item">
          <div className="lbl">N° DA</div>
          <div className="val">{doc.numeroDA || "—"}</div>
        </div>
        <div className="item">
          <div className="lbl">Émetteur</div>
          <div className="val">{doc.emetteur}</div>
        </div>
        <div className="item">
          <div className="lbl">Fonction</div>
          <div className="val">{doc.fonction}</div>
        </div>
        <div className="item">
          <div className="lbl">Signature</div>
          <div className="val">&nbsp;</div>
        </div>
      </div>
    </>
  );
}

function ColGroup({ fournisseursPage }) {
  return (
    <colgroup>
      <col className="col-num" />
      <col className="col-desig" />
      <col className="col-qte" />
      <col className="col-unite" />
      <col className="col-preco" />
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
            <th className="fill-preco preco-title" style={{ borderBottom: "none" }}>
              Préconisation
            </th>
            {fournisseursPage.map((f, idx) => {
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              const wins = winningArticleNumbers(f, articles, preconisations);
              return (
                <th
                  key={f.nom}
                  colSpan={3}
                  className={`${alt} group-start`}
                  style={{ padding: 0, borderBottom: "none" }}
                >
                  <div className="supplier-head-name">
                    {f.nom}
                    {f.nonTaxable && <span className="non-taxable-tag"> (non taxable)</span>}
                  </div>
                  <div className="supplier-head-devis">
                    {f.numeroDevis ? `Devis ${f.numeroDevis} · ` : ""}
                    {f.dateDevis}
                  </div>
                  <div className={`supplier-head-winlist${alt}`}>
                    {wins.length
                      ? `Moins cher sur article${wins.length > 1 ? "s" : ""} n° ${joinFrench(wins)}`
                      : ""}
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
                  <th key={`h-pu-${f.nom}`} className={`text-right group-start${alt}`}>
                    PU HT
                  </th>
                  <th key={`h-re-${f.nom}`} className={`text-right${alt}`}>
                    {f.tauxRemiseDefaut !== null && f.tauxRemiseDefaut !== undefined
                      ? `Remise ${f.tauxRemiseDefaut}%`
                      : "Remise"}
                  </th>
                  <th key={`h-mo-${f.nom}`} className={`text-right${alt}`}>
                    Montant HT
                  </th>
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
                  <div className="amounts">
                    HT <b>{money(preco.totalNetHT)}</b>
                  </div>
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
                        <span className={isWinner ? "amount-value winner" : ""}>
                          {mht !== null ? money(mht) : ""}
                        </span>
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

function RecapTable({
  doc,
  articles,
  fournisseursPage,
  totalHTRetenu,
  totalTVARetenu,
  totalTTCRetenu,
}) {
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
                  {doc.autresFournisseursConsultes ||
                    "ex. consultés mais n'ont pas répondu à la demande de devis, ou ne vendent pas l'article recherché"}
                </div>
              </div>
            </td>
            <td className="recap-total-cell fill-preco" rowSpan={5}>
              <div className="lbl">Total au prix le moins cher (HT)</div>
              <div className="val">{money(totalHTRetenu)}</div>
              <div className="lbl" style={{ marginTop: "1.8mm" }}>
                TVA
              </div>
              <div className="val">{money(totalTVARetenu)}</div>
              <div className="lbl" style={{ marginTop: "1.8mm" }}>
                Total TTC
              </div>
              <div className="val big">{money(totalTTCRetenu)}</div>
            </td>
            {fournisseursPage.map((f, idx) => {
              const t = totauxFournisseur(f, articles);
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
              return (
                <>
                  <td key={`mh-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>
                    Montant HT
                  </td>
                  <td key={`mhv-${f.nom}`} className={`recap-value${alt}`}>
                    {money(t.montantHTTotal)}
                  </td>
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
                  <td key={`rem-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>
                    Remise obtenue
                  </td>
                  <td key={`remv-${f.nom}`} className={`recap-value${alt}`}>
                    {t.remiseTotale ? money(t.remiseTotale) : ""}
                  </td>
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
                  <td key={`tva-${f.nom}`} colSpan={2} className={`recap-label group-start${alt}`}>
                    TVA
                  </td>
                  <td key={`tvav-${f.nom}`} className={`recap-value${alt}`}>
                    {f.nonTaxable ? (
                      <span className="non-taxable-tag">Non taxable</span>
                    ) : (
                      money(t.tva)
                    )}
                  </td>
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
                  <td
                    key={`ttc-${f.nom}`}
                    colSpan={2}
                    className={`recap-label group-start${alt}`}
                    style={{ fontWeight: 600 }}
                  >
                    Total TTC
                  </td>
                  <td
                    key={`ttcv-${f.nom}`}
                    className={`recap-value${alt}`}
                    style={{ color: "var(--brand-dark)", fontWeight: 700 }}
                  >
                    {money(t.totalTTC)}
                  </td>
                </>
              );
            })}
          </tr>

          <tr className="recap-row">
            {fournisseursPage.map((f, idx) => {
              const alt = idx > 0 && idx % 2 === 1 ? " supplier-alt" : "";
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

function ValidationSection() {
  return (
    <div className="validation-section">
      <div className="box">
        <div className="lbl">Validation technique</div>
        <div className="sign-line">Date / Nom / Signature</div>
      </div>
      <div className="box">
        <div className="lbl">Validation direction</div>
        <div className="sign-line">Date / Nom / Signature</div>
      </div>
    </div>
  );
}
