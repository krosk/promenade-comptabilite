# ADR 002 — Position-based column parsing over find_tables()

## Context

The Grand Livre and RGD PDFs are tabular documents. PyMuPDF offers `find_tables()` for automatic table detection. We needed to decide how to reconstruct column structure from raw PDF text.

## Decision

Use **position-based parsing**: assign text spans to columns based on their x-coordinate ranges, and group spans into rows based on y-coordinate proximity.

## Reasoning

`find_tables()` was evaluated on the actual PDFs. It merged all left-side columns (Journal, Date, Contre-partie, Libellé, N° Pièce) into a single cell, making individual field extraction unreliable. The PDFs are positioned text, not HTML tables — the column structure is implicit in the x-coordinates of each span.

The position-based approach works because the syndic software (Sabimmo/HOMELAND) places every span at consistent x-positions across all pages and all document years. Column boundaries are stable constants, not heuristics.

Row grouping uses a chaining tolerance of 4.0pt: a span joins the current row if it is within 4pt of the previous span's y-position. Chaining (updating the reference y on each accepted span) is required because multi-line libellés cause amounts to be vertically centred between the two text lines, placing them ~4pt from each line rather than within 4pt of the first line.

## Consequences

- Column boundary constants in `grand_livre.py` and `rgd.py` are tuned to this syndic's PDF layout. A different syndic's software would require different constants.
- The y-tolerance of 4.0pt handles the vertical centring of amounts in multi-line entries. Tightening it breaks those entries; loosening it risks merging separate rows.
- This approach was validated against 150 pages / 6,887 entries: all stated entry counts match parsed counts, and total débit = total crédit = 1,204,787.71.
