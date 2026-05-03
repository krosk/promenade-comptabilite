import os
import pytest

from cross_check import match, _rgd_key, _gl_key

GL_PDF = os.path.join(os.path.dirname(__file__), "..", "grand livre 2025 2026.pdf")
RGD_PDF = os.path.join(os.path.dirname(__file__), "..", "rgd 2025 2026.pdf")
BOTH_AVAILABLE = os.path.exists(GL_PDF) and os.path.exists(RGD_PDF)


# ---------------------------------------------------------------------------
# Helpers to build minimal synthetic dicts
# ---------------------------------------------------------------------------

def _gl(accounts):
    return {"accounts": accounts}


def _rgd(cles):
    return {"cles": cles}


def _gl_account(numero, entries):
    return {"numero": numero, "entries": entries}


def _gl_entry(date, debit, credit=None):
    return {"date": date, "debit": debit, "credit": credit, "libelle": None,
            "journal": None, "contre_partie": None, "numero_piece": None,
            "solde_debiteur": None, "solde_crediteur": None}


def _rgd_cle(accounts):
    return {"nom": "CHARGES GENERALES", "numero": 1, "accounts": accounts}


def _rgd_account(numero, entries):
    return {"numero": numero, "label": "", "entries": entries,
            "sous_total": 0, "sous_total_tva": 0, "sous_total_charges_locatives": 0}


def _rgd_entry(date, montant_ttc):
    return {"date": date, "montant_ttc": montant_ttc, "libelle": None,
            "fournisseur": None, "tva": None, "charges_locatives": None}


# ---------------------------------------------------------------------------
# Unit tests (no PDFs required)
# ---------------------------------------------------------------------------

class TestMatchUnit:
    def test_simple_1_to_1(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 1234.56)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("15/06/2025", 1234.56)])])])
        result = match(gl, rgd)
        rk = _rgd_key(0, "60100000", 0)
        gk = _gl_key("60100000", 0)
        assert rk in result["rgd_to_gl"]
        assert gk in result["gl_to_rgd"]
        assert result["rgd_to_gl"][rk] == {"acct_numero": "60100000", "entry_index": 0}
        assert result["gl_to_rgd"][gk] == {"cle_index": 0, "acct_numero": "60100000", "entry_index": 0}

    def test_no_match_different_date(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 100.00)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("16/06/2025", 100.00)])])])
        result = match(gl, rgd)
        assert result["rgd_to_gl"] == {}
        assert result["gl_to_rgd"] == {}

    def test_no_match_different_amount(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 100.00)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("15/06/2025", 200.00)])])])
        result = match(gl, rgd)
        assert result["rgd_to_gl"] == {}

    def test_no_match_different_account(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 100.00)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60200000", [_rgd_entry("15/06/2025", 100.00)])])])
        result = match(gl, rgd)
        assert result["rgd_to_gl"] == {}

    def test_amount_tolerance(self):
        # Within epsilon (0.005)
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 100.003)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("15/06/2025", 100.00)])])])
        result = match(gl, rgd)
        assert _rgd_key(0, "60100000", 0) in result["rgd_to_gl"]

    def test_amount_outside_tolerance(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", 100.01)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("15/06/2025", 100.00)])])])
        result = match(gl, rgd)
        assert result["rgd_to_gl"] == {}

    def test_many_rgd_to_one_gl_excluded(self):
        """One GL entry split across two RGD entries → not a 1:1 match."""
        gl_entry = _gl_entry("15/06/2025", 500.00)
        gl = _gl([_gl_account("60100000", [gl_entry])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [
            _rgd_entry("15/06/2025", 500.00),
            _rgd_entry("15/06/2025", 500.00),
        ])])])
        result = match(gl, rgd)
        # GL entry matches 2 RGD entries → excluded from gl_to_rgd
        assert _gl_key("60100000", 0) not in result["gl_to_rgd"]

    def test_null_amounts_ignored(self):
        gl = _gl([_gl_account("60100000", [_gl_entry("15/06/2025", None)])])
        rgd = _rgd([_rgd_cle([_rgd_account("60100000", [_rgd_entry("15/06/2025", None)])])])
        result = match(gl, rgd)
        assert result["rgd_to_gl"] == {}

    def test_multiple_cles_same_account_one_match(self):
        """Same account in two clés, only one RGD entry per clé — should still match if 1:1."""
        gl = _gl([_gl_account("60100000", [
            _gl_entry("01/06/2025", 100.00),
            _gl_entry("02/06/2025", 200.00),
        ])])
        cle1 = {"nom": "CHARGES GENERALES", "numero": 1, "accounts": [
            _rgd_account("60100000", [_rgd_entry("01/06/2025", 100.00)])
        ]}
        cle2 = {"nom": "BATIMENT A", "numero": 2, "accounts": [
            _rgd_account("60100000", [_rgd_entry("02/06/2025", 200.00)])
        ]}
        rgd = _rgd([cle1, cle2])
        result = match(gl, rgd)
        assert _rgd_key(0, "60100000", 0) in result["rgd_to_gl"]
        assert _rgd_key(1, "60100000", 0) in result["rgd_to_gl"]


# ---------------------------------------------------------------------------
# Integration tests (require actual PDFs)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def parsed_both():
    from grand_livre import parse as gl_parse
    from rgd import parse as rgd_parse
    with open(GL_PDF, "rb") as f:
        gl = gl_parse(f.read())
    with open(RGD_PDF, "rb") as f:
        rgd = rgd_parse(f.read())
    return gl, rgd


@pytest.mark.skipif(not BOTH_AVAILABLE, reason="PDFs not available")
class TestMatchIntegration:
    def test_some_matches_found(self, parsed_both):
        gl, rgd = parsed_both
        result = match(gl, rgd)
        assert len(result["rgd_to_gl"]) > 0, "Expected at least some 1:1 matches"

    def test_bidirectional_consistency(self, parsed_both):
        """Every rgd_to_gl entry must have a symmetric gl_to_rgd entry."""
        gl, rgd = parsed_both
        result = match(gl, rgd)
        for rk, gl_ref in result["rgd_to_gl"].items():
            gk = _gl_key(gl_ref["acct_numero"], gl_ref["entry_index"])
            assert gk in result["gl_to_rgd"], f"Missing reverse for {rk}"
            rgd_ref = result["gl_to_rgd"][gk]
            ci, acct_no, ei = rk.split(":")
            assert rgd_ref["cle_index"] == int(ci)
            assert rgd_ref["acct_numero"] == acct_no
            assert rgd_ref["entry_index"] == int(ei)

    def test_matched_entries_have_same_date_and_amount(self, parsed_both):
        gl, rgd = parsed_both
        result = match(gl, rgd)
        gl_by_account = {a["numero"]: a["entries"] for a in gl["accounts"]}
        cles = rgd["cles"]
        for rk, gl_ref in result["rgd_to_gl"].items():
            ci, acct_no, ei = rk.split(":")
            rgd_entry = cles[int(ci)]["accounts"]
            # Find the account in this cle
            rgd_acct = next(a for a in cles[int(ci)]["accounts"] if a["numero"] == acct_no)
            re = rgd_acct["entries"][int(ei)]
            ge = gl_by_account[acct_no][gl_ref["entry_index"]]
            assert re["date"] == ge["date"]
            assert abs((re["montant_ttc"] or 0) - (ge["debit"] or 0)) < 0.005
