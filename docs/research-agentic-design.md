# Recherche produit & architecture — CreatiPoster, A2UI et OpenBot

**Recherche vérifiée le 24 novembre 2026.** Les conclusions ci-dessous distinguent ce que les dépôts indiquent de ce qui est recommandé pour Aurora.

## Résumé de décision

**Fusion utile, mais à deux niveaux différents :**

1. **CreatiPoster inspire le modèle de création graphique** : une affiche est composée de couches éditables et contrôlables, et la composition combine contenu/éléments structurés avec un fond ou des images.
2. **A2UI inspire les surfaces interactives temporaires du chat** : l’agent peut diffuser des choix de composition, des variantes, des cartes de confirmation ou un sélecteur d’assets, que le frontend rend avec ses composants React autorisés.
3. **Le canvas d’affiche Aurora reste un renderer spécialisé**, déterministe et propriétaire. On ne demande ni à A2UI de dessiner la scène vectorielle, ni au LLM d’envoyer du code/HTML arbitraire. La conversation et le flux d’actions s’appuient sur le runtime OpenBot/CopilotKit/AG-UI.

Le contrat central est un `PosterDocument` structuré. Les gestes directs et les outils de l’agent produisent des patches validés sur ce même document ; le renderer met à jour seulement les éléments affectés. Le chat reste l’espace de direction artistique.

## 1. OpenBot : vraie base de conversation, pas un widget

### Faits observés dans le dépôt

- OpenBot décrit `app/` comme son application web principale et le chat comme l’une de ses surfaces principales. Sa fiche produit donne la stack de l’application : React 19, Vite, Tailwind 4, shadcn/Base UI, Tabler et Motion.
- La conversation n’est pas réduite à une zone de texte : `ConversationView` compose un transcript, un composer, pièces jointes, états d’attente/arrêt, reprise et gestion de messages en file. `ChatTranscript` rend les messages et les sorties d’outils/activités.
- `channel-chat.tsx` relie ces composants à CopilotKit v2, AG-UI, l’API OpenBot, l’historique et les états de conversation. Ce code importe plusieurs services et composants internes.
- Le dépôt OpenBot est MIT, mais sa documentation distingue l’application du service CopilotKit Intelligence, qui a ses propres conditions/licences de déploiement.

### Conséquence pour Aurora

Pour reprendre **le chat complet** sans en fabriquer une copie incomplète, la bonne unité de réutilisation est le flux conversationnel d’OpenBot avec ses dépendances et son runtime, pas uniquement le composer ni une capture visuelle. Il faut l’adopter comme base du shell/conversation, puis ajouter le canvas Aurora dans la même route de création. Le frontend OpenBot n’est pas publié comme package de chat autonome.

Le prototype actuel de `src/` reste une maquette d’expérience et **n’est pas le frontend OpenBot**. Il ne doit pas être présenté comme une intégration terminée.

## 2. CreatiPoster : idées transposables, code/modèle non réutilisable en l’état

### Faits observés dans le dépôt public

Le README de CreatiPoster décrit une génération graphique en couches : le modèle de protocole produit une structure de design éditable ; un modèle de fond produit un arrière-plan complémentaire ; le système les compose. L’éditeur de démonstration expose des champs JSON pour personnaliser texte, assets, disposition et style. Le dépôt mentionne aussi les entrées prompt-only, asset-only et mixtes, la superposition de texte et le re-layout.

Le dépôt officiel indique dans sa liste de tâches que le code d’entraînement/inférence, le checkpoint et les jeux de données restent à publier; la page GitHub consultée ne présente pas de licence logicielle à la racine. L’article arXiv v2 (22 juillet 2026) affiche CC BY 4.0 pour le manuscrit, mais cela ne constitue pas à lui seul une licence du dépôt, d’éventuels poids, du dataset ou du code non publié. **Aurora applique les mécanismes décrits de façon indépendante et ne copie pas leurs fichiers, poids ou données.**

### Apport raisonnable à Aurora

- représenter les textes, formes, éléments visuels, styles et références d’assets comme couches distinctes ;
- garder le texte réel éditable et séparer le document de son rendu ;
- séparer le choix de composition et le traitement/génération d’un fond ;
- prévoir le re-layout comme une transformation explicitement contrôlée, plutôt qu’un redimensionnement aveugle.

Ce sont des orientations de produit/architecture, **pas la preuve** qu’Aurora peut reproduire la qualité du modèle CreatiPoster sans son modèle, ses données et ses évaluations.

## 3. A2UI : adapté aux UI génératives du chat, pas au moteur d’affiche

### Faits observés

A2UI v1.0 définit un protocole JSON en flux avec `createSurface`, `updateComponents`, `updateDataModel` et `deleteSurface`. Sa spécification distingue structure UI et données ; les composants sont choisis dans un catalogue validé par le produit, et non exécutés comme du code arbitraire. Elle prévoit des mises à jour progressives et des appels de fonctions typés. A2UI documente AG-UI comme liaison de transport possible. Le dépôt propose un renderer React et indique une licence Apache-2.0 ; le paquet npm `@a2ui/react` annonce la compatibilité React 19.

### Apport raisonnable à Aurora

A2UI peut afficher dans la conversation, au moment opportun :

- quelques directions artistiques comparables avec un choix explicite ;
- des variantes de palette ou de hiérarchie typographique ;
- des cartes de confirmation avant un changement important ;
- un sélecteur de format, une galerie interne d’assets autorisés ou une proposition de re-layout.

A2UI ne fournit pas à lui seul un éditeur de poster multicouche, un modèle graphique, un moteur de rendu SVG, ni la qualité d’une composition. Le faire porter le canvas complet mélangerait deux responsabilités et rendrait plus difficile le contrôle fin des transformations.

## 4. Fusion recommandée

```text
OpenBot chat / CopilotKit + AG-UI
       ├── texte de l’utilisateur et contexte du projet
       ├── événements streamés : raisonnement d’action / statut / résultat
       ├── A2UI : cartes de choix, confirmations et petits contrôles du chat
       └── outils d’édition typés ──> patches validés sur PosterDocument
                                             │
                                  renderer SVG/Canvas déterministe
                                             │
                               canvas vivant + édition directe
```

`PosterDocument` est la source de vérité ; A2UI ne la remplace pas. Les événements AG-UI indiquent ce que l’agent fait. Le moteur applique chaque patch après validation de son schéma, de l’existence de l’élément ciblé et des contraintes géométriques. Un identifiant d’élément stable permet à l’utilisateur de suivre le même objet pendant une itération.

Outils actuellement enregistrés côté canvas : `poster_apply_protocol`, `poster_add_text`, `poster_update_text`, `poster_move_element`, `poster_resize_element`, `poster_set_style`, `poster_add_shape`, `poster_place_asset`, `poster_set_background`, `poster_set_background_asset`, `poster_generate_background`, `poster_relayout` et `poster_undo_change`. Le modèle de protocole exige un mode explicite (`create`, `complete`, `relayout`), des éléments typés, une géométrie et un ordre bottom-to-top; la création complète est refusée si le document contient déjà des calques. Les changements sont validés, historisés et les calques verrouillés ne peuvent pas être modifiés par les tools. La génération du fond requiert confirmation, garde la couche générée séparée et place les éléments éditables au-dessus.

## 5. Critères de réussite à tester

1. Dans une conversation OpenBot réelle, une instruction déclenche des événements observables et les changements arrivent progressivement dans le canvas.
2. Une édition manuelle et une action de l’agent modifient le même `PosterDocument` ; annuler une action restaure exactement son état précédent.
3. Un changement de titre ne déplace pas ou ne détruit pas les autres couches, sauf si l’agent a produit un patch explicite.
4. Chaque asset affiché garde sa provenance et sa licence ; aucun contenu de référence tiers n’est aspiré sans autorisation.
5. Le schéma rejette un ID d’élément inconnu, une propriété non autorisée et une géométrie hors format ; le message d’échec est visible et aucun faux succès n’est affiché.
6. Le flux reste lisible pendant une longue génération, les mises à jour du poster sont regroupées au rendu, et le chat reste utilisable sur mobile.

Aucun benchmark de qualité visuelle ou de latence n’a été exécuté dans cette recherche. Il faudra choisir des cibles mesurables et une suite de briefs de référence avant d’affirmer un gain de précision/performance.

## 6 Application effective des principes dans Aurora

Ce tableau traduit explicitement les propriétés de CreatiPoster en exigences fonctionnelles Aurora, sans réutiliser son code ou son modèle :

| Principe source | Application Aurora | Fichier / limite actuelle |
| --- | --- | --- |
| Programme de design JSON au lieu d’une image aplatie | `PosterDocument` Zod typé, couches SVG ordonnées et outils ciblés | `src/canvas/model.ts`, `src/canvas/PosterCanvas.tsx` |
| Attributs sémantiques, géométriques, stylistiques et ordre | Rôle, texte/type d’asset, x/y/taille/rotation, style/opacity, ordre de calques; protocole `poster_apply_protocol` | Le schéma SVG ne modélise pas encore toutes les courbures, masques ou attributs typographiques décrits dans le papier |
| Prompt-only, asset-only et mixte | Canevas vierge et protocole `create`; import/asset-ref et `complete`; le contexte agent expose métadonnées, descriptions et provenance d’assets | La vision du contenu d’un upload dépend de son alt/description; le modèle n’est pas envoyé automatiquement toutes les images chat |
| Canvas-conditioned completion et contraintes partielles/verrouillées | `complete` préserve les calques non référencés; tools ciblés; les calques verrouillés sont rejetés; `useAgentContext` transmet la structure courante | Un éditeur de champs arbitraires de protocole n’est pas encore exposé |
| Fond awareness séparé du premier plan | Agnes Image 2.1 reçoit, après confirmation, l’aperçu transparent du premier plan; la sortie devient un calque de fond dédié sous les calques texte/assets éditables | En cas d’asset distant sans permission CORS, génération sur prompt seul; le modèle peut encore dessiner des artefacts et doit être vérifié par le créateur |
| Re-layout réutilisant contenu/style | `poster_apply_protocol(mode=relayout)` change les dimensions du canvas, scale les couches et accepte des positions explicites par ID; `poster_relayout` applique aussi des presets à la taille actuelle | Presets actuels limités à editorial/centered/asymmetric; ce n’est pas le modèle entraîné de re-layout CreatiPoster |
| Qualité de composition et conformité à la demande | Prompt système demande hiérarchie, lisibilité, palette cohérente, assets fidèles et absence d’invention de données | Pas encore de benchmark humain ou automatique contre les dimensions Layout/Color/Graphic Style/Compliance du papier |

## 7 Agnes AI vérifié

Les pages officielles Agnes consultées documentent une API OpenAI-compatible : base `https://apihub.agnes-ai.com/v1`, `POST /chat/completions`, messages `tools`/`tool_choice` et streaming SSE. Pour Aurora, le runtime utilise `agnes-3.0-flash` via `@ai-sdk/openai` avec les tools CopilotKit; la clé reste côté serveur sous `AGNES_API_KEY`. Le modèle image `agnes-image-2.1-flash` utilise `POST /images/generations`, supporte `extra_body.image` en URL/Base64 et une sortie Base64 — ce qui alimente un calque de fond réversible et exportable. Chaque génération d’image exige confirmation explicite et conserve modèle/prompt en provenance.

**Limites non vérifiées en production :** la connexion réelle avec un compte Agnes, la disponibilité/modération du modèle et la qualité du tool calling ne sont pas testées ici, faute de clé. Les appels API sont testés par mocks locaux uniquement. Ne pas exposer publiquement le runtime sans authentification, quota et limites de dépenses par utilisateur.

## Sources primaires consultées

- OpenBot, dépôt et README : https://github.com/CopilotKit/OpenBot (commit `cd22ecbc5b29c038beae2115cecf05cd8ef2fafb`)
- OpenBot, fiche produit : https://github.com/CopilotKit/OpenBot/blob/main/app/PRODUCT.md
- OpenBot, conversation et transcript : https://github.com/CopilotKit/OpenBot/blob/main/app/src/components/channels/conversation-view.tsx et https://github.com/CopilotKit/OpenBot/blob/main/app/src/components/channels/chat-transcript.tsx
- OpenBot, orchestration de la conversation : https://github.com/CopilotKit/OpenBot/blob/main/app/src/components/channels/channel-chat.tsx
- CreatiPoster, dépôt (commit `82a262addc7ccea9b1cb7d22923f4a57457c7a74`) : https://github.com/graphic-design-ai/creatiposter
- CreatiPoster, article intégral v2 et licence du manuscrit : https://arxiv.org/html/2506.10890 — sections 3.1–3.4 (programme éditable, attributs sémantiques/géométriques/stylistiques et ordre, protocole completion, fond aware), section 5 (text overlay, re-layout, canvas-mode verrouillé, animation); arXiv indique CC BY 4.0 pour l’article.
- Agnes AI, Agnes 3.0 Flash (modèle, endpoints, streaming, tool calling et auth Bearer) : https://agnes-ai.com/en/docs/agnes-30-flash
- Agnes AI, Agnes 3.0 Pro : https://agnes-ai.com/en/docs/agnes-30-pro
- Agnes AI, Agnes Image 2.1 Flash (génération, édition, sorties Base64 et attribution de modèle) : https://agnes-ai.com/en/docs/agnes-image-21-flash
- A2UI, spécification v1.0 : https://github.com/a2ui-project/a2ui/blob/main/specification/v1_0/docs/a2ui_protocol.md (commit `c26be2dd087b541c46e0296c164ae13bf35f7836`)
- A2UI, README et paquets : https://github.com/a2ui-project/a2ui
