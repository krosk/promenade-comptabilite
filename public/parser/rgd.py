import re
from utils import (
    parse_french_number,
    extract_spans_from_page,
    group_spans_by_row,
    extract_pages_from_pdf,
)

RGD_COLUMNS = {
    "account_or_libelle": (24, 130),
    "sous_total_label": (130, 250),
    "fournisseur": (250, 330),
    "date": (330, 380),
    "tva": (380, 435),
    "charges_locatives": (435, 495),
    "montant_ttc": (495, 570),
}

ACCOUNT_RE = re.compile(r'^(\d{8})\s+(.*)$')
CLE_RE = re.compile(
    r'^(\d{1,2})\s+'
    r'(CHARGES GENERALES|BATIMENT [A-D]|CHARGES APPRTS BAT\.B\.C'
    r'|ASCENSEUR BAT\.[A-C]|CHARGES PARKING AFUL)$'
)
SOUS_TOTAL_RE = re.compile(r'Sous-total')
TOTAL_CLE_RE = re.compile(r'Total de la cl')
TOTAL_DEPENSES_RE = re.compile(r'Total des d.penses')
PERIODE_RE = re.compile(
    r'du\s+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})')
PAGE_FOOTER_RE = re.compile(r'page\s+\d+\s+de')
HEADER_TEXTS = {
    "Locatives", "dont TVA", "Fournisseurs",
}
HEADER_START_RE = re.compile(
    r"^(Num.ro des comptes|Montant TTC|Date d'.dition"
    r"|N. Imm|Relev. g.n.ral)"
)
CHARGES_DU_RE = re.compile(r'Charges du \d{2}/\d{2}')


def _assign_column(x: float) -> str | None:
    for col_name, (lo, hi) in RGD_COLUMNS.items():
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
    cles = []
    current_cle = None
    current_account = None

    for page_idx, page in enumerate(pages):
        if progress_cb:
            progress_cb(page_idx + 1, total_pages)
        spans = extract_spans_from_page(page)
        rows = group_spans_by_row(spans, y_tolerance=3.0)

        for row in rows:
            full_text = _full_row_text(row)
            cols = _row_to_columns(row)

            m = PERIODE_RE.search(full_text)
            if m and periode["from"] is None:
                periode["from"] = m.group(1)
                periode["to"] = m.group(2)
                continue

            if HEADER_START_RE.match(full_text):
                continue
            if full_text.strip() in HEADER_TEXTS:
                continue
            if full_text.strip() == "Charges":
                continue
            if PAGE_FOOTER_RE.search(full_text):
                continue
            if CHARGES_DU_RE.search(full_text):
                continue
            if full_text.startswith("Copropri"):
                continue
            if full_text.startswith("La Promenade"):
                continue
            if full_text.startswith("3 all"):
                continue
            if full_text.startswith("93160"):
                continue

            acct_text = cols.get("account_or_libelle", "").strip()

            cle_match = CLE_RE.match(acct_text)
            if cle_match:
                current_cle = {
                    "nom": cle_match.group(2),
                    "numero": int(cle_match.group(1)),
                    "accounts": [],
                    "total": 0.0,
                }
                cles.append(current_cle)
                current_account = None
                continue

            if TOTAL_DEPENSES_RE.search(full_text):
                continue

            if TOTAL_CLE_RE.search(full_text):
                if current_cle is not None:
                    ttc = parse_french_number(cols.get("montant_ttc"))
                    if ttc is not None:
                        current_cle["total"] = ttc
                current_account = None
                continue

            if SOUS_TOTAL_RE.search(full_text):
                if current_account is not None:
                    ttc = parse_french_number(cols.get("montant_ttc"))
                    if ttc is not None:
                        current_account["sous_total"] = ttc
                    tva = parse_french_number(cols.get("tva"))
                    if tva is not None:
                        current_account["sous_total_tva"] = tva
                    cl = parse_french_number(cols.get("charges_locatives"))
                    if cl is not None:
                        current_account["sous_total_charges_locatives"] = cl
                continue

            acct_match = ACCOUNT_RE.match(acct_text)
            if acct_match and current_cle is not None:
                current_account = {
                    "numero": acct_match.group(1),
                    "label": acct_match.group(2).strip(),
                    "entries": [],
                    "sous_total": 0.0,
                    "sous_total_tva": 0.0,
                    "sous_total_charges_locatives": 0.0,
                }
                current_cle["accounts"].append(current_account)
                continue

            if current_account is not None:
                ttc = parse_french_number(cols.get("montant_ttc"))
                date = cols.get("date", "").strip()
                libelle = acct_text
                fournisseur = cols.get("fournisseur", "").strip()
                tva = parse_french_number(cols.get("tva"))
                cl = parse_french_number(cols.get("charges_locatives"))

                if ttc is not None or date:
                    entry = {
                        "libelle": libelle,
                        "montant_ttc": ttc,
                        "charges_locatives": cl,
                        "tva": tva,
                        "date": date if date else None,
                        "fournisseur": fournisseur if fournisseur else None,
                    }
                    current_account["entries"].append(entry)
                elif libelle and current_account["entries"]:
                    last = current_account["entries"][-1]
                    last["libelle"] = (
                        (last["libelle"] or "") + " " + libelle).strip()
                elif fournisseur and current_account["entries"]:
                    last = current_account["entries"][-1]
                    last["fournisseur"] = (
                        (last["fournisseur"] or "") + " " + fournisseur
                    ).strip()

    total_depenses = sum(c["total"] for c in cles)

    return {
        "periode": periode,
        "cles": cles,
        "total_depenses": round(total_depenses, 2),
    }


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "rgd 2025 2026.pdf"
    with open(path, "rb") as f:
        result = parse(f.read())
    print(f"Periode: {result['periode']['from']} -> {result['periode']['to']}")
    print(f"Total depenses: {result['total_depenses']:,.2f}")
    for cle in result["cles"]:
        print(f"\n  Cle: {cle['nom']} ({cle['numero']})"
              f" - Total: {cle['total']:,.2f}")
        for acct in cle["accounts"]:
            print(f"    {acct['numero']} {acct['label']}: "
                  f"{len(acct['entries'])} entries, "
                  f"sous-total={acct['sous_total']:,.2f}")
