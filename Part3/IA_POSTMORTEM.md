# Post-mortem — outils d’IA utilisés (Web Components 2025/2026)

Document à remplir pour le rendu cours. Réponses factuelles : outil, version si pertinent, fichiers de règles, prompts types, limites rencontrées.

---

## 1. Outils

| Outil | Usage |
|-------|--------|
| *(ex. Cursor + modèle …)* | Génération / refactor de composants, spec, relecture |
| *(autre)* | |

## 2. Fichiers de règles / contraintes créés ou réutilisés

- *(ex. `.cursor/rules/…`, consignes copiées dans le chat, SPECIFICATION comme contrainte)*
- Règle importante retenue du feedback enseignant : **`webaudiocontrols.js` chargé uniquement via `import` dans les composants qui en ont besoin** (`components/libs/webaudiocontrols.js`), **pas** via `<script>` dans `index.html`.

## 3. Prompts types (schémas)

> *Coller ou résumer 3–5 prompts représentatifs (sans données personnelles).*

1. *(ex. « Implémente `<my-playlist>` avec drag-and-drop, extends HTMLElement, Shadow DOM, observedAttributes pour `tracks` »)*
2. *(…)*
3. *(…)*

## 4. Ce que l’IA a bien fait

- *(…)*
- *(…)*

## 5. Ce que l’IA a mal fait / pièges

- *(ex. oubli de `composed: true` sur les CustomEvent dans un arbre Shadow — corrigé dans le dépôt pour exposer l’API à la page hôte.)*
- *(…)*

## 6. Validation humaine

- *(Tests navigateur, lecture SPECIFICATION vs code, http-server, WAM en ligne, etc.)*

---

*Dernière mise à jour : à compléter avant rendu (3 avril).*
