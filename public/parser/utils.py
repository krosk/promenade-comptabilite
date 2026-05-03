import re
from io import BytesIO
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox, LTTextLine, LAParams


def parse_french_number(text: str) -> float | None:
    if text is None:
        return None
    text = text.strip()
    if not text:
        return None
    text = text.replace('\xa0', ' ')
    negative = text.startswith('-')
    if negative:
        text = text[1:].strip()
    text = text.replace(' ', '').replace(',', '.')
    try:
        value = float(text)
        return -value if negative else value
    except ValueError:
        return None


def parse_french_date(text: str) -> str | None:
    if text is None:
        return None
    text = text.strip()
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', text)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def extract_spans_from_page(page) -> list[dict]:
    spans = []
    for element in page:
        if isinstance(element, LTTextBox):
            for line in element:
                if isinstance(line, LTTextLine):
                    text = line.get_text().strip()
                    if text:
                        spans.append({
                            "x": line.bbox[0],
                            "y": round(line.bbox[1], 1),
                            "y1": round(line.bbox[3], 1),
                            "text": text,
                        })
    return spans


def group_spans_by_row(spans: list[dict], y_tolerance: float = 4.0) -> list[dict]:
    """Group text spans into logical rows by vertical overlap.

    Two spans belong to the same row if their vertical extents overlap or
    touch (within 1 pt rounding tolerance). The row's y-range expands as
    spans are added, so multi-line libellés and amounts centred between
    text lines are captured in one row without cascading into adjacent rows.

    Unlike the previous chaining approach, a span is compared against the
    row's full accumulated y-range, not just the previous span's y. This
    prevents tight adjacent rows from merging.

    Args:
        spans: List of {"x", "y", "y1", "text"} dicts, unsorted.
            y1 (top of line) is required; falls back to y + 10 if absent.
        y_tolerance: unused, kept for API compatibility.

    Returns:
        List of {"y", "y1", "spans": [...]} row dicts, ordered top-to-bottom.
        Spans within each row are ordered left-to-right by x.
    """
    GAP = 1.0  # pt: spans within this gap of the row bottom join the same row

    spans.sort(key=lambda s: (-s.get("y1", s["y"]), s["x"]))

    rows = []
    current_row = None

    for span in spans:
        if not span["text"]:
            continue
        sy0 = span["y"]
        sy1 = span.get("y1", span["y"] + 10)

        if current_row is None or sy1 < current_row["y"] - GAP:
            current_row = {"y": sy0, "y1": sy1, "spans": [span]}
            rows.append(current_row)
        else:
            current_row["y"] = min(current_row["y"], sy0)
            current_row["y1"] = max(current_row["y1"], sy1)
            current_row["spans"].append(span)

    for row in rows:
        row["spans"].sort(key=lambda s: s["x"])

    return rows


def extract_pages_from_pdf(pdf_bytes: bytes):
    laparams = LAParams()
    return list(extract_pages(BytesIO(pdf_bytes), laparams=laparams))
