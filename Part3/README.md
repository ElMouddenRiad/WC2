# Part 3 — Lecteur Audio en Web Components

> Projet réalisé dans le cadre du cours **M2 NUMRES — Web Components 2025/2026** (Michel Buffa).

## Contexte du cours

Le cours étudie les **APIs standards Web Components** (Custom Elements, Shadow DOM, ES Modules) présentes nativement dans le navigateur, sans framework. L'objectif est de concevoir un lecteur audio avancé décomposé en composants réutilisables, intégrant la **Web Audio API** pour le traitement audio (égaliseur, balance, visualisations).

### Séances couvertes

| Séance | Objectif |
|--------|----------|
| 1-2 | Creation d'un premier Web Component `<my-audio-player>` utilisant la librairie webaudiocontrols et des assets audio |
| 3 | Introduction Web Audio API : ajout balance, egaliseur graphique, visualiseur frequence / waveform / volume |
| 4 | Barre de progression custom, partie bufferisee, duree / temps courant, composant playlist (click to play, auto-next, loop, shuffle, drag & drop, suppression), communication inter-composants |

## Fonctionnalites implementees

### Lecteur audio (`<my-audio-player>`)
- Lecture / pause / previous / next
- Barre de progression custom cliquable + visualisation de la zone bufferisee
- Affichage duree totale et temps courant (evenements `loadedmetadata`, `timeupdate`, `progress` de `<audio>`)
- Reglage volume (slider + knob webaudiocontrols)
- Reglage balance (StereoPannerNode)
- VU-metre RMS temps reel
- Modes de lecture : boucle (off / all / one), shuffle (Fisher-Yates)
- Ajout de pistes par URL ou fichiers locaux
- Integration MediaSession API (controles OS)
- Navigation clavier globale (Space = play/pause, fleches = prev/next)

### Playlist (`<my-playlist>`)
- Affichage de la liste des morceaux avec duree
- Clic sur un morceau = lecture immediate
- Passage automatique au morceau suivant a la fin
- Suppression d'un morceau (bouton X ou touche Delete)
- Reorganisation par drag & drop
- Navigation clavier (Enter/Space = play, Delete = supprimer)

### Egaliseur (`<my-equalizer>`)
- 10 bandes (31 Hz a 16 kHz) avec BiquadFilterNodes (type peaking)
- Sliders verticaux (webaudio-slider de webaudiocontrols)
- Presets : Flat, Bass Boost, Vocal, Phone
- Bypass : desactive temporairement l'EQ sans perdre les reglages
- Mode compact via attribut `compact`

### Visualiseur (`<my-visualizer>`)
- Mode Spectrum (barres frequentielles via `getByteFrequencyData`)
- Mode Waveform (courbe temporelle via `getByteTimeDomainData`)
- Rendu canvas avec controle de framerate
- Mode compact via attribut `compact`

### Effets WAM (`<wam-plugin>`)
- Chargement d'effets audio au format WAM2 (Web Audio Modules) par URL
- Dry/wet routing pour bypass transparent
- Affichage de la GUI native du plugin
- Compatible avec la WAM Gallery (https://www.webaudiomodules.com/docs/community)
- Testable isolement via `isolated-wam.html`

## Architecture

```
Part3/
+-- index.html                  # Page principale (layout="fixed")
+-- demo-advanced.html          # Demonstration complete
+-- isolated-eq.html            # Test isole de l'egaliseur
+-- isolated-playlist.html      # Test isole de la playlist
+-- isolated-visualizer.html    # Test isole du visualiseur
+-- components/
|   +-- audioplayer.js          # <my-audio-player> -- orchestration
|   +-- myequalizer.js          # <my-equalizer>    -- traitement EQ
|   +-- myvisualizer.js         # <my-visualizer>   -- rendu canvas
|   +-- playlist.js             # <my-playlist>     -- gestion playlist
|   +-- wamplugin.js            # <wam-plugin>      -- effets WAM
|   +-- libs/webaudiocontrols.js
+-- css/
|   +-- theme-futuristic.css    # Variables + typo (theme spatial / neon)
|   +-- player.css              # Styles du lecteur principal
|   +-- equalizer.css           # Styles de l'egaliseur
|   +-- visualizer.css          # Styles du visualiseur
|   +-- playlist.css            # Styles de la playlist
+-- assets/                     # Fichiers audio (mp3)
```

### Graphe audio (Web Audio API)

```
<audio> -> [EQ 10 bandes] -> [WAM Plugin] -> GainNode -> StereoPannerNode -> AnalyserNode -> destination
```

Le graphe est cree au premier clic utilisateur (respect de l'autoplay policy du navigateur).

### Communication inter-composants

Le composant parent `<my-audio-player>` importe et instancie les sous-composants dans son Shadow DOM, puis communique avec eux via :

| Mecanisme | Utilisation |
|-----------|-------------|
| **Methodes directes** | `eq.setAudioContext(ctx)`, `eq.setInput(src)`, `viz.setAnalyser(node)`, `playlist.setTracks(list)` |
| **CustomEvents** | `play-track` (playlist -> player), `playlist-changed` (playlist -> player), `eq-change` / `eq-preset` (eq -> exterieur) |
| **Attributs observes** | `<my-playlist>` reagit aux changements de `tracks` / `data-tracks` via `observedAttributes` + `attributeChangedCallback` |

Cette approche correspond a l'option 1 du cours : le lecteur audio **importe et utilise** les composants dans sa GUI HTML en leur donnant un id.

### Conformite Web Components W3C

| Critere | audioplayer | playlist | equalizer | visualizer | wam-plugin |
|---------|:-----------:|:--------:|:---------:|:----------:|:----------:|
| `class extends HTMLElement` | oui | oui | oui | oui | oui |
| `super()` en premier | oui | oui | oui | oui | oui |
| `attachShadow({mode:'open'})` | oui | oui | oui | oui | oui |
| `customElements.define()` | oui | oui | oui | oui | oui |
| `connectedCallback` | oui | oui | oui | oui | oui |
| `disconnectedCallback` | oui | oui | oui | oui | oui |
| `observedAttributes` | oui | oui | oui | oui | oui |
| `attributeChangedCallback` | oui | oui | oui | oui | oui |
| Pas d'attribut lu dans constructor | oui | oui | oui | oui | oui |
| CSS encapsule (`:host`) | oui | oui | oui | oui | oui |
| Modules ES (`import`/`export`) | oui | oui | oui | oui | oui |
| Accessibilite (ARIA) | oui | oui | oui | oui | oui |

### API publique du lecteur

```js
// Methodes
player.setPlaylist([{src, title}, ...])
player.getPlaylist()
player.setVolume(0.5)
player.setBalance(-0.3)
player.playNext()
player.playPrevious()
player.toggleShuffle()
player.toggleLoop()

// Accesseurs Web Audio
player.getAudioContext()
player.getGainNode()
player.getPannerNode()
player.getAnalyserNode()
```

## Lancement

```bash
cd Part3
npx http-server . -p 8000 -c-1
```

Ouvrir `http://localhost:8000/index.html`.

Les composants peuvent aussi etre testes individuellement via les pages `isolated-*.html`.

**Intégration dans une autre application audio** (même `AudioContext`, branchement progressif) : [SPECIFICATION.md](SPECIFICATION.md), [integration-host-app.html](integration-host-app.html) et le module hôte d’exemple [integration-demo-host.js](integration-demo-host.js) (option B sans `new AudioContext` dans la page).

## Utilisation par URI (sans copier le repo localement)

Les composants sont des **modules ES** ; une autre page HTML peut les charger depuis une base URL publique (GitHub Pages, autre CDN), en conservant la structure des dossiers `components/`, `css/`, `assets/` pour que les chemins `import.meta.url` restent valides.

**Une seule entrée** suffit souvent : le lecteur tire déjà les autres modules (`myequalizer`, `playlist`, etc.) par des imports relatifs.

```html
<script type="module" src="https://VOTRE_HEBERGEUR/.../Part3/components/audioplayer.js"></script>
```

Pour n’utiliser qu’un sous-composant, pointer vers `.../components/myequalizer.js`, `playlist.js`, etc., en conservant le même chemin de base pour que `../css/...` et `./libs/...` continuent de résoudre correctement.

Ensuite utiliser `<my-audio-player>` dans le HTML comme dans `index.html`. Pour n’importer qu’un sous-composant (`myequalizer.js`, `playlist.js`, etc.), charger uniquement ce module depuis la même base URL.

**Note CORS** : l’hégeur doit servir les `.js` avec les bons en-têtes ; les fichiers doivent être sur **le même site** ou le serveur doit autoriser votre origine pour `type="module"`.

## Documentation API

Voir [SPECIFICATION.md](SPECIFICATION.md) pour l'API complete de chaque composant, les decisions de design, et le schema de communication inter-composants.

Post-mortem IA (consigne cours) : [IA_POSTMORTEM.md](IA_POSTMORTEM.md).
