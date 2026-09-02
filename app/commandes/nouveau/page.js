"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";

const ligneVide = () => ({ key: Math.random().toString(36).slice(2), designation: "", quantite: 1, unite: "pcs", prix_unitaire_ht: "", remise_pct: 0 });

export default function NouveauBCDirectPage() {
  const router = useRouter();
  const [fournisseurs, setFournisseurs] = useState([]);
  const [articlesBase, setArticlesBase] = useState([]);
  const [rechercheFournisseur, setRechercheFournisseur] = useState("");
  const [fournisseurChoisi, setFournisseurChoisi] = useState(null);
  const [assujettiTva, setAssujettiTva] = useState(true);
  const [lignes, setLignes] = useState([ligneVide()]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("fournisseurs").select("*").order("nom");
      const { data: a } = await supabase.from("articles").select("id, designation, unite_defaut, dernier_prix_ht");
      setFournisseurs(f || []);
      setArticlesBase(a || []);
    })();
  }, []);

  const choisirFournisseur = () => {
    const f = fournisseurs.find((x) => x.nom.toLowerCase() === rechercheFournisseur.trim().toLowerCase());
    if (f) { setFournisseurChoisi(f); setAssujettiTva(f.tva_defaut_pct !== 0); }
  };

  const updateLigne = (key, field, val) => setLignes(lignes.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  const addLigne = () => setLignes([...lignes, ligneVide()]);
  const removeLigne = (key) => setLignes(lignes.filter((l) => l.key !== key));

  const onDesignationChange = (key, val) => {
    updateLigne(key, "designation", val);
    const match = articlesBase.find((a) => a.designation.toLowerCase() === val.toLowerCase());
    if (match) {
      updateLigne(key, "unite", match.unite_defaut || "pcs");
      if (match.dernier_prix_ht) updateLigne(key, "prix_unitaire_ht", match.dernier_prix_ht);
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
    for (const l of lignesValides) {
      let article = articlesBase.find((a) => a.designation.toLowerCase() === l.designation.toLowerCase());
      if (!article) {
        const { data: nouvel } = await supabase.from("articles").insert({ designation: l.designation, unite_defaut: l.unite || "pcs", dernier_prix_ht: Number(l.prix_unitaire_ht) }).select().single();
        article = nouvel;
      }
      const m = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      montantHT += m;
      lignesBcPayload.push({
        designation: l.designation, quantite: Number(l.quantite) || 1, unite: l.unite,
        prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0, remise_pct: Number(l.remise_pct) || 0, montant_ht: m,
      });
    }
    const tvaFinal = assujettiTva ? montantHT * 0.2 : 0;

    const { data: bc } = await supabase
      .from("commandes")
      .insert({
        demande_id: null, fournisseur_id: fournisseurChoisi.id, fournisseur_nom: fournisseurChoisi.nom,
        assujetti_tva: assujettiTva, montant_ht: montantHT, montant_tva: tvaFinal, montant_ttc: montantHT + tvaFinal,
      })
      .select()
      .single();

    if (bc) {
      await supabase.from("lignes_bc").insert(lignesBcPayload.map((l) => ({ ...l, bc_id: bc.id })));
      router.push(`/commandes/${bc.id}`);
    }
    setEnvoi(false);
  };

  return (
    <AuthGuard>
      <button onClick={() => router.push("/commandes")} style={{ ...linkBtn, marginBottom: 16 }}>&larr; Retour aux commandes</button>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Créer un bon de commande directement</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        Sans passer par une demande/TCO — pour les articles disponibles chez un seul fournisseur ou un fournisseur déjà recommandé/imposé.
      </p>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Fournisseur</h2>
        {fournisseurChoisi ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <strong>{fournisseurChoisi.nom}</strong>
            <button onClick={() => setFournisseurChoisi(null)} style={linkBtn}>Changer</button>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#666" }}>
              <input type="checkbox" checked={!assujettiTva} onChange={(e) => setAssujettiTva(!e.target.checked)} />
              Fournisseur non taxable
            </label>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Taper le nom du fournisseur..."
              value={rechercheFournisseur}
              onChange={(e) => setRechercheFournisseur(e.target.value)}
              list="liste-fournisseurs-direct"
              style={{ ...inputStyle, width: 320 }}
            />
            <datalist id="liste-fournisseurs-direct">
              {fournisseurs.map((f) => <option key={f.id} value={f.nom} />)}
            </datalist>
            <button onClick={choisirFournisseur} style={buttonStyle}>Choisir</button>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Articles</h2>
        <datalist id="liste-articles-direct">
          {articlesBase.map((a) => <option key={a.id} value={a.designation} />)}
        </datalist>
        {lignes.map((l) => (
          <div key={l.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input placeholder="Désignation" value={l.designation} onChange={(e) => onDesignationChange(l.key, e.target.value)} list="liste-articles-direct" style={{ ...inputStyle, flex: 2 }} />
            <input type="number" placeholder="Qté" value={l.quantite} onChange={(e) => updateLigne(l.key, "quantite", e.target.value)} style={{ ...inputStyle, width: 80 }} />
            <input placeholder="unité" value={l.unite} onChange={(e) => updateLigne(l.key, "unite", e.target.value)} style={{ ...inputStyle, width: 80 }} />
            <input type="number" placeholder="PU HT" value={l.prix_unitaire_ht} onChange={(e) => updateLigne(l.key, "prix_unitaire_ht", e.target.value)} style={{ ...inputStyle, width: 110 }} />
            <input type="number" placeholder="remise %" value={l.remise_pct} onChange={(e) => updateLigne(l.key, "remise_pct", e.target.value)} style={{ ...inputStyle, width: 90 }} />
            <button onClick={() => removeLigne(l.key)} style={linkBtn}>Retirer</button>
          </div>
        ))}
        <button onClick={addLigne} style={{ ...buttonStyle, background: "#888" }}>+ Ajouter une ligne</button>

        <div style={{ marginTop: 16, fontSize: 13 }}>
          <div>Total HT : <strong>{totaux.ht.toLocaleString("fr-FR")} Ar</strong></div>
          <div>TVA : {assujettiTva ? `${tva.toLocaleString("fr-FR")} Ar` : "Non taxable"}</div>
          <div>Total TTC : <strong>{ttc.toLocaleString("fr-FR")} Ar</strong></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={creer} disabled={envoi || !fournisseurChoisi} style={buttonStyle}>
            {envoi ? "Création..." : "Créer le bon de commande"}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}

const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
const buttonStyle = { padding: "8px 16px", borderRadius: 6, border: "none", background: "#1B2430", color: "#fff", fontSize: 13, cursor: "pointer" };
const linkBtn = { border: "none", background: "none", color: "#1B2430", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };

