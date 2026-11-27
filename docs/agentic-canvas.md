# Aurora : direction agentique et contrat du canvas

## Décision produit

Aurora n’est pas un éditeur graphique générique avec un chatbot ajouté. La conversation est l’espace de création : l’utilisateur dirige, l’agent propose et exécute des itérations visibles, et le canvas permet de corriger sans perdre le contrôle.

## Boucle de création

1. L’utilisateur fournit un brief, un asset, ou les deux; il peut continuer un document existant.
2. L’agent lit le contexte sérialisé du document et propose un protocole de couches typées.
3. Les outils appliquent des changements ciblés au document Zod canonique; le renderer SVG affiche les couches texte, images, formes, tracés et fond séparément.
4. Les gestes humains et l’agent partagent la même source; le créateur peut déplacer, éditer, verrouiller, réordonner, annuler et réorienter.
5. Une génération de fond via Agnes utilise l’aperçu transparent du premier plan comme guide quand le navigateur le permet. Elle demande confirmation avant transmission et laisse le premier plan intact.

## Contrat et outils en place

`src/canvas/model.ts` définit `PosterDocument`, ses couches discriminées, validations, migration de l’ancien format et presets de re-layout. `PosterCanvas.tsx` assure le rendu SVG, l’édition locale, l’import, la persistance, l’historique et l’export.

`use-poster-agent-tools.ts` enregistre le contexte courant du document et les tools :

- `poster_apply_protocol` : création sur canvas vide, complétion préservant les couches non ciblées, ou re-layout par preset; ordre de protocole bottom-to-top, géométrie et styles sont validés;
- `poster_add_text`, `poster_update_text`, `poster_move_element`, `poster_resize_element`, `poster_set_style`, `poster_add_shape`;
- `poster_place_asset`, `poster_set_background`, `poster_set_background_asset`, `poster_generate_background`;
- `poster_relayout`, `poster_undo_change`.

Toute opération commitée passe la validation du document et l’historique; les calques verrouillés sont exclus des modifications agentiques. Les outils retournent un échec si la validation échoue. L’agent reçoit un inventaire utile des éléments, mais pas les octets image des assets dans son contexte texte : si l’alt/nom ne permet pas de comprendre l’image, il doit demander à l’utilisateur une description. Une image distante sans CORS permet l’affichage, mais pas toujours son inclusion comme référence de génération.

## Principes CreatiPoster appliqués (indépendamment)

1. **Programme structuré, pas raster aplati :** chaque objet est un calque éditable avec sémantique, géométrie, style et ordre.
2. **Protocole de génération/completion :** même schéma pour créer, compléter un canvas contraint et réorganiser un document.
3. **Modes d’entrée :** prompt-only depuis un canvas vide; asset-only via import et références d’asset; mode mixte via brief + assets; canvas-conditioned via les calques courants et les locks.
4. **Fond distinct :** Agnes Image 2.1 reçoit une image de premier plan transparente et un prompt de fond, et ne remplace que `background.image`; le renderer garde le vrai texte/asset au premier plan.
5. **Text overlay :** une image importée reste un calque indépendant sur lequel l’agent peut ajouter du texte éditable sans régénérer le fond.
6. **Re-layout/responsive :** `poster_apply_protocol` change le format, met à l’échelle les calques, puis accepte des géométries par ID sans changer contenu/style/z-order; `poster_relayout` offre aussi les presets editorial/centered/asymmetric.
7. **Contrôle utilisateur :** les actions sont réversibles, les locks respectés, la génération potentiellement facturée exige consentement.

Aurora ne reproduit pas les poids, l’objectif d’entraînement du modèle de protocole, le synthétiseur MM-DiT ou les résultats évalués CreatiPoster. Ses presets ne remplacent pas un apprentissage de layout. L’animation d’affiche, les attributs avancés (masques, text bending) et un benchmark esthétique restent des extensions non livrées. Voir [`research-agentic-design.md`](research-agentic-design.md) pour le détail des sources et écarts.

## Agnes AI

Le serveur utilise l’API officielle Agnes AI `https://apihub.agnes-ai.com/v1` via le client AI SDK OpenAI-compatible. Chat/tool calling : modèle `agnes-3.0-flash`; génération de fond : `agnes-image-2.1-flash`. Secret uniquement côté serveur `AGNES_API_KEY`; aucun secret réel n’a été fourni au dépôt. Les tests locaux utilisent un faux fetch et ne consomment pas l’API.

## État et validation

Chat runtime, tool registration, protocole de document et génération de fond avec confirmation sont implémentés. Les tests de transport Agnes s’exécutent avec `npm test`; `npx tsc -b` et `npm run build` valident le client. La découverte CopilotKit `/api/copilotkit/info` fonctionne avec une fausse clé de test; aucune requête de génération réelle à Agnes n’a été envoyée, car aucun secret de compte n’est disponible.
