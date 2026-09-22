"use client";
import { useState, useCallback } from "react";

// Détecte si un formulaire a des modifications non enregistrées, pour
// mettre en évidence le bouton "Enregistrer" correspondant (voir
// boutonSelonModif dans components/ui.js pour le style à appliquer).
//
// Usage :
//   const suivi = useDirty(monEtatDeFormulaire);
//   ...
//   <button style={boutonSelonModif(suivi.modifie)} onClick={async () => {
//     await enregistrer();
//     suivi.marquerSauvegarde();
//   }}>Enregistrer</button>
//
// Après un chargement asynchrone qui remplit le formulaire, appeler
// suivi.reinitialiser(donneesChargees) pour que ce premier remplissage ne
// soit pas compté comme une modification.
export function useDirty(valeurActuelle) {
  const [reference, setReference] = useState(() => JSON.stringify(valeurActuelle));

  const modifie = JSON.stringify(valeurActuelle) !== reference;

  const marquerSauvegarde = useCallback(() => {
    setReference(JSON.stringify(valeurActuelle));
  }, [valeurActuelle]);

  const reinitialiser = useCallback((nouvelleValeur) => {
    setReference(JSON.stringify(nouvelleValeur));
  }, []);

  return { modifie, marquerSauvegarde, reinitialiser };
}
