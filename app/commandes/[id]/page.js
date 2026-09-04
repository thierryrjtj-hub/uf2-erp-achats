"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";

const RECEPTIONNAIRES = ["Magasin", "Direction", "Site travaux", "Prestataire", "Autre"];
const TYPES_LIVRAISON = ["Livraison fournisseur", "Enlèvement par nos soins"];
const nouvelleSaisie = () => ({ receptionnaire: "Magasin", receptionnaireAutre: "", numeroBl: "", typeLivraison: "Livraison fournisseur", dateLivraisonTerrain: "" });

export default function CommandeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [bc, setBc] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [demande, setDemande] = useState(null);
  const [fournisseurDetail, setFournisseurDetail] = useState(null);
  const [receptions, setReceptions] = useState([]); // historique complet, avec .lignes
  const [saisie, setSaisie] = useState(nouvelleSaisie());
  const [quantitesSaisie, setQuantitesSaisie] = useState({}); // ligne_bc_id -> qté livrée maintenant
  const [loading, setLoading] = useState(true);
  const [facture, setFacture] = useState({ numero_facture: "", date_facture: "", echeance_jours: 30, statut_paiement: "Impayé", date_paiement: "" });
  const [transmission, setTransmission] = useState({ dateEnvoiSignature: "", dateRetourSignature: "", destinataireSignature: "", dateEnvoiPaiement: "", dateDisponibilitePaiement: "", destinatairePaiement: "" });
  const [accuses, setAccuses] = useState([]);
  const [nouvelAccuse, setNouvelAccuse] = useState({ date_accuse: "", date_facture: "", numero_facture: "", montant: "", demandeur: "", observation: "" });
  const [dateSignature, setDateSignature] = useState("");
  const [observation, setObservation] = useState("");
  const [dateEstimeeReste, setDateEstimeeReste] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [modeImpression, setModeImpression] = useState("bc");

  const charger = async () => {
    const { data: c } = await supabase.from("commandes").select("*").eq("id", id).single();
    const { data: l } = await supabase.from("lignes_bc").select("*").eq("bc_id", id);
    const { data: r } = await supabase.from("receptions").select("*").eq("bc_id", id).order("date_reception_reelle");
    let receptionsAvecLignes = [];
    if (r && r.length) {
      const { data: lr } = await supabase.from("lignes_reception").select("*").in("reception_id", r.map((x) => x.id));
      receptionsAvecLignes = r.map((rec) => ({ ...rec, lignes: (lr || []).filter((x) => x.reception_id === rec.id) }));
    }
    setBc(c);
    setLignes(l || []);
    setReceptions(receptionsAvecLignes);
    setDateEstimeeReste(c?.date_estimee_reste || "");

    if (c?.demande_id) {
      const { data: d } = await supabase.from("demandes").select("*").eq("id", c.demande_id).maybeSingle();
      setDemande(d || null);
    } else {
      setDemande(null);
    }
    if (c?.fournisseur_id) {
      const { data: f } = await supabase.from("fournisseurs").select("*").eq("id", c.fournisseur_id).maybeSingle();
      setFournisseurDetail(f || null);
    }

    if (c) {
      setFacture({
        numero_facture: c.numero_facture || "",
        date_facture: c.date_facture || "",
        echeance_jours: c.echeance_jours ?? 30,
        statut_paiement: c.statut_paiement || "Impayé",
        date_paiement: c.date_paiement || "",
      });
      setDateSignature(c.date_signature || "");
      setObservation(c.observation || "");
      setTransmission({
        dateEnvoiSignature: c.date_envoi_signature || "", dateRetourSignature: c.date_retour_signature || "",
        destinataireSignature: c.destinataire_signature || "", dateEnvoiPaiement: c.date_envoi_paiement || "",
        dateDisponibilitePaiement: c.date_disponibilite_paiement || "", destinatairePaiement: c.destinataire_paiement || "",
      });
    }
    const { data: acc } = await supabase.from("accuses_reception_facture").select("*").eq("bc_id", id).order("date_accuse", { ascending: false });
    setAccuses(acc || []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, [id]);

  // Cumul livré par ligne, toutes réceptions confondues
  const cumulLivre = (ligneBcId) => receptions.reduce((s, r) => s + (r.lignes.find((x) => x.ligne_bc_id === ligneBcId)?.quantite_livree ? Number(r.lignes.find((x) => x.ligne_bc_id === ligneBcId).quantite_livree) : 0), 0);

  const etatLivraison = () => {
    if (bc?.statut === "Clôturée (rupture)") return "Clôturé (rupture)";
    let toutLivre = true, unLivre = false;
    lignes.forEach((l) => {
      const c = cumulLivre(l.id);
      if (c > 0) unLivre = true;
      if (c < Number(l.quantite)) toutLivre = false;
    });
    if (toutLivre && unLivre) return "Livré";
    if (unLivre) return "Livré partiellement";
    return "Non livré";
  };

  const majQuantiteSaisie = (ligneBcId, val) => setQuantitesSaisie((prev) => ({ ...prev, [ligneBcId]: val }));

  const enregistrerReception = async () => {
    setEnregistrement(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "utilisateur";
    const receptionnaireFinal = saisie.receptionnaire === "Autre" ? saisie.receptionnaireAutre : saisie.receptionnaire;

    const lignesAvecSaisie = lignes.filter((l) => quantitesSaisie[l.id] !== undefined && quantitesSaisie[l.id] !== "");
    if (lignesAvecSaisie.length === 0) { setEnregistrement(false); return; }

    const toutLivreApres = lignes.every((l) => {
      const dejaCumul = cumulLivre(l.id);
      const nouveau = quantitesSaisie[l.id] !== undefined && quantitesSaisie[l.id] !== "" ? Number(quantitesSaisie[l.id]) : 0;
      return dejaCumul + nouveau >= Number(l.quantite);
    });

    const { data: nouvelle } = await supabase.from("receptions").insert({
      bc_id: id, receptionnaire: receptionnaireFinal, numero_bl: saisie.numeroBl, type_livraison: saisie.typeLivraison,
      date_livraison_terrain: saisie.dateLivraisonTerrain || null, confirme_par: email,
      statut: toutLivreApres ? "Totale" : "Partielle",
    }).select().single();

    if (nouvelle) {
      const payload = lignesAvecSaisie.map((l) => ({
        reception_id: nouvelle.id, ligne_bc_id: l.id, quantite_livree: Number(quantitesSaisie[l.id]) || 0,
      }));
      await supabase.from("lignes_reception").insert(payload);
    }

    await supabase.from("commandes").update({ statut: toutLivreApres ? "Clôturée" : "Livraison en cours" }).eq("id", id);
    setSaisie(nouvelleSaisie());
    setQuantitesSaisie({});
    setEnregistrement(false);
    charger();
  };

  const enregistrerDateEstimee = async () => {
    await supabase.from("commandes").update({ date_estimee_reste: dateEstimeeReste || null }).eq("id", id);
    charger();
  };

  const enregistrerSignatureObservation = async () => {
    await supabase.from("commandes").update({ date_signature: dateSignature || null, observation }).eq("id", id);
    charger();
  };

  const enregistrerTransmission = async () => {
    await supabase.from("commandes").update({
      date_envoi_signature: transmission.dateEnvoiSignature || null,
      date_retour_signature: transmission.dateRetourSignature || null,
      destinataire_signature: transmission.destinataireSignature,
      date_envoi_paiement: transmission.dateEnvoiPaiement || null,
      date_disponibilite_paiement: transmission.dateDisponibilitePaiement || null,
      destinataire_paiement: transmission.destinatairePaiement,
    }).eq("id", id);
    charger();
  };

  const ajouterAccuse = async () => {
    if (!nouvelAccuse.numero_facture.trim()) return;
    await supabase.from("accuses_reception_facture").insert({
      bc_id: id,
      date_accuse: nouvelAccuse.date_accuse || null,
      date_facture: nouvelAccuse.date_facture || null,
      numero_facture: nouvelAccuse.numero_facture,
      montant: nouvelAccuse.montant === "" ? null : Number(nouvelAccuse.montant),
      demandeur: nouvelAccuse.demandeur,
      observation: nouvelAccuse.observation,
    });
    setNouvelAccuse({ date_accuse: "", date_facture: "", numero_facture: "", montant: "", demandeur: "", observation: "" });
    charger();
  };

  const supprimerAccuse = async (accId) => {
    await supabase.from("accuses_reception_facture").delete().eq("id", accId);
    charger();
  };

  const arreterCommandeSurReste = async () => {
    const restantes = lignes.filter((l) => cumulLivre(l.id) < Number(l.quantite));
    if (restantes.length === 0) return;
    if (!confirm(`Arrêter cette commande sur le déjà-livré ? Une nouvelle demande d'achat sera créée avec les ${restantes.length} article(s) restant(s), à sourcer ailleurs.`)) return;

    const { data: nouvelleDemande } = await supabase.from("demandes").insert({
      service: demande?.service || "", demandeur: demande?.demandeur || "",
      motif_projet: `Reliquat non livré par ${bc.fournisseur_nom} sur ${bc.numero}`,
    }).select().single();

    if (nouvelleDemande) {
      const payload = restantes.map((l) => ({
        demande_id: nouvelleDemande.id, designation: l.designation,
        quantite: Number(l.quantite) - cumulLivre(l.id), unite: l.unite,
      }));
      await supabase.from("lignes_demande").insert(payload);
    }
    await supabase.from("commandes").update({ statut: "Clôturée (rupture)" }).eq("id", id);
    charger();
    if (nouvelleDemande) router.push(`/demandes/${nouvelleDemande.id}`);
  };

  const enregistrerFacture = async () => {
    await supabase.from("commandes").update({
      numero_facture: facture.numero_facture,
      date_facture: facture.date_facture || null,
      echeance_jours: Number(facture.echeance_jours) || 30,
      statut_paiement: facture.statut_paiement,
      date_paiement: facture.statut_paiement === "Payé" ? (facture.date_paiement || new Date().toISOString().slice(0, 10)) : null,
    }).eq("id", id);
    charger();
  };

  if (loading) return <AuthGuard><p>Chargement...</p></AuthGuard>;
  if (!bc) return <AuthGuard><p>Bon de commande introuvable.</p></AuthGuard>;

  const resteGlobal = lignes.some((l) => cumulLivre(l.id) < Number(l.quantite));
  const derniere = receptions[receptions.length - 1];

  return (
    <AuthGuard>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .pv-template { display: none; }
        @media print { .pv-template.print-area { display: block; } }
      `}</style>

      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }} className="no-print">&larr; Retour aux commandes</button>

      {/* ---- Bon de commande ---- */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20 }} className={modeImpression === "bc" ? "print-area" : "no-print"}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="UNIFOODS" style={{ height: 32 }} /> — Bon de commande
            </h1>
            <p style={{ fontSize: 14, color: "#666" }}>{bc.numero} — {bc.date}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }} className="no-print">
            <button onClick={() => { setModeImpression("bc"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888" }}>Imprimer le BC</button>
          </div>
        </div>

        <p style={{ fontSize: 14, marginBottom: 16 }}><strong>Fournisseur :</strong> {bc.fournisseur_nom}</p>

        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#666" }}>Date de signature du BC :</label>
          <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} style={inputStyle} />
          <input placeholder="Observation" value={observation} onChange={(e) => setObservation(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button onClick={enregistrerSignatureObservation} style={{ ...buttonStyle, background: "#888" }}>Enregistrer</button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={thStyle}>Article</th><th style={thStyle}>Qté</th><th style={thStyle}>Unité</th>
              <th style={thStyle}>PU HT</th><th style={thStyle}>Remise</th><th style={thStyle}>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td style={tdStyle}>{l.designation}</td>
                <td style={tdStyle}>{l.quantite}</td>
                <td style={tdStyle}>{l.unite}</td>
                <td style={tdStyle}>{Number(l.prix_unitaire_ht).toLocaleString("fr-FR")} Ar</td>
                <td style={tdStyle}>{l.remise_pct} %</td>
                <td style={tdStyle}>{Number(l.montant_ht).toLocaleString("fr-FR")} Ar</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: "auto", width: 260 }}>
          <div style={rowTotal}><span>Total HT</span><span>{Number(bc.montant_ht).toLocaleString("fr-FR")} Ar</span></div>
          <div style={rowTotal}><span>TVA</span><span>{bc.assujetti_tva === false ? "Non taxable" : `${Number(bc.montant_tva).toLocaleString("fr-FR")} Ar`}</span></div>
          <div style={{ ...rowTotal, fontWeight: 700, borderTop: "1px solid #ddd", paddingTop: 6 }}>
            <span>Total TTC</span><span>{Number(bc.montant_ttc).toLocaleString("fr-FR")} Ar</span>
          </div>
        </div>

        <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <div>Établi par : ____________________</div>
          <div>Signature Direction : ____________________</div>
        </div>
      </div>

      {/* ---- Réception ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15 }}>Réception</h2>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: etatLivraison() === "Livré" ? "#EAF7EE" : etatLivraison().startsWith("Livré partiellement") ? "#FFF3D6" : etatLivraison().startsWith("Clôturé") ? "#F0EFEA" : "#F0EFEA", color: etatLivraison() === "Livré" ? "#1B7A4C" : etatLivraison().startsWith("Livré partiellement") ? "#8A6100" : "#888" }}>
            {etatLivraison()}
          </span>
        </div>

        {receptions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Historique des réceptions</div>
            {receptions.map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                Le <strong>{new Date(r.date_reception_reelle).toLocaleString("fr-FR")}</strong> — {r.receptionnaire} ({r.type_livraison}{r.numero_bl ? `, BL ${r.numero_bl}` : ""}) —
                {" "}{r.lignes.map((x) => `${lignes.find((l) => l.id === x.ligne_bc_id)?.designation || "?"}: ${x.quantite_livree}`).join(", ")}
                {" "}— saisi par {r.confirme_par}
              </div>
            ))}
          </div>
        )}

        {resteGlobal ? (
          <>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              Imprime le PV à l'avance pour le donner au magasin, ou saisis directement une nouvelle réception (partielle ou totale sur le reste).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <select value={saisie.receptionnaire} onChange={(e) => setSaisie({ ...saisie, receptionnaire: e.target.value })} style={inputStyle}>
                {RECEPTIONNAIRES.map((r) => <option key={r}>{r}</option>)}
              </select>
              {saisie.receptionnaire === "Autre" && (
                <input placeholder="Préciser le réceptionnaire" value={saisie.receptionnaireAutre} onChange={(e) => setSaisie({ ...saisie, receptionnaireAutre: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              )}
              <select value={saisie.typeLivraison} onChange={(e) => setSaisie({ ...saisie, typeLivraison: e.target.value })} style={inputStyle}>
                {TYPES_LIVRAISON.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="N° de Bon de Livraison (BL)" value={saisie.numeroBl} onChange={(e) => setSaisie({ ...saisie, numeroBl: e.target.value })} style={{ ...inputStyle, width: 180 }} />
              <input type="date" value={saisie.dateLivraisonTerrain} onChange={(e) => setSaisie({ ...saisie, dateLivraisonTerrain: e.target.value })} style={inputStyle} />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Article</th><th style={thStyle}>Qté commandée</th><th style={thStyle}>Déjà livré</th>
                  <th style={thStyle}>Reste à livrer</th><th style={thStyle}>Qté livrée maintenant</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const deja = cumulLivre(l.id);
                  const reste = Math.max(0, Number(l.quantite) - deja);
                  if (reste === 0) return null;
                  return (
                    <tr key={l.id}>
                      <td style={tdStyle}>{l.designation}</td>
                      <td style={tdStyle}>{l.quantite} {l.unite}</td>
                      <td style={tdStyle}>{deja} {l.unite}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{reste} {l.unite}</td>
                      <td style={tdStyle}>
                        <input type="number" min="0" max={reste} value={quantitesSaisie[l.id] ?? ""} onChange={(e) => majQuantiteSaisie(l.id, e.target.value)} style={{ ...inputStyle, width: 90 }} placeholder="0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => { setModeImpression("pv"); setTimeout(() => window.print(), 50); }} style={{ ...buttonStyle, background: "#888" }}>Imprimer le PV de réception</button>
              <button onClick={enregistrerReception} disabled={enregistrement} style={buttonStyle}>
                {enregistrement ? "Enregistrement..." : "Enregistrer cette réception"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#666" }}>Date estimée du reste à livrer :</label>
                <input type="date" value={dateEstimeeReste} onChange={(e) => setDateEstimeeReste(e.target.value)} style={inputStyle} />
                <button onClick={enregistrerDateEstimee} style={{ ...buttonStyle, background: "#888" }}>Enregistrer</button>
                <button onClick={arreterCommandeSurReste} style={{ ...buttonStyle, background: "#B3261E", marginLeft: "auto" }}>
                  Arrêter la commande sur le déjà-livré (rupture fournisseur)
                </button>
              </div>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#1B7A4C" }}>✓ Commande entièrement livrée.</p>
        )}
      </div>

      {/* ---- Suivi transmission signature / paiement ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Suivi de transmission</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Pour signature</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div>
                <label style={miniLabel}>Date d'envoi</label>
                <input type="date" value={transmission.dateEnvoiSignature} onChange={(e) => setTransmission({ ...transmission, dateEnvoiSignature: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Date de retour signé</label>
                <input type="date" value={transmission.dateRetourSignature} onChange={(e) => setTransmission({ ...transmission, dateRetourSignature: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Destinataire</label>
                <input placeholder="ex: Mayuri" value={transmission.destinataireSignature} onChange={(e) => setTransmission({ ...transmission, destinataireSignature: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Pour paiement</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div>
                <label style={miniLabel}>Date d'envoi compta</label>
                <input type="date" value={transmission.dateEnvoiPaiement} onChange={(e) => setTransmission({ ...transmission, dateEnvoiPaiement: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Date disponibilité paiement</label>
                <input type="date" value={transmission.dateDisponibilitePaiement} onChange={(e) => setTransmission({ ...transmission, dateDisponibilitePaiement: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={miniLabel}>Destinataire</label>
                <input placeholder="ex: Compta" value={transmission.destinatairePaiement} onChange={(e) => setTransmission({ ...transmission, destinatairePaiement: e.target.value })} style={{ ...inputStyle, width: 130 }} />
              </div>
            </div>
          </div>
        </div>
        <button onClick={enregistrerTransmission} style={{ ...buttonStyle, marginTop: 12 }}>Enregistrer</button>
      </div>

      {/* ---- Accusés de réception facture ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Accusés de réception facture</h2>
        {accuses.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Date accusé</th><th style={thStyle}>Date facture</th><th style={thStyle}>N° facture</th>
                <th style={thStyle}>Montant</th><th style={thStyle}>Demandeur</th><th style={thStyle}>Observation</th><th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {accuses.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>{a.date_accuse || "-"}</td>
                  <td style={tdStyle}>{a.date_facture || "-"}</td>
                  <td style={tdStyle}>{a.numero_facture}</td>
                  <td style={tdStyle}>{a.montant ? `${Number(a.montant).toLocaleString("fr-FR")} Ar` : "-"}</td>
                  <td style={tdStyle}>{a.demandeur || "-"}</td>
                  <td style={tdStyle}>{a.observation || "-"}</td>
                  <td style={tdStyle}><button onClick={() => supprimerAccuse(a.id)} style={linkBtn}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" placeholder="Date accusé" value={nouvelAccuse.date_accuse} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, date_accuse: e.target.value })} style={inputStyle} />
          <input type="date" placeholder="Date facture" value={nouvelAccuse.date_facture} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, date_facture: e.target.value })} style={inputStyle} />
          <input placeholder="N° facture" value={nouvelAccuse.numero_facture} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, numero_facture: e.target.value })} style={{ ...inputStyle, width: 140 }} />
          <input type="number" placeholder="Montant" value={nouvelAccuse.montant} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, montant: e.target.value })} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="Demandeur" value={nouvelAccuse.demandeur} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, demandeur: e.target.value })} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="Observation" value={nouvelAccuse.observation} onChange={(e) => setNouvelAccuse({ ...nouvelAccuse, observation: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={ajouterAccuse} style={buttonStyle}>+ Ajouter</button>
        </div>
      </div>

      {/* ---- Facture / paiement ---- */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Facture et paiement</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input placeholder="N° de facture" value={facture.numero_facture} onChange={(e) => setFacture({ ...facture, numero_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="date" value={facture.date_facture} onChange={(e) => setFacture({ ...facture, date_facture: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" placeholder="Échéance (jours)" value={facture.echeance_jours} onChange={(e) => setFacture({ ...facture, echeance_jours: e.target.value })} style={{ ...inputStyle, width: 150 }} />
          <select value={facture.statut_paiement} onChange={(e) => setFacture({ ...facture, statut_paiement: e.target.value })} style={inputStyle}>
            <option>Impayé</option>
            <option>Payé</option>
          </select>
        </div>
        <button onClick={enregistrerFacture} style={buttonStyle}>Enregistrer</button>
      </div>

      {/* ---- PV de réception (imprimable) ---- */}
      <div className={`pv-template ${modeImpression === "pv" ? "print-area" : ""}`} style={{ padding: 20 }}>
        <h1 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="UNIFOODS" style={{ height: 28 }} /> — PV de Réception
        </h1>
        <p style={{ fontSize: 13 }}>N° {bc.numero.replace("BC-", "PVR-")} — Date : {new Date().toLocaleDateString("fr-FR")}</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <tbody>
            <tr><td style={pvLabel}>Fournisseur</td><td style={pvVal}>{bc.fournisseur_nom}</td>
                <td style={pvLabel}>Adresse</td><td style={pvVal}>{fournisseurDetail?.adresse || ""}</td></tr>
            <tr><td style={pvLabel}>NIF</td><td style={pvVal}>{fournisseurDetail?.nif || ""}</td>
                <td style={pvLabel}>STAT</td><td style={pvVal}>{fournisseurDetail?.stat || ""}</td></tr>
            <tr><td style={pvLabel}>Contact</td><td style={pvVal}>{fournisseurDetail?.contact || ""}</td>
                <td style={pvLabel}>Tél</td><td style={pvVal}>{fournisseurDetail?.telephone || ""}</td></tr>
            <tr><td style={pvLabel}>N° BC UF2</td><td style={pvVal}>{bc.numero}</td>
                <td style={pvLabel}>Demande liée</td><td style={pvVal}>{demande ? `${demande.numero} — ${demande.service}` : "BC direct"}</td></tr>
            <tr><td style={pvLabel}>Type de livraison</td><td style={pvVal}>{saisie.typeLivraison}</td>
                <td style={pvLabel}>N° BL</td><td style={pvVal}>{saisie.numeroBl}</td></tr>
            <tr><td style={pvLabel}>Date de livraison</td><td style={pvVal}>{saisie.dateLivraisonTerrain || "____________"}</td>
                <td style={pvLabel}>Nom Réceptionnaire du Magasin</td><td style={pvVal}>{saisie.receptionnaire === "Autre" ? saisie.receptionnaireAutre : "____________"}</td></tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr>
              <th style={pvTh}>BC UF2 n°</th><th style={pvTh}>Description</th><th style={pvTh}>Quantité</th>
              <th style={pvTh}>Unité</th><th style={pvTh}>Déjà livré</th><th style={pvTh}>Quantité livré (ce jour)</th>
              <th style={pvTh}>Reste à Livrer</th><th style={pvTh}>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const deja = cumulLivre(l.id);
              const maintenant = quantitesSaisie[l.id] ?? "";
              const reste = Math.max(0, Number(l.quantite) - deja - (Number(maintenant) || 0));
              return (
                <tr key={l.id}>
                  <td style={pvTd}>{i === 0 ? bc.numero : ""}</td>
                  <td style={pvTd}>{l.designation}</td>
                  <td style={pvTd}>{l.quantite}</td>
                  <td style={pvTd}>{l.unite}</td>
                  <td style={pvTd}>{deja}</td>
                  <td style={pvTd}>{maintenant}</td>
                  <td style={pvTd}>{reste}</td>
                  <td style={pvTd}></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 50, fontSize: 12 }}>Signatures, Date, Nom :</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
          {["RESPONSABLE MAGASIN", "MAGASINIER", "AGENT DE SECURITE", "LIVREUR ou TRANSPORTEUR"].map((s) => (
            <div key={s} style={{ width: "22%", borderTop: "1px solid #333", paddingTop: 6, textAlign: "center", fontSize: 11 }}>{s}</div>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}

const thStyle = { textAlign: "left", padding: "8px 6px", color: "#888", borderBottom: "1px solid #eee" };
const tdStyle = { padding: "8px 6px", borderBottom: "1px solid #f5f5f5" };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const rowTotal = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 };
const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const miniLabel = { display: "block", fontSize: 11, color: "#999", marginBottom: 2 };
const pvLabel = { padding: "4px 6px", color: "#666", fontWeight: 600, border: "1px solid #eee", width: "15%" };
const pvVal = { padding: "4px 6px", border: "1px solid #eee", width: "35%" };
const pvTh = { border: "1px solid #ccc", padding: "6px 4px", background: "#F0F7F2" };
const pvTd = { border: "1px solid #ddd", padding: "6px 4px" };
