"use client";
import { useEffect, useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { chargerAvecCache } from "../../../lib/cache";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import ChampPrixHT from "../../components/ChampPrixHT";
import CadreExtensible from "../../components/CadreExtensible";
import { inputStyle, buttonStyle, thStyle, tdStyle, linkBtn } from "../../components/ui";
import { formatDate } from "../../../lib/format";
import { useRole } from "../../../lib/useRole";
import { useUserId } from "../../../lib/useUserId";
import BandeauLectureSeule from "../../components/BandeauLectureSeule";

function computeTotal(lignesOffre, lignesDemande, assujettiTva) {
  let totalHT = 0;
  for (const ld of lignesDemande) {
    const lo = lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) continue;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    totalHT += qte * pu * (1 - remise / 100);
  }
  const tva = assujettiTva ? totalHT * 0.2 : 0;
  return { totalHT, tva, totalTTC: totalHT + tva };
}

function remiseObtenueOffre(o, lignesDemande) {
  let total = 0;
  for (const ld of lignesDemande) {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) continue;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    total += qte * pu * (remise / 100);
  }
  return total;
}

function remiseExceptionsOffre(o, lignesDemande, fournisseursDetailMap) {
  const defaut = fournisseursDetailMap[o.fournisseur_id]?.remise_par_defaut_pct;
  if (defaut === null || defaut === undefined) return [];
  const out = [];
  lignesDemande.forEach((ld, i) => {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) return;
    const remise = Number(lo.remise_pct) || 0;
    if (remise !== Number(defaut)) {
      out.push({ numero: i + 1, designation: ld.designation, remise, defaut: Number(defaut) });
    }
  });
  return out;
}

function joinFrench(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return String(arr[0]);
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

function truncateTexte(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const FOURNISSEURS_PAR_PAGE = 4;

export default function TCODetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const role = useRole();
  const userId = useUserId();
  const [nomCreateurDemande, setNomCreateurDemande] = useState("");
  const [demande, setDemande] = useState(null);
  const [lignesDemande, setLignesDemande] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [offres, setOffres] = useState([]);
  const [lignesOffre, setLignesOffre] = useState([]);
  const [dejaCouvertes, setDejaCouvertes] = useState(new Set());
  const [bcGeneres, setBcGeneres] = useState([]);
  const [notesTco, setNotesTco] = useState({ remarque: "" });
  const [orientationManuelle, setOrientationManuelle] = useState("");
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({});
  const [generating, setGenerating] = useState(false);
  const [modeImpression, setModeImpression] = useState("comparatif");
  const [sauvegardesPrixEnCours, setSauvegardesPrixEnCours] = useState(0);
  const [rechercheFournisseur, setRechercheFournisseur] = useState("");
  const [emetteur, setEmetteur] = useState({ nom: "Judicaël RANDRIANAIVO", fonction: "Buyer" });

  const charger = async () => {
    const { data: d } = await supabase.from("demandes").select("*").eq("id", id).single();
    const { data: ld } = await supabase.from("lignes_demande").select("*").eq("demande_id", id).order("created_at");
    const { data: f } = await supabase.from("fournisseurs").select("*").order("nom").limit(10000);
    const { data: o } = await supabase.from("offres").select("*").eq("demande_id", id);
    const { data: art } = await supabase.from("articles").select("id, designation, unite_defaut, continue_par_id").limit(10000);
    let lo = [];
    if (o && o.length) {
      const { data } = await supabase.from("lignes_offre").select("*").in("offre_id", o.map((x) => x.id));
      lo = data || [];
    }
    setDemande(d);
    if (d?.created_by) {
      const { data: profilCreateur } = await supabase.from("profiles").select("nom").eq("id", d.created_by).maybeSingle();
      setNomCreateurDemande(profilCreateur?.nom || "");
    } else {
      setNomCreateurDemande("");
    }
    setNotesTco({ remarque: d?.tco_remarque || "" });
    setLignesDemande(ld || []);
    setArticlesBase(art || []);
    setFournisseurs(f || []);
    setOffres(o || []);
    setLignesOffre(lo);
    if (ld && ld.length) {
      const { data: dejaBc } = await supabase.from("lignes_bc").select("ligne_demande_id").in("ligne_demande_id", ld.map((x) => x.id));
      setDejaCouvertes(new Set((dejaBc || []).map((x) => x.ligne_demande_id)));
    } else {
      setDejaCouvertes(new Set());
    }
    const { data: bcs } = await supabase.from("commandes").select("id, numero, fournisseur_nom, statut").eq("demande_id", id);
    setBcGeneres(bcs || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { data: p } = await supabase.from("profiles").select("nom, role").eq("id", userData.user.id).maybeSingle();
      const fonctions = { acheteur: "Buyer", direction: "Direction", invite: "Invité" };
      setEmetteur({ nom: p?.nom || userData.user.email, fonction: fonctions[p?.role] || "Buyer" });
    })();
  }, []);

  const fournisseursDetailMap = useMemo(() => {
    const map = {};
    fournisseurs.forEach((f) => { map[f.id] = f; });
    return map;
  }, [fournisseurs]);

  const offresAvecTotaux = useMemo(() => {
    return offres.map((o) => {
      const lo = lignesOffre.filter((x) => x.offre_id === o.id);
      return { ...o, lignesOffre: lo, ...computeTotal(lo, lignesDemande, o.assujetti_tva !== false) };
    });
  }, [offres, lignesOffre, lignesDemande]);

  const montantLigne = (o, ld) => {
    const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
    if (!lo || !lo.prix_unitaire_ht) return null;
    const pu = Number(lo.prix_unitaire_ht) || 0;
    const remise = Number(lo.remise_pct) || 0;
    const qte = Number(ld.quantite) || 0;
    return qte * pu * (1 - remise / 100);
  };

  const moinsCherParLigne = useMemo(() => {
    const map = {};
    for (const ld of lignesDemande) {
      const candidats = offresAvecTotaux.filter((o) => montantLigne(o, ld) != null);
      if (candidats.length) {
        const meilleur = candidats.reduce((a, b) => (montantLigne(b, ld) < montantLigne(a, ld) ? b : a));
        map[ld.id] = meilleur.id;
      }
    }
    return map;
  }, [offresAvecTotaux, lignesDemande]);

  const etiquetteParOffre = useMemo(() => {
    const map = {};
    offresAvecTotaux.forEach((o) => {
      const numeros = [];
      lignesDemande.forEach((ld, i) => {
        if (moinsCherParLigne[ld.id] === o.id) numeros.push(i + 1);
      });
      if (numeros.length === 0) { map[o.id] = null; return; }
      if (numeros.length === lignesDemande.length) { map[o.id] = "moins cher"; return; }
      map[o.id] = `moins cher — article n°${numeros.join(", n°")}`;
    });
    return map;
  }, [offresAvecTotaux, lignesDemande, moinsCherParLigne]);

  const totalPreconisation = useMemo(() => {
    let ht = 0, tva = 0;
    for (const ld of lignesDemande) {
      const offreId = selection[ld.id];
      const offre = offresAvecTotaux.find((o) => o.id === offreId);
      if (offre) {
        const m = montantLigne(offre, ld);
        if (m != null) {
          ht += m;
          tva += offre.assujetti_tva !== false ? m * 0.2 : 0;
        }
      }
    }
    return { ht, tva, ttc: ht + tva };
  }, [selection, offresAvecTotaux, lignesDemande]);

  useEffect(() => {
    setSelection((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const ld of lignesDemande) {
        const valide = next[ld.id] && offresAvecTotaux.some((o) => o.id === next[ld.id] && montantLigne(o, ld) != null);
        if (!valide) {
          if (moinsCherParLigne[ld.id]) {
            next[ld.id] = moinsCherParLigne[ld.id];
            changed = true;
          } else if (next[ld.id]) {
            delete next[ld.id];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [offresAvecTotaux, lignesDemande, moinsCherParLigne]);

  const ajouterFournisseur = async (fournisseurId) => {
    const f = fournisseurs.find((x) => x.id === fournisseurId);
    if (!f) return;
    const { data: offre } = await supabase
      .from("offres")
      .insert({ demande_id: id, fournisseur_id: f.id, fournisseur_nom: f.nom, assujetti_tva: f.tva_defaut_pct !== 0, date_devis: new Date().toISOString().slice(0, 10) })
      .select()
      .single();
    if (offre) {
      const designations = lignesDemande.map((ld) => ld.designation);
      let derniersPrix = {};
      if (designations.length) {
        const { data: histBc } = await supabase
          .from("lignes_bc")
          .select("designation, prix_unitaire_ht, remise_pct, commandes:bc_id(fournisseur_id, date)")
          .in("designation", designations);
        (histBc || [])
          .filter((h) => h.commandes && h.commandes.fournisseur_id === f.id)
          .sort((a, b) => new Date(a.commandes.date) - new Date(b.commandes.date))
          .forEach((h) => { derniersPrix[h.designation.toLowerCase()] = h; });
      }
      const payload = lignesDemande.map((ld) => {
        const hist = derniersPrix[ld.designation.toLowerCase()];
        return {
          offre_id: offre.id,
          ligne_demande_id: ld.id,
          prix_unitaire_ht: hist ? hist.prix_unitaire_ht : null,
          remise_pct: hist ? hist.remise_pct : (f.remise_par_defaut_pct || 0),
        };
      });
      if (payload.length) await supabase.from("lignes_offre").insert(payload);
    }
    charger();
  };

  const retirerOffre = async (offreId) => {
    await supabase.from("offres").delete().eq("id", offreId);
    charger();
  };

  const toggleTva = async (offreId, valeurActuelle) => {
    const nouvelle = !(valeurActuelle !== false);
    setOffres((prev) => prev.map((o) => (o.id === offreId ? { ...o, assujetti_tva: nouvelle } : o)));
    await supabase.from("offres").update({ assujetti_tva: nouvelle }).eq("id", offreId);
  };

  const majOffre = async (offreId, champ, valeur) => {
    setOffres((prev) => prev.map((o) => (o.id === offreId ? { ...o, [champ]: valeur } : o)));
    await supabase.from("offres").update({ [champ]: valeur || null }).eq("id", offreId);
  };

  const enregistrerNotesTco = async () => {
    await supabase.from("demandes").update({
      tco_remarque: notesTco.remarque || null,
    }).eq("id", id);
  };

  const lectureSeule = !!(role && role !== "acheteur" && demande?.created_by && demande.created_by !== userId);

  const majDemande = async (champs) => {
    if (lectureSeule) return;
    setDemande((prev) => (prev ? { ...prev, ...champs } : prev));
    await supabase.from("demandes").update(champs).eq("id", id);
  };

  const majPrix = async (offreId, ligneDemandeId, field, value) => {
    setSauvegardesPrixEnCours((n) => n + 1);
    try {
      const existante = lignesOffre.find((x) => x.offre_id === offreId && x.ligne_demande_id === ligneDemandeId);
      const payload = { [field]: value === "" ? null : Number(value) };
      if (existante) {
        setLignesOffre((prev) =>
          prev.map((x) => (x.offre_id === offreId && x.ligne_demande_id === ligneDemandeId ? { ...x, [field]: value } : x))
        );
        await supabase.from("lignes_offre").update(payload).eq("id", existante.id);
      } else {
        // Aucune ligne d'offre pour ce couple fournisseur/article pour l'instant :
        // on la crée, sinon la saisie (calculette comprise) était silencieusement perdue.
        const { data: nouvelle } = await supabase.from("lignes_offre").insert({ offre_id: offreId, ligne_demande_id: ligneDemandeId, ...payload }).select().single();
        if (nouvelle) setLignesOffre((prev) => [...prev, nouvelle]);
      }
      if (field === "prix_unitaire_ht" && value !== "") {
        const ld = lignesDemande.find((l) => l.id === ligneDemandeId);
        if (ld) await supabase.from("articles").update({ dernier_prix_ht: Number(value) }).ilike("designation", ld.designation);
      }
    } finally {
      // Petit délai avant de rouvrir "Générer les BC"/impression : le temps que
      // le calcul du moins cher se rafraîchisse bien à l'écran avant de s'y fier.
      setTimeout(() => setSauvegardesPrixEnCours((n) => Math.max(0, n - 1)), 600);
    }
  };

  const majLigneDemande = async (ligneId, field, value) => {
    if (lectureSeule) return;
    setLignesDemande((prev) => prev.map((l) => (l.id === ligneId ? { ...l, [field]: value } : l)));
    const payload = field === "quantite" ? { quantite: Number(value) || 0 } : { [field]: value };
    await supabase.from("lignes_demande").update(payload).eq("id", ligneId);
  };

  const onDesignationLigneChange = (ligneId, val) => {
    const matchBrut = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (matchBrut) {
      const final = resoudreSuccesseurArticle(matchBrut);
      majLigneDemande(ligneId, "designation", final.designation);
      if (final.unite_defaut) majLigneDemande(ligneId, "unite", final.unite_defaut);
      return;
    }
    majLigneDemande(ligneId, "designation", val);
  };

  // Suit la chaîne "continue par" jusqu'au dernier article en vigueur (protection anti-boucle)
  const resoudreSuccesseurArticle = (article) => {
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

  const onUniteLigneBlur = async (designation, unite) => {
    const match = articlesBase.find((a) => a.designation.toLowerCase() === (designation || "").toLowerCase());
    if (match && unite && unite !== match.unite_defaut) {
      await supabase.from("articles").update({ unite_defaut: unite }).eq("id", match.id);
      setArticlesBase((prev) => prev.map((a) => (a.id === match.id ? { ...a, unite_defaut: unite } : a)));
    }
  };

  const supprimerLigneDemande = async (ligne) => {
    if (lectureSeule) return;
    if (!confirm(`Retirer "${ligne.designation}" de la demande ?`)) return;
    await supabase.from("lignes_offre").delete().eq("ligne_demande_id", ligne.id);
    await supabase.from("lignes_demande").delete().eq("id", ligne.id);
    setLignesDemande((prev) => prev.filter((l) => l.id !== ligne.id));
    setLignesOffre((prev) => prev.filter((x) => x.ligne_demande_id !== ligne.id));
  };

  const ajouterLigneDemande = async () => {
    if (lectureSeule) return;
    const { data, error } = await supabase
      .from("lignes_demande")
      .insert({ demande_id: id, designation: "", quantite: 1, unite: "pcs" })
      .select()
      .single();
    if (!error && data) setLignesDemande((prev) => [...prev, data]);
  };

  const genererBC = async () => {
    const groupes = {};
    for (const ld of lignesDemande) {
      if (dejaCouvertes.has(ld.id)) continue;
      const offreId = selection[ld.id];
      if (!offreId) continue;
      if (!groupes[offreId]) groupes[offreId] = [];
      groupes[offreId].push(ld);
    }
    if (Object.keys(groupes).length === 0) return;
    setGenerating(true);

    const lignesReellementCouvertes = new Set();
    const echecs = [];

    for (const [offreId, lignes] of Object.entries(groupes)) {
      const offre = offresAvecTotaux.find((o) => o.id === offreId);
      if (!offre) continue;
      let montantHT = 0;
      const lignesBcPayload = [];
      for (const ld of lignes) {
        const m = montantLigne(offre, ld);
        if (m == null) continue;
        const lo = offre.lignesOffre.find((x) => x.ligne_demande_id === ld.id);
        montantHT += m;
        lignesBcPayload.push({
          ligne_demande_id: ld.id,
          designation: ld.designation,
          quantite: ld.quantite,
          unite: ld.unite,
          prix_unitaire_ht: Number(lo.prix_unitaire_ht) || 0,
          remise_pct: Number(lo.remise_pct) || 0,
          montant_ht: m,
        });
      }
      if (lignesBcPayload.length === 0) continue;

      const assujetti = offre.assujetti_tva !== false;
      const tva = assujetti ? montantHT * 0.2 : 0;

      const { data: bc, error: erreurBc } = await supabase
        .from("commandes")
        .insert({
          demande_id: id,
          fournisseur_id: offre.fournisseur_id,
          fournisseur_nom: offre.fournisseur_nom,
          assujetti_tva: assujetti,
          montant_ht: montantHT,
          montant_tva: tva,
          montant_ttc: montantHT + tva,
        })
        .select()
        .single();

      // Une ligne n'est marquée "couverte" que si le BC ET ses lignes ont
      // réellement été créés avec succès — sinon elle reste disponible pour
      // une nouvelle tentative de génération au lieu d'être bloquée à tort.
      if (bc) {
        const { error: erreurLignes } = await supabase.from("lignes_bc").insert(lignesBcPayload.map((l) => ({ ...l, bc_id: bc.id })));
        if (!erreurLignes) {
          lignes.forEach((ld) => lignesReellementCouvertes.add(ld.id));
        } else {
          echecs.push(offre.fournisseur_nom);
        }
      } else {
        echecs.push(offre.fournisseur_nom);
      }
    }

    const restants = lignesDemande.filter((ld) => !dejaCouvertes.has(ld.id) && !lignesReellementCouvertes.has(ld.id));

    // Parmi les lignes restantes, celles sans aucun prix renseigné par aucun
    // fournisseur (comme un "commande arrêtée" sur ces articles précis) sont
    // transférées automatiquement vers une nouvelle demande dédiée, pour
    // pouvoir les rechercher ailleurs ou aviser les demandeurs de leur
    // indisponibilité — au lieu de rester bloquées dans le TCO déjà généré.
    const restantsSansPrix = restants.filter((ld) => !offresAvecTotaux.some((o) => montantLigne(o, ld) != null));
    let statutFinal = restants.length === 0 ? "Basculée en commande" : "Partiellement traitée";

    if (restantsSansPrix.length > 0) {
      const { data: nouvelleDemandeReliquat } = await supabase.from("demandes").insert({
        demandeur: demande.demandeur, service: demande.service,
        motif_projet: `Reliquat sans prix — ${demande.numero} — ${demande.motif_projet || ""}`,
        observation: `Article(s) sans aucun prix renseigné par un fournisseur lors du comparatif de ${demande.numero}`,
        statut: "A faire", created_by: demande.created_by,
      }).select().single();
      if (nouvelleDemandeReliquat) {
        for (const ld of restantsSansPrix) {
          await supabase.from("lignes_demande").update({
            demande_id: nouvelleDemandeReliquat.id, non_disponible_localement: true,
          }).eq("id", ld.id);
        }
        const restantsAvecPrix = restants.filter((ld) => !restantsSansPrix.some((r) => r.id === ld.id));
        statutFinal = restantsAvecPrix.length === 0 ? "Basculée en commande" : "Partiellement traitée";
      }
    }

    await supabase.from("demandes").update({ statut: statutFinal }).eq("id", id);
    setGenerating(false);
    if (echecs.length > 0 || restantsSansPrix.length > 0) {
      const morceaux = [];
      if (echecs.length > 0) morceaux.push(`le BC n'a pas pu être créé pour ${echecs.join(", ")} — les lignes correspondantes restent disponibles pour une nouvelle tentative`);
      if (restantsSansPrix.length > 0) morceaux.push(`${restantsSansPrix.length} article(s) sans aucun prix ont été transférés vers une nouvelle demande dédiée (à rechercher ailleurs ou à signaler aux demandeurs)`);
      alert(`Attention : ${morceaux.join(" ; ")}.`);
      charger();
    } else {
      router.push("/commandes");
    }
  };

  const marquerNonDisponible = async (ligne) => {
    const observation = `À rechercher à l'import — ${ligne.designation}`;
    if (lignesDemande.length <= 1) {
      await supabase.from("lignes_demande").update({ non_disponible_localement: true }).eq("id", ligne.id);
      await supabase.from("demandes").update({ statut: "Clôturée", observation }).eq("id", id);
    } else {
      const { data: nouvelleDemande } = await supabase.from("demandes").insert({
        service: demande.service, demandeur: demande.demandeur, priorite: demande.priorite,
        statut: "Clôturée", observation,
      }).select().single();
      if (nouvelleDemande) {
        await supabase.from("lignes_demande").update({
          demande_id: nouvelleDemande.id, non_disponible_localement: true,
        }).eq("id", ligne.id);
      }
    }
    charger();
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!demande) return <AuthGuard><p>Demande introuvable.</p></AuthGuard>;

  const pagesImpression = [];
  for (let i = 0; i < offresAvecTotaux.length; i += FOURNISSEURS_PAR_PAGE) {
    pagesImpression.push(offresAvecTotaux.slice(i, i + FOURNISSEURS_PAR_PAGE));
  }
  // Orientation automatique du TCO à l'impression : portrait si 2 fournisseurs
  // ou moins, paysage au-delà — reste modifiable manuellement via le menu à
  // côté du bouton "Imprimer le comparatif" si besoin.
  const orientation = orientationManuelle || (offresAvecTotaux.length > 2 ? "landscape" : "portrait");
  const nbLignesTco = lignesDemande.length;
  const dense = nbLignesTco > 10;
  const cozy = nbLignesTco <= 3;
  // Resserrement plus agressif par paliers, pour que le tableau + le bloc
  // totaux + la zone de signature tiennent toujours sur une seule page,
  // même à 16 lignes et jusqu'à 4 fournisseurs.
  const tailleTexteTco = nbLignesTco > 14 ? 7.5 : nbLignesTco > 10 ? 8.5 : 10.5;
  const padCellule = nbLignesTco > 14 ? "1px 3px" : nbLignesTco > 10 ? "1.5px 3px" : cozy ? "7px 4px" : "4px 4px";
  const tdTco = { padding: padCellule, fontSize: tailleTexteTco, borderBottom: "1px solid #1a1a1a" };

  return (
    <AuthGuard>
      <style>{`
        @page { size: A4 ${orientation}; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          .nav-sidebar { display: none !important; }
          .content-pane { max-width: none !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .page-impression { page-break-after: always; }
          .page-impression:last-child { page-break-after: auto; }
          tr, td, th { break-inside: avoid; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
        .tco-imprimable { display: none; }
        @media print { .tco-imprimable { display: block; } }
      `}</style>

      <div className="no-print">
      <button onClick={() => router.back()} style={{ ...linkBtn, marginBottom: 16 }}>&larr; Retour</button>

      {role && role !== "acheteur" && demande?.created_by && demande.created_by !== userId && (
        <BandeauLectureSeule nomCreateur={nomCreateurDemande} />
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: "100%" }}>
            <h1 style={{ fontSize: 18, marginBottom: 4 }}>{demande.numero}</h1>
            {demande.numero_tco && <p style={{ fontSize: 12, color: "#1B7A4C", marginBottom: 12 }}>N° {demande.numero_tco}</p>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ width: 150 }}>
                <div style={lblStyle}>Date DA</div>
                <input
                  type="date"
                  defaultValue={demande.date_da ? demande.date_da.slice(0, 10) : ""}
                  disabled={lectureSeule}
                  onBlur={(e) => majDemande({ date_da: e.target.value || null })}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ width: 170 }}>
                <div style={lblStyle}>N° DA</div>
                <input
                  defaultValue={demande.numero_da || ""}
                  disabled={lectureSeule}
                  onBlur={(e) => majDemande({ numero_da: e.target.value.trim() || null })}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={lblStyle}>Service demandeur</div>
                <input
                  defaultValue={demande.service || ""}
                  disabled={lectureSeule}
                  onBlur={(e) => majDemande({ service: e.target.value.trim() || null })}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={lblStyle}>Nom demandeur</div>
                <input
                  defaultValue={demande.demandeur || ""}
                  disabled={lectureSeule}
                  onBlur={(e) => majDemande({ demandeur: e.target.value.trim() || null })}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ width: 140 }}>
                <div style={lblStyle}>Priorité</div>
                <select
                  defaultValue={demande.priorite || "Moyenne"}
                  disabled={lectureSeule}
                  onChange={(e) => majDemande({ priorite: e.target.value })}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="Basse">Basse</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Haute">Haute</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={lblStyle}>Motif de la demande</div>
              <input
                defaultValue={demande.motif_projet || ""}
                disabled={lectureSeule}
                onBlur={(e) => majDemande({ motif_projet: e.target.value.trim() || null })}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={lblStyle}>Observation</div>
              <textarea
                defaultValue={demande.observation || ""}
                disabled={lectureSeule}
                onBlur={(e) => majDemande({ observation: e.target.value.trim() || null })}
                rows={2}
                style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit" }}
              />
              {demande.observation && !demande.demandeur_avise && (
                <button
                  onClick={async () => { await supabase.from("demandes").update({ demandeur_avise: true }).eq("id", id); charger(); }}
                  style={{ ...linkBtn, marginTop: 6, color: "#B3261E" }}
                >
                  Marquer le demandeur avisé
                </button>
              )}
              {demande.observation && demande.demandeur_avise && <p style={{ marginTop: 6, color: "#1B7A4C", fontSize: 12.5 }}>✓ Demandeur avisé</p>}
            </div>
            {bcGeneres.length > 0 && (
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>Bon(s) de commande généré(s) :</strong>{" "}
                {bcGeneres.map((bc, i) => (
                  <span key={bc.id}>
                    {i > 0 && ", "}
                    <Link href={`/commandes/${bc.id}`} style={{ color: "#1E3A34", textDecoration: "underline" }}>{bc.numero}</Link> ({bc.fournisseur_nom})
                  </span>
                ))}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { setModeImpression("demande"); setTimeout(() => window.print(), 60); }} style={buttonStyle}>Imprimer la demande</button>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>N°</th>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté</th>
              <th style={thStyle}>Unité</th>
              <th style={thStyle}>Non dispo. localement</th>
              {!lectureSeule && <th style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {lignesDemande.map((l, i) => (
              <tr key={l.id}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>
                  {lectureSeule ? (
                    <>
                      {l.designation}
                      {l.non_disponible_localement && <span style={{ marginLeft: 8, fontSize: 11, color: "#B3261E" }}>— à rechercher à l'import</span>}
                    </>
                  ) : (
                    <Autocomplete
                      value={l.designation}
                      onChange={(val) => onDesignationLigneChange(l.id, val)}
                      suggestions={articlesBase.filter((a) => !a.continue_par_id).map((a) => a.designation)}
                      style={{ width: "100%" }}
                    />
                  )}
                </td>
                <td style={tdStyle}>
                  {lectureSeule ? l.quantite.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (
                    <input
                      type="number" min="0" defaultValue={l.quantite}
                      onBlur={(e) => majLigneDemande(l.id, "quantite", e.target.value)}
                      style={{ ...inputStyle, width: 80 }}
                    />
                  )}
                </td>
                <td style={tdStyle}>
                  {lectureSeule ? l.unite : (
                    <input
                      defaultValue={l.unite}
                      onBlur={(e) => { majLigneDemande(l.id, "unite", e.target.value); onUniteLigneBlur(l.designation, e.target.value); }}
                      style={{ ...inputStyle, width: 90 }}
                    />
                  )}
                </td>
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    checked={!!l.non_disponible_localement}
                    disabled={lectureSeule}
                    onChange={(e) => { if (e.target.checked) marquerNonDisponible(l); }}
                  />
                </td>
                {!lectureSeule && (
                  <td style={tdStyle}>
                    <button onClick={() => supprimerLigneDemande(l)} style={{ ...linkBtn, color: "#B3261E" }}>Retirer</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!lectureSeule && (
          <button onClick={ajouterLigneDemande} style={{ ...buttonStyle, marginTop: 10 }}>+ Ajouter un article</button>
        )}
      </div>

      <CadreExtensible titre="Tableau comparatif (TCO)" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15 }}>Tableau comparatif (TCO)</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={orientationManuelle}
              onChange={(e) => setOrientationManuelle(e.target.value)}
              style={inputStyle}
              title="Par défaut automatique (portrait ≤2 fournisseurs, paysage au-delà) — modifiable ici si besoin"
            >
              <option value="">Orientation auto ({offresAvecTotaux.length > 2 ? "paysage" : "portrait"})</option>
              <option value="portrait">Forcer portrait</option>
              <option value="landscape">Forcer paysage</option>
            </select>
            <button onClick={() => { setModeImpression("comparatif"); setTimeout(() => window.print(), 60); }} disabled={sauvegardesPrixEnCours > 0} style={buttonStyle}>
              {sauvegardesPrixEnCours > 0 ? "Enregistrement des prix..." : "Imprimer le comparatif"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Autocomplete
            placeholder="Taper le nom du fournisseur à comparer..."
            value={rechercheFournisseur}
            onChange={setRechercheFournisseur}
            onSelect={(nom) => {
              const f = fournisseurs.find((x) => x.nom === nom);
              if (f) { ajouterFournisseur(f.id); setRechercheFournisseur(""); }
            }}
            suggestions={fournisseurs.filter((f) => !offres.some((o) => o.fournisseur_id === f.id)).map((f) => f.nom)}
            style={{ width: 320, maxWidth: "100%" }}
          />
          <button
            onClick={() => {
              const f = fournisseurs.find((x) => x.nom.toLowerCase() === rechercheFournisseur.trim().toLowerCase());
              if (f) { ajouterFournisseur(f.id); setRechercheFournisseur(""); }
            }}
            style={buttonStyle}
          >
            + Ajouter
          </button>
        </div>

        {offresAvecTotaux.length === 0 && (
          <div className="no-print" style={{ background: "#F5F4F1", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>Comment veux-tu traiter cette demande ?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ ...buttonStyle, opacity: 0.6, cursor: "default" }}>↓ Comparer des fournisseurs (TCO) — ajoute-en un ci-dessous</span>
              <button onClick={() => router.push(`/commandes/nouveau?demande_id=${id}`)} style={{ ...buttonStyle, background: "#888" }}>
                Créer le BC directement (sans comparatif)
              </button>
            </div>
          </div>
        )}
        {offresAvecTotaux.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Ajoute au moins un fournisseur pour saisir ses prix.</p>}

        {offresAvecTotaux.length > 0 && (
          <div className="ecran-seulement">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>N°</th>
                  <th style={thStyle}>Article</th>
                  <th style={thStyle}>Qté</th>
                  <th style={thStyle}>Unité</th>
                  <th style={{ ...thStyle, color: "#1B7A4C" }}>Préconisation</th>
                  {offresAvecTotaux.map((o, oi) => (
                    <th key={o.id} style={{ ...thStyle, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.fournisseur_nom}
                      {etiquetteParOffre[o.id] && <span style={{ fontSize: 11, color: "#1B7A4C" }}> — {etiquetteParOffre[o.id]}</span>}
                      <button onClick={() => retirerOffre(o.id)} style={{ ...linkBtn, marginLeft: 8 }}>x</button>
                      <div style={{ display: "flex", gap: 4, fontWeight: 400, color: "#aaa", fontSize: 11, marginTop: 4 }}>
                        <span style={{ width: 30 }}></span>
                        <span style={{ width: 80 }}>Prix unitaire HT</span>
                        <span style={{ width: 65 }}>Remise %</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, color: "#666", fontSize: 11, marginTop: 6 }}>
                        <input type="checkbox" checked={o.assujetti_tva === false} onChange={() => toggleTva(o.id, o.assujetti_tva)} />
                        Fournisseur non taxable
                      </label>
                      <div className="no-print" style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <input
                          id={`numero-devis-${oi}`}
                          placeholder="N° devis"
                          defaultValue={o.numero_devis || ""}
                          onBlur={(e) => majOffre(o.id, "numero_devis", e.target.value)}
                          style={{ ...inputStyle, width: 70, fontWeight: 400, fontSize: 11, padding: "4px 6px" }}
                        />
                        <input
                          type="date"
                          defaultValue={o.date_devis || ""}
                          onBlur={(e) => majOffre(o.id, "date_devis", e.target.value)}
                          style={{ ...inputStyle, width: 100, fontWeight: 400, fontSize: 11, padding: "4px 6px" }}
                        />
                      </div>
                      <textarea
                        className="no-print"
                        data-casse-normale placeholder="Observation (dispo, conditions, précision article...)"
                        defaultValue={o.observation || ""}
                        onBlur={(e) => majOffre(o.id, "observation", e.target.value)}
                        style={{ ...inputStyle, width: "100%", minHeight: 30, fontWeight: 400, fontSize: 11, marginTop: 6, resize: "vertical" }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignesDemande.map((ld, i) => {
                  const offreRetenue = offresAvecTotaux.find((o) => o.id === selection[ld.id]);
                  const montantRetenu = offreRetenue ? montantLigne(offreRetenue, ld) : null;
                  const couverte = dejaCouvertes.has(ld.id);
                  return (
                    <tr key={ld.id} style={couverte ? { opacity: 0.55 } : {}}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>
                        {ld.designation}
                        {couverte && <span style={{ marginLeft: 6, fontSize: 11, color: "#1B7A4C" }}>✓ BC déjà généré</span>}
                      </td>
                      <td style={tdStyle}>{ld.quantite.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={tdStyle}>{ld.unite}</td>
                      <td style={{ ...tdStyle, background: "#EAF7EE", fontSize: 12 }}>
                        {offreRetenue ? (
                          <>
                            <strong>{offreRetenue.fournisseur_nom}</strong><br />
                            {montantRetenu != null ? (
                              <>HT {montantRetenu.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</>
                            ) : "-"}
                          </>
                        ) : "-"}
                      </td>
                      {offresAvecTotaux.map((o, oi) => {
                        const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id) || {};
                        const disponible = lo.prix_unitaire_ht != null && lo.prix_unitaire_ht !== "";
                        const retenu = selection[ld.id] === o.id;
                        return (
                          <td key={o.id} style={{ ...tdStyle, ...(retenu ? { background: "#EAF7EE" } : {}) }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="radio"
                                name={`ligne-${ld.id}`}
                                checked={retenu}
                                disabled={!disponible || couverte}
                                onChange={() => setSelection((prev) => ({ ...prev, [ld.id]: o.id }))}
                                title="Retenir ce fournisseur pour cet article"
                              />
                              <ChampPrixHT
                                id={`pu-${oi}-${i}`}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const suivant = i < lignesDemande.length - 1
                                    ? document.getElementById(`pu-${oi}-${i + 1}`)
                                    : document.getElementById(`numero-devis-${oi + 1}`);
                                  // Laisse le temps au blur du champ actuel (enregistrement) de se déclencher
                                  // avant de focaliser le suivant, sinon le gestionnaire global "Entrée = blur"
                                  // risque de refermer le nouveau champ tout de suite après.
                                  setTimeout(() => { suivant?.focus(); suivant?.select?.(); }, 0);
                                }}
                                defaultValue={lo.prix_unitaire_ht ?? ""}
                                onCommit={(v) => majPrix(o.id, ld.id, "prix_unitaire_ht", v)}
                                tvaPct={o.assujetti_tva === false ? 0 : 20}
                                disabled={couverte}
                                style={{ ...inputStyle, width: 100 }}
                              />
                              <input
                                type="number"
                                placeholder="remise %"
                                defaultValue={lo.remise_pct ?? 0}
                                onBlur={(e) => majPrix(o.id, ld.id, "remise_pct", e.target.value)}
                                disabled={couverte}
                                style={{ ...inputStyle, width: 65 }}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid #eee" }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>Total des articles au prix le moins cher retenu (HT)</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#1B7A4C" }}>{totalPreconisation.ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={4} style={tdStyle}>TVA</td>
                  <td style={{ ...tdStyle, color: "#1B7A4C" }}>{totalPreconisation.tva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={tdStyle}>
                      {o.assujetti_tva === false ? <span style={{ color: "#999" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 600 }}>Total TTC</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#1B7A4C" }}>{totalPreconisation.ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                  {offresAvecTotaux.map((o) => (
                    <td key={o.id} style={{ ...tdStyle, fontWeight: 600, ...(etiquetteParOffre[o.id] ? { color: "#1B7A4C" } : {}) }}>
                      {o.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {offresAvecTotaux.length > 0 && (
          <div className="no-print" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Remarque de la demande (pour le TCO imprimé)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              <textarea
                placeholder="Ex. article surligné en jaune abordable... / Autres fournisseurs consultés : Sanifer et Batimax pas de dispo, MC Mining en attente de réponse..."
                value={notesTco.remarque}
                onChange={(e) => setNotesTco({ ...notesTco, remarque: e.target.value })}
                onBlur={enregistrerNotesTco}
                style={{ ...inputStyle, minHeight: 60 }}
              />
            </div>
          </div>
        )}

        {offresAvecTotaux.length > 0 && lignesDemande.some((ld) => !dejaCouvertes.has(ld.id)) && (
          <div className="no-print" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
              Le point (radio) coché sur chaque article indique le fournisseur retenu pour cet article (par défaut le moins cher). Change-le si besoin avant de générer les bons de commande — un BC distinct sera créé par fournisseur retenu, seulement pour les articles pas encore attribués.
            </p>
            <button onClick={genererBC} disabled={generating || sauvegardesPrixEnCours > 0} style={buttonStyle}>
              {generating ? "Génération..." : sauvegardesPrixEnCours > 0 ? "Enregistrement des prix..." : "Générer le(s) bon(s) de commande"}
            </button>
            {sauvegardesPrixEnCours > 0 && (
              <p style={{ fontSize: 11.5, color: "#8A6100", marginTop: 6 }}>Un instant — le calcul du fournisseur le moins cher se met à jour après ta dernière saisie de prix.</p>
            )}
          </div>
        )}
        {offresAvecTotaux.length > 0 && lignesDemande.length > 0 && lignesDemande.every((ld) => dejaCouvertes.has(ld.id)) && (
          <p className="no-print" style={{ fontSize: 13, color: "#1B7A4C", marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            ✓ Tous les articles de cette demande ont déjà un bon de commande.
          </p>
        )}
      </CadreExtensible>
      </div>

      {modeImpression === "demande" && (
        <div className="tco-imprimable">
          <div className="page-impression" style={{ fontFamily: "Arial, sans-serif", color: "#1a1a1a", padding: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2px solid #3E7A52", paddingBottom: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Demande d'achat {demande.numero}</div>
                {demande.numero_da && <div style={{ fontSize: 11, color: "#555" }}>N° DA : {demande.numero_da}</div>}
              </div>
              <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
                Imprimé le {formatDate(new Date().toISOString())}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, fontSize: 12 }}>
              <div><strong>Date DA :</strong> {demande.date_da ? formatDate(demande.date_da) : "—"}</div>
              <div><strong>Priorité :</strong> {demande.priorite || "Moyenne"}</div>
              <div><strong>Service demandeur :</strong> {demande.service || "—"}</div>
              <div><strong>Nom demandeur :</strong> {demande.demandeur || "—"}</div>
              <div style={{ gridColumn: "1 / -1" }}><strong>Motif :</strong> {demande.motif_projet || "—"}</div>
              {demande.observation && <div style={{ gridColumn: "1 / -1" }}><strong>Observation :</strong> {demande.observation}</div>}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #1a1a1a" }}>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>N°</th>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Article</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Quantité</th>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Unité</th>
                </tr>
              </thead>
              <tbody>
                {lignesDemande.map((ld, i) => (
                  <tr key={ld.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "4px 6px" }}>{i + 1}</td>
                    <td style={{ padding: "4px 6px" }}>{ld.designation}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right" }}>{ld.quantite}</td>
                    <td style={{ padding: "4px 6px" }}>{ld.unite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modeImpression === "comparatif" && (
      <div className="tco-imprimable">
        {offresAvecTotaux.length > 0 && pagesImpression.map((page, pIdx) => {
          const derniere = pIdx === pagesImpression.length - 1;
          const rowSpanMotif = derniere ? 5 : 4;
          return (
          <div key={pIdx} className="page-impression" style={{ fontFamily: "Arial, sans-serif", color: "#1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "2px solid #3E7A52", paddingBottom: 10, marginBottom: 10 }}>
              <div>
                <img src="/logo.png" alt="UNIFOODS" style={{ height: 34 }} />
              </div>
              <div style={{ textAlign: "center", flex: 1, padding: "0 20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Tableau comparatif des offres fournisseurs</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Destinataire : Tous</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 9.5, color: "#888", minWidth: 130 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1a1a1a" }}>{demande.numero_tco || "—"}</div>
                <div>Créé le {formatDate(demande.created_at)}</div>
                <div>Page {pIdx + 1} sur {pagesImpression.length}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", background: "#FAFAF9", borderRadius: 8, padding: "8px 14px", marginBottom: 12, gap: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                <MetaItem label="Date DA" value={formatDate(demande.date_da || demande.created_at)} />
                <MetaItem label="Service demandeur" value={demande.service || "—"} />
                <MetaItem label="Nom demandeur" value={demande.demandeur || "—"} />
                <MetaItem label="N° DA" value={demande.numero_da || demande.numero} />
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "0 12px" }}>
                <div style={lblStyle}>Motif de la demande</div>
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{demande.motif_projet || "—"}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                <MetaItem label="Émetteur" value={emetteur.nom} />
                <MetaItem label="Fonction" value={emetteur.fonction} />
              </div>
            </div>

            <div>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: tailleTexteTco, tableLayout: "fixed" }}>
                <colgroup>
                  {(() => {
                    // Largeurs en % de la page (jamais en px fixe) : le tableau tient
                    // toujours sur une page quel que soit le nombre de fournisseurs,
                    // pas besoin de réduire l'échelle à l'impression.
                    const FIXE = { no: 2.5, article: 15, qte: 4, unite: 4.5, gap: 0.5, preco: 13 };
                    const restant = 100 - (FIXE.no + FIXE.article + FIXE.qte + FIXE.unite + FIXE.gap * 2 + FIXE.preco);
                    const parFournisseur = restant / Math.max(page.length, 1);
                    return (
                      <>
                        <col style={{ width: `${FIXE.no}%` }} /><col style={{ width: `${FIXE.article}%` }} /><col style={{ width: `${FIXE.qte}%` }} /><col style={{ width: `${FIXE.unite}%` }} />
                        <col style={{ width: `${FIXE.gap}%` }} />
                        <col style={{ width: `${FIXE.preco}%` }} />
                        <col style={{ width: `${FIXE.gap}%` }} />
                        {page.map((o) => (
                          <Fragment key={o.id}>
                            <col style={{ width: `${parFournisseur * 0.345}%` }} />
                            <col style={{ width: `${parFournisseur * 0.263}%` }} />
                            <col style={{ width: `${parFournisseur * 0.392}%` }} />
                          </Fragment>
                        ))}
                      </>
                    );
                  })()}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...thBlank, ...boxEdge("left", { first: true, firstCol: true }) }}></th>
                    <th style={{ ...thBlank, ...boxEdge("left", { first: true }) }}></th>
                    <th style={{ ...thBlank, ...boxEdge("left", { first: true }) }}></th>
                    <th style={{ ...thBlank, ...boxEdge("left", { first: true, lastCol: true }) }}></th>
                    <th style={thBlank}></th>
                    <th rowSpan={2} style={{ ...thBlank, ...precoColStyle, ...boxEdge("mid", { first: true, firstCol: true, lastCol: true }), fontSize: 16, fontWeight: 700, textAlign: "center", verticalAlign: "middle" }}>Préconisation</th>
                    <th style={thBlank}></th>
                    {page.map((o, idx) => {
                      const wins = [];
                      lignesDemande.forEach((ld, i) => { if (moinsCherParLigne[ld.id] === o.id) wins.push(i + 1); });
                      return (
                        <th key={o.id} colSpan={3} style={{ padding: 0, ...boxEdge("right", { first: true, firstCol: idx === 0, lastCol: idx === page.length - 1 }) }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", padding: "3px 4px 0" }}>
                            {o.fournisseur_nom}
                          </div>
                          <div style={{ fontSize: 8.5, color: "#888", textAlign: "center" }}>
                            {o.numero_devis ? `Devis ${o.numero_devis} · ` : ""}{o.date_devis ? formatDate(o.date_devis) : ""}
                          </div>
                          <div style={{ fontSize: 8, fontWeight: 600, color: "#1B7A4C", textAlign: "center", padding: "2px 4px 4px" }}>
                            {wins.length ? `Moins cher sur article${wins.length > 1 ? "s" : ""} n° ${joinFrench(wins)}` : "\u00A0"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    <th style={{ ...thTco, ...boxEdge("left", { firstCol: true }) }}>N°</th>
                    <th style={{ ...thTco, textAlign: "center", ...boxEdge("left", {}) }}>Article</th>
                    <th style={{ ...thTco, textAlign: "center", ...boxEdge("left", {}) }}>Qté</th>
                    <th style={{ ...thTco, textAlign: "center", ...boxEdge("left", { lastCol: true }) }}>Unité</th>
                    <th style={thBlank}></th>
                    <th style={thBlank}></th>
                    {page.map((o, idx) => {
                      const defaut = fournisseursDetailMap[o.fournisseur_id]?.remise_par_defaut_pct;
                      return (
                        <Fragment key={o.id}>
                          <th style={{ ...thTco, textAlign: "right", ...(idx === 0 ? boxEdge("right", { firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) }}>PU HT</th>
                          <th style={{ ...thTco, textAlign: "right" }}>{defaut ? `Remise ${defaut}%` : "Remise"}</th>
                          <th style={{ ...thTco, textAlign: "right", ...boxEdge("right", { lastCol: idx === page.length - 1 }) }}>Montant HT</th>
                        </Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {lignesDemande.map((ld, i) => {
                    const offreRetenue = offresAvecTotaux.find((o) => o.id === selection[ld.id]);
                    const montantRetenu = offreRetenue ? montantLigne(offreRetenue, ld) : null;
                    const finRangee = i === lignesDemande.length - 1;
                    return (
                      <tr key={ld.id}>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule, ...boxEdge("left", { last: finRangee, firstCol: true }) }}>{i + 1}</td>
                        <td style={{ ...tdTco, padding: padCellule, ...boxEdge("left", { last: finRangee }) }}>{ld.designation}</td>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule, ...boxEdge("left", { last: finRangee }) }}>{Number(ld.quantite).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ ...tdTco, textAlign: "center", padding: padCellule, ...boxEdge("left", { last: finRangee, lastCol: true }) }}>{ld.unite}</td>
                        <td style={{ ...tdTco, border: "none" }}></td>
                        <td style={{ ...tdTco, ...precoColStyle, textAlign: "center", verticalAlign: "middle", padding: "8px 6px", ...boxEdge("mid", { last: finRangee, firstCol: true, lastCol: true }) }}>
                          {offreRetenue ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: "#1B7A4C" }}>{offreRetenue.fournisseur_nom}</div>
                              <div style={{ fontSize: 9.5, color: "#888", marginTop: 2 }}>HT {montantRetenu != null ? montantRetenu.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Ar" : "-"}</div>
                            </>
                          ) : "—"}
                        </td>
                        <td style={{ ...tdTco, border: "none" }}></td>
                        {page.map((o, idx) => {
                          const lo = o.lignesOffre.find((x) => x.ligne_demande_id === ld.id) || {};
                          const m = montantLigne(o, ld);
                          const estMoinsCher = moinsCherParLigne[ld.id] === o.id && !!lo.prix_unitaire_ht;
                          const fond = estMoinsCher ? { background: "#D6D6D6" } : {};
                          const styleCell1 = { ...tdTco, padding: padCellule, textAlign: "right", ...fond, ...(idx === 0 ? boxEdge("right", { last: finRangee, firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) };
                          const styleCell = { ...tdTco, padding: padCellule, textAlign: "right", ...fond };
                          const styleCellDer = { ...tdTco, padding: padCellule, textAlign: "right", ...fond, ...boxEdge("right", { last: finRangee, lastCol: idx === page.length - 1 }), fontWeight: estMoinsCher ? 700 : 400, color: estMoinsCher ? "#1B7A4C" : "#1a1a1a" };
                          const pastilleEtoile = (
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 11, height: 11, borderRadius: "50%", background: "#1a1a1a", color: "#fff", fontSize: 7, lineHeight: 1, marginRight: 3, verticalAlign: "middle" }}>★</span>
                          );
                          return (
                            <Fragment key={o.id}>
                              <td style={styleCell1}>{estMoinsCher && pastilleEtoile}{lo.prix_unitaire_ht ? `${Number(lo.prix_unitaire_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : ""}</td>
                              <td style={styleCell}>{lo.prix_unitaire_ht && lo.remise_pct ? `${lo.remise_pct}%` : ""}</td>
                              <td style={styleCellDer}>{m != null ? `${m.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : ""}</td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ height: 10 }} />

            <div>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: tailleTexteTco, tableLayout: "fixed" }}>
                <colgroup>
                  {(() => {
                    const FIXE = { no: 2.5, article: 15, qte: 4, unite: 4.5, gap: 0.5, preco: 13 };
                    const restant = 100 - (FIXE.no + FIXE.article + FIXE.qte + FIXE.unite + FIXE.gap * 2 + FIXE.preco);
                    const parFournisseur = restant / Math.max(page.length, 1);
                    return (
                      <>
                        <col style={{ width: `${FIXE.no}%` }} /><col style={{ width: `${FIXE.article}%` }} /><col style={{ width: `${FIXE.qte}%` }} /><col style={{ width: `${FIXE.unite}%` }} />
                        <col style={{ width: `${FIXE.gap}%` }} />
                        <col style={{ width: `${FIXE.preco}%` }} />
                        <col style={{ width: `${FIXE.gap}%` }} />
                        {page.map((o) => (
                          <Fragment key={o.id}>
                            <col style={{ width: `${parFournisseur * 0.345}%` }} />
                            <col style={{ width: `${parFournisseur * 0.263}%` }} />
                            <col style={{ width: `${parFournisseur * 0.392}%` }} />
                          </Fragment>
                        ))}
                      </>
                    );
                  })()}
                </colgroup>
                <tbody>
                  <tr>
                    <td colSpan={4} rowSpan={rowSpanMotif} style={{ ...tdTco, verticalAlign: "top", padding: 10, ...boxEdge("left", { first: true, last: true, firstCol: true, lastCol: true }) }}>
                      {derniere && (
                        <div>
                          <div style={lblStyle}>Remarque de la demande</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{notesTco.remarque || "—"}</div>
                        </div>
                      )}
                    </td>
                    <td rowSpan={rowSpanMotif} style={{ ...tdTco, border: "none" }}></td>
                    <td rowSpan={rowSpanMotif} style={{ ...tdTco, ...precoColStyle, verticalAlign: "top", padding: 10, ...boxEdge("mid", { first: true, last: true, firstCol: true, lastCol: true }) }}>
                      <div style={lblStyle}>Total au prix le moins cher (HT)</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{totalPreconisation.ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</div>
                      <div style={{ ...lblStyle, marginTop: 6 }}>TVA</div>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{totalPreconisation.tva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</div>
                      <div style={{ ...lblStyle, marginTop: 6 }}>Total TTC</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1B7A4C" }}>{totalPreconisation.ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</div>
                    </td>
                    <td rowSpan={rowSpanMotif} style={{ ...tdTco, border: "none" }}></td>
                    {page.map((o, idx) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, ...(idx === 0 ? boxEdge("right", { first: true, firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) }}>Montant HT</td>
                        <td style={{ ...tdTco, ...boxEdge("right", { first: true, lastCol: idx === page.length - 1 }) }}>{o.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o, idx) => {
                      const remiseObt = remiseObtenueOffre(o, lignesDemande);
                      return (
                        <Fragment key={o.id}>
                          <td colSpan={2} style={{ ...tdTco, ...(idx === 0 ? boxEdge("right", { firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) }}>Remise obtenue</td>
                          <td style={{ ...tdTco, ...boxEdge("right", { lastCol: idx === page.length - 1 }) }}>{remiseObt ? `${remiseObt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar` : ""}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                  <tr>
                    {page.map((o, idx) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, ...(idx === 0 ? boxEdge("right", { firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) }}>TVA</td>
                        <td style={{ ...tdTco, ...boxEdge("right", { lastCol: idx === page.length - 1 }) }}>{o.assujetti_tva === false ? <span style={{ color: "#999", fontStyle: "italic" }}>Non taxable</span> : `${o.tva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar`}</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o, idx) => (
                      <Fragment key={o.id}>
                        <td colSpan={2} style={{ ...tdTco, fontWeight: 600, ...(idx === 0 ? boxEdge("right", { firstCol: true }) : { borderLeft: "1.5px solid #1a1a1a" }) }}>Total TTC</td>
                        <td style={{ ...tdTco, fontWeight: 700, color: "#1B7A4C", ...boxEdge("right", { lastCol: idx === page.length - 1 }) }}>{o.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar</td>
                      </Fragment>
                    ))}
                  </tr>
                  <tr>
                    {page.map((o, idx) => {
                      const exceptions = remiseExceptionsOffre(o, lignesDemande, fournisseursDetailMap);
                      const echeance = fournisseursDetailMap[o.fournisseur_id]?.conditions_paiement_jours;
                      const lignesObs = [];
                      if (echeance) lignesObs.push(`* Échéance ${echeance} jours`);
                      if (o.observation) lignesObs.push(o.observation);
                      exceptions.forEach((e) => {
                        if (e.remise === 0) lignesObs.push(`* Pas de remise sur l'article n°${e.numero} (${truncateTexte(e.designation, 26)}) — habituellement ${e.defaut}%`);
                        else lignesObs.push(`* Remise de ${e.remise}% sur l'article n°${e.numero} (${truncateTexte(e.designation, 26)}), au lieu de ${e.defaut}% habituellement`);
                      });
                      return (
                        <td key={o.id} colSpan={3} style={{ ...tdTco, verticalAlign: "top", fontSize: 8.8, ...boxEdge("right", { last: true, firstCol: true, lastCol: idx === page.length - 1 }) }}>
                          <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>Observation</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{lignesObs.join("\n")}</div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {derniere && (
              <div style={{ display: "flex", gap: 20, marginTop: 16, breakInside: "avoid", pageBreakInside: "avoid" }}>
                <div style={{ flex: 1, maxWidth: 320 }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1.5px solid #1a1a1a", paddingBottom: 5, marginBottom: 85 }}>Validation technique</div>
                  <div style={{ fontSize: 8.5, color: "#888", borderTop: "0.75px solid #ddd", paddingTop: 4 }}>Date / Nom / Signature</div>
                </div>
                <div style={{ flex: 1, maxWidth: 320 }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1.5px solid #1a1a1a", paddingBottom: 5, marginBottom: 85 }}>Validation direction</div>
                  <div style={{ fontSize: 8.5, color: "#888", borderTop: "0.75px solid #ddd", paddingTop: 4 }}>Date / Nom / Signature</div>
                </div>
              </div>
            )}
          </div>
        );})}
      </div>
      )}
    </AuthGuard>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 7.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const precoColStyle = { background: "#EAF7EE", color: "#1B7A4C" };
function boxEdge(group, { first = false, last = false, firstCol = false, lastCol = false } = {}) {
  const c = "1.5px solid #1a1a1a";
  const s = {};
  if (firstCol) s.borderLeft = c;
  if (lastCol) s.borderRight = c;
  if (first) s.borderTop = c;
  if (last) s.borderBottom = c;
  if (group === "left") {
    if (first && firstCol) s.borderTopLeftRadius = 10;
    if (last && firstCol) s.borderBottomLeftRadius = 10;
  }
  if (group === "right") {
    if (first && lastCol) s.borderTopRightRadius = 10;
    if (last && lastCol) s.borderBottomRightRadius = 10;
  }
  return s;
}
const lblStyle = { fontSize: 8.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 };
const thBlank = { borderBottom: "none", padding: 0 };
const thTco = { padding: "3px 5px 5px", fontSize: 8, fontWeight: 600, textAlign: "left", color: "#888", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1.5px solid #1a1a1a" };
const tdTco = { padding: "4px", fontSize: 10, borderBottom: "1px solid #1a1a1a" };
