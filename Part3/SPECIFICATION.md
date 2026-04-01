# SPECIFICATION.md — API Documentation

Documentation complète de l'API de chaque Web Component du projet lecteur audio.

---

## Table des matières

1. [`<my-audio-player>`](#my-audio-player)
2. [`<my-equalizer>`](#my-equalizer)
3. [`<my-visualizer>`](#my-visualizer)
4. [`<my-playlist>`](#my-playlist)
5. [`<wam-plugin>`](#wam-plugin)
6. [Communication inter-composants](#communication-inter-composants)
7. [Graphe audio](#graphe-audio)
8. [Intégration dans une autre application audio](#intégration-dans-une-autre-application-audio)
9. [Décisions de design](#décisions-de-design)

---

## `<my-audio-player>`

**Tag** : `<my-audio-player>`  
**Fichier** : `components/audioplayer.js`  
**CSS** : `css/player.css`  
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

### Propriétés (accès programmatique)

Les états utiles depuis l’extérieur passent surtout par les **méthodes** ci-dessus. Les champs internes (`audioContext`, `currentIndex`, etc.) existent sur l’instance mais ne font pas partie d’une API officielle « propriété JS » documentée — préférer `getAudioContext()`, etc.

### Événements écoutés (comportement interne)

| Source | Événement | Rôle |
|--------|-----------|------|
| `<audio id="myplayer">` | `loadedmetadata`, `timeupdate`, `progress`, `play`, `pause`, `ended`, `error` | Barre de progression, durées, transport, enchaînement des pistes |
| `<my-playlist>` | `play-track`, `playlist-changed` | Synchronisation lecture / liste (ces événements sont aussi `composed`, voir ci-dessous) |
| Contrôles UI | `input` / `click` | Volume, balance, transport, ajout de pistes |
| `window` | `keydown` | Raccourcis clavier globaux |

Le lecteur **n’émet pas** aujourd’hui de `CustomEvent` propre vers le document ; pour réagir aux changements de piste ou d’EQ depuis la page hôte, écouter les événements **composés** remontés par les sous-composants (`play-track`, `eq-change`, etc.) sur `document` ou sur `<my-audio-player>`.

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

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `eq-change` | `{index, gain}` | oui | oui | Un slider de bande est modifié |
| `eq-preset` | `{preset}` | oui | oui | Un preset est sélectionné dans le menu |
| `eq-preset-applied` | `{name}` | oui | oui | Un preset est appliqué programmatiquement |
| `eq-bypass` | `{bypassed}` | oui | oui | Le bypass est activé/désactivé |

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

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `play-track` | `{index}` | oui | oui | Clic sur une piste ou appel à `play()` |
| `playlist-changed` | `{action, index, track?, from?, to?}` | oui | oui | Ajout, suppression, ou réordonnancement |

### Cycle de vie W3C

- `constructor()` : `attachShadow`, initialisation (aucun rendu)
- `connectedCallback()` : Premier rendu (avec garde `_rendered`)
- `disconnectedCallback()` : Libération des blob URLs (`URL.revokeObjectURL`)
- `attributeChangedCallback` : Parse et applique le JSON si `tracks` / `data-tracks` change
- `observedAttributes` : `['tracks', 'data-tracks']`

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

### Événements émis

| Événement | `detail` | `bubbles` | `composed` | Quand |
|-----------|----------|-----------|------------|-------|
| `wam-loaded` | `{url, name}` | oui | oui | Plugin chargé avec succès |
| `wam-error` | `{url, error}` | oui | oui | Erreur lors du chargement |
| `wam-bypass` | `{bypassed}` | oui | oui | Bypass activé/désactivé |

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

```
<audio> ──► EQ (10 BiquadFilters) ──► [WAM Plugin] ──► GainNode ──► StereoPannerNode ──► AnalyserNode ──► destination
                                       (optionnel)       (volume)      (balance)          (visualizer)
```

Le graphe est créé **au premier clic play** pour respecter l'autoplay policy du navigateur (l'`AudioContext` ne peut être créé que suite à un geste utilisateur).

Si le WAM plugin n'est pas chargé, la sortie de l'EQ est directement connectée au GainNode. Quand un plugin est chargé, il s'insère entre les deux via les nœuds input/output du composant `<wam-plugin>`.

---

## Intégration dans une autre application audio

Objectif : réutiliser **un seul** composant (EQ, visualiseur, WAM, playlist) dans **votre** page ou **votre** appli qui possède déjà un `AudioContext` et un graphe Web Audio.

### Règles générales

1. **Un seul `AudioContext`** pour tout le graphe. Récupérez celui de l’hôte (`votreApp.audioContext`, etc.) et passez-le aux composants qui exposent `setAudioContext(ctx)` (**EQ**, **WAM**). Ne créez pas un second contexte sauf si vous savez ce que vous faites (pas de lien entre les graphes).

2. **Geste utilisateur** : si le contexte hôte est `suspended`, appelez `await ctx.resume()` après une interaction (même contrainte autoplay que le lecteur intégré).

3. **Chargement du composant** : une balise `<script type="module" src=".../myequalizer.js">` (ou URL du déploiement), puis le tag HTML correspondant (`<my-equalizer id="eq">`).

### `<my-equalizer>` — point d’attention (**nœud pont**)

`setInput(node)` reconstruit le graphe EQ et appelle `sourceNode.disconnect()` sur le nœud passé. En Web Audio, **`disconnect()` sans argument enlève toutes les sorties** de ce nœud. Si vous passez directement votre `MediaElementAudioSourceNode`, un oscillateur ou un nœud qui envoie **aussi** vers une autre branche, cette branche est **coupée**.

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

`setInput` fait uniquement `sourceNode.connect(this._inputNode)` : vous pouvez souvent **réutiliser** un nœud qui a déjà d’autres destinations (**fan-out**). Utilisez toujours le **même** `ctx` dans `setAudioContext(ctx)` que le reste du graphe.

```js
wam.setAudioContext(ctx);
source.connect(wamInputAlso); // optionnel si branché autre part
wam.setInput(source);
wam.getOutput().connect(nextNode);
```

### `<my-visualizer>`

Il ne crée pas de contexte : vous lui donnez un **`AnalyserNode`** déjà branché dans votre chaîne (ou un analyseur en dérivation avec `gain.value = 0` sur une branche écoute, selon votre besoin).

```js
const analyser = ctx.createAnalyser();
analyser.fftSize = 2048;
someNodeInYourChain.connect(analyser); // + analyser.connect(...) si le signal doit continuer
viz.setAnalyser(analyser);
viz.start();
```

### `<my-playlist>`

Pas de Web Audio : **`setTracks([...])`** et écoute de `play-track` / `playlist-changed` pour piloter **votre** moteur (`audio.src`, `AudioBufferSourceNode`, etc.).

```js
playlist.setTracks(tracks);
playlist.addEventListener('play-track', (e) => {
  host.loadAndPlayIndex(e.detail.index);
});
```

### Exemple de référence

Voir **`integration-host-app.html`** et **`integration-demo-host.js`** : tutoriel **étape par étape** depuis zéro. L’option A contient un `new AudioContext` dans la page ; l’option B **n’en contient pas** (création dans le module hôte importé). Pistes audio : fichiers locaux (et option `./assets/Kalimba.mp3` via bouton). Chaîne : média natif → `MediaElementSource` → EQ (pont) → WAM → un seul `<my-visualizer>` (spectrum ou waveform via son UI). Recharger la page remet tout à plat (une seule `MediaElementSource` par `<audio>`).

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
