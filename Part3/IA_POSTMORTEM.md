# IA_POSTMORTEM.md

## Contexte

Projet: lecteur audio en Web Components (M2 NUMRES 2025/2026), avec composants separables (`my-audio-player`, `my-playlist`, `my-equalizer`, `my-visualizer`, `my-player-controls`) et support WAM optionnel (`wam-plugin`).

Objectif du post-mortem: documenter de maniere professionnelle l'utilisation des outils IA pendant la conception, l'implementation et la verification.

## Outils IA utilises

- GitHub Copilot Chat (mode conversationnel dans VS Code)
- Suggestions de completion Copilot (inline)

## Comment l'IA a ete utilisee

### 1. Structuration du projet

- Proposition d'une architecture modulaire basee sur des Custom Elements natifs.
- Aide a la separation des responsabilites:
	- orchestration dans `components/audioplayer.js`
	- traitements audio dans `myequalizer.js` / `wamplugin.js`
	- UI de controle dans `playercontrols.js`
	- visualisation dans `myvisualizer.js`
	- logique playlist dans `playlist.js`

### 2. Conformite Web Components (W3C)

- Verification guidee des points de conformite:
	- `extends HTMLElement`
	- `attachShadow(...)`
	- `connectedCallback` / `disconnectedCallback`
	- `observedAttributes` / `attributeChangedCallback`
	- absence de lecture d'attributs sensibles dans le constructeur

### 3. Web Audio API et integration des composants

- Assistance sur le graphe audio et l'ordre des connexions.
- Clarification de la strategie de partage du contexte audio:
	- creation du `AudioContext` dans l'orchestrateur
	- passage explicite via `setAudioContext(ctx)`
	- injection des points d'entree via `setInput(node)`
	- exposition des sorties via `getOutput()`

### 4. API et documentation

- Co-redaction de la documentation API de chaque composant dans `SPECIFICATION.md` (style "Detail & Specs").
- Structuration README + README.txt pour le rendu (lancement, arborescence, integration, conformite).

### 5. Debug et corrections

- Diagnostic et correction de regressions successives:
	- absence de son (routing dry/wet WAM)
	- rendu non interactif de GUI WAM (taille/overflow iframe/canvas)
	- stabilisation du chargement WAM via attribut `src`
	- comportement de panneaux detachables/dockables et redimensionnables

## Prompts / methodologie

Approche appliquée avec l'IA:

- prompts de specification (ce qu'on veut obtenir)
- prompts de verification (ce qu'il faut prouver par le code)
- prompts de correction ciblee (un bug, un fichier, un comportement attendu)

Exemples de formulations utilisees:

- "Verifier la conformite W3C de chaque composant."
- "Documenter l'API: tag, attributs, methodes, proprietes, evenements."
- "Corriger le chargement WAM automatique et garder un fallback robuste."
- "Refactoriser sans casser la communication inter-composants."

## Fichiers impactes avec aide IA

- `components/audioplayer.js`
- `components/playercontrols.js`
- `components/myequalizer.js`
- `components/myvisualizer.js`
- `components/playlist.js`
- `components/wamplugin.js`
- `css/player.css`
- `css/player-controls.css`
- `README.md`
- `SPECIFICATION.md`
- `README.txt`

## Regles / contraintes suivies

- Pas de framework front-end: Web Components natifs uniquement.
- Import de `components/libs/webaudiocontrols.js` uniquement dans les composants qui l'utilisent.
- Pas de `document.querySelector(...)` dans le code des composants maison (hors bibliotheque tierce).
- Couplage faible via API explicite + `CustomEvent`.
- Documentation des choix de design et de l'API publique.

## Ce que l'IA n'a pas remplace

- Decisions d'architecture finales (prises par l'equipe).
- Validation fonctionnelle manuelle dans le navigateur.
- Arbitrages UX et priorisation des fonctionnalites a rendre.

## Limites rencontrees

- Certaines suggestions IA etaient correctes techniquement mais non conformes a la consigne pedagogique (ex: formulations trop "framework-like").
- Necessite de relectures systematiques pour eviter:
	- API documentee mais non alignee a 100% avec le code
	- regressions de comportement lors des refactors rapides

## Bonnes pratiques retenues

- Toujours valider une suggestion IA par lecture du code et test local.
- Demander a l'IA des modifications petites et verifiables.
- Maintenir une trace claire des decisions dans les fichiers `.md`.
- Conserver une API simple et stable pour les composants reutilisables.

## Bilan

L'IA a servi d'accelerateur de production, de revue et de documentation, sans deleguer la responsabilite technique finale. Le projet final reste conforme a l'esprit du sujet: composants Web natifs, faiblement couples, documentes, reutilisables, et integrables dans une page hote.
