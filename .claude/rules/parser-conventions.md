---
description: Contracts and invariants for Python parsers and matchers in public/parser/
paths:
  - public/parser/*.py
  - tests/test_*.py
---

# Parser and matcher conventions

Rules that apply whenever touching `public/parser/*.py` or their tests.

## Parser functions

- Signature: `parse(pdf_bytes: bytes) -> dict`. No other public parse entry point.
- Never accept pre-parsed dicts as parser input — that is a matcher's responsibility.
- Return plain Python dicts only. No dataclasses, no custom objects, no classes.
- Call pdfminer only through `utils.py` helpers: `extract_pages_from_pdf`, `extract_spans_from_page`, `group_spans_by_row`. Never import pdfminer layout types directly in a parser module.
- Date values in output: `DD/MM/YYYY` string (raw from PDF). Do not call `parse_french_date`; that function converts to ISO format and is not used for stored dates.
- Amount values in output: call `parse_french_number` from `utils`. Never parse number strings inline.
- Column x-boundaries are hardcoded constants tuned to the Sabimmo/HOMELAND PDF layout. Put them at module scope with a descriptive name. Do not compute them at runtime.

## Matcher functions

- Signature: `match(a: dict, b: dict) -> dict`. Both inputs are already-parsed dicts, never raw PDF bytes.
- Return plain Python dicts with snake_case keys.
- N×N group pairing: when multiple entries share the same key fields, pair by sorted key order (deterministic, arbitrary but consistent). Unbalanced groups (M ≠ N) fall back to linking all entries to the first available counterpart.

## Key format conventions

- RGD entry key: `"{cle_index}:{acct_numero}:{entry_index}"` — always this order, always these names.
- GL entry key: `"{acct_numero}:{entry_index}"`.
- Factures-to-RGD key: same format as RGD entry key → page number (int).
- Never abbreviate or reorder key components.

## Tests

- Unit tests use synthetic dicts and must always run — no PDF path checks, no `skipif`.
- Integration tests against real PDFs use `pytest.mark.skipif(not os.path.exists(PDF_PATH), reason="...")`.
- One test file per parser module: `tests/test_<module_name>.py`.
- Integration test fixtures are class-scoped (`scope="class"`) to parse the PDF once per test class.
