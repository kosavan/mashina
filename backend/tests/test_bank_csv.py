"""Synthetic bank exports only; no real statement or account information."""

import pytest
from backend.bank_csv import Mapping, inspect_csv, parse_csv


def mapping(**overrides):
    return Mapping(
        **{
            "date": "Дата",
            "amount": "Сумма",
            "description": "Описание",
            "transaction_id": "ID",
            "currency": "Валюта",
            "date_format": "russian",
            "outgoing_sign": "negative",
            "default_currency": "RUB",
            **overrides,
        }
    )


CSV = "Дата;Сумма;Описание;ID;Валюта;Лишнее\n12.10.2026;-1 234,56;Мойка;A;RUB;UNMAPPED_PRIVATE_MARKER\n"


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "cp1251"])
def test_mapping_exact_and_private(encoding):
    content = CSV.encode(encoding)
    chosen = "cp1251" if encoding == "cp1251" else "utf-8"
    inspected = inspect_csv(content, chosen, "semicolon")
    assert inspected == {
        "headers": ["Дата", "Сумма", "Описание", "ID", "Валюта", "Лишнее"],
        "row_count": 1,
    }
    rows = parse_csv(content, chosen, "semicolon", mapping())
    assert len(rows) == 1 and not rows[0]["error"]
    assert rows[0]["data"]["amount_minor"] == 123456
    assert rows[0]["data"]["signed_minor"] == -123456
    assert rows[0]["data"]["date"] == "2026-10-12"
    assert "UNMAPPED_PRIVATE_MARKER" not in str(rows)


@pytest.mark.parametrize(
    "amount", ["-0.001", "NaN", "Infinity", "1,234.56", "1e3", "--3", "-1 23,00"]
)
def test_invalid_amount_never_normalizes(amount):
    rows = parse_csv(CSV.replace("-1 234,56", amount).encode(), "utf-8", "semicolon", mapping())
    assert rows[0]["error"] and rows[0]["data"] is None


@pytest.mark.parametrize("amount", ["0", "1.00"])
def test_credit_and_zero_remain_reviewable_but_not_expenses(amount):
    row = parse_csv(CSV.replace("-1 234,56", amount).encode(), "utf-8", "semicolon", mapping())[0]
    assert row["error"] and row["data"] is not None
    assert row["data"]["amount_minor"] is None


def test_explicit_iso_positive_and_default_currency():
    rows = parse_csv(
        b'date,amount,description\n2026-10-12,1.01,"Two, words"\n',
        "utf-8",
        "comma",
        Mapping(
            date="date",
            amount="amount",
            description="description",
            date_format="iso",
            outgoing_sign="positive",
            default_currency="EUR",
        ),
    )
    assert rows[0]["data"]["amount_minor"] == 101
    assert rows[0]["data"]["currency"] == "EUR"
    assert rows[0]["data"]["description"] == "Two, words"


def test_tab_and_canonical_content_not_raw_order():
    first = parse_csv(CSV.encode(), "utf-8", "semicolon", mapping())[0]
    other = "ID\tВалюта\tДата\tОписание\tСумма\nA\tRUB\t12.10.2026\tМойка\t-1234.56\n"
    second = parse_csv(other.encode(), "utf-8", "tab", mapping())[0]
    assert first["fingerprint"] == second["fingerprint"]


@pytest.mark.parametrize(
    "content", [b"", b"a,a\n1,2", b"a,\n1,2", b"a,b\n1", b"a,b\n1,2,3", b'a,b\n"unterminated,2']
)
def test_bad_structure_rejected(content):
    with pytest.raises(ValueError):
        inspect_csv(content, "utf-8", "comma")


def test_bounds_and_missing_mapping():
    for content in [
        b"a\n" + b"x\n" * 1001,
        b"x" * (2 * 1024 * 1024 + 1),
        (",".join(f"c{i}" for i in range(51)) + "\n").encode(),
    ]:
        with pytest.raises(ValueError):
            inspect_csv(content, "utf-8", "comma")
    with pytest.raises(ValueError):
        parse_csv(b"a\n1", "utf-8", "comma", mapping())
    row = parse_csv(CSV.replace("Мойка", "x" * 2001).encode(), "utf-8", "semicolon", mapping())[0]
    assert row["error"] and row["data"] is None


def test_date_currency_and_duplicate_column_mapping_rejected():
    for content in [CSV.replace("12.10.2026", "10/12/26"), CSV.replace(";RUB;", ";JPY;")]:
        assert parse_csv(content.encode(), "utf-8", "semicolon", mapping())[0]["error"]
    with pytest.raises(ValueError):
        parse_csv(CSV.encode(), "utf-8", "semicolon", mapping(amount="Дата"))


def test_two_identical_no_id_rows_are_not_collapsed():
    source = "Дата;Сумма;Описание\n12.10.2026;-10;Мойка\n12.10.2026;-10;Мойка\n"
    rows = parse_csv(
        source.encode(), "utf-8", "semicolon", mapping(transaction_id=None, currency=None)
    )
    assert len(rows) == 2 and rows[0]["fingerprint"] == rows[1]["fingerprint"]
    assert rows[0]["ordinal"] != rows[1]["ordinal"]
