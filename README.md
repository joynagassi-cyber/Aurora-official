# Aurora — studio de création agentique

Aurora est un espace de création où l’utilisateur dirige par conversation et où l’agent compose puis modifie une affiche visible, structurée et réversible. Le canvas est un programme SVG multi-calques — jamais une image aplatie.

## Lancer

```bash
npm ci
cp .env.example .env.local
# Renseigner AGNES_API_KEY uniquement dans .env.local (ignoré par Git)
npm run dev
```

`AGNES_API_KEY` est lu uniquement côté serveur. Ne jamais ajouter de secret à Git, à une variable `VITE_*` ou au code navigateur. Sans cette variable, le canvas reste disponible mais le runtime conversationnel et la génération d’image répondent `503`.

### Avatar papillon 3D

Ouvrir `/butterfly` pour explorer le papillon Aurora procédural. Le maillage est construit en Three.js (ailes, nervures, corps, antennes et traînées), sans image 2D plaquée. Glisser pour orbiter, utiliser la molette pour zoomer, sélectionner l’un des huit états d’agent et jouer le scénario d’animation complet. La page respecte le réglage système de réduction des animations.

### Connexion Agnes AI

Aurora utilise les APIs officielles documentées Agnes :

- Chat/agent : `https://apihub.agnes-ai.com/v1/chat/completions`, modèle `agnes-3.0-flash`, streaming et function calling via l’API OpenAI-compatible.
- Fonds : `https://apihub.agnes-ai.com/v1/images/generations`, modèle `agnes-image-2.1-flash`, image de référence Base64 et sortie Base64.
- La génération d’image est une action distincte, confirmée dans le canvas avant envoi; le prompt et l’aperçu des calques peuvent être transmis à Agnes. Vérifier les conditions et quotas du compte Agnes.

Pour Render, définir le secret `AGNES_API_KEY` dans les paramètres privés du service (le manifeste `render.yaml` le marque `sync: false`). L’application n’inclut pas la clé dans ses bundles. L’endpoint `/healthz` signale si le secret serveur est présent.

> **Sécurité avant déploiement public :** le service n’intègre pas encore une identité Aurora complète. Ajouter authentification et quotas par utilisateur avant d’exposer l’API; le quota local de génération d’image est seulement une protection simple, non une frontière de sécurité multi-tenant.

## Canvas et méthodes CreatiPoster

Aurora applique explicitement, par implémentation indépendante, les principes fonctionnels décrits dans le papier CreatiPoster :

- **Programme structuré éditable :** le document canonique Zod est rendu en SVG; textes, formes, tracés, assets et fond sont des couches indépendantes avec ordre z.
- **Protocole de composition :** `poster_apply_protocol` consomme des entrées typées avec sémantique/rôle, géométrie, style et ordre bottom-to-top. Il crée une affiche sur canvas vierge, complète sans aplatir et change le format en re-layout responsif par ID, en préservant texte, asset, style et ordre. Des presets éditoriaux restent disponibles pour le re-layout à taille constante.
- **Modes d’entrée :** prompt-only sur canvas vide; asset-only par import et référence de calque existant; mixte via protocole de composition; canvas-conditioned grâce au contexte de document, aux mises à jour ciblées et aux verrous.
- **Fond généré à part :** Agnes Image 2.1 reçoit un aperçu transparent du premier plan comme guide; son image est conservée comme fond autonome sous les textes/assets réels. Si un asset distant bloque l’export navigateur (CORS), la génération se fait sur le prompt seul.
- **Contrôle créateur :** une génération d’image exige confirmation; les opérations sont validées, historisées et annulables. Les calques verrouillés sont protégés. Un refus de validation n’est jamais présenté comme un succès.
- **Fidélité et provenance :** aucun fait métier n’est inventé; un asset externe requiert HTTPS, attribution et note de licence. Le modèle et le prompt sont mémorisés pour les fonds générés.

Les outils incluent `poster_add_text`, `poster_update_text`, `poster_move_element`, `poster_resize_element`, `poster_set_style`, `poster_add_shape`, `poster_place_asset`, `poster_set_background`, `poster_set_background_asset`, `poster_generate_background`, `poster_relayout` et `poster_undo_change`.

**Limite importante :** Aurora adopte les idées d’architecture et d’interaction, mais ne reproduit pas le modèle entraîné CreatiPoster ni ses performances. Le papier décrit un générateur de protocole spécifique et un synthétiseur de fond foreground-aware entraînés; Aurora les approche avec les modèles Agnes publiés et un document structuré. Pas de benchmark visuel CreatiPoster/Aurora n’a été effectué. L’état des sources, exigences et écarts est dans [`docs/research-agentic-design.md`](docs/research-agentic-design.md).

## Vérification

```bash
npm test
npx tsc -b
npm run build
```

Les tests Agnes utilisent un fetch mocké : ils vérifient l’endpoint, l’auth Bearer côté serveur, le modèle, l’image de référence et le rejet de sorties Base64 invalides; aucun secret ni appel externe réel n’est requis. Le build peut signaler des chunks CopilotKit/A2UI volumineux.
