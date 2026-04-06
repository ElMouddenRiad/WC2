# Partie 3 — Lecteur audio en Web Components

> Projet réalisé dans le cadre du cours **M2 NUMRES — Web Components 2025/2026** (Michel Buffa).

## Contexte du cours

Le cours porte sur les **API Web Components** natives (Custom Elements, Shadow DOM, ES modules), sans framework. Objectif : un lecteur audio décomposé en **composants réutilisables**, branchés sur la **Web Audio API** (égaliseur, balance, visualisation, WAM).

### Séances couvertes

| Séance | Objectif |
|--------|----------|
| 1–2 | Premier composant `<my-audio-player>`, librairie webaudio-controls, assets audio |
| 3 | Web Audio API : balance, égaliseur, visualiseur (spectre / waveform / volume) |
| 4 | Barre de progression, buffer, durées ; playlist (lecture, auto-suivant, boucles, shuffle, glisser-déposer, suppression / corbeille) ; événements entre composants |

## Fonctionnalités implémentées

### Lecteur (`<my-audio-player>`)

- Transport, volume (slider + knob), balance (`StereoPannerNode`), VU-mètre RMS
- Boucles (off / toutes / une piste), shuffle
- Barre de progression cliquable, zone bufferisée, temps courant / durée
- Ajout de pistes par URL ou fichiers locaux
- `MediaSession`, raccourcis clavier globaux (Espace, flèches) sur la page du lecteur
- Grille d’emplacements neutres (`slot1`–`slot5`), panneaux détachables / redimensionnables
- WAM optionnel dans le graphe

### Playlist (`<my-playlist>`)

- Liste, durées, clic pour lire, auto-suivant
- Suppression (corbeille, restauration), réordonnancement au drag
- Raccourcis clavier dans le composant (Enter / Espace, Delete)

### Égaliseur (`<my-equalizer>`)

- 10 bandes peaking, presets, bypass, mode `compact`

### Visualiseur (`<my-visualizer>`)

- Modes spectrum et waveform, `compact`, `setAnalyser` + `start` / `stop`

### Contrôles (`<my-player-controls>`)

- Transport, shuffle / boucle, volume, balance, VU ; événements `controls-*` pour l’orchestrateur
- Import de `webaudiocontrols.js` **dans ce module uniquement** (pas dans le HTML hôte)

### WAM (`<wam-plugin>`)

- Chargement d’effets WAM2 par URL, dry/wet, GUI du plugin ; démo isolée : `isolated-wam.html` (bouton **Load** dans le shadow du composant après **Démarrer l’audio**)

## Chargement de `webaudio-controls` (consigne cours)

Fichier local : `components/libs/webaudiocontrols.js`.

- **À éviter** : `<script src=".../webaudiocontrols.js">` dans les pages HTML (`index.html`, `demo-advanced.html`, etc.).
- **À faire** : `import './libs/webaudiocontrols.js'` dans **chaque composant** qui utilise les balises `webaudio-*`. Ici : [`playercontrols.js`](components/playercontrols.js) et [`myequalizer.js`](components/myequalizer.js). [`audioplayer.js`](components/audioplayer.js) importe `playercontrols.js`, pas la lib directement.

Référence des widgets : [webaudio-controls — Detail & Specs](https://g200kg.github.io/webaudio-controls/docs/detailspecs.html).

## Arborescence utile

```
Part3/
├── index.html                    # Lecteur plein écran (layout fixed)
├── demo-advanced.html            # Vitrine : récap fonctionnel + liens doc + même playlist que index
├── modular-player.html           # Grille modulaire (cases à cocher, emplacements dock)
├── modular-player.js
├── integration-host-app.html     # Parcours ordonné : playlist → contrôles → Web Audio → EQ → WAM? → visualiseur
├── integration-demo-host.js      # Hôte partagé : AudioContext au premier ensureAudioContext() (étape 3 ; pas de new dans le HTML)
├── isolated-playlist.html
├── isolated-eq.html
├── isolated-visualizer.html
├── isolated-wam.html
├── isolated-controls.html        # my-player-controls + journal des événements controls-*
├── css/
│   ├── theme-futuristic.css
│   ├── player.css
│   ├── player-controls.css
│   ├── modular-app.css
│   ├── equalizer.css, visualizer.css, playlist.css
├── components/
│   ├── audioplayer.js
│   ├── playercontrols.js
│   ├── myequalizer.js
│   ├── myvisualizer.js
│   ├── playlist.js
│   ├── wamplugin.js
│   └── libs/webaudiocontrols.js
├── assets/                       # MP3 de démo
├── SPECIFICATION.md              # API détaillée (style « Detail & Specs »)
└── README.md
```

## Graphe audio dans `<my-audio-player>`

```
<audio> → EQ → [WAM] → GainNode → StereoPannerNode → AnalyserNode → destination
```

Création du `AudioContext` et du graphe au **premier geste de lecture** (politique autoplay). Si le WAM n’est pas chargé, la sortie de l’EQ va directement au gain.

Un **enchaînement pédagogique** (contrôles montés avant le `MediaElementSource`, analyseur avant le gain maître dans cette démo) est décrit dans **`integration-host-app.html`** et dans [SPECIFICATION.md](SPECIFICATION.md#intégration-dans-une-autre-application-audio).

## Communication entre composants

Le lecteur **compose** les enfants dans son Shadow DOM et appelle leurs méthodes (`setAudioContext`, `setInput`, `setAnalyser`, `setTracks`, …). Les sous-composants émettent des `CustomEvent` avec `bubbles` et `composed: true` pour que l’hôte ou le `document` puissent écouter (ex. `play-track`, `playlist-changed`, `eq-change`, `wam-loaded`).

Tableau détaillé et contrat de chaque tag : [SPECIFICATION.md](SPECIFICATION.md).

## Conformité Web Components (rappel)

| Critère | audioplayer | playlist | equalizer | visualizer | wam-plugin | player-controls |
|---------|:-----------:|:--------:|:---------:|:----------:|:----------:|:---------------:|
| `extends HTMLElement`, `super()`, `attachShadow({mode:'open'})` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `customElements.define`, lifecycle, `observedAttributes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CSS encapsulé, modules ES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## API publique du lecteur (rappel)

```js
player.setPlaylist([{ src, title }, ...])
player.getPlaylist()
player.setVolume(0..1)
player.setBalance(-1..1)
player.playNext()
player.playPrevious()
player.toggleShuffle()
player.toggleLoop()
player.getAudioContext()
player.getGainNode()
player.getPannerNode()
player.getAnalyserNode()
```

## Lancement local

```bash
cd Part3
npx http-server . -p 8000 -c-1
```

Ouvrir `http://localhost:8000/index.html`. Pages de test : `isolated-*.html`, `integration-host-app.html`, `modular-player.html`, `demo-advanced.html`.

## Intégration dans une autre application

1. Consulter [SPECIFICATION.md — Intégration](SPECIFICATION.md#intégration-dans-une-autre-application-audio) (règles : un seul `AudioContext`, pont avant l’EQ, etc.).
2. Référence de parcours : **`integration-host-app.html`** et **`integration-demo-host.js`** — six étapes dans l’ordre pédagogique (playlist → **`my-player-controls`** → `MediaElementSource` + gain + panoramique → EQ → WAM optionnel → analyseur + visualiseur). Le bouton de l’étape 3 se débloque dès qu’il y a des pistes et qu’aucun `MediaElementSource` n’existe encore ; le montage de **`my-player-controls`** peut se faire à l’étape 2 ou automatiquement au premier clic sur l’étape 3. La playlist et le média de l’étape 1 sont prêts sans rechargement ; recharger la page sert à repartir de zéro une fois le graphe Web Audio attaché à `<audio>`.
3. Pour n’embarquer que le lecteur complet : un `<script type="module" src=".../audioplayer.js">` suffit en général (imports relatifs vers les autres modules).

### Pages isolées et contrat « hôte »

Les fichiers `isolated-*.html` montent un seul composant : le script de la page joue le rôle d’**hôte** (écoute des `CustomEvent`, appels à `audio` ou à Web Audio). Par exemple, **`isolated-controls.html`** relie `controls-volume` à `HTMLMediaElement.volume` et ne connecte pas `controls-balance` à un `StereoPannerNode` : le volume fonctionne, la balance reste sans effet tant que l’hôte ne fournit pas ce nœud — comportement attendu pour un composant présentant uniquement de l’UI et des événements, sans graphe intégré.

## Utilisation par URL distante

Les composants sont des modules ES ; conserver la structure `components/`, `css/`, `assets/` pour que `import.meta.url` reste valide. Attention **CORS** et en-têtes sur les `.js`.

## Documentation complète

- **[SPECIFICATION.md](SPECIFICATION.md)** — tags, attributs, méthodes, événements, graphes, intégration, [conformité au sujet du cours](SPECIFICATION.md#conformité-au-sujet-du-cours-rappel), décisions de design.
- **[IA_POSTMORTEM.md](IA_POSTMORTEM.md)** — post-mortem professionnel des outils IA utilisés.

## Sujet du cours — tableau de conformité (rappel)

L’énoncé **Projet Web Components 2025/2026** demande notamment : composants réutilisables par **URI**, documentation type **Detail & Specs**, **faible dépendance**, partage explicite de l’**AudioContext**, playlist / EQ / visualisations / **WAM** optionnel, pages **isolées** + application qui compose les composants, **décisions de design** documentées, **post-mortem IA**.

| Livrable demandé | Où le trouver |
|------------------|---------------|
| API détaillée (tag, attributs, méthodes, propriétés, événements) | [SPECIFICATION.md](SPECIFICATION.md) |
| Communication inter-composants, graphe audio, intégration hôte | [SPECIFICATION.md — Communication](SPECIFICATION.md#communication-inter-composants), [Graphe audio](SPECIFICATION.md#graphe-audio), [Intégration](SPECIFICATION.md#intégration-dans-une-autre-application-audio) |
| Décisions de design (imbrication, contexte, événements, etc.) | [SPECIFICATION.md — Décisions de design](SPECIFICATION.md#décisions-de-design) |
| Composants utilisables sans npm, chemins relatifs | Section [Utilisation par URL distante](#utilisation-par-url-distante) ci-dessus |
| Démos « un composant seul » | Fichiers `isolated-*.html` |
| Projet complet utilisant les composants | `index.html`, `demo-advanced.html`, `modular-player.html`, etc. |
| Post-mortem IA | [IA_POSTMORTEM.md](IA_POSTMORTEM.md) |
| `README.txt` à la racine (modalités) | [README.txt](README.txt) |

**Non inclus (optionnel dans le sujet)** : visualisation **Butterchurn** (mentionnée comme possibilité si le temps le permet) ; le projet couvre spectrum / waveform / VU via `<my-visualizer>` et les contrôles.
