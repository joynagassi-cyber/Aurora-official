# Évaluation d’intégration : FigCraft vs Grida pour Aurora

> **Réévaluation requise :** ce document comparait surtout `@grida/canvas-wasm` à FigCraft et recommandait provisoirement de garder le renderer Grida pour le MVP poster. Après le retour du propriétaire — Grida Desktop affiche « This chat is not available on this desktop or workspace. » — et la consultation du cadrage complet Aurora, cette conclusion ne vaut plus comme décision d’architecture. Ce message prouve que le chat intégré n’est pas accessible dans ce contexte; il ne prouve pas une panne du canvas. La base amont Grida complète, FigCraft, Grida FX et HyperFrames sont réévalués dans [`decision-grida-figcraft-hyperframes.md`](./decision-grida-figcraft-hyperframes.md). Grida n’est pas considéré fiable pour Aurora tant qu’un test navigateur ne l’a pas démontré; FigCraft reste un candidat ciblé UX/UI, et non un remplacement multimédia global.

**Date de l’évaluation initiale :** 24 novembre 2026 \
**Référence FigCraft examinée :** dépôt officiel `storytold/figcraft`, release `v0.18.1` (12 novembre 2026). \
**Référence Grida examinée :** intégration actuelle `@grida/canvas-wasm@0.91.0-canary.22` dans Aurora. \
**Portée :** adéquation à Aurora et à son MVP de création d’affiches en langage naturel; aucune intégration FigCraft ni aucun test navigateur FigCraft n’a été effectué dans cette évaluation.

## Conclusion initiale (historique, non normative depuis la réévaluation)

**FigCraft et Grida ne jouent pas le même rôle.**

- **Le dépôt Grida complet** est lui-même une plateforme open-source de canvas/éditeur, avec renderer DOM React et backend Skia/WASM; **le paquet Grida utilisé dans Aurora aujourd’hui** est seulement le moteur WASM de rendu autour de notre SVG. Le renderer seul laisse Aurora propriétaire du document, des outils, du workflow et du chat. Prendre l’éditeur Grida complet serait également une intégration différente, et non l’usage du paquet déjà ajouté.
- **FigCraft** est aussi un éditeur graphique complet : modèle documentaire, moteur de rendu, interface, commandes, formats d’import/export et interfaces pour agents (CLI/MCP et API WebAssembly). Ce n’est pas un simple renderer de remplacement.

Pour le MVP actuellement défini — affiches précises pilotées en langage naturel, assets et opérations agentiques sur le même document Aurora — **la recommandation est de garder le chemin Grida WASM facultatif + document Aurora, et de ne pas remplacer maintenant le canvas par FigCraft**. FigCraft mérite un prototype d’intégration ciblé, car son architecture « tout est une commande » et son API Web/MCP pourraient accélérer les gestes d’édition avancés. Le full-editor Grida mérite aussi une comparaison distincte si l’objectif est d’adopter un éditeur complet. Dans les deux cas, il faut choisir entre migrer Aurora vers le document moteur ou maintenir une synchronisation entre des modèles différents; ni l’une ni l’autre des intégrations complètes n’est un ajout transparent.

**Décision suggérée :** pas de migration pour le MVP de la semaine; faire ensuite un spike borné de 1–2 jours sur l’édition aller-retour d’une affiche. Si le critère non négociable est que l’agent profite immédiatement d’un moteur complet de commandes et d’édition vectorielle, comparer ce spike à une intégration plus poussée de Grida et accepter que FigCraft soit un changement de plateforme, non un remplacement de dépendance.

---

## 1. Quel « FigCraft » a été évalué?

Le nom est ambigu. Cette évaluation désigne **l’application de design Rust de [storytold/figcraft](https://github.com/storytold/figcraft)**, version `v0.18.1`, dual-licensed MIT ou Apache-2.0.

Le registre npm expose aussi un paquet distinct nommé [`figcraft`](https://www.npmjs.com/package/figcraft), décrit comme une bibliothèque TypeScript/Node pour produire des diagrammes SVG. Ce paquet provient du dépôt `xflow-lab/figcraft`; ce n’est pas l’éditeur `storytold/figcraft` et il ne donne pas accès à son moteur, son UI ou ses 400+ commandes. Je ne le recommande pas comme substitut de Grida pour Aurora.

---

## 2. Ce que FigCraft apporte réellement

D’après le dépôt et les documents de la release `v0.18.1` :

- un éditeur d’interfaces complet en Rust, avec modèle persistant de pages et de nœuds, texte, formes, vecteurs, composants, styles et variables;
- auto-layout, composants et variantes, variables, prototypes, tableaux/panneaux, outils vectoriels avancés, effets et export PNG/JPG/WebP/SVG/PDF;
- un registre central de commandes : la documentation annonce plus de 400 actions exposées à l’interface, au CLI, au canal de contrôle et au serveur MCP;
- un CLI et un serveur MCP sur stdio, utilisables soit en moteur headless, soit pour piloter une application desktop attachée;
- un build web WASM et une API page `window.figcraft` permettant `execute`, `request`, `commands`, `inspect`, `screenshot` et l’ouverture de fichier; une page hôte peut l’intégrer en iframe et communiquer via `postMessage` (`?host=parent`), avec événements d’ouverture, sauvegarde et état modifié;
- des archives `.figcraft` locales; import SVG, images, JSON de l’API REST Figma et import `.fig` « best effort »; export `.fig` expérimental.

### Maturité et éléments à ne pas surinterpréter

- La release examinée marque FigCraft **early alpha**; le README donne une estimation interne de couverture de son ambition de remplacement des outils propriétaires. Cette estimation n’est pas un benchmark indépendant de stabilité, de compatibilité ou de qualité d’affiche.
- L’API de commande et la documentation MCP sont particulièrement développées, mais elles sont propres au modèle et aux commandes FigCraft. Elles ne se branchent pas automatiquement sur le `PosterDocument` Aurora ni sur les outils CopilotKit déjà présents.
- Le repo a un build web et une interface iframe; la release `v0.18.1` atteste un artefact web ZIP de 10 534 024 octets. Ce n’est ni la taille décompressée ni une mesure de latence. Le WASM Grida dans le build Aurora pèse environ 17,6 MB non compressé / 6,5 MB gzip; ces formats de mesure ne sont pas directement comparables. FigCraft ajouté en parallèle augmenterait le poids total à livrer et le téléchargement lors de son premier chargement; un chargement différé peut éviter de pénaliser l’entrée dans le chat, à valider par mesure.
- Le serveur MCP FigCraft utilise JSON-RPC sur **stdio**, pas une API HTTP distante prête à connecter au runtime. Le mode headless peut être confiné à des répertoires autorisés; le mode attach utilise un canal de contrôle qui écoute en loopback. Il faudra une passerelle/gestion de processus et des règles de sécurité si CopilotKit l’appelle côté serveur.
- Les exemples, icônes, polices et autres ressources embarquées ont leurs propres notices; vérifier `NOTICE`, `ATTRIBUTION.md` et les licences d’assets avant redistribuer le build web, en plus de la double licence du code.

---

## 3. Comparaison directe pour le MVP Aurora

| Critère | Grida tel qu’intégré dans Aurora | FigCraft `storytold/figcraft` | Conséquence |
|---|---|---|---|
| **Nature du composant** | Le dépôt Grida complet inclut canvas/editor (renderer DOM React et backend Skia/WASM); l’intégration Aurora actuelle n’utilise que le binding WASM de rendu et garde la scène SVG | Éditeur complet + moteur + UI + modèle + commande engine + export | Les deux dépôts ont un éditeur complet, mais les intégrations concrètes comparées ici sont WASM-render-only Grida contre app FigCraft web complète; intégrer l’éditeur complet Grida demanderait également un portage distinct. |
| **Source de vérité** | `PosterDocument` Aurora reste canonique; SVG est son rendu/fallback | `Document` FigCraft est son propre graphe de pages/nœuds avec propriétés et commandes | Migration ou adaptateur de document à concevoir; pas de partage automatique. |
| **Édition agentique** | Outils Aurora ciblés déjà présents pour protocole, texte, mouvement, taille, style, formes, assets et re-layout; trous résiduels identifiés dans l’audit | Large API de commandes, CLI/MCP, inspection JSON et capture; bon alignement technique avec un agent d’édition | FigCraft gagne en largeur de fonctions; Aurora garde les actions métier spécialisées et le flux Agnes. |
| **Contrôle direct du canvas** | Interactions actuelles Aurora, à enrichir selon le MVP | Éditeur avec outils, panneaux, auto-layout, vecteurs et API page exposant les commandes | FigCraft peut fournir une vraie expérience d’éditeur plus complète, au prix d’intégrer aussi son UI et ses conventions. |
| **Affiche vs UI d’application** | Modèle spécialisé poster : rôles `title`, `date`, `cta`, etc.; composition guidée par protocole | Modèle général d’interface : frames, composants, auto-layout, variables, prototypes | Aurora est immédiatement plus près du brief poster; FigCraft fournit des primitives et un espace de création plus général. La qualité de composition IA n’est pas incluse dans FigCraft. |
| **SVG et éléments vectoriels** | Renderer SVG et types Aurora (formes, chemins) relativement restreints; Grida importe le SVG pour le dessin | Outils vectoriels avancés et import/export SVG; commande API d’édition; selon l’architecture FigCraft, l’export SVG convertit le texte en tracés | FigCraft élargit le contrôle vectoriel, mais son export SVG peut aplatir la sémantique/éditabilité du texte et ne préserve pas les propriétés sémantiques Aurora; round-trip à mesurer. |
| **Images et génération** | Aurora place des images; Agnes génère actuellement un fond, avec provenance et confirmation | Import/place d’images et fills image, mais le moteur n’est pas un service de génération ni une recherche d’assets | Ni Grida ni FigCraft ne remplace l’intégration à Agnes, à une bibliothèque d’assets ou à ses règles de licences. |
| **Chat/runtime** | CopilotKit + Agnes déjà installés; outils frontend relient le chat au document | MCP FigCraft est un serveur d’outils distinct; l’API Web est JS à l’intérieur de sa page/iframe | Avec FigCraft, il faut ajouter une passerelle CopilotKit↔FigCraft (ou adapter les appels de tools frontend à l’iframe). |
| **Embed / ergonomie** | Canvas Aurora intégré dans l’interface chat/canvas déjà cohérente | Build Web iframe possible avec `?host=parent` et bridge `postMessage`; le chrome d’éditeur FigCraft est livré avec | Techniquement plausible à embarquer; la cohérence visuelle, l’espace occupé, l’accessibilité et l’UX de sortie restent à prouver. |
| **Coût de bundle** | WASM Grida déjà conséquent mais renderer différé | Archive web officielle ~10,5 MB compressée à déployer; expansion après décompression non mesurée ici | Mesurer l’app réelle; ne pas importer FigCraft en dépendance sans essai de chargement et de performance. |
| **Licence** | Package WASM Apache-2.0; notices déjà posées dans Aurora | Code dual MIT/Apache-2.0; notices/licences d’assets tiers à conserver | Compatibilité de principe, mais valider le contenu du bundle web redistribué. |
| **Risque de livraison** | Le renderer peut échouer sur certaines scènes; fallback SVG préserve le document et l’édition | Alpha, application Rust importante, architecture de document distincte et de nombreuses fonctions non nécessaires à un poster | Grida est la voie à moindre risque de changement; FigCraft a davantage de potentiel editor/agent, et un risque d’intégration beaucoup plus élevé. |

---

## 4. Scénarios d’intégration possibles

### A. Continuer avec le renderer Grida WASM actuel — **recommandé pour le MVP**

Aurora sérialise le poster en SVG, passe le SVG à `@grida/canvas-wasm`, et garde le SVG natif comme surface/fallback. On peut enrichir `PosterDocument` et ses outils agentiques sans changer la source de vérité. Le compromis : Aurora garde la responsabilité d’implémenter elle-même les primitives d’édition et la qualité des compositions; le paquet WASM actuel n’apporte ni gestionnaire de fichiers d’affiche, ni interface d’éditeur/command API complète.

### B. Adopter le full editor de Grida — **faisable à étudier, pas un paquet drop-in**

Le dépôt Grida expose un vrai éditeur, un backend DOM React et un backend Skia/WASM, avec import SVG/Figma, historique, rich text et autres fonctions. Mais Aurora n’a intégré que `@grida/canvas-wasm`; le code complet se trouve dans un monorepo avec dépendances de workspace. Avant de choisir cette voie, il faut repérer l’interface/public API de l’éditeur, confirmer les dépendances nécessaires, la licence de chaque package et construire un prototype de montage sous Aurora. Le document Aurora devrait encore être converti ou synchronisé avec la représentation Grida; les outils agentiques ne sont pas prouvés compatibles avec CopilotKit tels quels.

### C. Remplacer le rendu Grida dans le canvas existant par FigCraft — **non recommandé**

FigCraft n’est pas exposé comme un renderer WASM React équivalent à `@grida/canvas-wasm`. Son build web lance l’éditeur FigCraft complet. Remplacer seulement le composant `GridaCanvasSurface` par FigCraft supposerait de supprimer/masquer son interface, construire/importer un document FigCraft depuis Aurora et synchroniser les edits du moteur vers le document Aurora. Le premier point perd les bénéfices UI; les deux suivants créent une deuxième source de vérité et un round-trip non démontré.

### D. Embarquer l’éditeur FigCraft dans une iframe — **meilleur prototype de faisabilité**

Compiler/héberger le build web avec l’API hôte officielle, établir un handshake `ready/open/save/dirty`, envoyer un document de test et piloter les commandes `window.figcraft.execute(...)` depuis un adaptateur Aurora strictement typé. Les outils CopilotKit côté frontend pourraient appeler cet adaptateur après validation/autorisation.

À prouver : intégration même origine et `postMessage` contrôlé; créer un poster depuis le protocole Aurora; faire un changement de calque; récupérer le fichier/les changements à la sauvegarde; comparer contenu, texte et provenance après round-trip; cacher ou harmoniser les panneaux sans casser les commandes; latence et poids du chargement. Il n’est pas encore prouvé que cette iframe offre une interface embarquée sans son UI FigCraft entière.

### E. FigCraft comme moteur headless par MCP — **exploration backend, pas le raccourci du MVP**

CopilotKit pourrait lancer ou appeler un processus `figcraft-cli mcp` côté serveur et exposer un ensemble réduit de ses outils à Agnes. Mais MCP est sur stdio; il faudrait gérer le cycle de vie, les sessions et les versions du binaire, sérialiser fichiers/images, confiner les répertoires et associer sans ambiguïté une session à chaque document Aurora. Le moteur headless rend en CPU et ne donne pas, à lui seul, les gestes visibles dans le canvas Aurora.

L’autre mode `mcp --attach` pilote l’app desktop via son canal loopback; ce modèle ne convient pas directement à une app web déployée et multi-utilisateur. Ne jamais exposer ce canal de contrôle au navigateur ou au réseau.

### F. FigCraft comme éditeur export/outil distinct — **possible mais divergence UX**

Aurora pourrait ouvrir l’édition dans une route/page distincte, puis réimporter SVG/PNG. L’export PNG perd la structure; SVG peut préserver certains tracés mais les documents complexes et la sémantique poster ne sont pas garantis. Ce mode peut aider les utilisateurs avancés, mais ne satisfait pas seul l’objectif de chat agentique et de document vivant commun.

---

## 5. Architecture recommandée à court terme

```text
Brief utilisateur
       │
CopilotKit + Agnes ── tools Aurora typés ──> PosterDocument (source unique)
                                                   │
                                  gestes canvas Aurora + undo/redo
                                                   │
                               SVG Aurora canonique / fallback
                                      ├────────────┴────────────┐
                                      │                         │
                             Grida WASM optionnel       assets/provenance
```

1. Garder Grida facultatif derrière le renderer actuel et compléter les capabilities agentiques manquantes dans `PosterDocument`.
2. Continuer l’intégration de recherche d’assets et de génération d’images comme services/outils distincts; ni Grida ni FigCraft ne les fournit.
3. Prototyper FigCraft à côté — **sans le charger dans la livraison MVP** — pour déterminer si son API Web donne un meilleur éditeur canvas et si le coût du format vaut le gain.
4. Si le prototype réussit et si Aurora choisit d’en faire le canvas principal, prendre une décision explicite sur la migration du document canonique. Ne pas maintenir durablement deux documents concurrents.

## 6. Spike recommandé et critères go/no-go

**Durée : 1–2 jours, après la tranche MVP la plus urgente; pas une promesse d’intégration complète.**

1. Construire ou servir la release officielle web FigCraft sur une route locale, en utilisant l’API hôte et non un site tiers hébergé. Conserver l’artefact et les notices; relever précisément taille initiale, temps de démarrage et erreurs navigateur.
2. Transformer un poster de test Aurora (texte exact, deux formes, un SVG/path et une image avec provenance) en une scène FigCraft de test.
3. Depuis l’API browser/iframe, créer, sélectionner, déplacer, modifier et supprimer un nœud avec une whitelist de commandes; capturer une image et écouter les événements `dirty/save`.
4. Sauvegarder puis convertir/récupérer les changements dans Aurora. Comparer automatiquement textes, positions, ordre, styles, images et provenance; noter les champs qu’on ne peut pas faire revenir.
5. Tester échec d’iframe/WASM, reload, timeout, origine du message, commandes interdites, export et taille mémoire.

**GO seulement si** la scène reste éditable dans une seule source de vérité après aller-retour; CopilotKit peut appeler les commandes de façon sûre et prévisible; l’UX embarquée est acceptable; le chargement et le rendu passent une cible définie sur un appareil de référence; et les licences des fichiers livrés sont attribuables. Sinon, garder FigCraft comme référence de fonctions/commandes à reprendre plus tard et poursuivre Grida + modèle Aurora.

---

## 7. Sources et limites de preuve

### Sources primaires FigCraft

- [Dépôt officiel](https://github.com/storytold/figcraft)
- [README de la release v0.18.1](https://github.com/storytold/figcraft/blob/v0.18.1/README.md) — early alpha, build web, moteur agent-ready, licences et fonctionnalités annoncées.
- [MCP de FigCraft v0.18.1](https://github.com/storytold/figcraft/blob/v0.18.1/docs/mcp.md) — stdio, mode headless/attach, commandes, restrictions de fichiers.
- [Architecture v0.18.1](https://github.com/storytold/figcraft/blob/v0.18.1/docs/architecture.md) — crates, modèle documentaire, WASM, renderer et format.
- [API Web WASM](https://github.com/storytold/figcraft/blob/v0.18.1/apps/figcraft-web/src/api.rs) — `window.figcraft` et contrôle par commandes.
- [Bridge d’hébergement iframe](https://github.com/storytold/figcraft/blob/v0.18.1/apps/figcraft-web/src/host.rs) — `?host=parent`, événements `ready/open/save/dirty`.
- [Release v0.18.1](https://github.com/storytold/figcraft/releases/tag/v0.18.1) — artefacts, dont le ZIP web (taille d’archive affichée par l’API GitHub : 10 534 024 octets).
- [Licences FigCraft](https://github.com/storytold/figcraft/tree/v0.18.1) — `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, `ATTRIBUTION.md`.
- [Paquet npm `figcraft` distinct](https://www.npmjs.com/package/figcraft) — bibliothèque TypeScript de diagrammes SVG de `xflow-lab`, à ne pas confondre avec l’éditeur Rust.

### Aurora / Grida

- [Dépôt Grida complet](https://github.com/gridaco/grida) — éditeur de canvas, UI et moteur Nothing.
- [Paquet de l’éditeur Grida](https://github.com/gridaco/grida/blob/main/editor/package.json) — manifeste au sein du monorepo.
- [`@grida/canvas-wasm`](https://www.npmjs.com/package/@grida/canvas-wasm) — moteur WASM effectivement installé dans Aurora.
- [Architecture Aurora et intégration Grida](./grida-canvas-integration.md)
- [Audit et roadmap du MVP Aurora](./audit-et-feuille-de-route-premier-rendu.md)
- `src/canvas/GridaCanvasSurface.tsx`, `src/canvas/model.ts`, `src/canvas/PosterCanvas.tsx`, `src/canvas/use-poster-agent-tools.ts`, `server/aurora-agent.mjs`, `package.json`

### Incertitudes restantes

Cette comparaison analyse code, documentation, versions et manifestes; elle n’intègre ni ne lance FigCraft dans Aurora. Les performances navigateur, compatibilité exacte de scène, fidélité du round-trip, qualité UX de l’iframe, stabilité des commandes en interaction CopilotKit et coût réel de migration sont **à mesurer dans le spike**, pas déduits de la documentation.
