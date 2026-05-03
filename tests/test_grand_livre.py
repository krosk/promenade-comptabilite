import os
import pytest

from grand_livre import parse

PDF_PATH = os.path.join(
    os.path.dirname(__file__), "..", "grand livre 2025 2026.pdf"
)


@pytest.fixture(scope="module")
def grand_livre():
    with open(PDF_PATH, "rb") as f:
        return parse(f.read())


@pytest.mark.skipif(not os.path.exists(PDF_PATH), reason="PDF not available")
class TestGrandLivreParsing:
    def test_periode(self, grand_livre):
        assert grand_livre["periode"]["from"] == "01/04/2025"
        assert grand_livre["periode"]["to"] == "31/03/2026"

    def test_total_balance(self, grand_livre):
        assert grand_livre["total_debit"] == pytest.approx(1_204_787.71, abs=0.01)
        assert grand_livre["total_credit"] == pytest.approx(1_204_787.71, abs=0.01)

    def test_account_count(self, grand_livre):
        assert len(grand_livre["accounts"]) == 266

    def test_entry_counts_match_stated(self, grand_livre):
        for acct in grand_livre["accounts"]:
            assert len(acct["entries"]) == acct["total_entry_count"], (
                f"Account {acct['numero']} {acct['label']}: "
                f"parsed {len(acct['entries'])}, stated {acct['total_entry_count']}"
            )

    def test_account_label_clean(self, grand_livre):
        for acct in grand_livre["accounts"]:
            assert "Cumul au" not in acct["label"], (
                f"Account {acct['numero']} label contains 'Cumul au': {acct['label']}"
            )

    def test_first_account(self, grand_livre):
        acct = grand_livre["accounts"][0]
        assert acct["numero"] == "10300000"
        assert acct["label"] == "Avances"
        assert acct["classe"] == "103"

    def test_entries_have_required_fields(self, grand_livre):
        for acct in grand_livre["accounts"]:
            for entry in acct["entries"]:
                assert entry["journal"] is not None
                assert entry["date"] is not None
                assert (
                    entry["debit"] is not None or entry["credit"] is not None
                ), f"Entry in {acct['numero']} has no debit or credit: {entry}"
