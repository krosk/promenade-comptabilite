"""
Invoice summary parser for the combined factures PDF.

The first several pages contain a summary table grouping invoices by:
  clé de répartition → compte → entries with Date, Description, PDF page number.

parse(pdf_bytes) → {
  "entries": [
    {
      "cle":         str | None,   # clé de répartition name
      "compte":      str,          # 8-digit account number
      "date":        str,          # DD/MM/YYYY
      "description": str | None,
      "page":        int | None,   # PDF page of the invoice; None if not linked
    }
  ]
}

match(rgd, factures) → {
  "rgd_to_page": {
    "{cle_index}:{compte}:{entry_index}": page_number,
    ...
  }
}

Matching strategy: (compte, date, position-within-group), mirroring cross_check Pass 3.
Mismatched group sizes (M RGD ≠ N facture entries): all RGD entries receive the first
available page. Facture entries with page=None are excluded from the output.
"""

import re
from collections import defaultdict
from utils import extract_spans_from_page, group_spans_by_row, extract_pages_from_pdf

_COMPTE_RE = re.compile(r"^Compte\s+(\d{8})")
_DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def _is_summary_page(rows: list) -> bool:
    """Summary pages have a 'Page' column header at x≈536."""
    for row in rows:
        for span in row["spans"]:
            if 530 <= span["x"] <= 545 and span["text"] == "Page":
                return True
    return False


def _classify_row(spans: list) -> tuple | None:
    """
    Classify a row by its leftmost span x-position.

    Returns one of:
        ('cle', name)                    – clé de répartition header (x < 26)
        ('compte', numero)               – account header (x < 26, "Compte XXXXXXXX")
        ('col_header',)                  – Date/Description/Page header row (x ≈ 28)
        ('data', date, desc, page)       – entry row (x ≈ 57)
        None                             – footer, empty, or unrecognised
    """
    if not spans:
        return None

    first = spans[0]
    x0, text = first["x"], first["text"]

    if x0 < 26:
        m = _COMPTE_RE.match(text)
        if m:
            return ("compte", m.group(1))
        return ("cle", text.strip())

    if 26 <= x0 <= 40 and text == "Date":
        return ("col_header",)

    if 50 <= x0 <= 65 and _DATE_RE.match(text):
        desc = next((s["text"] for s in spans if 133 <= s["x"] <= 148), None)
        page_text = next((s["text"] for s in spans if 530 <= s["x"] <= 548), None)
        page = None
        if page_text:
            try:
                page = int(page_text.strip())
            except ValueError:
                pass
        return ("data", text, desc, page)

    return None


def parse(pdf_bytes: bytes) -> dict:
    """Parse the invoice summary table from the combined factures PDF."""
    pages = extract_pages_from_pdf(pdf_bytes)
    entries = []
    current_cle = None
    current_compte = None

    for page in pages:
        spans = extract_spans_from_page(page)
        rows = group_spans_by_row(spans)

        if not _is_summary_page(rows):
            continue

        for row in rows:
            kind = _classify_row(row["spans"])
            if kind is None:
                continue

            if kind[0] == "cle":
                current_cle = kind[1]
            elif kind[0] == "compte":
                current_compte = kind[1]
            elif kind[0] == "data" and current_compte:
                _, date, desc, page = kind
                entries.append({
                    "cle": current_cle,
                    "compte": current_compte,
                    "date": date,
                    "description": desc,
                    "page": page,
                })

    return {"entries": entries}


def match(rgd: dict, factures: dict) -> dict:
    """
    Match facture entries to RGD entries by (compte, date, position within group).

    - Same-size groups → pair 1:1 by position (mirrors cross_check Pass 3).
    - Mismatched sizes → link all RGD entries to the first available page.
    - Facture entries with page=None are excluded.

    Returns:
        { "rgd_to_page": { "{cle_index}:{compte}:{entry_index}": page_number } }
    """
    # Index: (compte, date) → ordered list of invoice page numbers
    fact_groups: dict[tuple, list[int]] = defaultdict(list)
    for entry in factures.get("entries", []):
        if entry.get("page") is None:
            continue
        fact_groups[(entry["compte"], entry["date"])].append(entry["page"])

    rgd_to_page: dict[str, int] = {}

    for ci, cle in enumerate(rgd.get("cles", [])):
        for acct in cle.get("accounts", []):
            compte = acct["numero"]

            # Group RGD entry indices by date (preserving document order)
            date_groups: dict[str, list[int]] = defaultdict(list)
            for ei, entry in enumerate(acct.get("entries", [])):
                date = entry.get("date")
                if date:
                    date_groups[date].append(ei)

            for date, eis in date_groups.items():
                pages = fact_groups.get((compte, date))
                if not pages:
                    continue

                if len(eis) == len(pages):
                    for ei, page in zip(eis, pages):
                        rgd_to_page[f"{ci}:{compte}:{ei}"] = page
                else:
                    for ei in eis:
                        rgd_to_page[f"{ci}:{compte}:{ei}"] = pages[0]

    return {"rgd_to_page": rgd_to_page}
