// Petit cache en mémoire, partagé entre toutes les pages tant que l'onglet du
// navigateur reste ouvert (perdu au rechargement complet, ce qui est
// acceptable pour des données de référence comme les articles/fournisseurs).
//
// But : éviter de re-télécharger les mêmes listes (articles, fournisseurs...)
// à chaque changement d'écran alors qu'elles changent rarement — la
// navigation devient quasi instantanée une fois les données déjà en cache.
//
// Usage :
//   const data = await chargerAvecCache("articles", () =>
//     supabase.from("articles").select("id, designation, unite_defaut, continue_par_id").limit(10000).then(r => r.data)
//   );

const cache = new Map(); // cle -> { data, expire }
const DUREE_PAR_DEFAUT_MS = 12 * 1000; // 12 secondes

export async function chargerAvecCache(cle, chargeur, dureeMs = DUREE_PAR_DEFAUT_MS) {
  const entree = cache.get(cle);
  if (entree && entree.expire > Date.now()) {
    return entree.data;
  }
  const data = await chargeur();
  cache.set(cle, { data, expire: Date.now() + dureeMs });
  return data;
}

// À appeler après une modification (création/édition/suppression) d'une
// donnée mise en cache, pour que la prochaine lecture soit fraîche tout de
// suite au lieu d'attendre l'expiration naturelle.
export function invaliderCache(cle) {
  cache.delete(cle);
}

export function invaliderToutLeCache() {
  cache.clear();
}
