# Promenade Comptabilité

Browser-based tool for parsing and cross-checking accounting documents from a French copropriété syndic. All logic runs client-side via Pyodide (Python in WebAssembly).

## Architecture

```
PDF bytes → Web Worker → Pyodide (pdfminer.six) → JSON → React UI
```

- **Python parsers** (`public/parser/`): own all PDF parsing and data logic. Run in a Web Worker via Pyodide.
- **React UI** (`src/`): thin display layer. Receives JSON from Python, renders tables. No business logic.
- **Bridge** (`src/pyodide/bridge.ts`): manages Web Worker communication. Main thread never runs Python.

## Canonical vocabulary

- **Grand Livre**: general ledger. 150-page PDF with every accounting entry.
- **RGD** (Relevé Général des Dépenses): expense summary by distribution key (clé de répartition).
- **Clé de répartition**: cost allocation key (e.g., CHARGES GENERALES, BATIMENT A, ASCENSEUR BAT.B).
- **Tantièmes**: ownership share fractions.
- **Compte**: account number (8 digits, e.g., 60100000).
- **Écriture**: individual accounting entry.

## Parser contract

Both parsers accept `pdf_bytes: bytes` and return a `dict` serialized as JSON.

- `grand_livre.parse()` → `{ periode, accounts[], total_debit, total_credit }`
- `rgd.parse()` → `{ periode, cles[], total_depenses }`

Parsers use position-based text extraction: pdfminer gives text spans with (x, y) coordinates, which are assigned to columns by x-position ranges and grouped into rows by y-proximity.

Column boundaries are hardcoded constants tuned to the syndic's PDF layout (Sabimmo/HOMELAND).

## Testing

```bash
python -m pytest tests/ -v    # 34 tests, validates against actual PDFs
npm run build                 # TypeScript type check + Vite build
```

Tests validate: entry counts match stated totals, débit=crédit balance, sous-total sums, required fields present.

## Git

For all git commits, use `--author="Alexis He <alexis.yuhe@gmail.com>"`.

## Environment

- Node.js managed via fnm: `eval "$(fnm env)" && fnm use v22.22.2`
- Python 3.13 at `C:\Users\ahe\AppData\Local\Programs\Python\Python313\python.exe`

## Deployment

GitHub Pages via GitHub Actions. Repo name: `promenade-comptabilite`. Base path: `/promenade-comptabilite/`.

## Future scope (not yet implemented)

- Cross-checking Grand Livre vs RGD by account number
- Invoice (annexes) parsing
- CSV + Excel export via openpyxl
- Per-owner account statements
