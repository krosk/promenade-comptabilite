# Promenade Comptabilité

Browser-based tool for parsing and cross-checking accounting documents from a French copropriété syndic. All logic runs client-side via Pyodide (Python in WebAssembly).

## Architecture

```
PDF bytes → Web Worker → Pyodide (pdfminer.six) → parsed JSON ──────────┐
Pre-parsed JSON (exported from a prior session) ─────────────────────────┤→ React UI
Parsed GL + RGD dicts → Pyodide (cross_check.match) → xref JSON ─────────┤
Factures PDF → Web Worker → Pyodide (pdfminer.six) → factures JSON ──────┤
Factures JSON + RGD dict → Pyodide (factures.match) → page map JSON ─────┘
```

- **Python parsers** (`public/parser/`): own all PDF parsing and data logic. Run in a Web Worker via Pyodide.
- **React UI** (`src/`): thin display layer. Renders tables; no business logic. GL and RGD can be loaded from a pre-parsed JSON file (bypassing Pyodide) and exported as JSON for re-import on a future session. Factures have no JSON import/export — only PDF upload is supported.
- **Bridge** (`src/pyodide/bridge.ts`): manages Web Worker communication. Main thread never runs Python. All matching operations (cross-check, factures) always run via Pyodide even when source documents were pre-loaded from JSON.

## Canonical vocabulary

- **Grand Livre**: general ledger. 150-page PDF with every accounting entry.
- **RGD** (Relevé Général des Dépenses): expense summary by distribution key (clé de répartition).
- **Clé de répartition**: cost allocation key (e.g., CHARGES GENERALES, BATIMENT A, ASCENSEUR BAT.B).
- **Tantièmes**: ownership share fractions.
- **Compte**: account number (8 digits, e.g., 60100000).
- **Écriture**: individual accounting entry.
- **Cross-reference**: a confirmed 1:1 correspondence between one RGD entry and one GL entry (same compte, same date, same montant_ttc ≈ debit).
- **Factures**: combined invoice PDF. First pages are a summary table (clé → compte → entries with date, description, PDF page number); remaining pages are individual invoice scans. `factures.parse()` extracts only the summary table.

## Python module contracts

All modules live in `public/parser/` and run via Pyodide in the Web Worker.

**Parsers** accept `pdf_bytes: bytes` and return a `dict` serialized as JSON:
- `grand_livre.parse()` → `{ periode, accounts[], total_debit, total_credit }`
- `rgd.parse()` → `{ periode, cles[], total_depenses }`

Parsers use position-based text extraction: pdfminer gives text spans with (x, y, y1) coordinates, which are assigned to columns by x-position ranges and grouped into rows by vertical range overlap (spans whose y-extents touch or overlap belong to the same row). Column boundaries are hardcoded constants tuned to the syndic's PDF layout (Sabimmo/HOMELAND).

**Factures parser + matcher** — `factures.py` exposes two functions:
- `factures.parse(pdf_bytes)` → `{ entries[] }` where each entry: `{ cle, compte, date, description, page }`.
  - Parses only summary-table pages (detected by "Page" column header at x≈536); invoice pages are skipped.
  - `page` is the PDF page number of the invoice; `None` if no invoice is linked (e.g., extourne entries).
  - `date` format: `DD/MM/YYYY` (same as GL and RGD).
- `factures.match(rgd, factures)` → `{ rgd_to_page }` — maps RGD entry keys to PDF page numbers (int).
  - Match strategy: `(compte, date, position-within-group)` — same N×N pairing as `cross_check` Pass 3.
  - Mismatched group sizes (M RGD ≠ N facture entries for same compte+date): all RGD entries get the first available page.
  - Key format: `"{cle_index}:{compte}:{entry_index}"` → page number.
  - Entries with `page=None` are excluded from the output.

**Cross-checker** accepts two already-parsed dicts (not raw PDF bytes):
- `cross_check.match(gl: dict, rgd: dict)` → `{ rgd_to_gl, gl_to_rgd }`
  - Resolves 1:1 pairs; also resolves balanced N×N groups (legitimate duplicate entries on the same date/amount).
  - Match criteria: same `compte` (`acct.numero`), same `date` (exact string), amount sign-sensitive: positive `montant_ttc` matched against `gl_entry.debit`, negative `montant_ttc` matched against `gl_entry.credit` (reimbursements). Tolerance: 0.005 €.
  - Pass 4: propagates each RGD link to the matched GL entry's `contre_partie` counterpart (if not already matched), so both sides of a double-entry appear linked in the UI.
  - Key format — rgd side: `"{cle_index}:{acct_numero}:{entry_index}"`, gl side: `"{acct_numero}:{entry_index}"`.

## Testing

```bash
python -m pytest tests/ -v    # 67 tests, validates against actual PDFs
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
- CSV + Excel export via openpyxl
- Per-owner account statements
