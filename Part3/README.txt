Projet Web Components 2025/2026 — Lecteur audio (Part3)
=========================================================

Documentation principale (Markdown) : README.md
API des composants (tags, attributs, methodes, proprietes, evenements) : SPECIFICATION.md
Conformite sujet + decisions de design : SPECIFICATION.md (sections dediees)
Post-mortem outils IA (rempli, version professionnelle) : IA_POSTMORTEM.md

webaudio-controls (GUI) :
  Fichier : components/libs/webaudiocontrols.js
  Chargement : import dans le composant qui utilise webaudio-knob / webaudio-slider (playercontrols.js, myequalizer.js).
  Ne pas inclure ce script dans index.html — seulement via module ES.
  Doc attributs / evenements des balises webaudio-* : https://g200kg.github.io/webaudio-controls/docs/detailspecs.html

Lancement local :
  cd Part3
  npx http-server . -p 8000 -c-1
  Ouvrir http://localhost:8000/index.html

Parcours d'integration (etapes ordonnees, texte detaille sur la page) :
  integration-host-app.html + integration-demo-host.js
  Etape 3 : bouton actif des qu'il y a des pistes sans MediaElementSource ; montage de my-player-controls
  a l'etape 2 ou au premier clic etape 3 si etape 2 non utilisee.

Pages isolees par composant : isolated-playlist.html, isolated-eq.html, isolated-visualizer.html,
  isolated-wam.html (Load dans le shadow du wam-plugin apres Demarrer l'audio),
  isolated-controls.html (my-player-controls via import module ; hote branche volume sur audio, pas de StereoPanner).

Hébergement distant :
  Servir ce dossier avec les chemins relatifs intacts pour que import.meta.url des composants resolve correctement les CSS.

Fin du fichier README.txt
