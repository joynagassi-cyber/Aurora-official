# Réévaluation des bases open source pour Aurora

**Statut :** décision de sélection suspendue jusqu’aux tests sur clones amont. \
**Contexte :** retour direct du propriétaire après essai de Grida Desktop : le chat affiche « This chat is not available on this desktop or workspace. » C’est une indisponibilité avérée du chat intégré dans ce contexte, mais pas une preuve que le canvas ou le renderer ne fonctionne pas. Le chat intégré ne peut toutefois pas être compté comme capacité disponible d’Aurora; les informations marketing ou la réussite de compilation ne le remplacent pas. \
**Sources consultées :** vision et cadrages Aurora dans Google Drive; code et README amont de Grida, FigCraft, Grida FX et HyperFrames; intégration actuelle `@grida/canvas-wasm` dans ce dépôt. \
**Portée :** réemploi de code source sans application Desktop, et non simple comparaison de dépendances npm.

## 1. Direction produit à respecter

Aurora est une suite de studios créatifs destinés à produire un travail professionnel sans exiger que l’utilisateur soit designer ou développeur :

- **Design graphique :** affiches, flyers, posts, logos et assets de vente/publicité. Le premier moteur d’affiche doit produire un document multicouche précis, modifiable et pilotable en langage naturel, selon le cadre CreatiPoster.
- **Design d’interfaces :** partir de l’UX (besoin, parcours, structure), proposer des wireframes, laisser l’utilisateur les valider, puis construire l’UI et le code **frontend** de l’interface retenue. Le périmètre d’Aurora n’est pas de générer toute l’infrastructure/backend d’un produit.
- **Motion et vidéo :** à terme, montage, effets et créations animées professionnelles, avec des briques spécialisées comme FX et HyperFrames à évaluer.

Le besoin stratégique n’est donc pas « un renderer de poster à tout faire ». Aurora doit éviter de se verrouiller dans un modèle uniquement vectoriel, mais ne doit pas non plus intégrer dès aujourd’hui trois éditeurs complets dans la même interface. Le studio d’affiche peut rester le premier parcours livré; l’architecture cible doit laisser des studios spécialisés, avec un orchestrateur Aurora, une bibliothèque/provenance d’assets et des contrats d’échange.

L’avantage concurrentiel envisagé — un même agent qui fait produire des créations graphiques et des interfaces frontend professionnelles — est une **hypothèse de différenciation forte**, pas encore une preuve qu’aucun concurrent ne propose une expérience voisine. Il faudra la valider par entretiens et tests de parcours face aux outils existants.

## 2. Ce qui a été effectivement vérifié

### Aurora + Grida actuel

Aurora n’intègre pas l’éditeur Grida complet. Le dépôt utilise `@grida/canvas-wasm@0.91.0-canary.22` comme couche de rendu WebGL derrière son propre `PosterDocument`, son SVG, ses outils et son interface. Le code de `src/canvas/GridaCanvasSurface.tsx` conserve un rendu SVG de repli et écarte explicitement les scènes avec images de la couche Grida.

Le build TypeScript/Vite passe; cela ne démontre pas que le WASM s’initialise et rend correctement dans le navigateur de l’utilisateur, ni que la surface remplit le besoin d’édition attendu. Aucun test navigateur de bout en bout n’a été exécuté pour cette intégration dans cette passe. Le message rapporté par le propriétaire concerne **le chat intégré de Grida Desktop**, pas le renderer Aurora : il prouve que ce chat n’est pas accessible sur son Desktop/workspace, mais ne permet pas de conclure que le canvas ou le WASM échoue. Séparément, Aurora n’a pas encore de preuve navigateur que son renderer Grida fonctionne de bout en bout.

### Dépôt Grida complet

Le README actuel de [`gridaco/grida`](https://github.com/gridaco/grida) décrit un canvas de création, un éditeur SVG, des surfaces React/DOM et Skia/WASM, un CLI de génération de médias, des services AI et une architecture de packages. Il décrit aussi un hôte éditeur Next.js qui comprend des services de produit (comptes, billing et endpoints), ainsi qu’une application Desktop Electron séparée. Le guide du dépôt distingue explicitement les modules réutilisables, les assemblages de produit et les services.

Ce profil correspond mieux au **spectre graphique et média** recherché par Aurora que la seule dépendance WASM actuelle, mais « tout cloner sauf Desktop » n’est pas encore démontré comme un build autonome simple : il faut déterminer quels packages fonctionnent hors de l’hôte Grida, quels services/API sont indispensables et quel travail de portage vers Aurora est requis.

### Grida FX

[`gridaco/fx`](https://github.com/gridaco/fx) est un dépôt séparé sous Apache-2.0, présenté comme un moteur de workflows d’assets image/audio/vidéo/3D. Il annonce planification de coûts, plafonds/approbations, cache/réutilisation, reprise et SDK Python/TypeScript; son README le décrit comme un projet autonome en preview. Ce n’est pas un effet intégré au renderer Canvas Grida et son annonce ne prouve pas qu’il produit à lui seul un studio de montage vidéo complet.

### FigCraft

[`storytold/figcraft`](https://github.com/storytold/figcraft) est centré sur le design d’interfaces/prototypes : pages et frames, auto-layout, composants/variantes, outils vectoriels, variables, interactions de prototype, commandes d’édition pilotables par agent et build Web. Le README consulté signale le stade **early alpha**. Son modèle de document, son moteur et sa UI sont propres à FigCraft; il ne remplace pas une source de génération d’images, le pipeline vidéo/FX ou le document d’affiche Aurora.

Sa promesse de développement/code doit être vérifiée à l’usage : les éléments visibles dans ses exemples et modes Developer ne prouvent pas que FigCraft génère une application frontend complète, maintenable, accessible et raccordée aux besoins de production d’Aurora. La frontière « wireframe validé → UI → code frontend » doit être testée, pas extrapolée à partir de la présence d’une API de commandes.

### HyperFrames

[`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) est un autre dépôt sous Apache-2.0 : framework vidéo où HTML/CSS/JS et animations seekable sont rendus en vidéo, avec CLI et workflows agentiques annoncés. Il peut être candidat à un **studio vidéo** distinct, pas un moteur de canvas graphique ni un substitut à l’éditeur UI. Le produit Studio/les modèles hébergés et le framework OSS sont des choses distinctes; les coûts, licences des médias, dépendances de rendu et possibilité d’un déploiement auto-hébergé doivent être testés.

## 3. Conclusion provisoire — pas de décision binaire

- **Ne pas compter le chat intégré de Grida Desktop comme disponible dans le contexte du propriétaire.** Son indisponibilité peut venir d’une restriction d’appareil/workspace; elle ne prouve pas une panne du moteur graphique. L’Aurora actuelle doit néanmoins valider séparément le chargement/rendu du WASM dans un vrai navigateur avant de le mettre sur le chemin critique.
- **Ne pas remplacer Grida par FigCraft comme plateforme entière.** FigCraft est un candidat ciblé au studio UX/UI et prototypage frontend, pas une base couvrant toute la vision graphique, asset, image, FX et vidéo.
- **Grida complet est le candidat le plus large à auditer pour un workspace créatif unifié**, du fait de ses modules de canvas, SVG, IA/CLI et son projet FX séparé. Cela n’en fait pas une recommandation d’adoption : le périmètre portable sans Desktop, le fonctionnement des dépendances/services et l’expérience réellement testée restent inconnus.
- **Architecture à privilégier quelle que soit la base :** Aurora garde la direction produit, les parcours, les documents/contrats, les permissions et les validations; les moteurs spécialisés sont sélectionnés ou intégrés par studio. Pour l’interface, la validation UX/wireframe précède la génération du frontend. Pour la vidéo, FX peut orchestrer des assets et HyperFrames rendre des compositions, sous réserve de prototypes. Éviter une dépendance à un unique fournisseur ou à une API privée de Grida.
- **Le code cloné ne devient pas juridiquement « propriété exclusive » d’Aurora.** Aurora pourra maintenir ses changements et livrer sa propre application, tout en respectant les licences amont, notices, marques et licences distinctes des assets/modèles. Le code source ouvert et le Desktop commercial/service en ligne doivent être séparés dans l’audit.

## 4. Protocole de sélection sur clones

Faire des clones d’étude isolés, épinglés à des commits/releases, puis une branche d’essai Aurora; ne pas remplacer d’abord la base de travail. Pour chaque dépôt, noter commandes reproductibles, OS/outillage requis, dépendances externes, empreinte du build, licences, services/keys nécessaires et erreurs observées.

### Gate A — séparer chat Grida Desktop et canvas Aurora

1. **Chat Desktop :** le symptôme connu est « This chat is not available on this desktop or workspace. » Il concerne l’accès au chat intégré dans le contexte de l’utilisateur. S’il faut investiguer le produit Grida, vérifier les réglages/éligibilité du Desktop et du workspace avec le propriétaire; ne pas l’interpréter comme un test du renderer. Aurora possède son propre agent et ne devrait pas dépendre de ce chat.
2. **Canvas Aurora :** rejouer l’app existante en navigateur avec WebGL disponible puis indisponible; vérifier console, réseau WASM, chargement, édition et export.
3. Tester les scènes de référence (texte exact, formes, path SVG, gradients, image locale et distante, redimensionnement, reload) et le fallback SVG.
4. Consigner séparément les résultats du chat Desktop et du canvas Aurora, avec étapes, OS/navigateur, message observé et résultat attendu. Pas de conclusion « fiable » à partir du build seul.

### Gate B — portabilité de Grida sans Desktop

1. Cloner les dépôts Grida et, si nécessaire, `gridaco/nothing`; suivre les guides/AGENTS à la racine et dans les modules, puis lancer les checks upstream.
2. Identifier le plus petit build web/React réutilisable du canvas et de l’éditeur SVG; le compiler sans Electron, comptes, billing, backend privé ou API Grida hébergée.
3. Importer/éditer/exporter un poster Aurora, observer fidélité, accessibilité, image/provenance, interactions et round-trip avec un modèle Aurora.
4. Tester séparément CLI/AI et services. Ne pas exiger de clés Grida si le but est un produit autonome; utiliser un adaptateur de fournisseurs contrôlé par Aurora.
5. Gate **GO** seulement si l’expérience fonctionne hors Desktop et qu’Aurora peut maintenir un seul document source sans synchronisation fragile.

### Gate C — FigCraft pour le studio UX/UI

1. Compiler/héberger son build Web; établir le bridge avec l’app Aurora, tester restrictions d’origines/messages et mode mobile.
2. Demander un parcours UX, afficher 2–3 wireframes, faire choisir/valider un wireframe, puis l’étendre en UI avec composants/variables.
3. Vérifier ce qui peut réellement être récupéré : structure, texte, design tokens, interactions, export/code React et assets. Faire modifier le code dans le workflow frontend Aurora et comparer à la maquette.
4. Tester agent-command API, erreurs/undo, export/reimport et état après reload. Gate **GO** seulement avec un round-trip exploitable et un frontend maintenable; sinon FigCraft sert de référence de fonctions, non de runtime intégré.

### Gate D — FX et HyperFrames pour le studio vidéo

- Construire un workflow FX local sans fournisseur et un avec fournisseur, examiner coût prévu, approbations, cache, reprise, secret management et dossiers d’assets.
- Construire une courte séquence de test dans HyperFrames (planche/storyboard → scènes, mouvements, typographie, audio et export MP4) et vérifier déterminisme, rendu local, durée, qualité à la cadence/cible mobile et édition ciblée par agent.
- Garder les traitements coûteux derrière consentement/plafond et exposer des erreurs réelles. Ne pas intégrer le Desktop Studio d’un tiers comme substitut du studio Aurora.

### Score commun (0–5, avec preuves)

1. Build reproductible et santé des tests upstream.
2. Fonctionnement réel sans app Desktop ni service privé.
3. Compatibilité du modèle de document, ouverture/export et round-trip.
4. Agent: opérations ciblées, sûres, annulables et inspectables.
5. Qualité du rendu sur exemples métier Aurora, pas seulement démos amont.
6. Latence/taille mémoire/bundle sur navigateur et appareils mobiles visés.
7. Accessibilité, contrôle utilisateur et comportement sans réseau.
8. Licence, attribution, provenance et possibilité de maintenir les modifications.
9. Charge réelle d’intégration et de maintenance, mesurée par un vertical slice.

Pas de score global fondé uniquement sur les features annoncées : des P0 d’échec de build, d’API propriétaire indispensable, de perte de document ou de licence éliminent une option pour le périmètre concerné.

## 5. Sources primaires

- Grida : [repo](https://github.com/gridaco/grida), [guide de dépôt et carte des packages](https://github.com/gridaco/grida/blob/main/REPOSITORY.md), [Nothing graphics engine](https://github.com/gridaco/nothing).
- Grida FX : [repo](https://github.com/gridaco/fx), [README](https://github.com/gridaco/fx#readme).
- FigCraft : [repo](https://github.com/storytold/figcraft), [README](https://github.com/storytold/figcraft#readme).
- HyperFrames : [repo](https://github.com/heygen-com/hyperframes), [README](https://github.com/heygen-com/hyperframes#readme).
- Aurora : [Cadrage maître](https://drive.google.com/document/d/1OCRxvBSIAgy_GyD8-XiQwXsk1b-UONa2/edit), [scope MVP](https://drive.google.com/document/d/1DmScFyDp4jrnKnJ4qDJ919_g7B8uklk6/edit), [spécification du moteur d’affiche](https://drive.google.com/document/d/1wZ4KcrFy1BeBkUHIAJBthDMOFIxzmO8h/edit), [recherche assets/layouts](https://drive.google.com/document/d/18ma8ntcl8ET7zgAb5MEyKCQihT15qsqI/edit), [recherche motion design](https://drive.google.com/document/d/1pgaU0zNF7se-ztb_S_pb28auh7i8uZoO/edit).

**Limite actuelle :** pas de clone Grida/FigCraft/FX/HyperFrames compilé ou testé dans le parcours Aurora durant cette réévaluation. Les affirmations fonctionnelles de leurs README sont des déclarations amont; les gates ci-dessus sont les preuves attendues.
