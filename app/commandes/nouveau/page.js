"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AuthGuard from "../../components/AuthGuard";
import Autocomplete from "../../components/Autocomplete";
import { inputStyle, buttonStyle, linkBtn } from "../../components/ui";

const ligneVide = () => ({
  key: Math.random().toString(36).slice(2),
  ligne_demande_id: null,
  designation: "",
  quantite: 1,
  unite: "pcs",
  prix_unitaire_ht: "",
  remise_pct: 0,
  date_livraison: "",
});

const estBoisDeChauffage = (designation) => {
  const d = (designation || "").toLowerCase();
  return d.includes("bois de chauffage") || d.includes("bois chauffage");
};

export default function NouveauBCDirectPage() {
  return (
    <Suspense fallback={<AuthGuard><p>Chargement...</p></AuthGuard>}>
      <NouveauBCDirectInner />
    </Suspense>
  );
}

function NouveauBCDirectInner() {
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
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: f, error: fournisseursError } = await supabase
          .from("fournisseurs")
          .select("*")
          .order("nom")
          .limit(10000);

        if (fournisseursError) {
          console.error("Erreur chargement fournisseurs :", fournisseursError);
        }

        const { data: a, error: articlesError } = await supabase
          .from("articles")
          .select("id, designation, unite_defaut, dernier_prix_ht")
          .limit(10000);

        if (articlesError) {
          console.error("Erreur chargement articles :", articlesError);
        }

        setFournisseurs(f || []);
        setArticlesBase(a || []);

        if (demandeId) {
          const { data: d, error: demandeError } = await supabase
            .from("demandes")
            .select("*")
            .eq("id", demandeId)
            .maybeSingle();

          if (demandeError) {
            console.error("Erreur chargement demande :", demandeError);
          }

          setDemande(d || null);

          const { data: ld, error: lignesDemandeError } = await supabase
            .from("lignes_demande")
            .select("*")
            .eq("demande_id", demandeId)
            .order("created_at");

          if (lignesDemandeError) {
            console.error(
              "Erreur chargement lignes de demande :",
              lignesDemandeError
            );
          }

          if (ld && ld.length) {
            setLignes(
              ld.map((l) => {
                const art = (a || []).find(
                  (x) =>
                    x.designation.toLowerCase() ===
                    l.designation.toLowerCase()
                );

                return {
                  key: l.id,
                  ligne_demande_id: l.id,
                  designation: l.designation,
                  quantite: l.quantite,
                  unite: l.unite,
                  prix_unitaire_ht: art?.dernier_prix_ht || "",
                  remise_pct: 0,
                  date_livraison: l.date_livraison || "",
                };
              })
            );
          }
        }
      } catch (e) {
        console.error("Erreur chargement page BC direct :", e);
      }
    })();
  }, [demandeId]);

  const choisirFournisseur = (nom) => {
    const f = fournisseurs.find((x) => x.nom === nom);

    if (f) {
      setFournisseurChoisi(f);
      setAssujettiTva(f.tva_defaut_pct !== 0);
      setErreur("");
    }
  };

  const updateLigne = (key, field, val) =>
    setLignes((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: val } : l))
    );

  const addLigne = () => setLignes([...lignes, ligneVide()]);

  const removeLigne = (key) =>
    setLignes(lignes.filter((l) => l.key !== key));

  const onDesignationChange = (key, val) => {
    updateLigne(key, "designation", val);

    const match = articlesBase.find(
      (a) => a.designation.toLowerCase() === val.toLowerCase()
    );

    if (match) {
      updateLigne(key, "unite", match.unite_defaut || "pcs");

      if (match.dernier_prix_ht) {
        updateLigne(key, "prix_unitaire_ht", match.dernier_prix_ht);
      }
    }
  };

  const onUniteBlur = async (designation, unite) => {
    const match = articlesBase.find(
      (a) => a.designation.toLowerCase() === designation.toLowerCase()
    );

    if (match && unite && unite !== match.unite_defaut) {
      const { error } = await supabase
        .from("articles")
        .update({ unite_defaut: unite })
        .eq("id", match.id);

      if (error) {
        console.error("Erreur mise à jour unité :", error);
        return;
      }

      setArticlesBase((prev) =>
        prev.map((a) =>
          a.id === match.id
            ? { ...a, unite_defaut: unite }
            : a
        )
      );
    }
  };

  const totaux = lignes.reduce(
    (acc, l) => {
      const m =
        (Number(l.quantite) || 0) *
        (Number(l.prix_unitaire_ht) || 0) *
        (1 - (Number(l.remise_pct) || 0) / 100);

      return { ht: acc.ht + m };
    },
    { ht: 0 }
  );

  const tva = assujettiTva ? totaux.ht * 0.2 : 0;
  const ttc = totaux.ht + tva;

  const creer = async () => {
    setErreur("");

    // ------------------------------------------------------------
    // 1. Vérification fournisseur
    // ------------------------------------------------------------
    if (!fournisseurChoisi) {
      setErreur("Veuillez sélectionner un fournisseur.");
      return;
    }

    // ------------------------------------------------------------
    // 2. Vérification des lignes
    // ------------------------------------------------------------
    const lignesValides = lignes.filter(
      (l) =>
        l.designation &&
        l.designation.trim() &&
        l.prix_unitaire_ht !== "" &&
        l.prix_unitaire_ht !== null &&
        l.prix_unitaire_ht !== undefined
    );

    if (lignesValides.length === 0) {
      setErreur(
        "Veuillez ajouter au moins une ligne avec une désignation et un prix unitaire HT."
      );
      return;
    }

    setEnvoi(true);

    try {
      let montantHT = 0;
      const lignesBcPayload = [];
      let auMoinsUnBois = false;

      // ----------------------------------------------------------
      // 3. Préparation des lignes et création des articles manquants
      // ----------------------------------------------------------
      for (const l of lignesValides) {
        let article = articlesBase.find(
          (a) =>
            a.designation.toLowerCase() ===
            l.designation.trim().toLowerCase()
        );

        if (!article) {
          const {
            data: nouvel,
            error: articleError,
          } = await supabase
            .from("articles")
            .insert({
              designation: l.designation.trim(),
              unite_defaut: l.unite || "pcs",
              dernier_prix_ht: Number(l.prix_unitaire_ht),
            })
            .select()
            .single();

          if (articleError) {
            console.error(
              "Erreur création article :",
              articleError
            );

            throw new Error(
              `Impossible de créer l'article "${l.designation}". ${articleError.message || ""}`
            );
          }

          article = nouvel;

          // Mise à jour locale de la liste des articles
          setArticlesBase((prev) => [...prev, article]);
        }

        const quantite = Number(l.quantite) || 1;
        const prix = Number(l.prix_unitaire_ht) || 0;
        const remise = Number(l.remise_pct) || 0;

        const m =
          quantite *
          prix *
          (1 - remise / 100);

        montantHT += m;

        if (estBoisDeChauffage(l.designation)) {
          auMoinsUnBois = true;
        }

        lignesBcPayload.push({
          ligne_demande_id: l.ligne_demande_id,
          designation: l.designation.trim(),
          quantite,
          unite: l.unite || "pcs",
          prix_unitaire_ht: prix,
          remise_pct: remise,
          montant_ht: m,
          date_livraison: l.date_livraison || null,
        });
      }

      const tvaFinal = assujettiTva
        ? montantHT * 0.2
        : 0;

      // ----------------------------------------------------------
      // 4. Création du bon de commande
      // ----------------------------------------------------------
      const {
        data: bc,
        error: bcError,
      } = await supabase
        .from("commandes")
        .insert({
          demande_id: demandeId || null,
          fournisseur_id: fournisseurChoisi.id,
          fournisseur_nom: fournisseurChoisi.nom,
          assujetti_tva: assujettiTva,
          montant_ht: montantHT,
          montant_tva: tvaFinal,
          montant_ttc: montantHT + tvaFinal,
          reference_devis: referenceDevis.trim() || null,
        })
        .select()
        .single();

      // ----------------------------------------------------------
      // IMPORTANT :
      // Avant, l'erreur Supabase était ignorée ici.
      // ----------------------------------------------------------
      if (bcError) {
        console.error(
          "Erreur création BC :",
          bcError
        );

        throw new Error(
          `Impossible de créer le bon de commande. ${bcError.message || ""}`
        );
      }

      if (!bc) {
        throw new Error(
          "Le bon de commande n'a pas pu être créé : aucune donnée retournée par Supabase."
        );
      }

      console.log("BC créé avec succès :", bc);

      // ----------------------------------------------------------
      // 5. Création des lignes du BC
      // ----------------------------------------------------------
      const {
        data: lignesInserees,
        error: lignesError,
      } = await supabase
        .from("lignes_bc")
        .insert(
          lignesBcPayload.map((l) => ({
            ...l,
            bc_id: bc.id,
          }))
        )
        .select();

      if (lignesError) {
        console.error(
          "Erreur création lignes BC :",
          lignesError
        );

        throw new Error(
          `Le BC a été créé mais ses lignes n'ont pas pu être enregistrées. ${lignesError.message || ""}`
        );
      }

      if (!lignesInserees || lignesInserees.length === 0) {
        throw new Error(
          "Le BC a été créé mais aucune ligne n'a été enregistrée."
        );
      }

      // ----------------------------------------------------------
      // 6. Mise à jour de la demande
      // ----------------------------------------------------------
      if (demandeId) {
        const {
          error: demandeUpdateError,
        } = await supabase
          .from("demandes")
          .update({
            statut: "Basculée en commande",
          })
          .eq("id", demandeId);

        if (demandeUpdateError) {
          console.error(
            "Erreur mise à jour demande :",
            demandeUpdateError
          );

          throw new Error(
            `Le BC a été créé mais la demande n'a pas pu être mise à jour. ${demandeUpdateError.message || ""}`
          );
        }
      }

      // ----------------------------------------------------------
      // 7. Réception automatique pour le bois de chauffage
      // ----------------------------------------------------------
      if (auMoinsUnBois && lignesInserees?.length) {
        const datesLivraison = lignesInserees
          .map((l) => l.date_livraison)
          .filter(Boolean)
          .sort();

        const dateReception = datesLivraison.length
          ? datesLivraison[datesLivraison.length - 1]
          : new Date().toISOString().slice(0, 10);

        const {
          data: reception,
          error: receptionError,
        } = await supabase
          .from("receptions")
          .insert({
            bc_id: bc.id,
            statut: "Totale",
            date_reception_reelle: dateReception,
            receptionnaire:
              "Livraison directe (bois de chauffage)",
          })
          .select()
          .single();

        if (receptionError) {
          console.error(
            "Erreur création réception bois :",
            receptionError
          );

          throw new Error(
            `Le BC a été créé mais la réception automatique du bois n'a pas pu être créée. ${receptionError.message || ""}`
          );
        }

        if (reception) {
          const {
            error: lignesReceptionError,
          } = await supabase
            .from("lignes_reception")
            .insert(
              lignesInserees.map((l) => ({
                reception_id: reception.id,
                ligne_bc_id: l.id,
                quantite_livree: l.quantite,
              }))
            );

          if (lignesReceptionError) {
            console.error(
              "Erreur lignes réception bois :",
              lignesReceptionError
            );

            throw new Error(
              `La réception a été créée mais ses lignes n'ont pas pu être enregistrées. ${lignesReceptionError.message || ""}`
            );
          }
        }
      }

      // ----------------------------------------------------------
      // 8. Tout est OK → ouverture du BC
      // ----------------------------------------------------------
      router.push(`/commandes/${bc.id}`);

    } catch (error) {
      console.error(
        "Erreur complète création BC direct :",
        error
      );

      setErreur(
        error?.message ||
        "Une erreur est survenue lors de la création du bon de commande."
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <AuthGuard>
      <button
        onClick={() =>
          router.push(
            demandeId
              ? `/demandes/${demandeId}`
              : "/commandes"
          )
        }
        style={{ ...linkBtn, marginBottom: 16 }}
      >
        &larr; Retour
      </button>

      <h1 style={{ fontSize: 18, marginBottom: 4 }}>
        Créer un bon de commande directement
      </h1>

      <p
        style={{
          fontSize: 13,
          color: "#888",
          marginBottom: 16,
        }}
      >
        {demande ? (
          <>
            Depuis la demande{" "}
            <strong>{demande.numero}</strong> — sans passer
            par un comparatif TCO.
          </>
        ) : (
          "Sans passer par une demande/TCO — pour les articles disponibles chez un seul fournisseur ou un fournisseur déjà recommandé/imposé."
        )}
      </p>

      {erreur && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Erreur :</strong>{" "}
          {erreur}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow:
            "0 1px 3px rgba(16,24,40,0.05)",
          border: "1px solid #ECEBE6",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          Fournisseur
        </h2>

        {fournisseurChoisi ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong>{fournisseurChoisi.nom}</strong>

            <button
              onClick={() => {
                setFournisseurChoisi(null);
                setErreur("");
              }}
              style={linkBtn}
            >
              Changer
            </button>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#666",
              }}
            >
              <input
                type="checkbox"
                checked={!assujettiTva}
                onChange={(e) =>
                  setAssujettiTva(!e.target.checked)
                }
              />
              Fournisseur non taxable
            </label>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Autocomplete
              placeholder="Taper le nom du fournisseur..."
              value={rechercheFournisseur}
              onChange={setRechercheFournisseur}
              onSelect={choisirFournisseur}
              suggestions={fournisseurs.map(
                (f) => f.nom
              )}
              style={{
                width: 320,
                maxWidth: "100%",
              }}
            />

            <button
              onClick={() =>
                choisirFournisseur(
                  fournisseurs.find(
                    (x) =>
                      x.nom.toLowerCase() ===
                      rechercheFournisseur
                        .trim()
                        .toLowerCase()
                  )?.nom
                )
              }
              style={buttonStyle}
            >
              Choisir
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow:
            "0 1px 3px rgba(16,24,40,0.05)",
          border: "1px solid #ECEBE6",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          Référence
        </h2>

        <input
          placeholder="Réf. devis fournisseur (visible sur le BC imprimé)"
          value={referenceDevis}
          onChange={(e) =>
            setReferenceDevis(e.target.value)
          }
          style={{
            ...inputStyle,
            width: "100%",
          }}
        />
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow:
            "0 1px 3px rgba(16,24,40,0.05)",
          border: "1px solid #ECEBE6",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          Articles
        </h2>

        {lignes.map((l) => {
          const bois = estBoisDeChauffage(
            l.designation
          );

          return (
            <div
              key={l.key}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              {bois && (
                <input
                  type="date"
                  value={l.date_livraison}
                  onChange={(e) =>
                    updateLigne(
                      l.key,
                      "date_livraison",
                      e.target.value
                    )
                  }
                  title="Date de livraison réelle (un voyage = une ligne)"
                  style={{
                    ...inputStyle,
                    width: 150,
                  }}
                />
              )}

              <Autocomplete
                placeholder="Désignation"
                value={l.designation}
                onChange={(val) =>
                  onDesignationChange(
                    l.key,
                    val
                  )
                }
                suggestions={articlesBase.map(
                  (a) => a.designation
                )}
                style={{
                  flex: 2,
                  minWidth: 160,
                }}
              />

              <input
                type="number"
                placeholder="Qté"
                value={l.quantite}
                onChange={(e) =>
                  updateLigne(
                    l.key,
                    "quantite",
                    e.target.value
                  )
                }
                style={{
                  ...inputStyle,
                  width: 80,
                }}
              />

              <input
                placeholder="unité"
                value={l.unite}
                onChange={(e) =>
                  updateLigne(
                    l.key,
                    "unite",
                    e.target.value
                  )
                }
                onBlur={(e) =>
                  onUniteBlur(
                    l.designation,
                    e.target.value
                  )
                }
                style={{
                  ...inputStyle,
                  width: 80,
                }}
              />

              <input
                type="number"
                placeholder="PU HT"
                value={l.prix_unitaire_ht}
                onChange={(e) =>
                  updateLigne(
                    l.key,
                    "prix_unitaire_ht",
                    e.target.value
                  )
                }
                style={{
                  ...inputStyle,
                  width: 110,
                }}
              />

              <input
                type="number"
                placeholder="remise %"
                value={l.remise_pct}
                onChange={(e) =>
                  updateLigne(
                    l.key,
                    "remise_pct",
                    e.target.value
                  )
                }
                style={{
                  ...inputStyle,
                  width: 90,
                }}
              />

              <button
                onClick={() =>
                  removeLigne(l.key)
                }
                style={linkBtn}
              >
                Retirer
              </button>
            </div>
          );
        })}

        <button
          onClick={addLigne}
          style={{
            ...buttonStyle,
            background: "#888",
          }}
        >
          + Ajouter une ligne
        </button>

        <div
          style={{
            marginTop: 16,
            fontSize: 13,
          }}
        >
          <div>
            Total HT :{" "}
            <strong>
              {totaux.ht.toLocaleString(
                "fr-FR"
              )}{" "}
              Ar
            </strong>
          </div>

          <div>
            TVA :{" "}
            {assujettiTva
              ? `${tva.toLocaleString(
                  "fr-FR"
                )} Ar`
              : "Non taxable"}
          </div>

          <div>
            Total TTC :{" "}
            <strong>
              {ttc.toLocaleString(
                "fr-FR"
              )}{" "}
              Ar
            </strong>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={creer}
            disabled={
              envoi ||
              !fournisseurChoisi
            }
            style={buttonStyle}
          >
            {envoi
              ? "Création..."
              : "Créer le bon de commande"}
          </button>
        </div>
      </div>
    </AuthGuard>
  );
}
