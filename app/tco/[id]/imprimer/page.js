"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TCOPrintDocument from "@/components/tco/TCOPrintDocument";

// Réutilise le même client Supabase que le reste de l'appli si tu en as déjà
// un exporté quelque part (ex. "@/lib/supabaseClient") — remplace les deux
// lignes ci-dessous par un simple `import { supabase } from "@/lib/supabaseClient"`
// si c'est le cas, pour ne pas dupliquer la config.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ImprimerTCOPage() {
  const { id } = useParams(); // /tco/[id]/imprimer -> id de la demande ou du TCO
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

  return (
    <TCOPrintDocument
      doc={data.doc}
      articles={data.articles}
      fournisseurs={data.fournisseurs}
    />
  );
}

/**
 * ===========================================================================
 * ADAPTATEUR SUPABASE — C'EST ICI QU'IL FAUT AJUSTER
 * ===========================================================================
 * Les noms de tables/colonnes ci-dessous sont des noms plausibles vu le
 * cahier des charges (Phase 1: fournisseurs + articles, Phase 2: demandes +
 * TCO), mais je n'ai pas le schéma exact de ta base. Adapte les noms de
 * tables et de colonnes dans les requêtes .from()/.select() ci-dessous pour
 * qu'ils correspondent à ta base réelle — le reste du fichier (mise en forme
 * des données pour TCOPrintDocument) n'a pas besoin de changer.
 *
 * Champ à vérifier en particulier : tauxRemiseDefaut. S'il n'existe pas
 * encore dans ta table fournisseurs, ajoute une colonne (ex.
 * "taux_remise_defaut", numérique, nullable) pour que l'appli puisse détecter
 * automatiquement les remises hors norme (voir point discuté : remise
 * habituelle 10/15/25% par fournisseur).
 * ===========================================================================
 */
async function getTCOPrintData(demandeId) {
  // 1) L'entête du TCO / de la demande
  const { data: demande, error: e1 } = await supabase
    .from("demandes")
    .select("*")
    .eq("id", demandeId)
    .single();
  if (e1) throw e1;

  // 2) Les lignes d'articles de la demande
  const { data: lignesDemande, error: e2 } = await supabase
    .from("lignes_demande")
    .select("*")
    .eq("demande_id", demandeId)
    .order("numero", { ascending: true });
  if (e2) throw e2;

  // 3) Les devis fournisseurs (un devis = un fournisseur consulté pour cette
  //    demande, avec sa liste de prix par article)
  const { data: devis, error: e3 } = await supabase
    .from("devis_fournisseurs")
    .select("*, fournisseur:fournisseurs(nom, taux_remise_defaut), lignes_devis(*)")
    .eq("demande_id", demandeId);
  if (e3) throw e3;

  // ---- Mise en forme pour TCOPrintDocument (ne dépend pas de Supabase) ----

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
    // Le champ libre saisi par l'utilisateur (conditions de paiement...) ;
    // à pré-remplir côté saisie avec les infos de la fiche fournisseur
    // (ex. "* Échéance 30 jours") plutôt que de le laisser vide par défaut.
    observation: d.observation || "",
    // lignes_devis doit être dans le même ordre que lignesDemande : on
    // reconstruit la correspondance par numero d'article pour être sûr.
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

function formatDateFr(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("fr-FR");
}
