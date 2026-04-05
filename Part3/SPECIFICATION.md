# SPECIFICATION.md — API Documentation

Documentation complète de l'API de chaque Web Component du projet lecteur audio.

Chaque composant maison est décrit avec la même structure que l’exemple du cours ([webaudio-controls — Detail & Specs](https://g200kg.github.io/webaudio-controls/docs/detailspecs.html)) : **tag**, **attributs HTML**, **méthodes** publiques, **propriétés** exposées (ou politique explicite), **événements émis**, **événements écoutés** (comportement interne ou contrat avec l’hôte).

---

## Bibliothèque tierce : `webaudio-controls` (fichier local)

| | |
|--|--|
| **Fichier** | `components/libs/webaudiocontrols.js` |
| **Rôle** | Enregistre les custom elements `webaudio-knob`, `webaudio-slider`, `webaudio-switch`, `webaudio-param`, `webaudio-keyboard`. |
| **Chargement** | Uniquement via `import './libs/webaudiocontrols.js'` dans un **module** qui en a besoin. **Interdit** dans les pages HTML du projet : `<script src="...webaudiocontrols.js">`. |
| **Utilisé par** | `<my-player-controls>` (`playercontrols.js`) — knob volume ; `<my-equalizer>` (`myequalizer.js`) — sliders EQ. `<my-audio-player>` importe `playercontrols.js`, pas `webaudiocontrols.js` directement. |
| **Doc complète (attributs, `setValue`, `input` / `change`, etc.)** | [g200kg — Detail&Specs](https://g200kg.github.io/webaudio-controls/docs/detailspecs.html) |

---

## Table des matières

1. [Bibliothèque tierce `webaudio-controls` (fichier local)](#bibliothèque-tierce--webaudio-controls-fichier-local)
2. [`<my-audio-player>`](#my-audio-player)
3. [`<my-equalizer>`](#my-equalizer)
4. [`<my-visualizer>`](#my-visualizer)
5. [`<my-playlist>`](#my-playlist)
6. [`<my-player-controls>`](#my-player-controls)
7. [`<wam-plugin>`](#wam-plugin)
8. [Communication inter-composants](#communication-inter-composants)
9. [Graphe audio](#graphe-audio)
10. [Intégration dans une autre application audio](#intégration-dans-une-autre-application-audio)
11. [Décisions de design](#décisions-de-design)

---

## `<my-audio-player>`

**Tag** : `<my-audio-player>`  
**Fichier** : `components/audioplayer.js`  
**CSS** : `css/player.css` (importe `css/player-shell.css`, partagé avec `modular-app.css` pour la même apparence hors Shadow DOM)  
**Rôle** : Composant orchestrateur principal. Crée le graphe Web Audio, instancie et connecte les sous-composants (EQ, visualizer, playlist, WAM).

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| `src` | `string` | URL de la piste audio par défaut |
| `data-tracks` | `JSON string` | Liste de pistes au format `[{src, title, duration?, artist?, album?, artwork?}, ...]` |
| `tracks` | `JSON string` | Alias de `data-tracks` |
| `layout` | `"fixed"` \| _(absent)_ | Mode d'affichage. `"fixed"` = hauteur 100%, pas de scroll de page |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `setPlaylist(list)` | `Array<{src, title}>` | `void` | Remplace la playlist complète |
| `getPlaylist()` | — | `Array` | Retourne une copie de la playlist |
| `setVolume(val)` | `number (0-1)` | `void` | Modifie le volume |
| `setBalance(val)` | `number (-1 à 1)` | `void` | Modifie la balance stéréo |
| `playNext()` | — | `void` | Passe à la piste suivante |
| `playPrevious()` | — | `void` | Passe à la piste précédente |
| `toggleShuffle()` | — | `void` | Active/désactive le mode aléatoire |
| `toggleLoop()` | — | `void` | Cycle : off → all → one → off |
| `getAudioContext()` | — | `AudioContext` | Accès au contexte audio |
| `getGainNode()` | — | `GainNode` | Accès au nœud de gain |
| `getPannerNode()` | — | `StereoPannerNode` | Accès au nœud de balance |
| `getAnalyserNode()` | — | `AnalyserNode` | Accès au nœud d'analyse |

### Propriétés exposées (JavaScript)

| Politique | Détail |
|-----------|--------|
| **API stable** | Aucune propriété « getter/setter » dédiée sur `<my-audio-player>`. Utiliser les **méthodes** (`setVolume`, `getAudioContext`, etc.). |
| **Champs internes** | `audioContext`, `currentIndex`, `playlistData`, etc. existent sur l’instance mais **ne font pas partie du contrat public** ; ne pas s’y fier dans une intégration tierce. |

### Événements émis

| Événement | Description |
|-----------|-------------|
| *(aucun)* | Le lecteur ne définit pas de `CustomEvent` propre. Les notifications vers l’extérieur passent par les sous-composants (`play-track`, `eq-change`, `wam-loaded`, …) avec `composed: true`, réémissibles jusqu’à l’hôte `<my-audio-player>`. |

### Événements écoutés (comportement interne)

| Source | Événement | Rôle |
|--------|-----------|------|
| `<audio id="myplayer">` | `loadedmetadata`, `timeupdate`, `progress`, `play`, `pause`, `ended`, `error` | Barre de progression, durées, transport, enchaînement des pistes |
| `<my-playlist>` | `play-track`, `playlist-changed` | Synchronisation lecture / liste |
| Contrôles UI (dont `webaudio-knob` volume) | `input`, `change`, `click` | Volume, balance, transport, ajout de pistes ; le knob suit les événements décrits dans la doc webaudio-controls |
| `window` | `mousemove`, `mouseup`, `keydown` | Panneaux détachables, redimensionnement de grille, raccourcis clavier |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation des propriétés (aucune lecture d'attribut)
- `connectedCallback()` : Rendu HTML, lecture des attributs, configuration des listeners
- `disconnectedCallback()` : Nettoyage du listener clavier global, arrêt du visualizer, fermeture de l'AudioContext
- `observedAttributes` : `['src', 'data-tracks', 'tracks', 'layout']`

---

## `<my-equalizer>`

**Tag** : `<my-equalizer>`  
**Fichier** : `components/myequalizer.js`  
**CSS** : `css/equalizer.css`  
**Rôle** : Égaliseur paramétrique 10 bandes avec presets et bypass.

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| `compact` | `boolean` (présence) | Mode compact : sliders plus petits, espacement réduit |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `setAudioContext(ctx)` | `AudioContext` | `void` | Injecte le contexte audio et crée les filtres |
| `setInput(sourceNode)` | `AudioNode` | `void` | Connecte un nœud source en entrée |
| `getOutput()` | — | `GainNode` | Retourne le nœud de sortie de l'EQ |
| `applyPreset(name)` | `string` | `void` | Applique un preset (Flat, Bass Boost, Vocal, Phone) |
| `toggleBypass()` | — | `void` | Active/désactive le bypass (gain à 0 sur tous les filtres) |
| `isBypassed()` | — | `boolean` | État du bypass |
| `disconnectAll()` | — | `void` | Déconnecte tous les nœuds audio |

### Propriétés exposées (JavaScript)

| Propriété | Type | Stable ? | Description |
|-----------|------|----------|-------------|
| *(aucune documentée)* | — | — | Préférer `isBypassed()`, `getOutput()`, `applyPreset()`, etc. Les tableaux `filters`, `bandFreqs`, `presets` sont des détails d’implémentation. |

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `eq-change` | `{index, gain}` | oui | oui | Un slider de bande est modifié |
| `eq-preset` | `{preset}` | oui | oui | Un preset est sélectionné dans le menu |
| `eq-preset-applied` | `{name}` | oui | oui | Un preset est appliqué programmatiquement |
| `eq-bypass` | `{bypassed}` | oui | oui | Le bypass est activé/désactivé |

### Événements écoutés

| Source | Événement | Rôle |
|--------|-----------|------|
| `webaudio-slider` (chaque bande) | `input`, `change` | Mise à jour des gains des `BiquadFilterNode` ; émission de `eq-change` |
| `#presetSelect` | `change` | Choix de preset → `eq-preset` |
| `#bypassBtn` | `click` | Toggle bypass → `eq-bypass` |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation (aucune lecture d'attribut, aucun rendu)
- `connectedCallback()` : Premier rendu (avec garde `_rendered`)
- `disconnectedCallback()` : Déconnexion de tous les nœuds audio
- `attributeChangedCallback` : Re-rendu si `compact` change
- `observedAttributes` : `['compact']`

---

## `<my-visualizer>`

**Tag** : `<my-visualizer>`  
**Fichier** : `components/myvisualizer.js`  
**CSS** : `css/visualizer.css`  
**Rôle** : Rendu canvas temps réel (spectrum ou waveform) à partir d'un `AnalyserNode`.

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| `mode` | `"spectrum"` \| `"waveform"` | Mode d'affichage |
| `compact` | `boolean` (présence) | Mode compact : canvas plus petit |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `setAnalyser(node)` | `AnalyserNode` | `void` | Connecte l'analyseur fréquentiel |
| `start()` | — | `void` | Démarre l'animation canvas (requestAnimationFrame) |
| `stop()` | — | `void` | Arrête l'animation et efface le canvas |

### Propriétés exposées

| Propriété | Type | Description |
|-----------|------|-------------|
| `mode` | `string` | Mode actuel (`spectrum` ou `waveform`) |
| `frameRate` | `number` | FPS cible (défaut: 30) |

### Événements émis

| Événement | Description |
|-----------|-------------|
| *(aucun)* | Pas de `CustomEvent` ; le rendu est entièrement piloté par `setAnalyser` + `start()` / `stop()`. |

### Événements écoutés

| Source | Événement | Rôle |
|--------|-----------|------|
| Boutons mode (shadow interne) | `click` | Bascule spectrum / waveform |
| *(aucun autre contrat public)* | — | — |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation (aucun rendu)
- `connectedCallback()` : Premier rendu canvas et boutons (avec garde `_rendered`)
- `disconnectedCallback()` : Arrêt de l'animation RAF
- `attributeChangedCallback` : Mise à jour du mode si changé
- `observedAttributes` : `['mode', 'compact']`

---

## `<my-playlist>`

**Tag** : `<my-playlist>`  
**Fichier** : `components/playlist.js`  
**CSS** : `css/playlist.css`  
**Rôle** : Gestion de la liste de pistes audio avec drag & drop, suppression, navigation clavier.

**Note (fichiers / URL)** : Le formulaire « Add URL » / « Files… » du lecteur monolithique est rendu par **`<my-audio-player>`** (carte playlist), pas à l’intérieur du shadow de `<my-playlist>`. Le composant expose `addTrack` / `setTracks` ; c’est à la **page hôte** de brancher un `<input type="file">` ou un champ URL (voir `isolated-playlist.html`).

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| `tracks` | `JSON string` | Liste de pistes `[{src, title, duration?}, ...]` |
| `data-tracks` | `JSON string` | Alias de `tracks` |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `setTracks(list)` | `Array<{src, title, duration?}>` | `void` | Remplace toute la playlist |
| `play(index)` | `number` | `void` | Sélectionne et joue la piste à l'index donné |
| `highlight(index)` | `number` | `void` | Met en surbrillance sans déclencher la lecture |
| `addTrack(track)` | `{src, title, duration?}` | `void` | Ajoute une piste à la fin |
| `removeTrack(index)` | `number` | `void` | Supprime une piste |
| `reorderTrack(from, to)` | `number, number` | `void` | Déplace une piste par index |
| `nextIndex()` | — | `number \| undefined` | Index de la piste suivante |
| `previousIndex()` | — | `number \| undefined` | Index de la piste précédente |
| `getTracks()` | — | `Array` | Copie de la liste de pistes |
| `restoreLastRemoved()` | — | `void` | Remet la **dernière** piste supprimée (LIFO) à sa position d’origine si possible ; émet `playlist-changed` (`add`) |
| `restoreRemovedAt(stackIndex)` | `number` | `void` | Restaure l’entrée d’historique à l’indice `stackIndex` (`0` = plus ancienne dans la pile interne) |
| `clearRemovedHistory()` | — | `void` | Vide la liste des suppressions récentes **sans** restaurer les pistes (l’UI « Supprimées » disparaît) |
| `getRemovedHistory()` | — | `Array` | Copie des entrées `{ track, index }` encore récupérables |

### Propriétés exposées (JavaScript)

| Propriété | Type | Stable ? | Description |
|-----------|------|----------|-------------|
| `tracks` | `Array` | partiel | Tableau courant des pistes ; **`getTracks()`** est préférable pour une copie sûre. |
| `current` | `number` | partiel | Index de surbrillance / sélection interne ; l’API préférée pour la logique métier reste `play(index)` et les événements. |

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `play-track` | `{index}` | oui | oui | Clic sur une piste ou appel à `play()` |
| `playlist-changed` | `{action, index, track?, from?, to?}` | oui | oui | Ajout, suppression, ou réordonnancement |

### Événements écoutés

| Source | Événement | Rôle |
|--------|-----------|------|
| Liste des pistes (shadow) | `click`, `keydown` | Lecture, suppression, navigation clavier |
| Drag & drop | `dragstart`, `dragover`, `drop`, etc. | Réordonnancement |
| `#btnUndoLast`, `#btnClearTrash`, boutons « Restaurer » | `click` | Annuler dernière suppression, vider l’historique, restaurer une piste précise |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation (aucun rendu)
- `connectedCallback()` : Premier rendu (avec garde `_rendered`), puis si `tracks` / `data-tracks` est déjà présent dans le HTML, application du JSON via `setTracks`
- `disconnectedCallback()` : Libération des blob URLs des pistes actives **et** de l’historique de suppression (`URL.revokeObjectURL`)
- `attributeChangedCallback` : Parse et applique le JSON si `tracks` / `data-tracks` change
- `observedAttributes` : `['tracks', 'data-tracks']`

---

## `<my-player-controls>`

**Tag** : `<my-player-controls>`  
**Fichier** : `components/playercontrols.js`  
**CSS** : `css/player-controls.css`  
**Rôle** : Transport (play / pause / prev / next / shuffle / loop), volume (slider + `webaudio-knob`), balance, VU-mètre (affichage). Le composant **n’ouvre aucune connexion** tout seul : l’**hôte** écoute les `CustomEvent` `controls-*` et les relie à `<audio>`, à la playlist, au `GainNode` / `StereoPannerNode`, ou à l’analyseur selon l’architecture. Dans `<my-audio-player>` et `modular-player.js`, ce branchement est fait par le script du lecteur ; dans `integration-host-app.html` la séquence prévue est **étape 2** (montage + événements) puis **étape 3** (`createMediaElementSource`, gain, panoramique) ; si l’étape 2 n’a pas été validée, le montage et le câblage des événements sont exécutés au premier clic sur l’étape 3. Volume sur `HTMLMediaElement.volume` puis sur le `GainNode` maître ; balance sur `StereoPannerNode` après l’étape 3 ; VU alimenté par l’`AnalyserNode` après l’étape 6. Démo : `isolated-controls.html` — l’hôte relie `controls-volume` à `audio.volume` et laisse `controls-balance` sans cible audio (aucun `StereoPannerNode`), ce qui illustre le contrat : sans graphe Web Audio, la balance n’a pas d’effet audible.

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| *(aucun observé)* | — | Pas d’`observedAttributes` dans cette version. |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `getVolumeValue()` | — | `number` | Volume 0–1 |
| `getBalanceValue()` | — | `number` | Pan −1…1 |
| `setVolumeValue(v)` | `number` | `void` | Synchronise slider + knob |
| `setBalanceValue(p)` | `number` | `void` | Synchronise balance |
| `setMeterPercent(pct)` | `number` | `void` | Largeur du VU (0–100) |
| `setShuffleActive(on)` | `boolean` | `void` | État visuel shuffle |
| `setLoopMode(mode)` | `0 \| 1 \| 2` | `void` | Libellé / état loop (off / all / one) |

### Événements émis (`bubbles` + `composed`)

| Événement | `detail` | Quand |
|-----------|----------|-------|
| `controls-play` | — | Play |
| `controls-pause` | — | Pause |
| `controls-next` | — | Piste suivante |
| `controls-prev` | — | Piste précédente |
| `controls-shuffle` | — | Clic shuffle (le parent bascule l’état) |
| `controls-loop` | — | Clic loop (le parent avance le mode) |
| `controls-volume` | `{ value }` | `input` volume |
| `controls-balance` | `{ value }` | `input` balance |

### Placement UI

Dans le lecteur principal, le bloc est dans une carte de la grille (`player.css`, zones `slot1`–`slot5`). Sur `modular-player.html`, les cartes sont créées à l’activation d’un module et insérées dans des emplacements vides (`dock-slot`) ; elles peuvent être détachées puis déposées sur un autre emplacement.

### Cycle de vie W3C

- `constructor()` → `attachShadow({ mode: 'open' })`
- `connectedCallback()` : premier rendu + branchement des écouteurs internes

---

## `<wam-plugin>`

**Tag** : `<wam-plugin>`  
**Fichier** : `components/wamplugin.js`  
**Rôle** : Chargeur d'effets audio au format WAM (Web Audio Modules). Charge un plugin WAM2 par URL et l'insère dans la chaîne audio avec gestion dry/wet pour le bypass.

### Attributs HTML

| Attribut | Type | Description |
|----------|------|-------------|
| `src` | `string` | URL du plugin WAM à charger |
| `name` | `string` | Nom affiché (défaut: "WAM Plugin") |

### Méthodes publiques

| Méthode | Paramètres | Retour | Description |
|---------|------------|--------|-------------|
| `setAudioContext(ctx)` | `AudioContext` | `void` | Injecte le contexte audio et crée les nœuds de routage |
| `loadPlugin(url)` | `string` | `Promise<void>` | Charge un plugin WAM par URL |
| `setInput(sourceNode)` | `AudioNode` | `void` | Connecte un nœud source en entrée |
| `getOutput()` | — | `GainNode` | Retourne le nœud de sortie |
| `toggleBypass()` | — | `void` | Active/désactive le bypass (dry/wet routing) |
| `toggleGUI()` | — | `Promise<void>` | Affiche/masque l'interface graphique du plugin |
| `showGUI()` | — | `void` | Affiche l'interface si pas déjà visible |
| `hideGUI()` | — | `void` | Masque l'interface |
| `destroyPlugin()` | — | `void` | Détruit le plugin et restaure le passthrough |
| `isBypassed()` | — | `boolean` | État du bypass |

### Propriétés exposées (JavaScript)

| Propriété | Type | Stable ? | Description |
|-----------|------|----------|-------------|
| *(aucune documentée)* | — | — | État du plugin et URL gérés en interne ; utiliser les méthodes et les événements `wam-*`. |

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `wam-loaded` | `{url, name}` | oui | oui | Plugin chargé avec succès |
| `wam-error` | `{url, error}` | oui | oui | Erreur lors du chargement |
| `wam-bypass` | `{bypassed}` | oui | oui | Bypass activé/désactivé |

### Événements écoutés

| Source | Événement | Rôle |
|--------|-----------|------|
| Champs UI (URL, boutons bypass / GUI / destroy) | `change`, `click` | Chargement de plugin, bypass, affichage GUI |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation (aucun rendu)
- `connectedCallback()` : Premier rendu (avec garde `_rendered`)
- `disconnectedCallback()` : `destroyPlugin()` — déconnexion audio et nettoyage GUI
- `attributeChangedCallback` : Charge le plugin si `src` change, met à jour le nom si `name` change
- `observedAttributes` : `['src', 'name']`

---

## Communication inter-composants

### Schéma de communication

```
┌──────────────────────────────────────────────────────┐
│                  <my-audio-player>                    │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐     │
│  │ <my-     │   │ <my-     │   │ <wam-plugin> │     │
│  │ playlist>│   │ equalizer│   │              │     │
│  │          │   │ >        │   │              │     │
│  └──┬───────┘   └──┬───────┘   └──┬───────────┘     │
│     │              │              │                  │
│     │ play-track   │ eq-change    │ wam-loaded       │
│     │ playlist-    │ eq-preset    │ wam-error        │
│     │ changed      │ eq-bypass    │ wam-bypass       │
│     ▼              ▼              ▼                  │
│  [audioplayer écoute ces événements et orchestre]     │
│                                                      │
│  ┌──────────┐                                        │
│  │ <my-     │ ◄── setAnalyser(node)                  │
│  │ visualiz │                                        │
│  │ er>      │                                        │
│  └──────────┘                                        │
└──────────────────────────────────────────────────────┘
```

### Mécanismes utilisés

| Mécanisme | Usage |
|-----------|-------|
| **Appels de méthodes directes** | `eq.setAudioContext(ctx)`, `eq.setInput(src)`, `viz.setAnalyser(node)`, `playlist.setTracks(list)`, `wam.setAudioContext(ctx)`, `wam.setInput(node)` |
| **CustomEvents** | `play-track` (playlist → player), `playlist-changed` (playlist → player), `eq-change`, `eq-preset`, `eq-bypass` (EQ → extérieur), `wam-loaded`, `wam-error`, `wam-bypass` (WAM → extérieur) |
| **Attributs HTML** | `data-tracks` / `tracks` sur `<my-playlist>`, `compact` sur EQ/visualizer, `src` / `name` sur `<wam-plugin>` |

### Partage du contexte audio

Le composant parent `<my-audio-player>` **possède** l'`AudioContext` et le passe explicitement aux sous-composants via leurs méthodes `setAudioContext(ctx)`. Aucun composant ne crée son propre contexte.

### Événements traversant le Shadow DOM (`composed: true`)

Tous les `CustomEvent` publics des sous-composants utilisent `bubbles: true` et **`composed: true`**. Ainsi, une page peut enregistrer par exemple :

```js
document.querySelector('my-audio-player').addEventListener('play-track', (e) => {
  console.log('Piste demandée', e.detail.index);
});
```

…même lorsque `<my-playlist>` vit dans le Shadow DOM du lecteur. Sans `composed`, ces événements s’arrêteraient au niveau du shadow root et ne seraient pas observables sur l’hôte.

---

## Graphe audio

### Dans `<my-audio-player>` (`audioplayer.js`)

```
MediaElementSource ──► EQ ──► [WAM] ──► GainNode ──► StereoPannerNode ──► AnalyserNode ──► destination
                              (optionnel)  (volume)     (balance)         (visualiseur + mesure)
```

- Le graphe et l’`AudioContext` sont créés **au premier geste de lecture** (autoplay).
- Sans WAM chargé : sortie de l’EQ → `GainNode`.
- L’`AnalyserNode` est **après** le panoramique ; le visualiseur et le VU du lecteur s’appuient sur ce nœud.

### Dans `integration-host-app.html` (parcours pédagogique)

Enchaînement **imposé** (texte détaillé sur la page : objectifs pédagogiques, liste ordonnée, encadré « évaluation »). Sur la page hôte, tant que `<my-player-controls>` n’est pas monté, l’indicateur visuel des cartes passe à l’**étape 2** dès qu’au moins une piste est disponible (sinon l’**étape 1** reste mise en avant). Différences notables par rapport à `<my-audio-player>` :

1. **`<my-player-controls>`** est monté **en étape 2** (bouton dédié), ou **au premier clic sur l’étape 3** si l’étape 2 n’a pas été utilisée : l’objectif est que le **contrat événementiel** (`controls-*`) soit branché sur `<audio>` avant ou en même temps que `createMediaElementSource` (volume via `HTMLMediaElement.volume`, balance sans cible tant qu’il n’y a pas de `StereoPannerNode`).
2. **Étape 3** : création du graphe `MediaElementSource → GainNode (maître) → StereoPanner → destination`, puis bascule du volume / balance vers ces nœuds et `audio.volume = 1`.
3. **Fin de chaîne** : l’`AnalyserNode` est inséré **sur la queue du signal avant le gain maître** : `… → AnalyserNode → GainNode (maître) → StereoPanner → destination`, ce qui alimente le visualiseur et permet au VU du bloc contrôles (déjà présent) de lire l’analyseur pendant la lecture.

Le fichier **`integration-demo-host.js`** expose un hôte partagé : l’`AudioContext` est créé au **premier** appel de `ensureAudioContext()` (étape 3 du parcours), afin de ne pas perturber la lecture HTML5 seule à l’étape 1. Pas de `new AudioContext` dans le HTML.

---

## Intégration dans une autre application audio

Objectif : réutiliser **un seul** composant (EQ, visualiseur, WAM, playlist, contrôles) dans une page ou une application hôte disposant déjà d’un `AudioContext` et d’un graphe Web Audio.

### Règles générales

1. **Un seul `AudioContext`** pour tout le graphe. Récupérer celui de l’hôte (`app.audioContext`, etc.) et le transmettre aux composants qui exposent `setAudioContext(ctx)` (**EQ**, **WAM**). Il convient d’éviter un second contexte sans justification explicite (absence de liaison automatique entre graphes distincts).

2. **Geste utilisateur** : si le contexte hôte est `suspended`, appeler `await ctx.resume()` après une interaction (même contrainte autoplay que le lecteur intégré).

3. **Chargement du composant** : une balise `<script type="module" src=".../myequalizer.js">` (ou URL du déploiement), puis le tag HTML correspondant (`<my-equalizer id="eq">`).

### `<my-equalizer>` — point d’attention (**nœud pont**)

`setInput(node)` reconstruit le graphe EQ et appelle `sourceNode.disconnect()` sur le nœud passé. En Web Audio, **`disconnect()` sans argument enlève toutes les sorties** de ce nœud. Si l’on passe directement un `MediaElementAudioSourceNode`, un oscillateur ou un nœud alimentant **également** une autre branche, cette branche est **coupée**.

**Patron recommandé** : insérer un **`GainNode` dédié** (ou tout nœud dont la sortie ne sert **qu’à** l’EQ) :

```js
await host.resumeAudioIfNeeded();
const ctx = host.getAudioContext();

const bridge = ctx.createGain(); // réservé uniquement à l’entrée EQ
host.getLastNodeBeforeDestination().disconnect(host.getDestinationNode());
host.getLastNodeBeforeDestination().connect(bridge);

const eq = document.getElementById('eq');
eq.setAudioContext(ctx);
eq.setInput(bridge);
eq.getOutput().connect(host.getNextStage()); // ex. : compressor, destination, etc.
```

Schéma : `… → bridgeGain → [EQ] → eq.getOutput() → … → destination`.

### `<wam-plugin>`

`setInput` fait uniquement `sourceNode.connect(this._inputNode)` : il est souvent possible de **réutiliser** un nœud qui possède déjà d’autres destinations (**fan-out**). Conserver le **même** `ctx` dans `setAudioContext(ctx)` que pour le reste du graphe.

```js
wam.setAudioContext(ctx);
source.connect(wamInputAlso); // optionnel si branché autre part
wam.setInput(source);
wam.getOutput().connect(nextNode);
```

### `<my-visualizer>`

Il ne crée pas de contexte : il reçoit un **`AnalyserNode`** déjà branché dans la chaîne (ou un analyseur en dérivation avec `gain.value = 0` sur une branche d’écoute, selon le besoin).

```js
const analyser = ctx.createAnalyser();
analyser.fftSize = 2048;
someNodeInYourChain.connect(analyser); // + analyser.connect(...) si le signal doit continuer
viz.setAnalyser(analyser);
viz.start();
```

### `<my-playlist>`

Pas de Web Audio : **`setTracks([...])`** et écoute de `play-track` / `playlist-changed` pour piloter le moteur de lecture (`audio.src`, `AudioBufferSourceNode`, etc.).

```js
playlist.setTracks(tracks);
playlist.addEventListener('play-track', (e) => {
  host.loadAndPlayIndex(e.detail.index);
});
```

### Ordre recommandé (référence `integration-host-app.html`)

| Ordre | Contenu | Rôle |
|------:|---------|------|
| 1 | `<my-playlist>` + `<audio>` | Données et lecture HTML5 possible sans `MediaElementSource`. |
| 2 | `<my-player-controls>` | Montage du composant (ou report au clic étape 3) ; événements `controls-*` reliés au média et à la playlist ; volume sur `audio.volume` tant que le graphe Web Audio n’existe pas. |
| 3 | `createMediaElementSource` + gain maître + panoramique + `destination` | Bouton actif dès qu’il existe des pistes et qu’aucune source n’a été créée ; une source par `<audio>` ; volume / balance pilotent les nœuds Web Audio ; `audio.volume` fixé à 1. |
| 4 | `<my-equalizer>` | Même `ctx` ; entrée via **pont** `GainNode` (voir ci-dessus). |
| 5 | `<wam-plugin>` (optionnel) | Avant l’analyseur dans ce parcours ; refus après insertion de l’analyseur (démo linéaire). |
| 6 | `AnalyserNode` + `<my-visualizer>` | Visualisation ; le VU du bloc contrôles (étape 2) peut refléter le signal via l’analyseur. |

### Exemple de référence

Fichiers **`integration-host-app.html`** et **`integration-demo-host.js`** : parcours interactif reprenant le tableau ci-dessus ; pistes `assets/` préchargées ; ajout de fichiers locaux possible ; journal affichant le résumé du graphe à chaque étape. L’étape 1 (playlist + média) est initialisée au premier chargement ; un **rechargement** complet sert surtout à réinitialiser le graphe après `createMediaElementSource` (contrainte `MediaElementSource` unique par `<audio>`).

Pour la **démo complète** du lecteur tout-en-un (autre ordre de construction interne), voir **`demo-advanced.html`** et **`index.html`**.

---

## Décisions de design

### 1. Composants imbriqués dans le Shadow DOM du parent

**Choix** : Le lecteur audio importe et instancie les sous-composants **dans son propre template HTML** (option 1 du cours).

**Pourquoi** :
- Le parent garde le contrôle total du graphe audio et de l'orchestration
- Les sous-composants restent indépendants et testables isolément (pages `isolated-*.html`)
- Pas de dépendance ascendante : un EQ n'a pas besoin de savoir qu'il est dans un player
- Communication simple : le parent appelle les méthodes publiques directement

### 2. Injection du contexte audio par méthode

**Choix** : `setAudioContext(ctx)` plutôt qu'un attribut ou un événement.

**Pourquoi** :
- Un `AudioContext` est un objet JavaScript complexe, pas sérialisable en attribut HTML
- L'injection par méthode permet au parent de contrôler **quand** le contexte est créé (premier play)
- Un seul `AudioContext` partagé = pas de problème de synchronisation

### 3. Faible couplage via événements pour les notifications

**Choix** : Les sous-composants émettent des `CustomEvent` pour notifier le parent (ex: `play-track`, `eq-change`), mais n'appellent jamais de méthodes du parent.

**Pourquoi** :
- Respect du principe de faible dépendance
- Un sous-composant peut fonctionner seul sans parent (pages `isolated-*.html`)
- Le parent s'abonne aux événements qu'il choisit

### 4. WAM comme composant séparé

**Choix** : Le support WAM est un composant `<wam-plugin>` distinct, pas intégré dans l'EQ ou le player.

**Pourquoi** :
- Séparation des responsabilités : l'EQ fait l'égalisation, le WAM charge des effets tiers
- Un composant WAM peut être utilisé sans le reste du player
- On peut ajouter plusieurs instances de WAM si nécessaire
- Le routing dry/wet est encapsulé dans le composant

### 5. Pas de framework

**Choix** : Vanilla JavaScript, pas de React/Angular/Vue.

**Pourquoi** :
- Conformité avec l'objectif pédagogique du cours (APIs standards W3C)
- Zéro dépendance = composants chargeables par simple URI
- Compréhension directe du cycle de vie des Custom Elements
