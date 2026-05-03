import os
import pytest

from factures import match, parse

FACTURES_PDF = os.path.join(os.path.dirname(__file__), "..", "export factures.pdf")
RGD_PDF = os.path.join(os.path.dirname(__file__), "..", "rgd 2025 2026.pdf")
FACTURES_AVAILABLE = os.path.exists(FACTURES_PDF)
RGD_AVAILABLE = os.path.exists(RGD_PDF)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rgd(cles):
    return {"cles": cles}


def _cle(accounts, nom="CHARGES GENERALES"):
    return {"nom": nom, "numero": 1, "accounts": accounts}


def _account(numero, entries):
    return {"numero": numero, "label": "", "entries": entries,
            "sous_total": 0, "sous_total_tva": 0, "sous_total_charges_locatives": 0}


def _entry(date, montant_ttc=100.0):
    return {"date": date, "montant_ttc": montant_ttc, "libelle": None,
            "fournisseur": None, "tva": None, "charges_locatives": None}


def _factures(entries):
    return {"entries": entries}


def _fact_entry(compte, date, page=None, cle=None, desc=None):
    return {"cle": cle, "compte": compte, "date": date,
            "description": desc, "page": page}


# ---------------------------------------------------------------------------
# Unit tests — match()
# ---------------------------------------------------------------------------

class TestMatchUnit:
    def test_simple_1_to_1(self):
        rgd = _rgd([_cle([_account("60100000", [_entry("16/06/2025")])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=53)])
        result = match(rgd, fact)
        assert result["rgd_to_page"]["0:60100000:0"] == 53

    def test_no_page_excluded(self):
        rgd = _rgd([_cle([_account("60100000", [_entry("16/06/2025")])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=None)])
        result = match(rgd, fact)
        assert result["rgd_to_page"] == {}

    def test_no_match_different_date(self):
        rgd = _rgd([_cle([_account("60100000", [_entry("15/06/2025")])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=53)])
        result = match(rgd, fact)
        assert result["rgd_to_page"] == {}

    def test_no_match_different_compte(self):
        rgd = _rgd([_cle([_account("60200000", [_entry("16/06/2025")])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=53)])
        result = match(rgd, fact)
        assert result["rgd_to_page"] == {}

    def test_n_to_n_paired_by_position(self):
        # 2 RGD entries, 2 facture entries on same date → paired 1:1 by order
        rgd = _rgd([_cle([_account("60100000", [
            _entry("16/06/2025"),
            _entry("16/06/2025"),
        ])])])
        fact = _factures([
            _fact_entry("60100000", "16/06/2025", page=53),
            _fact_entry("60100000", "16/06/2025", page=57),
        ])
        result = match(rgd, fact)
        assert result["rgd_to_page"]["0:60100000:0"] == 53
        assert result["rgd_to_page"]["0:60100000:1"] == 57

    def test_mismatch_all_get_first_page(self):
        # 2 RGD entries but only 1 facture entry → both get page 53
        rgd = _rgd([_cle([_account("60100000", [
            _entry("16/06/2025"),
            _entry("16/06/2025"),
        ])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=53)])
        result = match(rgd, fact)
        assert result["rgd_to_page"]["0:60100000:0"] == 53
        assert result["rgd_to_page"]["0:60100000:1"] == 53

    def test_multiple_cles_same_compte_date(self):
        # Same compte+date in two different clés → both matched independently
        rgd = _rgd([
            _cle([_account("60100000", [_entry("16/06/2025")])], nom="CLE A"),
            _cle([_account("60100000", [_entry("16/06/2025")])], nom="CLE B"),
        ])
        fact = _factures([
            _fact_entry("60100000", "16/06/2025", page=53),
            _fact_entry("60100000", "16/06/2025", page=57),
        ])
        result = match(rgd, fact)
        # Both cle-0 and cle-1 entries get linked (to pages[0] since 1 RGD each vs 2 pages)
        assert result["rgd_to_page"]["0:60100000:0"] == 53
        assert result["rgd_to_page"]["1:60100000:0"] == 53

    def test_entry_without_date_skipped(self):
        rgd = _rgd([_cle([_account("60100000", [
            {"date": None, "montant_ttc": 100.0, "libelle": None,
             "fournisseur": None, "tva": None, "charges_locatives": None}
        ])])])
        fact = _factures([_fact_entry("60100000", "16/06/2025", page=53)])
        result = match(rgd, fact)
        assert result["rgd_to_page"] == {}


# ---------------------------------------------------------------------------
# Integration tests — parse() and match() against the real PDF
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FACTURES_AVAILABLE, reason="export factures.pdf not available")
class TestParseIntegration:
    @pytest.fixture(scope="class")
    def parsed(self):
        with open(FACTURES_PDF, "rb") as f:
            return parse(f.read())

    def test_has_entries(self, parsed):
        assert len(parsed["entries"]) > 0

    def test_entries_have_required_fields(self, parsed):
        for e in parsed["entries"]:
            assert "compte" in e and len(e["compte"]) == 8
            assert "date" in e
            assert "description" in e
            assert "page" in e
            assert "cle" in e

    def test_some_entries_have_pages(self, parsed):
        with_page = [e for e in parsed["entries"] if e["page"] is not None]
        assert len(with_page) > 0

    def test_pages_are_positive_integers(self, parsed):
        for e in parsed["entries"]:
            if e["page"] is not None:
                assert isinstance(e["page"], int)
                assert e["page"] >= 1

    def test_dates_are_dd_mm_yyyy(self, parsed):
        import re
        pat = re.compile(r"^\d{2}/\d{2}/\d{4}$")
        for e in parsed["entries"]:
            assert pat.match(e["date"]), f"Bad date: {e['date']}"

    def test_first_invoice_page_is_around_11(self, parsed):
        # Summary covers pages 1-10; first invoice page should be >= 10
        min_page = min(e["page"] for e in parsed["entries"] if e["page"] is not None)
        assert min_page >= 10


@pytest.mark.skipif(
    not (FACTURES_AVAILABLE and RGD_AVAILABLE),
    reason="export factures.pdf or rgd 2025 2026.pdf not available",
)
class TestMatchIntegration:
    @pytest.fixture(scope="class")
    def parsed_both(self):
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "public", "parser"))
        import rgd as rgd_mod
        with open(FACTURES_PDF, "rb") as f:
            fact = parse(f.read())
        with open(RGD_PDF, "rb") as f:
            rgd_data = rgd_mod.parse(f.read())
        return rgd_data, fact

    def test_some_rgd_entries_matched(self, parsed_both):
        rgd_data, fact = parsed_both
        result = match(rgd_data, fact)
        assert len(result["rgd_to_page"]) > 0

    def test_matched_pages_are_positive_integers(self, parsed_both):
        rgd_data, fact = parsed_both
        result = match(rgd_data, fact)
        for key, page in result["rgd_to_page"].items():
            assert isinstance(page, int) and page >= 1, f"{key}: {page}"

    def test_rgd_key_format(self, parsed_both):
        rgd_data, fact = parsed_both
        result = match(rgd_data, fact)
        import re
        pat = re.compile(r"^\d+:\d{8}:\d+$")
        for key in result["rgd_to_page"]:
            assert pat.match(key), f"Bad key format: {key}"
