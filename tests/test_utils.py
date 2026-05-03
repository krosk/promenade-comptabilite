import pytest
from utils import parse_french_number, parse_french_date


class TestParseFrenchNumber:
    def test_simple_integer(self):
        assert parse_french_number("123") == 123.0

    def test_comma_decimal(self):
        assert parse_french_number("123,45") == 123.45

    def test_space_thousands(self):
        assert parse_french_number("1 234,56") == 1234.56

    def test_large_number(self):
        assert parse_french_number("1 204 787,71") == 1204787.71

    def test_negative(self):
        assert parse_french_number("-188,75") == -188.75

    def test_negative_with_spaces(self):
        assert parse_french_number("-1 234,56") == -1234.56

    def test_empty_string(self):
        assert parse_french_number("") is None

    def test_none(self):
        assert parse_french_number(None) is None

    def test_whitespace_only(self):
        assert parse_french_number("   ") is None

    def test_non_breaking_space(self):
        assert parse_french_number("1\xa0234,56") == 1234.56

    def test_zero(self):
        assert parse_french_number("0,00") == 0.0

    def test_no_decimal(self):
        assert parse_french_number("25 000") == 25000.0


class TestParseFrenchDate:
    def test_standard_date(self):
        assert parse_french_date("15/10/2025") == "2025-10-15"

    def test_start_of_year(self):
        assert parse_french_date("01/01/2026") == "2026-01-01"

    def test_none(self):
        assert parse_french_date(None) is None

    def test_empty(self):
        assert parse_french_date("") is None

    def test_invalid(self):
        assert parse_french_date("not a date") is None

    def test_with_whitespace(self):
        assert parse_french_date("  15/10/2025  ") == "2025-10-15"
