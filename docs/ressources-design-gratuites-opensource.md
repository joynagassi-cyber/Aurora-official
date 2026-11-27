# Répertoire Complet des Ressources de Design Gratuites, Open Source & Self-Hosted

Ce document centralise toutes les bibliothèques, API gratuites et dépôts auto-hébergeables (Self-Hosted) pour alimenter une application de **design graphique vectoriel** et de **design UI/UX** à coût nul (0 $), sans quotas bloquants.

---

## 1. Icônes UI / UX & Systèmes Vectoriels (Self-Hosted & API Gratuites)

### Iconify
* **Type :** Méga-agrégateur d'icônes vectorielles (200+ collections, 300 000+ icônes : Lucide, Phosphor, Material Symbols, Tabler, Remix, Heroicons, Radix).
* **Licence :** MIT / Apache 2.0 / ISC (selon les packs).
* **Mode d'accès :**
  * API publique gratuite sans clé (`https://api.iconify.design`).
  * Auto-hébergeable via Docker (`iconify/api`) ou Node.js.
  * Téléchargeable en paquets JSON bruts (`@iconify/json`) pour un fonctionnement 100 % hors-ligne.
* **URL officielle :** https://iconify.design/

### Lucide Icons
* **Type :** Icônes d'interface minimalistes et cohérentes (fork communautaire de Feather Icons).
* **Licence :** ISC (Open Source, usage commercial libre).
* **Mode d'accès :** Packages NPM, fichiers SVG bruts sur GitHub, ou via Iconify.
* **URL officielle :** https://lucide.dev/

### Phosphor Icons
* **Type :** Famille d'icônes flexibles en 6 graisses (Thin, Light, Regular, Bold, Fill, Duotone).
* **Licence :** MIT.
* **Mode d'accès :** Dépôt GitHub SVG, NPM, CDN, ou via Iconify.
* **URL officielle :** https://phosphoricons.com/

### Tabler Icons
* **Type :** Plus de 5 500 icônes vectorielles pixel-perfect sur grille 24x24.
* **Licence :** MIT.
* **Mode d'accès :** Dépôt GitHub SVG, NPM, ou via Iconify.
* **URL officielle :** https://tabler.io/icons

---

## 2. Logos de Marques, Tech & Cloud (API & CDN Gratuits)

### SVGL
* **Type :** Bibliothèque de logos vectoriels optimisés (entreprises, frameworks, langages, outils SaaS).
* **Licence :** MIT (Open Source).
* **Mode d'accès :** API REST publique (`https://api.svgl.app`), dépôt GitHub clonable et auto-hébergeable.
* **URL officielle :** https://svgl.app/

### thesvg
* **Type :** Plus de 7 600 logos vectoriels avec variantes (couleur, monochrome, mode sombre, wordmark).
* **Licence :** MIT / Open Source.
* **Mode d'accès :** API publique, NPM, ou chargement direct via CDN jsDelivr.
* **URL officielle :** https://thesvg.org/

### Simple Icons
* **Type :** Plus de 3 000 icônes SVG de marques populaires en monochrome.
* **Licence :** CC0 1.0 (Domaine Public).
* **Mode d'accès :** Package NPM, dépôt GitHub, CDN jsDelivr.
* **URL officielle :** https://simpleicons.org/

---

## 3. Illustrations Vectorielles UI / UX & Éditoriales (Libres de Droits)

### unDraw
* **Type :** Illustrations vectorielles modernes pour interfaces web, mobile et écrans d'accueil.
* **Licence :** Licence ouverte personnalisée (usage commercial gratuit, sans attribution requise).
* **Atout technique :** Couleur d'accentuation unique facilement remplaçable dynamiquement dans le code SVG.
* **URL officielle :** https://undraw.co/

### Open Peeps
* **Type :** Bibliothèque modulaire d'illustrations de personnages dessinés à la main.
* **Licence :** CC0 (Domaine Public).
* **Atout technique :** Calques SVG séparés (têtes, coiffures, expressions, bustes, postures) permettant d'assembler des milliers de combinaisons dans un éditeur.
* **URL officielle :** https://www.openpeeps.com/

### Humaaans
* **Type :** Système modulaire d'illustrations humaines vectorielles (positions, vêtements, arrière-plans).
* **Licence :** CC0 (Domaine Public).
* **URL officielle :** https://humaaans.com/

### Open Doodles
* **Type :** Collection d'illustrations vectorielles au trait libre et expressif.
* **Licence :** CC0 (Domaine Public).
* **URL officielle :** https://www.opendoodles.com/

### ManyPixels Illustrations
* **Type :** Galerie d'illustrations vectorielles catégorisées (business, tech, éducation, marketing) avec sélecteur de couleur.
* **Licence :** Libre de droits (usage commercial gratuit sans attribution).
* **URL officielle :** https://www.manypixels.co/gallery

---

## 4. Banques Généralistes avec API Gratuites (Vecteurs & Photos)

### Pixabay API
* **Type :** Banque massive de vecteurs, illustrations et photos libres de droits.
* **Licence :** Licence Pixabay (usage commercial gratuit).
* **Quota API gratuit :** 100 requêtes par minute (filtrable avec `image_type=vector` ou `image_type=illustration`).
* **Contraintes :** Mise en cache locale de 24 h exigée et mention de la source.
* **URL officielle :** https://pixabay.com/api/docs/

### GetIllustrations API
* **Type :** Packs d'illustrations vectorielles éditoriales (SVG et PNG).
* **Quota API gratuit :** 1 500 appels par mois sur le catalogue gratuit.
* **URL officielle :** https://getillustrations.com/illustrations-api

### SVG Repo
* **Type :** Plus de 500 000 vecteurs, icônes, badges et ornements graphiques.
* **Licence :** Filtrable par licence (CC0, MIT, Apache).
* **Mode d'accès :** Téléchargement direct de collections SVG pour indexation sur stockage statique.
* **URL officielle :** https://www.svgrepo.com/

---

## 5. Générateurs Procéduraux & Formes Géométriques (Sans Stockage)

### Haikei
* **Type :** Générateur de formes vectorielles SVG (vagues, dégradés maillés, blobs, grilles, motifs géométriques).
* **Usage :** Idéal pour reproduire la logique mathématique côté client et générer des arrière-plans infinis sans appel réseau.
* **URL officielle :** https://haikei.app/

### Blobmaker
* **Type :** Générateur de formes organiques SVG basées sur des courbes de Bézier.
* **URL officielle :** https://www.blobmaker.app/

---

## 6. Architecture d'Hébergement & Cache Recommandée (Coût 0 $)

| Composant | Technologie recommandée | Capacité / Limite gratuite | Rôle dans l'application |
| :--- | :--- | :--- | :--- |
| **API Icônes** | Iconify API (Docker Self-Hosted) | Illimité | Recherche et rendu SVG dynamique des icônes UI |
| **Stockage Vecteurs** | Cloudflare R2 | 10 Go stockage, bande passante illimitée | Hébergement des collections SVG (unDraw, Open Peeps, CC0) |
| **Index de recherche** | Fichier `catalog-index.json` statique | Illimité | Métadonnées, tags et URLs chargés au démarrage |
| **Cache Client** | IndexedDB (Navigateur) | Plusieurs centaines de Mo | Recherche instantanée hors-ligne et cache API 24h |

---

## 7. Implémentation actuelle dans Aurora (24 novembre 2026)

- L’outil agent `poster_search_design_assets` interroge Iconify ou SVGL via des routes serveur Aurora; les requêtes du navigateur ne contactent pas directement ces fournisseurs.
- Les icônes Iconify ne sont ajoutées au poster que si la collection fournit une licence SPDX présente dans l’ensemble actuellement autorisé par le MVP. L’agent revalide cette licence côté serveur au moment du placement; le SVG est limité en taille, assaini puis enregistré dans un calque image avec auteur, collection, licence et URL source.
- SVGL sert uniquement de recherche de logos pour l’instant. Ses résultats sont informatifs et ne sont jamais ajoutés automatiquement: absence de licence par logo et droits de marque nécessitent une vérification séparée.
- La liste ci-dessus reste un inventaire de pistes, pas une déclaration que chaque ressource a été vérifiée, intégrée ou qu’elle accorde automatiquement les droits d’usage. Les autres fournisseurs (Pixabay, SVG Repo, bibliothèques d’illustrations, etc.) ne sont pas connectés par cette première tranche; vérifier leurs conditions propres avant de les activer.
