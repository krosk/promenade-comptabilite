import re
from utils import (
    parse_french_number,
    extract_spans_from_page,
    group_spans_by_row,
    extract_pages_from_pdf,
)

COLUMN_BOUNDARIES = {
    "journal": (0, 55),
    "date": (55, 95),
    "contre_partie": (95, 135),
    "libelle": (135, 270),
    "numero_piece": (270, 335),
    "debit": (335, 400),
    "credit": (400, 450),
    "solde_debiteur": (450, 515),
    "solde_crediteur": (515, 600),
}

ACCOUNT_RE = re.compile(r'Compte\s+(\d{8})\s*:\s*(.*)')
CUMUL_RE = re.compile(r'Cumul\s+au\s+(\d{2}/\d{2}/\d{4})')
TOTAL_COMPTE_RE = re.compile(r'Total\s+Compte\s+(\d{8})\s*\((\d+)\s+.critures?\)')
TOTAL_CLASSE_RE = re.compile(r'Total\s+Classe\s*(\d+)\s+(.*?)\s*\((\d+)\s+.critures?\)')
TOTAL_COPRO_RE = re.compile(r'Total\s+Copropri.t.\s+')
TOTAL_PERIODE_RE = re.compile(r'Total\s+sur\s+la\s+p.riode')
PERIODE_RE = re.compile(r'P.riode\s+du\s+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})')
CLASSE_HEADER_RE = re.compile(r'^(\d{3})\s+(.+)$')
DATE_RE = re.compile(r'\d{2}/\d{2}/\d{4}')
JOURNAL_CODES = {"OD", "BQ", "AC", "AN", "EX", "RG"}
SKIP_TEXTS = {
    "Grand Livre", "Solde", "Journal", "Imprim", "Date",
    "Contre", "partie", "affectation",
}
PAGE_FOOTER_RE = re.compile(r'Grand Livre\s+page\s+\d+')
COPRO_HEADER_RE = re.compile(r'Copropri.t.\s*:\s*SDC')
SDC_LINE_RE = re.compile(r'SDC\s+\d{5}.*du\s+\d{2}/\d{2}/\d{4}')


def _assign_column(x: float) -> str | None:
    for col_name, (lo, hi) in COLUMN_BOUNDARIES.items():
        if lo <= x < hi:
            return col_name
    return None


def _row_to_columns(row: dict) -> dict:
    columns = {}
    for span in row["spans"]:
        col = _assign_column(span["x"])
        if col is None:
            continue
        if col in columns:
            columns[col] += " " + span["text"]
        else:
            columns[col] = span["text"]
    return columns


def _full_row_text(row: dict) -> str:
    return " ".join(s["text"] for s in row["spans"])


def parse(pdf_bytes: bytes, progress_cb=None) -> dict:
    pages = extract_pages_from_pdf(pdf_bytes)
    total_pages = len(pages)

    periode = {"from": None, "to": None}
    accounts = []
    current_account = None

    for page_idx, page in enumerate(pages):
        if progress_cb:
            progress_cb(page_idx + 1, total_pages)
        spans = extract_spans_from_page(page)
        rows = group_spans_by_row(spans)

        for row in rows:
            full_text = _full_row_text(row)

            m = PERIODE_RE.search(full_text)
            if m and periode["from"] is None:
                periode["from"] = m.group(1)
                periode["to"] = m.group(2)
                continue

            if any(full_text.startswith(s) for s in SKIP_TEXTS):
                continue
            if PAGE_FOOTER_RE.search(full_text):
                continue
            if COPRO_HEADER_RE.search(full_text):
                continue
            if SDC_LINE_RE.search(full_text):
                continue

            m = ACCOUNT_RE.search(full_text)
            if m:
                label = m.group(2).strip()
                label = CUMUL_RE.split(label)[0].strip()
                current_account = {
                    "numero": m.group(1),
                    "label": label,
                    "classe": m.group(1)[:3],
                    "cumul_debit": 0.0,
                    "cumul_credit": 0.0,
                    "entries": [],
                    "total_debit": 0.0,
                    "total_credit": 0.0,
                    "total_entry_count": 0,
                }
                accounts.append(current_account)

                m_cumul = CUMUL_RE.search(full_text)
                if m_cumul:
                    cols = _row_to_columns(row)
                    current_account["cumul_debit"] = parse_french_number(
                        cols.get("solde_debiteur")) or 0.0
                    current_account["cumul_credit"] = parse_french_number(
                        cols.get("solde_crediteur")) or 0.0
                continue

            m = CUMUL_RE.search(full_text)
            if m and current_account is not None:
                cols = _row_to_columns(row)
                current_account["cumul_debit"] = parse_french_number(
                    cols.get("solde_debiteur")) or 0.0
                current_account["cumul_credit"] = parse_french_number(
                    cols.get("solde_crediteur")) or 0.0
                continue

            m = TOTAL_COMPTE_RE.search(full_text)
            if m and current_account is not None:
                cols = _row_to_columns(row)
                current_account["total_debit"] = parse_french_number(
                    cols.get("debit")) or 0.0
                current_account["total_credit"] = parse_french_number(
                    cols.get("credit")) or 0.0
                current_account["total_entry_count"] = int(m.group(2))
                continue

            if TOTAL_CLASSE_RE.search(full_text):
                continue
            if TOTAL_COPRO_RE.search(full_text):
                continue
            if TOTAL_PERIODE_RE.search(full_text):
                continue
            m = CLASSE_HEADER_RE.match(full_text)
            if m and len(full_text) < 50:
                continue

            if current_account is not None:
                cols = _row_to_columns(row)
                has_valid_date = bool(
                    cols.get("date") and DATE_RE.match(cols["date"].strip()))
                has_valid_journal = bool(
                    cols.get("journal")
                    and cols["journal"].strip() in JOURNAL_CODES)
                if has_valid_date and has_valid_journal:
                    entry = {
                        "journal": cols.get("journal"),
                        "date": cols.get("date"),
                        "contre_partie": cols.get("contre_partie"),
                        "libelle": cols.get("libelle"),
                        "numero_piece": cols.get("numero_piece"),
                        "debit": parse_french_number(cols.get("debit")),
                        "credit": parse_french_number(cols.get("credit")),
                        "solde_debiteur": parse_french_number(
                            cols.get("solde_debiteur")),
                        "solde_crediteur": parse_french_number(
                            cols.get("solde_crediteur")),
                    }
                    current_account["entries"].append(entry)
                elif cols.get("libelle") and current_account["entries"]:
                    last = current_account["entries"][-1]
                    last["libelle"] = (
                        (last["libelle"] or "") + " " + cols["libelle"]
                    ).strip()
                    if cols.get("numero_piece"):
                        last["numero_piece"] = (
                            (last["numero_piece"] or "") + " "
                            + cols["numero_piece"]
                        ).strip()

    total_debit = sum(a["total_debit"] + a["cumul_debit"] for a in accounts)
    total_credit = sum(a["total_credit"] + a["cumul_credit"] for a in accounts)

    return {
        "periode": periode,
        "accounts": accounts,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
    }


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "grand livre 2025 2026.pdf"
    with open(path, "rb") as f:
        result = parse(f.read())
    print(f"Periode: {result['periode']['from']} -> {result['periode']['to']}")
    print(f"Comptes: {len(result['accounts'])}")
    total_entries = sum(len(a["entries"]) for a in result["accounts"])
    print(f"Total ecritures: {total_entries}")
    print(f"Total debit: {result['total_debit']:,.2f}")
    print(f"Total credit: {result['total_credit']:,.2f}")
