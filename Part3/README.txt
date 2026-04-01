Projet Web Components 2025/2026 — Lecteur audio (Part3)
=========================================================

Documentation principale (Markdown) : README.md
API des composants (tags, attributs, methodes, proprietes, evenements) : SPECIFICATION.md
Post-mortem outils IA (a completer / tenir a jour) : IA_POSTMORTEM.md

Consignes depot (Michel Buffa) :
- README.txt present (ce fichier)
- Fichiers .md pour l'IA : IA_POSTMORTEM.md + eventuellement exports de regles Cursor dans .cursor/rules/ si utilises

Lancement local :
  cd Part3
  npx http-server . -p 8000 -c-1
  Ouvrir http://localhost:8000/index.html

Intégration progressive (contexte page vs module hôte) : integration-host-app.html + integration-demo-host.js

Hébergement distant :
- Servir ce dossier (ou la racine GitHub Pages) avec les chemins relatifs intacts pour que import.meta.url des composants resolve correctement les CSS.

Fin du fichier README.txt
