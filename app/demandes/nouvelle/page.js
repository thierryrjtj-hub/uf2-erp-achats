"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { chargerAvecCache } from "../../../lib/cache";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";
import { useLangue } from "../../../lib/i18n";

const ligneVide = () => ({ key: Math.random().toString(36).slice(2), designation: "", quantite: 1, unite: "pcs", date_livraison: "" });
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const estBoisDeChauffage = (designation) => {
  const d = (designation || "").toLowerCase();
  return d.includes("bois de chauffage") || d.includes("bois chauffage");
};

// Préfixe par défaut à partir du service (4 lettres, sans accents/espaces) — reste
// entièrement modifiable dans le champ N° DA, pour les abréviations internes
// spécifiques à un service (ex. MNTC pour Maintenance).
function prefixeParDefaut(service) {
  return (service || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 4).toUpperCase();
}

export default function NouvelleDemandePage() {
  const router = useRouter();
  const { t } = useLangue();
  const [articlesBase, setArticlesBase] = useState([]);
  const [service, setService] = useState("");
  const [demandeur, setDemandeur] = useState("");
  const [motif, setMotif] = useState("");
  const [priorite, setPriorite] = useState("Moyenne");
  const [dateDa, setDateDa] = useState(aujourdHui());
  const [numeroDa, setNumeroDa] = useState("");
  const [lignes, setLignes] = useState([ligneVide()]);
  const [envoi, setEnvoi] = useState(false);
  const [genererNumero, setGenererNumero] = useState(false);
  const [collageTexte, setCollageTexte] = useState("");
  const [collageOuvert, setCollageOuvert] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await chargerAvecCache("articles-liste", () =>
        supabase.from("articles").select("id, designation, unite_defaut, continue_par_id").limit(10000).then((r) => r.data)
      );
      setArticlesBase(data || []);
    })();
  }, []);

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

  // Si la désignation tapée correspond à un article existant, pré-remplit son unité
  // automatiquement — et si cet article a été remplacé ("continue par"), c'est
  // directement l'article de remplacement qui est utilisé.
  const onDesignationChange = (key, val) => {
    const matchBrut = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (matchBrut) {
      const final = resoudreSuccesseur(matchBrut);
      updateLigne(key, "designation", final.designation);
      if (final.unite_defaut) updateLigne(key, "unite", final.unite_defaut);
      return;
    }
    updateLigne(key, "designation", val);
  };

  // Si l'unité est modifiée à la main, on met aussi à jour la fiche article correspondante
  const onUniteBlur = async (key, designation, unite) => {
    const match = articlesBase.find((a) => a.designation.toLowerCase() === designation.toLowerCase());
    if (match && unite && unite !== match.unite_defaut) {
      await supabase.from("articles").update({ unite_defaut: unite }).eq("id", match.id);
      setArticlesBase((prev) => prev.map((a) => (a.id === match.id ? { ...a, unite_defaut: unite } : a)));
    }
  };

  const addLigne = () => setLignes([...lignes, ligneVide()]);
  const updateLigne = (key, field, val) => setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const removeLigne = (key) => setLignes(lignes.filter((l) => l.key !== key));

  // Colle plusieurs articles d'un coup (copiés depuis Excel par exemple) : une ligne
  // collée = un article. Colonnes séparées par tabulation : Désignation, puis
  // en option Quantité, puis en option Unité. Complète l'unité automatiquement
  // si l'article existe déjà et qu'aucune unité n'a été collée.
  const traiterCollage = () => {
    const rangees = collageTexte
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (rangees.length === 0) return;

    const nouvelles = rangees.map((rangee) => {
      const colonnes = rangee.split("\t").map((c) => c.trim());
      let designation = colonnes[0] || "";
      const quantite = colonnes[1] && !isNaN(Number(colonnes[1])) ? Number(colonnes[1]) : 1;
      let unite = colonnes[2] || "";
      const matchBrut = articlesBase.find((a) => a.designation.toLowerCase() === designation.toLowerCase());
      if (matchBrut) {
        const final = resoudreSuccesseur(matchBrut);
        designation = final.designation;
        if (!unite) unite = final.unite_defaut || "pcs";
      } else if (!unite) {
        unite = "pcs";
      }
      return { key: Math.random().toString(36).slice(2), designation, quantite, unite, date_livraison: "" };
    }).filter((l) => l.designation);

    setLignes((prev) => {
      const base = prev.length === 1 && !prev[0].designation.trim() ? [] : prev;
      return [...base, ...nouvelles];
    });
    setCollageTexte("");
    setCollageOuvert(false);
  };

  // Génère un numéro DA du type MNTC-0115-26 : préfixe déduit du service (modifiable),
  // compteur qui se souvient du dernier numéro par préfixe, remis à zéro chaque année.
  const genererNumeroDa = async () => {
    const prefixe = prefixeParDefaut(service);
    if (!prefixe) { alert(t("nd_alert_service")); return; }
    setGenererNumero(true);
    const annee = Number(new Date().getFullYear().toString().slice(-2));
    const { data: n } = await supabase.rpc("next_numero_da", { p_prefixe: prefixe, p_annee: annee });
    setGenererNumero(false);
    if (n != null) setNumeroDa(`${prefixe}-${String(n).padStart(4, "0")}-${annee}`);
  };

  const creer = async () => {
    const lignesValides = lignes.filter((l) => l.designation.trim());
    if (lignesValides.length === 0) return;

    let numeroDaFinal = numeroDa.trim();
    if (numeroDaFinal) {
      const { data: existant } = await supabase.from("demandes").select("id").ilike("numero_da", numeroDaFinal).maybeSingle();
      if (existant && !confirm(t("nd_confirm_da_existant", { numero: numeroDaFinal }))) return;
    } else {
      const prefixe = prefixeParDefaut(service);
      if (prefixe) {
        const annee = Number(new Date().getFullYear().toString().slice(-2));
        const { data: n } = await supabase.rpc("next_numero_da", { p_prefixe: prefixe, p_annee: annee });
        if (n != null) numeroDaFinal = `${prefixe}-${String(n).padStart(4, "0")}-${annee}`;
      }
    }

    setEnvoi(true);

    const { data: demande, error } = await supabase
      .from("demandes")
      .insert({ service, demandeur, motif_projet: motif, priorite, date_da: dateDa || null, numero_da: numeroDaFinal || null })
      .select()
      .single();

    if (error || !demande) {
      setEnvoi(false);
      return;
    }

    const payload = [];
    for (const l of lignesValides) {
      let article = articlesBase.find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
      if (!article) {
        const { data: nouvel } = await supabase
          .from("articles")
          .insert({ designation: l.designation, unite_defaut: l.unite || "pcs" })
          .select()
          .single();
        article = nouvel;
      }
      payload.push({
        demande_id: demande.id,
        article_id: article ? article.id : null,
        designation: l.designation,
        quantite: Number(l.quantite) || 1,
        unite: l.unite,
        date_livraison: l.date_livraison || null,
      });
    }
    await supabase.from("lignes_demande").insert(payload);

    router.push(`/demandes/${demande.id}`);
  };

  return (
    <AuthGuard>
      <h1 style={{ fontSize: 18, marginBottom: 14 }}>{t("nav_demandes_nouvelle")}</h1>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input placeholder={t("dem_h_service")} value={service} onChange={(e) => setService(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder={t("nd_ph_nom_demandeur")} value={demandeur} onChange={(e) => setDemandeur(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder={t("nd_ph_motif")} value={motif} onChange={(e) => setMotif(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)} style={inputStyle}>
            <option value="Haute">{t("prio_haute")}</option><option value="Moyenne">{t("prio_moyenne")}</option><option value="Basse">{t("prio_basse")}</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <div>
            <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>{t("nd_l_date_da")}</label>
            <input type="date" value={dateDa} onChange={(e) => setDateDa(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "#999", display: "block", marginBottom: 2 }}>{t("nd_l_numero_da")}</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input placeholder={t("nd_ph_ex_da")} value={numeroDa} onChange={(e) => setNumeroDa(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={genererNumeroDa} disabled={genererNumero} style={{ ...buttonStyle, background: "#888", whiteSpace: "nowrap" }}>
                {genererNumero ? "..." : t("nd_btn_generer")}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => setCollageOuvert((o) => !o)} style={{ ...buttonStyle, background: "#888" }}>
            {collageOuvert ? t("nd_btn_collage_ferme") : t("nd_btn_collage")}
          </button>
          {collageOuvert && (
            <div style={{ marginTop: 8, border: "1px solid #ECEBE6", borderRadius: 8, padding: 12, background: "#FAFAF8" }}>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                {t("nd_aide_collage")}
              </p>
              <textarea
                value={collageTexte}
                onChange={(e) => setCollageTexte(e.target.value)}
                placeholder={"COLLE DUNSON DJ64K - 23KG\t3\tseau\nRAME PAPIER A4\t10"}
                rows={5}
                style={{ ...inputStyle, width: "100%", fontFamily: "inherit", resize: "vertical" }}
              />
              <button type="button" onClick={traiterCollage} style={{ ...buttonStyle, marginTop: 8 }}>{t("nd_btn_repartir")}</button>
            </div>
          )}
        </div>

        {lignes.map((l) => (
          <div key={l.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {estBoisDeChauffage(l.designation) && (
              <input
                type="date"
                value={l.date_livraison || ""}
                onChange={(e) => updateLigne(l.key, "date_livraison", e.target.value)}
                title={t("ncmd_date_reelle_info")}
                style={{ ...inputStyle, width: 150 }}
              />
            )}
            <Autocomplete
              placeholder={t("nd_ph_designation")}
              value={l.designation}
              onChange={(val) => onDesignationChange(l.key, val)}
              suggestions={articlesBase.filter((a) => !a.continue_par_id).map((a) => a.designation)}
              style={{ flex: 3 }}
            />
            <input type="number" min="0" value={l.quantite} onChange={(e) => updateLigne(l.key, "quantite", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input
              placeholder={t("ph_unite")}
              value={l.unite}
              onChange={(e) => updateLigne(l.key, "unite", e.target.value)}
              onBlur={(e) => onUniteBlur(l.key, l.designation, e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => removeLigne(l.key)} style={linkBtn}>{t("btn_retirer")}</button>
          </div>
        ))}
        <button onClick={addLigne} style={{ ...buttonStyle, background: "#888", marginTop: 4 }}>{t("btn_ajouter_ligne")}</button>

        <div style={{ marginTop: 16 }}>
          <button onClick={creer} disabled={envoi} style={buttonStyle}>
            {envoi ? t("ncmd_creation") : t("nd_btn_creer")}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
