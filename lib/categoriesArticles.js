// Liste de référence des catégories d'articles — utilisée à la fois pour la
// création d'un article et pour la liste déroulante d'édition. Une catégorie
// employée sur des articles existants mais absente d'ici s'ajoute quand même
// automatiquement (les pages qui l'utilisent fusionnent avec les catégories
// déjà en base), donc rien ne se perd — celle-ci sert de socle standard.
export const CATEGORIES_BASE = [
  "Produits Chimiques",
  "Produits de Nettoyage / Hygiène",
  "Équipements de Protection (EPI)",
  "Consommables de Production",
  "Emballages & Conditionnement",
  "Pièces Détachées / Maintenance",
  "Équipements Électriques",
  "Matériaux de Construction",
  "Carburants & Lubrifiants",
  "Fournitures de Bureau",
  "Bois de Chauffage",
  "Matériel Informatique",
  "Services & Prestations",
  "Travaux / Main d'Œuvre",
  "Outillage/Quincaillerie",
  "Outillage Laboratoire",
  "Équipement Buanderie / Blanchisserie",
  "Médicament / Matériel Médical",
  "Consommable Laboratoire",
  "Mobilier / Matériel de Bureau",
  "Consommable / Ration Bureau",
  "Besoin Logement Expat",
  "Autre",
];

// Catégories considérées comme matières premières / directement liées à la
// production — seules celles-ci entrent dans le classement "Fréquence
// d'achat" (KPI). Les autres catégories (services, fournitures de bureau,
// EPI, pièces détachées...) s'achètent à la demande ou sur planification,
// pas selon un vrai cycle de consommation.
export const CATEGORIES_MATIERES_PREMIERES = [
  "Produits Chimiques",
  "Consommables de Production",
  "Emballages & Conditionnement",
  "Bois de Chauffage",
];

// Sous-ensemble de CATEGORIES_MATIERES_PREMIERES utilisé pour l'alerte
// "Réapprovisionnement à prévoir" (Tableau de bord) et le classement "Cycle
// de réapprovisionnement" (KPI). Le Bois de Chauffage en est exclu : ses
// livraisons sont quotidiennes et continues jusqu'à saturation du lieu de
// stockage, donc une alerte de cycle n'a pas de sens pour cette catégorie.
export const CATEGORIES_REAPPROVISIONNEMENT = CATEGORIES_MATIERES_PREMIERES.filter(
  (c) => c !== "Bois de Chauffage"
);
