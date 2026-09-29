"use client";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import { linkBtn, buttonStyle } from "../../components/ui";
import { IconPrint } from "../../components/Icons";
import { useLangue } from "../../../lib/i18n";

const VERT = "#74BC1F";
const VERT_FONCE = "#185640";
const VERT_CLAIR = "#E3F1E7";
const GRIS_BORD = "#BFBFBF";
const GRIS_LABEL = "#4D4D4D";
const NOIR_VALEUR = "#262626";

const encadreDouble = (fond = VERT_CLAIR) => ({
  background: fond, borderRadius: 10, border: `1px solid ${GRIS_BORD}`,
  boxShadow: "inset 0 0 0 3px #fff", padding: "13px 18px",
});
const thPrint = { padding: "6px 4px", fontSize: 10, textAlign: "left", fontWeight: 700, background: VERT_CLAIR, color: GRIS_LABEL, borderRight: "1px solid #fff" };
// Bordures toujours visibles (même vide) : c'est la différence avec le PV normal,
// qui sert de repère d'écriture manuscrite.
const tdPrint = { padding: "4px 4px", fontSize: 10.5, color: NOIR_VALEUR, border: "1px solid #D8D8D8" };
const doubleLigneVerte = { borderTop: `2.5px double ${VERT}`, margin: "18px 0" };
const ombrePortee = { height: 2.5, background: VERT };

function LigneInfo({ label, valeurVide = true }) {
  return (
    <div style={{ display: "flex", fontSize: 11, marginBottom: 3 }}>
      <span style={{ width: 118, flexShrink: 0, fontWeight: 400, color: GRIS_LABEL, borderRight: "1px solid #CFCFCF", paddingRight: 8, marginRight: 8 }}>{label}</span>
      <span style={{ fontWeight: 700, color: NOIR_VALEUR, flex: 1, borderBottom: valeurVide ? "1px solid #ccc" : "none" }}>&nbsp;</span>
    </div>
  );
}

const LIGNES_VIDES = Array.from({ length: 16 });

export default function PVViergePage() {
  const router = useRouter();
  const { t } = useLangue();

  return (
    <AuthGuard>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        .pv-vierge-template { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; {t("retour")}</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }} className="no-print">
        <h1 style={{ fontSize: 20 }}>{t("pvv_titre")}</h1>
        <button onClick={() => window.print()} style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", gap: 6 }}><IconPrint /> {t("pvv_btn_imprimer")}</button>
      </div>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }} className="no-print">
        {t("pvv_aide")}
      </p>

      <div className="pv-vierge-template print-area" style={{ padding: "0 8px", fontFamily: "Arial, sans-serif", color: "#1a1a1a", fontSize: 12, background: "#fff", display: "flex", flexDirection: "column", minHeight: "calc(297mm - 20mm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginBottom: 16 }}>
          <img src="/logo.png" alt="UNIFOODS" style={{ height: 46 }} />
          <div style={{ ...encadreDouble(), flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 22px" }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: VERT, whiteSpace: "nowrap" }}>{t("pvv_titre").replace(" vierge", "")}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: GRIS_LABEL, whiteSpace: "nowrap" }}><strong style={{ color: GRIS_LABEL }}>N°</strong> &nbsp; ____________</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div style={encadreDouble()}>
            <LigneInfo label={t("pvv_date")} />
            <LigneInfo label={t("pvv_emis_par")} />
            <LigneInfo label={t("pvv_contact")} />
            <LigneInfo label={t("pvv_email")} />
            <div style={{ height: 8 }} />
            <LigneInfo label={t("pvv_date_da")} />
            <LigneInfo label={t("pvv_da_n")} />
            <LigneInfo label={t("pvv_destinataire")} />
            <LigneInfo label={t("pvv_utilisateur_final")} />
          </div>
          <div style={encadreDouble()}>
            <LigneInfo label={t("col_fournisseur")} />
            <LigneInfo label={t("pvv_adresse")} />
            <LigneInfo label={t("pvv_code_postal")} />
            <LigneInfo label="NIF" />
            <LigneInfo label="STAT" />
            <LigneInfo label="RCS" />
            <LigneInfo label={t("pvv_contact")} />
            <LigneInfo label={t("pvv_tel")} />
            <LigneInfo label={t("pvv_email")} />
          </div>
          <div style={encadreDouble()}>
            <LigneInfo label={t("pvv_date_livraison")} />
            <LigneInfo label={t("pvv_nom_recept_magasin")} />
          </div>
          <div style={encadreDouble()}>
            <LigneInfo label={t("pvv_type_reglement")} />
            <LigneInfo label={t("pvv_modalite_paiement")} />
          </div>
        </div>

        <div style={ombrePortee} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thPrint}>{t("pvv_n_bc")}</th><th style={thPrint}>{t("pvv_description")}</th><th style={thPrint}>{t("ph_qte")}</th>
              <th style={thPrint}>{t("col_unite")}</th><th style={thPrint}>{t("pvv_qte_livree")}</th><th style={thPrint}>{t("col_unite")}</th>
              <th style={thPrint}>{t("bc_h_reste")}</th><th style={{ ...thPrint, borderRight: "none" }}>{t("pvv_remarque")}</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES_VIDES.map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => <td key={j} style={{ ...tdPrint, height: 22 }}></td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={ombrePortee} />
        <div style={{ textAlign: "right", fontSize: 8, color: GRIS_LABEL, marginTop: 3 }}>{t("pvv_page")}</div>

        <div style={{ ...encadreDouble(), display: "inline-block", padding: "6px 16px", margin: "14px 0 10px", fontSize: 12, fontWeight: 700, color: VERT }}>
          {t("pvv_signatures")}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          {[t("pvv_resp_magasin"), t("pvv_magasinier"), t("pvv_agent_securite"), t("pvv_livreur")].map((s) => (
            <div key={s} style={{ flex: 1, ...encadreDouble(), minHeight: 165, padding: "10px 10px 6px", textAlign: "center", fontSize: 10.5, fontWeight: 700, color: NOIR_VALEUR }}>
              {s}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ marginTop: 24, fontSize: 10, color: GRIS_LABEL }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong style={{ color: NOIR_VALEUR }}>UNIFOODS</strong><br />Siège Sociale<br />27, Rue Radama 1er Tsaralalana<br />101 Antananarivo<br />Madagascar
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ color: NOIR_VALEUR }}>Coordonnées fiscaux</strong><br />NIF : 3001453076<br />STAT : 10505 11 2013 1 11066<br />RCS : 21013 B 00860 2018 B 01049
            </div>
          </div>
          <div style={{ height: 10, background: VERT_FONCE, marginTop: 14 }} />
        </div>
      </div>
    </AuthGuard>
  );
}
