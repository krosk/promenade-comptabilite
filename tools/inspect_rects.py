"""
Diagnostic: print all LTRect elements on a few pages of the Grand Livre PDF.
Run from the repo root:
  python tools/inspect_rects.py "grand livre 2025 2026.pdf"

If row background fills are proper PDF fill objects, they will appear here
as rects spanning most of the page width with heights matching row heights.
"""
import sys
from io import BytesIO
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTRect, LAParams

path = sys.argv[1] if len(sys.argv) > 1 else "grand livre 2025 2026.pdf"
with open(path, "rb") as f:
    pdf_bytes = f.read()

pages = list(extract_pages(BytesIO(pdf_bytes), laparams=LAParams()))
print(f"Total pages: {len(pages)}")

for page_num in [2, 5, 10]:
    if page_num >= len(pages):
        continue
    page = pages[page_num]
    rects = [e for e in page if isinstance(e, LTRect)]
    print(f"\n--- Page {page_num + 1} (page bbox width={page.bbox[2]:.0f}) ---")
    print(f"  LTRect count: {len(rects)}")
    wide = [r for r in rects if (r.bbox[2] - r.bbox[0]) > page.bbox[2] * 0.5]
    print(f"  Wide rects (>50% page width): {len(wide)}")
    for r in sorted(wide, key=lambda e: -e.bbox[1])[:25]:
        x0, y0, x1, y1 = r.bbox
        print(f"    y={y0:.1f}–{y1:.1f}  h={y1-y0:.1f}  x={x0:.1f}–{x1:.1f}")
