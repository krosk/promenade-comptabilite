# ADR 002 — Position-based column parsing over find_tables()

## Context

The Grand Livre and RGD PDFs are tabular documents. PyMuPDF offers `find_tables()` for automatic table detection. We needed to decide how to reconstruct column structure from raw PDF text.

## Decision

Use **position-based parsing**: assign text spans to columns based on their x-coordinate ranges, and group spans into rows based on y-coordinate proximity.

## Reasoning

`find_tables()` was evaluated on the actual PDFs. It merged all left-side columns (Journal, Date, Contre-partie, Libellé, N° Pièce) into a single cell, making individual field extraction unreliable. The PDFs are positioned text, not HTML tables — the column structure is implicit in the x-coordinates of each span.

The position-based approach works because the syndic software (Sabimmo/HOMELAND) places every span at consistent x-positions across all pages and all document years. Column boundaries are stable constants, not heuristics.

Row grouping uses **y-range overlap**: each span carries its bottom (`y`) and top (`y1`) edges from pdfminer's bbox. A span joins the current row if its top edge (`y1`) reaches or overlaps the row's accumulated bottom edge. The row's y-range expands as spans are added, so multi-line libellés and amounts centred between text lines are captured in one row. The original chaining approach (comparing to the previous span's y within a 4 pt tolerance) was replaced because it caused cascading merges on tight rows: spans A→B→C could all be within 4 pt of their neighbours while A and C were 6 pt apart.

## Consequences

- Column boundary constants in `grand_livre.py` and `rgd.py` are tuned to this syndic's PDF layout. A different syndic's software would require different constants.
- The y-range overlap algorithm handles multi-line entries without a tunable tolerance. The only parameter is a 1 pt rounding gap to absorb floating-point differences between touching edges.
- This approach was validated against 150 pages / 6,887 entries: all stated entry counts match parsed counts, and total débit = total crédit = 1,204,787.71.
