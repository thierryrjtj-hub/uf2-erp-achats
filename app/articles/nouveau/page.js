"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { chargerAvecCache } from "../../../lib/cache";
import { useLangue } from "../../../lib/i18n";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import ChampPrixHT from "../../components/ChampPrixHT";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";

const ligneVide = () => ({ key: Math.random().toString(36).slice(2), ligne_demande_id: null, designation: "", quantite: 1, unite: "pcs", prix_unitaire_ht: "", remise_pct: 0, date_livraison: "" });
const estBoisDeChauffage = (designation) => {
  const d = (designation || "").toLowerCase();
  return d.includes("bois de chauffage") || d.includes("bois chauffage");
};

export default function NouveauBCDirectPage() {
  const { t } = useLangue();
  return (
    <Suspense fallback={<AuthGuard><p>{t("chargement")}</p></AuthGuard>}>
      <NouveauBCDirectInner />
    </Suspense>
  );
}

function NouveauBCDirectInner() {
  const { t } = useLangue();
  const router = useRouter();
  const searchParams = useSearchParams();
  const demandeId = searchParams.get("demande_id");
  const [demande, setDemande] = useState(null);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [rechercheFournisseur, setRechercheFournisseur] = useState("");
  const [fournisseurChoisi, setFournisseurChoisi] = useState(null);
  const [assujettiTva, setAssujettiTva] = useState(true);
  const [referenceDevis, setReferenceDevis] = useState("");
  const [lignes, setLignes] = useState([ligneVide()]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, a] = await Promise.all([
        chargerAvecCache("fournisseurs-liste", () => supabase.from("fournisseurs").select("*").order("nom").limit(10000).then((r) => r.data)),
        chargerAvecCache("articles-liste-prix", () => supabase.from("articles").select("id, designation, unite_defaut, dernier_prix_ht, continue_par_id, endormi").limit(10000).then((r) => r.data)),
      ]);
      setFournisseurs(f || []);
      setArticlesBase(a || []);

      const resoudre = (article) => {
        let courant = article;
        const vus = new Set();
        while (courant?.continue_par_id && !vus.has(courant.id)) {
          vus.add(courant.id);
          const suivant = (a || []).find((x) => x.id === courant.continue_par_id);
          if (!suivant) break;
          courant = suivant;
        }
        return courant;
      };

      if (demandeId) {
        const [{ data: d }, { data: ld }] = await Promise.all([
          supabase.from("demandes").select("*").eq("id", demandeId).maybeSingle(),
          supabase.from("lignes_demande").select("*").eq("demande_id", demandeId).order("created_at"),
        ]);
        setDemande(d || null);
        if (ld && ld.length) {
          setLignes(ld.map((l) => {
            const artBrut = (a || []).find((x) => x.designation.toLowerCase() === l.designation.toLowerCase());
            const art = artBrut ? resoudre(artBrut) : null;
            return {
              key: l.id, ligne_demande_id: l.id, designation: art ? art.designation : l.designation, quantite: l.quantite, unite: art?.unite_defaut || l.unite,
              prix_unitaire_ht: art?.dernier_prix_ht || "", remise_pct: 0, date_livraison: l.date_livraison || "",
            };
          }));
        }
      }
    })();
  }, [demandeId]);

  const choisirFournisseur = (nom) => {
    const f = fournisseurs.find((x) => x.nom === nom);
    if (f) { setFournisseurChoisi(f); setAssujettiTva(f.tva_defaut_pct !== 0); }
  };

  const updateLigne = (key, field, val) => setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const addLigne = () => setLignes([...lignes, ligneVide()]);
  const removeLigne = (key) => setLignes(lignes.filter((l) => l.key !== key));

  // Suit la chaîne "continue par" jusqu'au dernier article en vigueur (protection anti-boucle)
  const resoudreSuccesseur = (article) => {
    let courant = article;
    const vus = new Set();
    while (courant?.continue_par_id && !vus.has(courant.id)) {
      vus.add(courant.id);
      const suivant = articlesBase.find((a) => a.id === courant.continue_par_id);
      if (!suivant) break;
      courant = suivant;
    }
    return courant;
  };

  const onDesignationChange = (key, val) => {
    const matchBrut = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (matchBrut) {
      const final = resoudreSuccesseur(matchBrut);
      updateLigne(key, "designation", final.designation);
      if (final.unite_defaut) updateLigne(key, "unite", final.unite_defaut);
      if (final.dernier_prix_ht) updateLigne(key, "prix_unitaire_ht", final.dernier_prix_ht);
      return;
    }
    updateLigne(key, "designation", val);
  };

  const onUniteBlur = async (designation, unite) => {
    const match = articlesBase.find((a) => a.designation.toLowerCase() === designation.toLowerCase());
    if (match && unite && unite !== match.unite_defaut) {
      await supabase.from("articles").update({ unite_defaut: unite }).eq("id", match.id);
      setArticlesBase((prev) => prev.map((a) => (a.id === match.id ? { ...a, unite_defaut: unite } : a)));
    }
  };

  const totaux = lignes.reduce(
    (acc, l) => {
      const m = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      return { ht: acc.ht + m };
    },
    { ht: 0 }
  );
  const tva = assujettiTva ? totaux.ht * 0.2 : 0;
  const ttc = totaux.ht + tva;

  const creer = async () => {
    if (!fournisseurChoisi) return;
    const lignesValides = lignes.filter((l) => l.designation.trim() && l.prix_unitaire_ht !== "");
    if (lignesValides.length === 0) return;
    setEnvoi(true);

    let montantHT = 0;
    const lignesBcPayload = [];
    let auMoinsUnBois = false;
    for (const l of lignesValides) {
      let article = articlesBase.find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
      if (!article) {
        const { data: nouvel } = await supabase.from("articles").insert({ designation: l.designation, unite_defaut: l.unite || "pcs", dernier_prix_ht: Number(l.prix_unitaire_ht) }).select().single();
        article = nouvel;
      }
      const m = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      montantHT += m;
      if (estBoisDeChauffage(l.designation)) auMoinsUnBois = true;
      lignesBcPayload.push({
        ligne_demande_id: l.ligne_demande_id, designation: l.designation, quantite: Number(l.quantite) || 1, unite: l.unite,
        prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0, remise_pct: Number(l.remise_pct) || 0, montant_ht: m,
        date_livraison: l.date_livraison || null,
      });
    }
    const tvaFinal = assujettiTva ? montantHT * 0.2 : 0;

    const { data: bc } = await supabase
      .from("commandes")
      .insert({
        demande_id: demandeId || null, fournisseur_id: fournisseurChoisi.id, fournisseur_nom: fournisseurChoisi.nom,
        assujetti_tva: assujettiTva, montant_ht: montantHT, montant_tva: tvaFinal, montant_ttc: montantHT + tvaFinal,
        reference_devis: referenceDevis.trim() || null,
      })
      .select()
      .single();

    if (bc) {
      const { data: lignesInserees } = await supabase.from("lignes_bc").insert(lignesBcPayload.map((l) => ({ ...l, bc_id: bc.id }))).select();
      if (demandeId) await supabase.from("demandes").update({ statut: "Basculée en commande" }).eq("id", demandeId);
      // Le bois de chauffage n'est jamais facturé par le fournisseur avant livraison :
      // toute ligne bois est donc automatiquement considérée comme totalement reçue.
      if (auMoinsUnBois && lignesInserees?.length) {
        const datesLivraison = lignesInserees.map((l) => l.date_livraison).filter(Boolean).sort();
        const dateReception = datesLivraison.length ? datesLivraison[datesLivraison.length - 1] : new Date().toISOString().slice(0, 10);
        const { data: reception } = await supabase.from("receptions").insert({
          bc_id: bc.id, statut: "Totale", date_reception_reelle: dateReception, receptionnaire: "Livraison directe (bois de chauffage)",
        }).select().single();
        if (reception) {
          await supabase.from("lignes_reception").insert(
            lignesInserees.map((l) => ({ reception_id: reception.id, ligne_bc_id: l.id, quantite_livree: l.quantite }))
          );
        }
      }
      router.push(`/commandes/${bc.id}`);
    }
    setEnvoi(false);
  };

  return (
    <AuthGuard>
      <button onClick={() => router.push(demandeId ? `/demandes/${demandeId}` : "/commandes")} style={{ ...linkBtn, marginBottom: 16 }}>&larr; {t("retour")}</button>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>{t("ncmd_titre")}</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        {demande ? (() => {
          const [avant, apres] = t("ncmd_depuis_demande", { numero: "§" }).split("§");
          return <>{avant}<strong>{demande.numero}</strong>{apres}</>;
        })() : t("ncmd_sans_demande")}
      </p>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{t("col_fournisseur")}</h2>
        {fournisseurChoisi ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong>{fournisseurChoisi.nom}</strong>
            <button onClick={() => setFournisseurChoisi(null)} style={linkBtn}>{t("btn_changer")}</button>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#666" }}>
              <input type="checkbox" checked={!assujettiTva} onChange={(e) => setAssujettiTva(!e.target.checked)} />
              {t("ncmd_non_taxable_check")}
            </label>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Autocomplete
              placeholder={t("ncmd_ph_fournisseur")}
              value={rechercheFournisseur}
              onChange={setRechercheFournisseur}
              onSelect={choisirFournisseur}
              suggestions={fournisseurs.map((f) => f.nom)}
              style={{ width: 320, maxWidth: "100%" }}
            />
            <button onClick={() => choisirFournisseur(fournisseurs.find((x) => x.nom.toLowerCase() === rechercheFournisseur.trim().toLowerCase())?.nom)} style={buttonStyle}>{t("btn_choisir")}</button>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{t("ncmd_h_reference")}</h2>
        <input
          placeholder={t("ncmd_ph_ref_devis")}
          value={referenceDevis}
          onChange={(e) => setReferenceDevis(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>{t("nav_articles")}</h2>
        {lignes.map((l) => {
          const bois = estBoisDeChauffage(l.designation);
          return (
          <div key={l.key} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {bois && (
              <input
                id={`date-livraison-${l.key}`}
                type="date"
                value={l.date_livraison}
                onChange={(e) => updateLigne(l.key, "date_livraison", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Tab" || e.shiftKey) return;
                  e.preventDefault();
                  document.getElementById(`quantite-${l.key}`)?.focus();
                  document.getElementById(`quantite-${l.key}`)?.select?.();
                }}
                title={t("ncmd_date_reelle_info")}
                style={{ ...inputStyle, width: 150 }}
              />
            )}
            <Autocomplete
              placeholder={t("ph_designation")}
              value={l.designation}
              onChange={(val) => onDesignationChange(l.key, val)}
              onSelect={(val) => {
                onDesignationChange(l.key, val);
                if (estBoisDeChauffage(val)) {
                  setTimeout(() => document.getElementById(`date-livraison-${l.key}`)?.focus(), 0);
                }
              }}
              suggestions={articlesBase.filter((a) => !a.continue_par_id && !a.endormi).map((a) => a.designation)}
              style={{ flex: 2, minWidth: 160 }}
            />
            <input id={`quantite-${l.key}`} type="number" placeholder={t("ph_qte")} value={l.quantite} onChange={(e) => updateLigne(l.key, "quantite", e.target.value)} style={{ ...inputStyle, width: 80 }} />
            <input placeholder={t("ph_unite")} value={l.unite} onChange={(e) => updateLigne(l.key, "unite", e.target.value)} onBlur={(e) => onUniteBlur(l.designation, e.target.value)} style={{ ...inputStyle, width: 80 }} />
            <ChampPrixHT value={l.prix_unitaire_ht} onChange={(v) => updateLigne(l.key, "prix_unitaire_ht", v)} tvaPct={assujettiTva ? 20 : 0} style={{ ...inputStyle, width: 110 }} />
            {l.prix_unitaire_ht !== "" && (
              <span style={{ fontSize: 11, color: "#888", alignSelf: "center", whiteSpace: "nowrap" }}>
                {Number(l.prix_unitaire_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar
              </span>
            )}
            <input type="number" placeholder={t("ph_remise")} value={l.remise_pct === 0 ? "" : l.remise_pct} onChange={(e) => updateLigne(l.key, "remise_pct", e.target.value)} style={{ ...inputStyle, width: 90 }} />
            <button onClick={() => removeLigne(l.key)} style={linkBtn}>{t("btn_retirer")}</button>
          </div>
          );
        })}
        <button onClick={addLigne} style={{ ...buttonStyle, background: "#888" }}>{t("btn_ajouter_ligne")}</button>

        <div style={{ marginTop: 16, fontSize: 13 }}>
          <div>{t("lbl_total_ht")} : <strong>{totaux.ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</strong></div>
          <div>{t("lbl_tva")} : {assujettiTva ? `${tva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : t("lbl_non_taxable")}</div>
          <div>{t("lbl_total_ttc")} : <strong>{ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</strong></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={creer} disabled={envoi || !fournisseurChoisi} style={buttonStyle}>
            {envoi ? t("ncmd_creation") : t("ncmd_btn_creer")}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}

