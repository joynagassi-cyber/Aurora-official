# Audit technique et feuille de route — premier rendu Aurora

> **Mise à jour de décision :** Grida Desktop affiche au propriétaire « This chat is not available on this desktop or workspace. » Cela établit que son chat intégré n’est pas accessible dans ce contexte, mais ne prouve pas une panne du canvas. La recommandation antérieure « Grida est la base du canvas » est suspendue : l’Aurora actuelle utilise seulement un renderer WASM optionnel, dont le bon fonctionnement navigateur reste à vérifier séparément. La réévaluation Grida/FigCraft/FX/HyperFrames et ses critères GO/NO-GO sont dans [`decision-grida-figcraft-hyperframes.md`](./decision-grida-figcraft-hyperframes.md). Garder le SVG natif comme voie de rendu/édition fiable jusqu’à test; ne pas dépendre du chat Grida pour l’agent Aurora.

**État :** cadrage préalable à une nouvelle intégration importante \
**Horizon proposé :** 7 jours consécutifs, à convertir en jours ouvrés selon la disponibilité de l’équipe \
**Décision antérieure :** le renderer Grida était envisagé derrière le modèle Aurora. Cette décision est maintenant suspendue en attente d’un test reproductible et de l’évaluation de la base Grida complète contre FigCraft et les briques média.

## Résumé exécutif

La cible du MVP est plus ambitieuse qu’une simple première composition : l’utilisateur dirige en langage naturel; l’agent comprend le brief, consulte les ressources utiles, construit une affiche précise en couches éditables et peut manipuler le même canvas et ses assets au fil des corrections. La création d’éléments vectoriels/SVG, la génération d’images et la recherche d’assets en ligne font partie du résultat attendu dès le départ — pas d’une phase ultérieure.

Aurora a déjà un document de poster structuré, un protocole de création/complétion inspiré indépendamment de CreatiPoster, des outils d’édition ciblée, CopilotKit + Agnes et un rendu Grida/SVG. Mais l’audit confirme des lacunes importantes face à cette cible : aucun outil agent de recherche dans une bibliothèque distante n’est visible dans le dépôt; l’image générée est actuellement limitée au fond; la manipulation agentique ne couvre pas toutes les opérations de calques; la capacité SVG se limite aux formes et tracés du schéma plutôt qu’à un outil général d’assets SVG. Ces trous doivent être au cœur du plan.

**Définition proposée du MVP :** à partir d’un brief en français (et, le cas échéant, d’assets fournis), l’agent crée une affiche précise et visuellement cohérente, demande les faits manquants au lieu de les inventer, recherche et propose des ressources avec provenance, produit des éléments SVG simples et/ou des images, puis les compose en calques Aurora. L’utilisateur peut ensuite demander des corrections en langage naturel ou agir directement sur le canvas; les deux agissent sur le même document éditable et validé.

**Plan réaliste :** traiter cette cible comme un MVP avec un périmètre fonctionnel complet mais borné : un fournisseur d’images, une bibliothèque en ligne à licence/provenance explicites, un sous-ensemble SVG sûr et les opérations d’édition indispensables. Le planning d’une semaine est un plan de tranche verticale et comporte un jalon de faisabilité dès le premier jour; l’accès aux clés/services et aux règles de licence conditionne la démonstration réelle. Ne pas réduire silencieusement ces capacités à des mocks. A2UI ne remplace ni ces outils ni le canvas; il reste optionnel pour des cartes de choix/confirmation.

---

## 1. Inventaire du dépôt et état existant

| Domaine | Ce qui existe | Conséquence pour le plan |
|---|---|---|
| Application | React 19, Vite, TypeScript; chat et canvas côte à côte (`src/App.tsx`) | Garder l’architecture web actuelle; investir dans les tests du parcours réel. |
| Document | Schéma Zod versionné, couches texte/forme/tracé/image, provenance des assets, migration d’un ancien format (`src/canvas/model.ts`) | Le document Aurora reste la source de vérité et le format éditable. |
| Canvas | Sélection, déplacement, outils texte/crayon/gomme, couches, inspecteur, historique, sauvegarde locale et export sont présents dans `src/canvas/PosterCanvas.tsx` | Valider ce qui marche réellement et corriger les lacunes bloquantes; ne pas reconstruire ces fonctions. |
| Assets / génération | Upload manuel et placement d’images; `PathLayer` avec `d` SVG; endpoint Agnes `agnes-image-2.1-flash` pour générer un **fond** avec confirmation | Pas encore de recherche d’assets en ligne; pas de génération d’image générique qui ajoute un calque image; pas d’outil SVG explicite/validation géométrique au-delà du type path. Étendre sans accepter/exécuter du SVG/HTML arbitraire. |
| Rendu Grida | `@grida/canvas-wasm@0.91.0-canary.22`, chargement différé, conversion de SVG, rendu WebGL et repli SVG dans `src/canvas/GridaCanvasSurface.tsx` | Grida est un moteur facultatif derrière la scène SVG, pas un éditeur complet intégré. |
| Agent | CopilotKit `1.85.0`, runtime serveur Agnes (`server/aurora-agent.mjs`), outils frontend (`src/canvas/use-poster-agent-tools.ts`); protocole `poster_apply_protocol` et outils add/update/move/resize/style/shape/place asset/background/relayout/undo | La création structurée et une partie de la manipulation sont déjà là. Il manque les outils agent visibles pour supprimer/réordonner/masquer/verrouiller les calques et le parcours de recherche de ressources en ligne. Agnes requiert `AGNES_API_KEY`. |
| Livraison | Tests Node, vérifications TypeScript et build Vite disponibles | Les tests unitaires existants ne remplacent pas une vérification navigateur du rendu, des assets et des interactions. |
| Dépendances et bundle | Le build actuel passe, mais produit un chunk d’entrée d’environ 2,85 Mo (823 ko gzip), plusieurs chunks >500 ko et un binaire Grida WASM séparé d’environ 17,6 Mo non compressé / 6,5 Mo gzip | Contrôler le chargement différé et mesurer le démarrage sur le parcours utilisateur; consigner la taille comme risque UX/performance, sans faire de l’optimisation générale un bloqueur avant d’avoir mesuré le parcours. |

### Vérifications de base à refaire au démarrage

Validations relancées lors de la mise à jour du plan : `npm test` (3/3), `npx tsc -b`, `npm run build` et `git diff --check` réussissent. Le build conserve des avertissements Vite sur des modules Node externalisés et de gros chunks; aucune vérification manuelle navigateur n’a été effectuée dans cette passe. Le Jour 1 doit faire le smoke test avec et sans WebGL, avec image et avec Agnes actif.

---

## 2. Évaluation des technologies et des voies d’intégration

> Évaluation initiale FigCraft vs Grida : [document historique](./evaluation-figcraft-vs-grida.md). Réévaluation alignée sur la vision globale et le retour d’essai : [sélection Grida/FigCraft/FX/HyperFrames](./decision-grida-figcraft-hyperframes.md). Aucun moteur amont n’est validé pour le canvas Aurora avant un vertical slice navigateur.

### Grida : notes de l’approche initiale (à ne pas appliquer avant validation)

Les paragraphes ci-dessous consignent le raisonnement de la première passe, pas la décision en vigueur. La fiabilité de cette intégration est contestée par l’essai du propriétaire; exécuter d’abord les gates du document de réévaluation.

Le dépôt public `gridaco/grida` est un monorepo et l’éditeur complet s’appuie sur de nombreux paquets de workspace. Le paquet déjà installé `@grida/canvas-wasm` expose surtout les bindings et capacités du moteur canvas; il ne fournit pas l’éditeur React autonome, sa gestion de document complète ni tout son chrome d’édition. Les paquets voisins ne doivent donc pas être considérés comme des remplacements immédiats : leurs versions, APIs, licences et dépendances internes varient.

**Hypothèse initiale (non confirmée) :** conserver le document Aurora et les outils Aurora, produire le SVG depuis ce document, puis utiliser Grida WASM pour peindre ce SVG quand l’import réussit. Maintenir le SVG natif comme surface d’interaction/export et repli fiable. Cette séparation préserve les fonctions spécifiques d’Aurora et évite de migrer les documents ou les actions de l’agent vers un modèle tiers.

**À vérifier pendant la semaine :** comportement dans un vrai navigateur, latence de première initialisation, gestion des changements successifs, pertes éventuelles de contenu par l’importeur SVG, comportement WebGL indisponible, images distantes/data URI, redimensionnement et nettoyage du contexte WASM. Le fallback doit rester transparent pour l’utilisateur.

### CopilotKit et Agnes : conserver, clarifier l’orchestration

CopilotKit est déjà la couche de conversation et de connexion aux outils; Agnes est le fournisseur du modèle dans le runtime. L’agent reçoit des consignes pour préserver les calques, éviter d’inventer des faits et demander confirmation avant une génération de fond potentiellement facturable. Il faut tester que ces règles sont appliquées au runtime réel et que l’UI reflète les états d’erreur, de confirmation, d’exécution et de succès.

**Risque opérationnel :** sans `AGNES_API_KEY`, le runtime agent ne peut pas démarrer normalement. Le premier rendu doit rester testable en mode manuel/démo et l’interface doit expliquer clairement l’indisponibilité de l’agent plutôt que de laisser croire qu’une génération a eu lieu.

### A2UI : intérêt réel, mais pas encore une dépendance du MVP

A2UI décrit une interface générative via des données/éléments de surface que l’application rend avec un catalogue de composants autorisés. Cela peut être utile plus tard pour des panneaux structurés dans la conversation — propositions, choix de palette ou formulaire de clarification — mais ne remplace ni le document de poster Aurora ni le moteur canvas Grida.

Compatibilité constatée dans le dépôt et sur npm :

- Aurora utilise CopilotKit `1.85.0`; `@copilotkit/a2ui-renderer@1.85.0` dépend de `@a2ui/web_core@0.15.0`.
- Le renderer React officiel `@a2ui/react@0.16.1` accepte React 17, 18 et 19, et s’aligne sur `@a2ui/web_core ^0.16.1`.
- Le SDK agent officiel `@a2ui/agent@0.2.1` utilise aussi `@a2ui/web_core ^0.16.1`.
- Le registre npm consulté publie toujours les versions `@a2ui/react 0.16.1`, `@a2ui/agent 0.2.1` et `@a2ui/web_core 0.16.1`; le renderer CopilotKit et cette voie officielle ne sont donc pas alignés sur la même version du core.
- Le dépôt A2UI expose désormais la spécification v1.0 comme version courante; les numéros de version des paquets ne suffisent donc pas à démontrer que les flux produits et consommés parlent la même version du protocole.

**Deux voies possibles à comparer dans un prototype, sans mélanger les dépendances à l’aveugle :**

1. Renderer A2UI CopilotKit, pratique pour rester dans l’écosystème déjà installé, mais à confirmer qu’il sait traiter le format de protocole requis; dépendance au core `0.15.0`.
2. Renderer React officiel A2UI, plus proche du paquet officiel courant, mais nécessitant de définir et tester séparément l’intégration avec le runtime CopilotKit/Aurora; core `0.16.1`.

Avant tout choix, vérifier explicitement les messages/opérations supportés, le mapping d’événements, les actions vers les outils Aurora, les versions imbriquées dans l’arbre npm et la politique de rendu limité à un catalogue sûr. Ne pas installer à la fois deux versions incompatibles du core pour contourner le problème. A2UI reste hors du chemin critique du premier poster tant qu’un cas d’usage et une compatibilité vérifiée ne justifient pas son coût.

### Autres composants Grida : pistes secondaires, pas des dépendances du premier rendu

- `nothing` est un moteur graphique Rust distinct; il ne remplace pas directement l’adaptateur WASM actuellement validé.
- `editor-ui` est un framework d’interface d’éditeur, pas un moteur de rendu de poster; son intégration élargirait fortement la portée.
- Les outils de conversion de fichiers, SDK Figma, icônes, polices et bibliothèques d’assets peuvent soutenir des besoins ultérieurs (import, typographie, ressources), mais n’améliorent pas nécessairement le premier parcours prompt→poster.
- Avant d’ajouter un paquet ou des assets, vérifier la fraîcheur, la compatibilité, le coût de bundle et la licence exacte du composant et de ses ressources.

---

## 3. Périmètre du MVP clarifié

### Parcours produit indispensable

1. **Brief en langage naturel → affiche précise.** Extraire le format, le public, le style, le texte exact et les contraintes; poser une question quand une information factuelle essentielle manque; bâtir la composition via le protocole Aurora inspiré de CreatiPoster. Ne jamais inventer prix, date, lieu, nom de marque ou promesse.
2. **Manipulation du document par l’agent dès la première version.** Créer, sélectionner par ID, déplacer, redimensionner, styliser, supprimer, dupliquer, réordonner, masquer/afficher et respecter le verrouillage. L’utilisateur garde la possibilité de faire ces actions manuellement; les deux voies modifient le même `PosterDocument`, passent la validation et sont annulables.
3. **Assets vectoriels.** L’agent peut créer des formes et tracés éditables comme couches SVG Aurora. Pour le MVP, autoriser un sous-ensemble contrôlé (formes primitives et chemins SVG `d` validés, tailles et limites); ne pas accepter de balisage SVG libre, scripts, références externes ou HTML arbitraire.
4. **Génération d’images.** L’agent peut demander/générer une image destinée à un calque image, pas uniquement au fond. Le document garde modèle, prompt et provenance. Toute action susceptible d’être facturée suit la politique de confirmation explicite du produit; le fond reste une fonction distincte.
5. **Recherche d’assets dans une bibliothèque en ligne.** L’agent peut rechercher, présenter quelques résultats identifiables, puis placer l’asset choisi. La source doit avoir une API accessible, une licence et une attribution vérifiables. Une réponse de recherche n’est pas une permission implicite : conserver URL/source/licence et respecter les conditions de l’API. Ne pas faire de récupération arbitraire d’URL côté serveur.
6. **Rendu et itération.** Les ajouts apparaissent comme couches Aurora éditables dans le canvas; Grida est le rendu facultatif, SVG la référence et le fallback. L’agent peut continuer à modifier un poster existant sans remplacer les couches non ciblées.

### Limites nécessaires au premier MVP

- Un seul fournisseur de génération d’images (Agnes déjà configuré), une seule bibliothèque de recherche choisie après vérification de l’accès/licence, et une première gamme d’assets vectoriels simples; pas de promesse de génération de logos professionnels ou d’illustrations SVG complexes.
- L’agent reçoit aujourd’hui les métadonnées/alt des images mais pas automatiquement une compréhension visuelle de tous les uploads. Le MVP doit fournir des descriptions/aperçus contrôlés ou demander à l’utilisateur de préciser le contenu lorsqu’il est ambigu.
- La recherche en ligne exige de valider le service retenu, son accès, ses quotas, ses règles d’usage et le stockage de provenance. Aucun accès API ou compte fournisseur de bibliothèque n’est établi par cet audit. Si ces prérequis manquent, cette capacité est un bloqueur à annoncer, pas à remplacer par une recherche simulée.
- Les images distantes peuvent s’afficher mais être inexportables en PNG à cause de CORS; préserver SVG et expliquer la limite.

### Hors périmètre du MVP initial

- Import complet de l’éditeur Grida ou remplacement du format Aurora; modification arbitraire du DOM/SVG par le modèle.
- Plusieurs bibliothèques simultanées, aspirateur web généraliste ou téléchargement serveur d’URL arbitraires.
- Collaboration temps réel, comptes/persistance cloud, import Figma complet, animations d’affiche, masques et typographie curviligne.
- A2UI dans le chemin obligatoire; il peut ultérieurement présenter les variantes ou les résultats de recherche si la compatibilité est prouvée.

---

## 4. Critères d’acceptation observables

Le MVP est démontré en navigateur avec Agnes configuré et une source de bibliothèque réellement accessible. Tests simulés peuvent couvrir les erreurs, mais ne remplacent pas cette preuve d’intégration réelle.

1. Sur un brief de référence qui donne tous les faits nécessaires, l’utilisateur demande une affiche en langage naturel et obtient une composition complète; aucun détail factuel du brief n’est déformé ou inventé. Sur un brief incomplet, l’agent pose une question ciblée avant d’inscrire le fait manquant.
2. Le résultat est un `PosterDocument` valide avec textes, formes/tracés et images séparés en couches; ce n’est pas une image aplatie. Le rendu s’affiche via Grida quand possible, sinon en SVG sans perte silencieuse.
3. Une correction en langage naturel modifie le calque visé et préserve les autres. L’utilisateur peut également sélectionner/déplacer/modifier directement dans le canvas. Ajouter/supprimer/réordonner/masquer/verrouiller des éléments par outils agent respecte les locks, l’historique et la validation du document.
4. L’agent produit au moins un élément vectoriel contrôlé affiché comme élément éditable; un test rejette une géométrie/path invalide et aucun markup/script arbitraire n’est interprété.
5. L’agent recherche une ressource dans la bibliothèque choisie, retourne des résultats attribuables, attend le choix approprié, puis l’insère avec URL/source, attribution et licence enregistrées. Aucun asset n’est présenté comme libre si sa licence n’est pas établie.
6. L’agent peut générer une image et la placer comme calque, avec modèle/prompt/provenance conservés; la génération de fond existante continue de préserver le premier plan. L’expérience respecte la confirmation et le budget convenus.
7. Persistance locale, reload, undo/redo et export pris en charge ne régressent pas; les erreurs de réseau, CORS, source/licence, API ou renderer sont visibles et ne produisent pas de faux succès.
8. `npm test`, `npx tsc -b`, `npm run build`, `git diff --check` passent; une recette navigateur filmée ou consignée couvre le brief, la modification de calques, la recherche réelle, la génération d’image réelle et le fallback SVG.

**Précision et qualité :** préparer au moins trois briefs représentatifs (événement, commerce/service, annonce culturelle), chacun avec faits de référence et critères de composition observables. Faire relire les affiches par la personne produit/design; ne pas prétendre égaler le modèle ou les résultats évalués CreatiPoster sans benchmark comparatif.

---

## 5. Feuille de route sur une semaine

| Jour | Objectif | Travail et livrable de fin de journée |
|---|---|---|
| **1 — Faisabilité et contrats MVP** | Valider les prérequis réels | Rejouer tests/build; écrire trois briefs de référence et les faits exacts; vérifier l’accès Agnes et identifier une seule bibliothèque d’assets avec API, licence, attribution, quotas et accès disponibles; inspecter l’arbre d’assets et la taille du bundle. Définir contrats de tools, confirmation, IDs/provenance et cas d’échec. **Livrable :** matrice exigences→implémentation et go/no-go documenté pour les services externes. |
| **2 — Précision du brief et protocole CreatiPoster** | Transformer l’intention en composition fiable | Renforcer le flux brief→clarification si fait manquant→protocole create/complete; vérifier contenu exact, rôles, dimensions, z-order, marges, lisibilité et conservation des couches; créer tests de fixtures documentaires pour les briefs. **Livrable :** création structurée reproductible et erreurs factuelles couvertes. |
| **3 — Contrôle agentique complet du canvas** | Donner les leviers d’édition nécessaires dès le MVP | Ajouter ou terminer tools sûrs pour delete/duplicate/reorder/visibility/lock et inspection du document; garder modifications manuelles et agentiques sur le même état, journalisées/annulables; valider IDs inconnus et calques verrouillés. **Livrable :** les demandes “déplace/retire/masque/avance cet élément” fonctionnent et ciblent le bon calque. |
| **4 — SVG contrôlé et images générées** | Donner à l’agent des moyens de créer des assets | Définir un sous-ensemble vectoriel borné (shapes/path) avec validation et tests de rendu; étendre la génération Agnes à un calque image quelconque en gardant la génération de fond séparée; stocker modèle, prompt, origine; appliquer confirmation, limites de taille et retours d’erreur. **Livrable :** ajout vérifié de vectoriel éditable et d’une image générée au poster. |
| **5 — Recherche en bibliothèque et placement** | Trouver et intégrer une ressource réelle | Intégrer une bibliothèque/API unique retenue Jour 1 derrière un tool serveur à périmètre restreint; mapper résultats, previews, source, licence, attribution; laisser l’utilisateur/agent choisir avant insertion; contrôler CORS, liens expirés, quotas, validation HTTPS et risques SSRF. **Livrable :** recherche et placement d’un vrai asset avec provenance persistée. |
| **6 — Parcours complet, rendu et sécurité** | Faire fonctionner les capacités ensemble | Rejouer les trois briefs en prompt-only, avec asset fourni et avec asset trouvé; itérer agent→canvas→agent; tester Grida/SVG, images locales/distantes, permissions, refus/rate limit et erreurs service; tester les actions de calques et la sauvegarde/export. Corriger P0/P1. **Livrable :** release candidate et matrice d’évidence remplie. |
| **7 — Revue design et décision MVP** | Confirmer la précision, l’usage et les limites | Démonstration de bout en bout en navigateur avec services réels; revue design des affiches et vérification factuelle; exécuter tous les tests/build; noter mesures de latence et bugs; décider livraison ou blocages. **Livrable :** démonstration reproductible, bilan des critères et prochaines priorités. |

### Priorité si la semaine est contrainte

**Ne pas couper** : création fidèle en langage naturel, document éditable, contrôle agentique minimal, génération d’image en calque, SVG simple et au moins une recherche de bibliothèque réelle (si l’accès externe est un objectif MVP). **Réduire d’abord** : le nombre de fournisseurs/sources, l’étendue graphique SVG, le polissage hors du parcours de création. Si la clé Agnes ou l’accès à une bibliothèque n’existe pas, inscrire explicitement cette dépendance comme blocage de la démonstration réelle.

### Ordre des défauts

- **P0 — invalide le MVP :** faits inventés ou texte déformé, canvas vide, document aplati/invalide, tool cible le mauvais calque, image/asset perdu, faux succès, ressource sans provenance/licence établie.
- **P1 — bloque un usage normal :** action canvas essentielle absente, recherche ou génération non intégrée au document, calque verrouillé modifié, erreurs/confirmation incompréhensibles, fallback de rendu cassé.
- **P2 — après MVP :** multi-fournisseurs, optimisation fine bundle, import étendu, A2UI, collaboration et outils graphiques avancés.

---

## 6. Risques et mesures

| Risque | Mesure proposée |
|---|---|
| Le renderer Grida et l’importeur SVG ne couvrent pas tous les éléments SVG | Tester une matrice de scènes; conserver une bascule de rendu et un SVG canonique; ne jamais supprimer la voie de repli. |
| Taille/initialisation WASM ralentit le premier affichage | Chargement différé déjà en place; mesurer le temps; éviter que le chargement de Grida bloque le SVG et la première interaction. |
| Images distantes ou export bloqués par CORS | Tester images locales et distantes; rendre l’image au SVG; afficher une limite export explicite au lieu d’échouer silencieusement. |
| Recherche de bibliothèque sans API/licence vérifiée | Choisir un fournisseur unique avec API et conditions claires au Jour 1; conserver attribution/licence; si accès absent, déclarer le blocage plutôt que maquiller une recherche. |
| SVG libre ou génération d’image trop large/non sécurisée | Borner le SVG à des éléments de document typés et limiter les tailles; utiliser un fournisseur d’image unique et conserver provenance/confirmation. |
| A2UI présente un écart core 0.15.0/0.16.1 et un protocole évolutif | Ne pas mélanger les versions; vérifier le flux de bout en bout en prototype isolé; reporter l’intégration si les formats ne s’alignent pas. |
| Génération Agnes indisponible ou facturable | Mode démo manuel, statut explicite de configuration, confirmation avant génération d’image, pas de revendication de succès si l’outil échoue. |
| Une dépendance Grida supplémentaire augmente la surface de maintenance/licence | Garder uniquement `@grida/canvas-wasm` dans le MVP; contrôler licences, dépendances transitives et bundle de tout ajout ultérieur. |

---

## 7. Sources consultées

### Dépôt Aurora

- [Documentation de l’intégration Grida](./grida-canvas-integration.md)
- `src/canvas/PosterCanvas.tsx`, `src/canvas/GridaCanvasSurface.tsx`, `src/canvas/model.ts`, `src/canvas/use-poster-agent-tools.ts`, `src/App.tsx`, `server/aurora-agent.mjs`, `package.json`

### Grida

- [Dépôt Grida](https://github.com/gridaco/grida)
- [Licence principale Grida](https://github.com/gridaco/grida/blob/main/LICENSE)
- [Monorepo et paquet éditeur](https://github.com/gridaco/grida/blob/main/editor/package.json)
- [Catalogue public des dépôts Grida](https://api.github.com/orgs/gridaco/repos?per_page=100&type=public)
- Paquet npm observé : [`@grida/canvas-wasm@0.91.0-canary.22`](https://www.npmjs.com/package/@grida/canvas-wasm)

### CopilotKit et A2UI

- [Dépôt A2UI](https://github.com/a2ui-project/a2ui)
- [État des versions de la spécification A2UI](https://github.com/a2ui-project/a2ui/blob/main/specification/versions.json)
- [Renderer React A2UI officiel](https://github.com/a2ui-project/a2ui/tree/main/typescript/renderers/react)
- [SDK agent A2UI TypeScript](https://github.com/a2ui-project/a2ui/tree/main/typescript/agents/a2ui_agent)
- [Renderer A2UI CopilotKit](https://github.com/CopilotKit/CopilotKit/tree/main/packages/a2ui-renderer)
- [Exemple d’intégration A2UI dans CopilotKit](https://github.com/CopilotKit/CopilotKit/tree/main/examples/integrations/a2a-a2ui)
- Versions/dépendances consultées sur npm : `@copilotkit/react-core@1.85.0`, `@copilotkit/a2ui-renderer@1.85.0`, `@a2ui/react@0.16.1`, `@a2ui/agent@0.2.1`, `@a2ui/web_core@0.16.1`.

---

## Décisions à confirmer au lancement

1. Pour les assets en ligne, avez-vous une bibliothèque/API à privilégier, ou faut-il choisir une première source en fonction de ses licences, de son accès et de son attribution?
2. L’accès Agnes et la clé API de la bibliothèque seront-ils configurés dans l’environnement de démo? Ces clés ne doivent pas être partagées dans le chat.
3. Pour la génération d’images, souhaitez-vous une confirmation avant chaque génération potentiellement facturée, y compris lorsqu’elle est ajoutée comme asset au premier plan?
