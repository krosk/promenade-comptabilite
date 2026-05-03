# Promenade Comptabilité

Outil de vérification des comptes d'une copropriété française. Fonctionne entièrement dans le navigateur — aucune donnée n'est envoyée à un serveur.

## Fonctionnalités

- **Grand Livre** : import et affichage du grand livre comptable (PDF)
- **RGD** : import et affichage du relevé général des dépenses (PDF)
- **Recoupement automatique** : correspondances 1:1 entre écritures RGD et Grand Livre — badge cliquable pour naviguer de l'une à l'autre
- Validation automatique des totaux et sous-totaux

## Utilisation

1. Ouvrir l'application dans un navigateur
2. Attendre le chargement de l'environnement Python (~15s au premier chargement)
3. Glisser-déposer un PDF (Grand Livre ou RGD) dans la zone prévue
4. Explorer les comptes, écritures et dépenses ; cliquer les badges « GL ↗ » / « RGD ↗ » pour naviguer entre les deux documents

## Développement

```bash
# Prérequis
# Node.js 22+ (via fnm), Python 3.13+

# Installation
npm install
pip install -r requirements.txt

# Développement
npm run dev

# Tests Python (parseurs)
python -m pytest tests/ -v

# Build production
npm run build
```

## Architecture

L'analyse des PDF se fait côté client via [Pyodide](https://pyodide.org/) (Python compilé en WebAssembly). La bibliothèque [pdfminer.six](https://github.com/pdfminer/pdfminer.six) extrait le texte avec ses coordonnées, puis un parseur Python reconstruit les lignes et colonnes.

Le traitement s'exécute dans un Web Worker pour ne pas bloquer l'interface.

## Déploiement

Déploiement automatique sur GitHub Pages via GitHub Actions à chaque push sur `main`.
