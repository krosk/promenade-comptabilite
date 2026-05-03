import os
import pytest

from rgd import parse

PDF_PATH = os.path.join(
    os.path.dirname(__file__), "..", "rgd 2025 2026.pdf"
)


@pytest.fixture(scope="module")
def rgd():
    with open(PDF_PATH, "rb") as f:
        return parse(f.read())


@pytest.mark.skipif(not os.path.exists(PDF_PATH), reason="PDF not available")
class TestRgdParsing:
    def test_periode(self, rgd):
        assert rgd["periode"]["from"] == "01/04/2025"
        assert rgd["periode"]["to"] == "31/03/2026"

    def test_total_depenses(self, rgd):
        assert rgd["total_depenses"] == pytest.approx(144_856.90, abs=0.01)

    def test_cle_count(self, rgd):
        assert len(rgd["cles"]) == 10

    def test_cle_names(self, rgd):
        names = [c["nom"] for c in rgd["cles"]]
        assert "CHARGES GENERALES" in names
        assert "BATIMENT A" in names
        assert "CHARGES PARKING AFUL" in names

    def test_cle_totals_sum_to_grand_total(self, rgd):
        computed = sum(c["total"] for c in rgd["cles"])
        assert computed == pytest.approx(rgd["total_depenses"], abs=0.02)

    def test_sous_totals_match_entries(self, rgd):
        for cle in rgd["cles"]:
            for acct in cle["accounts"]:
                computed = sum(e["montant_ttc"] or 0 for e in acct["entries"])
                assert computed == pytest.approx(acct["sous_total"], abs=0.02), (
                    f"{cle['nom']} / {acct['numero']} {acct['label']}: "
                    f"computed={computed:.2f}, stated={acct['sous_total']:.2f}"
                )

    def test_sous_totals_sum_to_cle_total(self, rgd):
        for cle in rgd["cles"]:
            computed = sum(a["sous_total"] for a in cle["accounts"])
            assert computed == pytest.approx(cle["total"], abs=0.02), (
                f"{cle['nom']}: computed={computed:.2f}, stated={cle['total']:.2f}"
            )

    def test_entries_have_required_fields(self, rgd):
        for cle in rgd["cles"]:
            for acct in cle["accounts"]:
                for entry in acct["entries"]:
                    assert entry["montant_ttc"] is not None, (
                        f"Entry in {acct['numero']} has no montant_ttc: {entry}"
                    )

    def test_charges_generales_eau(self, rgd):
        cg = next(c for c in rgd["cles"] if c["nom"] == "CHARGES GENERALES")
        eau = next(a for a in cg["accounts"] if a["numero"] == "60100000")
        assert eau["label"] == "Eau"
        assert eau["sous_total"] == pytest.approx(508.16, abs=0.01)
