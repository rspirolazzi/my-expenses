"""Exact money (Principle III): parsing, formatting and equal split with deterministic cents."""

import pytest

from app.core.money import (
    InvalidAmount,
    currency_decimals,
    format_amount,
    parse_amount,
    split_equal,
)


@pytest.mark.parametrize(
    ("code", "decimals"),
    [
        ("ARS", 2),
        ("USD", 2),
        ("EUR", 2),
        ("JPY", 0),
        ("CLP", 0),
        ("KRW", 0),
        ("PYG", 0),
        ("ISK", 0),
        ("BHD", 3),
        ("KWD", 3),
        ("JOD", 3),
        ("OMR", 3),
        ("TND", 3),
    ],
)
def test_currency_decimals(code, decimals):
    assert currency_decimals(code) == decimals


@pytest.mark.parametrize(
    ("text", "currency", "minor"),
    [
        ("100.5", "ARS", 10050),
        ("100.50", "ARS", 10050),
        ("100", "ARS", 10000),
        ("0.01", "ARS", 1),
        ("1500", "JPY", 1500),
        ("1.234", "KWD", 1234),
        ("999999999", "ARS", 99999999900),
        ("999999999.99", "ARS", 99999999999),
    ],
)
def test_parse_amount(text, currency, minor):
    assert parse_amount(text, currency) == minor


@pytest.mark.parametrize(
    ("text", "currency"),
    [
        ("0", "ARS"),
        ("0.00", "ARS"),
        ("-5", "ARS"),
        ("10.555", "ARS"),
        ("10.5", "JPY"),
        ("1e3", "ARS"),
        ("abc", "ARS"),
        ("1,5", "ARS"),
        ("", "ARS"),
        (" 1", "ARS"),
        ("1000000000", "ARS"),
        ("1000000000", "JPY"),
        ("NaN", "ARS"),
        ("Infinity", "ARS"),
    ],
)
def test_parse_amount_rejects(text, currency):
    with pytest.raises(InvalidAmount):
        parse_amount(text, currency)


@pytest.mark.parametrize(
    ("minor", "currency", "text"),
    [
        (10050, "ARS", "100.50"),
        (5, "ARS", "0.05"),
        (1500, "JPY", "1500"),
        (1234, "KWD", "1.234"),
        (0, "ARS", "0.00"),
    ],
)
def test_format_amount(minor, currency, text):
    assert format_amount(minor, currency) == text


def test_split_gives_leftover_cents_in_account_order():
    assert split_equal(10000, ["a", "b", "c"], ["a", "b", "c"]) == {
        "a": 3334,
        "b": 3333,
        "c": 3333,
    }
    assert split_equal(10000, ["a", "b", "c"], ["c", "a", "b"]) == {
        "c": 3334,
        "a": 3333,
        "b": 3333,
    }


def test_split_ignores_participants_order_in_the_expense():
    assert split_equal(10001, ["c", "b"], ["a", "b", "c"]) == {"b": 5001, "c": 5000}


def test_split_single_participant_takes_everything():
    assert split_equal(12345, ["a"], ["a", "b"]) == {"a": 12345}


def test_split_without_decimals():
    assert split_equal(1000, ["x", "y", "z"], ["x", "y", "z"]) == {"x": 334, "y": 333, "z": 333}


def test_split_without_participants():
    assert split_equal(1000, [], ["a"]) == {}


def test_split_always_adds_up_to_the_total():
    order = [f"p{i}" for i in range(7)]
    for amount in range(1, 501):
        for count in range(1, 8):
            shares = split_equal(amount, order[:count], order)
            assert sum(shares.values()) == amount
            assert max(shares.values()) - min(shares.values()) <= 1
