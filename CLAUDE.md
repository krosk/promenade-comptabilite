# Promenade Comptabilité

Browser-based tool for parsing and cross-checking accounting documents from a French copropriété syndic. All logic runs client-side via Pyodide (Python in WebAssembly).

## Architecture

```
PDF bytes → Web Worker → Pyodide (pdfminer.six) → parsed JSON ──┐
Pre-parsed JSON (exported from a prior session) ─────────────────┤→ React UI
Parsed GL + RGD dicts → Pyodide (cross_check.match) → xref JSON ┘
```

- **Python parsers** (`public/parser/`): own all PDF parsing and data logic. Run in a Web Worker via Pyodide.
- **React UI** (`src/`): thin display layer. Renders tables; no business logic. Accepts either Pyodide-produced JSON or a pre-parsed JSON file uploaded directly (bypassing Pyodide for the parse step). Can export parsed data as JSON for re-import on a future session.
- **Bridge** (`src/pyodide/bridge.ts`): manages Web Worker communication. Main thread never runs Python. Cross-check always runs via Pyodide even when both documents were loaded from JSON.

## Canonical vocabulary

- **Grand Livre**: general ledger. 150-page PDF with every accounting entry.
- **RGD** (Relevé Général des Dépenses): expense summary by distribution key (clé de répartition).
- **Clé de répartition**: cost allocation key (e.g., CHARGES GENERALES, BATIMENT A, ASCENSEUR BAT.B).
- **Tantièmes**: ownership share fractions.
- **Compte**: account number (8 digits, e.g., 60100000).
- **Écriture**: individual accounting entry.
- **Cross-reference**: a confirmed 1:1 correspondence between one RGD entry and one GL entry (same compte, same date, same montant_ttc ≈ debit).

## Python module contracts

All modules live in `public/parser/` and run via Pyodide in the Web Worker.

**Parsers** accept `pdf_bytes: bytes` and return a `dict` serialized as JSON:
- `grand_livre.parse()` → `{ periode, accounts[], total_debit, total_credit }`
- `rgd.parse()` → `{ periode, cles[], total_depenses }`

Parsers use position-based text extraction: pdfminer gives text spans with (x, y) coordinates, which are assigned to columns by x-position ranges and grouped into rows by y-proximity. Column boundaries are hardcoded constants tuned to the syndic's PDF layout (Sabimmo/HOMELAND).

**Cross-checker** accepts two already-parsed dicts (not raw PDF bytes):
- `cross_check.match(gl: dict, rgd: dict)` → `{ rgd_to_gl, gl_to_rgd }`
  - Resolves only 1:1 matches: each side must have exactly one counterpart.
  - Match criteria: same `compte` (`acct.numero`), same `date` (exact string), `|montant_ttc − gl_entry.debit| < 0.005`.
  - `gl_entry.credit` is not matched against — reversals are intentionally out of scope.
  - Key format — rgd side: `"{cle_index}:{acct_numero}:{entry_index}"`, gl side: `"{acct_numero}:{entry_index}"`.

## Testing

```bash
python -m pytest tests/ -v    # 46 tests, validates against actual PDFs
npm run build                 # TypeScript type check + Vite build
```

Tests validate: entry counts match stated totals, débit=crédit balance, sous-total sums, required fields present. Cross-check tests include unit tests with synthetic data (always run) and integration tests against real PDFs (skipped if unavailable).

## Git

For all git commits, use `--author="Alexis He <alexis.yuhe@gmail.com>"`.

## Environment

- Node.js managed via fnm: `eval "$(fnm env)" && fnm use v22.22.2`
- Python 3.13 at `C:\Users\ahe\AppData\Local\Programs\Python\Python313\python.exe`

## Deployment

GitHub Pages via GitHub Actions. Repo name: `promenade-comptabilite`. Base path: `/promenade-comptabilite/`.

## Future scope (not yet implemented)

- Multi-match cross-reference: one GL entry split across multiple RGD entries (one payment → multiple distribution keys)
- Invoice (annexes) parsing
- CSV + Excel export via openpyxl
- Per-owner account statements
