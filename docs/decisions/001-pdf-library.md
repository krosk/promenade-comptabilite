# ADR 001 — pdfminer.six over PyMuPDF

## Context

PDF parsing needs to run entirely in the browser (no server, GitHub Pages deployment). Pyodide runs Python via WebAssembly. We evaluated two libraries: PyMuPDF and pdfminer.six.

## Decision

Use **pdfminer.six**.

## Reasoning

PyMuPDF wraps MuPDF, a C library. It requires compiled shared libraries that must be cross-compiled to WebAssembly. The Pyodide team marks this build as experimental, there is no pre-hosted wheel, `micropip.install()` does not work, and building a custom wheel requires a full Pyodide build environment. The constraint is architectural, not a version issue.

pdfminer.six is pure Python. It installs via `micropip.install("pdfminer.six")` in Pyodide with no special handling. It provides `LTTextLine` objects with bounding box coordinates — the same positional data we need.

The tradeoff is speed: pdfminer is slower than PyMuPDF (pure Python vs C). For a 150-page PDF parsed once per session, this is acceptable.

## Consequences

- If PyMuPDF ever ships a stable, hosted Pyodide wheel, it could replace pdfminer.six with no parser logic changes — the extraction API in `utils.py` is the only callsite.
- The PyMuPDF `find_tables()` feature is unavailable. See ADR 002 for how we handle table structure instead.
