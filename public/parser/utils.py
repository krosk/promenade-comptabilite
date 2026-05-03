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
                            "text": text,
                        })
    return spans


def group_spans_by_row(spans: list[dict], y_tolerance: float = 4.0) -> list[dict]:
    spans.sort(key=lambda s: (-s["y"], s["x"]))

    rows = []
    current_row = None
    current_y = None

    for span in spans:
        if not span["text"]:
            continue
        if current_y is None or abs(span["y"] - current_y) > y_tolerance:
            current_row = {"y": span["y"], "spans": []}
            rows.append(current_row)
        current_y = span["y"]
        current_row["spans"].append(span)

    return rows


def extract_pages_from_pdf(pdf_bytes: bytes):
    laparams = LAParams()
    return list(extract_pages(BytesIO(pdf_bytes), laparams=laparams))
