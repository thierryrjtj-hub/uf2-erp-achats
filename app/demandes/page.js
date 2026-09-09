"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AuthGuard from "../components/AuthGuard";
import { formatDate } from "../../lib/format";
import { linkBtn, inputStyle } from "../components/ui";
import { IconCopy, IconBan, IconTrash } from "../components/Icons";
import { useRole } from "../../lib/useRole";
import TriMenu, { appliquerTri } from "../components/TriMenu";

export default function DemandesListePage() {
  const role = useRole();
  const [liste, setListe] = useState([]);
  const [demandesAvecNonDispo, setDemandesAvecNonDispo] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [tri, setTri] = useState({ colonne: "created_at", sens: "desc" });

  const charger = async () => {
    const { data } = await supabase.from("demandes").select("*").order("created_at", { ascending: false }).limit(10000);
    setListe(data || []);
    const { data: nonDispo } = await supabase.from("lignes_demande").select("demande_id").eq("non_disponible_localement", true).limit(10000);
    setDemandesAvecNonDispo(new Set((nonDispo || []).map((x) => x.demande_id)));
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const statutsDistincts = useMemo(() => [...new Set(liste.map((d) => d.statut).filter(Boolean))].sort(), [liste]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = liste.filter((d) => {
      const okRecherche = !q || [d.numero, d.service, d.demandeur, d.motif_projet].some((v) => (v || "").toLowerCase().includes(q));
      const okStatut = !filtreStatut || d.statut === filtreStatut;
      return okRecherche && okStatut;
    });
    return appliquerTri(base, tri);
  }, [liste, recherche, filtreStatut, tri]);

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
        <h1 style={{ fontSize: 18, marginBottom: 14, flexShrink: 0 }}>Liste des demandes ({filtrees.length} / {liste.length})</h1>

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(16,24,40,0.05)", border: "1px solid #ECEBE6", padding: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <input placeholder="Rechercher (N°, service, demandeur, motif...)" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ ...inputStyle, width: "100%", paddingRight: 30 }} />
              {recherche && <button onClick={() => setRecherche("")} style={clearBtn} aria-label="Effacer">×</button>}
            </div>
            <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={inputStyle}>
              <option value="">Tous les statuts</option>
              {statutsDistincts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {filtrees.map((d) => (
              <div key={d.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <Link href={`/demandes/${d.id}`} style={{ fontWeight: 600, fontSize: 13, color: "#1E3A34", textDecoration: "underline" }}>{d.numero}</Link>
                  <div style={{ fontSize: 12, color: "#888" }}>{d.motif_projet}</div>
                </div>
                <div style={{ fontSize: 13, color: "#666", width: 150 }}>{d.service || "-"}</div>
                <div style={{ fontSize: 13, color: "#666", width: 110 }}>{formatDate(d.date)}</div>
                <span title={`Priorité : ${d.priorite || "Moyenne"}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: prioriteCouleur(d.priorite), flexShrink: 0, cursor: "help" }} />
                {demandesAvecNonDispo.has(d.id) && (
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#FDECEA", color: "#B3261E" }}>À rechercher import</span>
                )}
                <button onClick={() => setFiltreStatut(d.statut)} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#FFF3D6", color: "#8A6100", border: "none", cursor: "pointer" }} title="Filtrer sur ce statut">{d.statut}</button>
                <button onClick={() => copierPourDevis(d)} style={linkBtnBleu} title="Copier pour demande de devis">
                  <IconCopy /> Devis
                </button>
                <button onClick={() => annulerDemande(d)} style={{ ...linkBtn, color: d.statut === "Annulée" ? "#1B7A4C" : "#8A6100", display: "inline-flex", alignItems: "center" }} title={d.statut === "Annulée" ? "Réactiver" : "Annuler"}>
                  <IconBan />
                </button>
                {role === "acheteur" && (
                  <button onClick={() => supprimerDemande(d)} style={{ ...linkBtn, color: "#B3261E", display: "inline-flex", alignItems: "center" }} title="Supprimer">
                    <IconTrash />
                  </button>
                )}
              </div>
            ))}
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
const rowStyle = { display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid #f0f0f0" };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "#999", cursor: "pointer", padding: "2px 6px" };
