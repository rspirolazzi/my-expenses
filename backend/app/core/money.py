"""Exact money (Principle III): integer minor units, decimal text at the API, equal split.

No binary floats anywhere: amounts are parsed with `decimal.Decimal` and stored as integers.
"""

import re
from decimal import Decimal

# ISO 4217 minor units for the currencies that do not use 2 decimals (research R1).
_DECIMALS: dict[str, int] = {
    **dict.fromkeys(
        (
            "BIF",
            "CLP",
            "DJF",
            "GNF",
            "ISK",
            "JPY",
            "KMF",
            "KRW",
            "PYG",
            "RWF",
            "UGX",
            "UYI",
            "VND",
            "VUV",
            "XAF",
            "XOF",
            "XPF",
        ),
        0,
    ),
    **dict.fromkeys(("BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"), 3),
    **dict.fromkeys(("CLF", "UYW"), 4),
}

MAX_MAJOR_AMOUNT = 999_999_999
_AMOUNT_TEXT = re.compile(r"^\d+(\.\d+)?$")


class InvalidAmount(ValueError):
    """The text is not a positive amount valid for the currency."""


def currency_decimals(code: str) -> int:
    return _DECIMALS.get(code.upper(), 2)


def parse_amount(text: str, currency: str) -> int:
    """Decimal text ("100.50") to minor units; > 0, at most the currency's decimals and the max."""
    if not isinstance(text, str) or not _AMOUNT_TEXT.match(text):
        raise InvalidAmount("amount must be a decimal number with a dot")
    decimals = currency_decimals(currency)
    _, _, fraction = text.partition(".")
    if len(fraction.rstrip("0")) > decimals:
        raise InvalidAmount(f"amount must have at most {decimals} decimals")
    value = Decimal(text)
    if value <= 0:
        raise InvalidAmount("amount must be greater than zero")
    if value > MAX_MAJOR_AMOUNT + 1 - Decimal(1).scaleb(-decimals):
        raise InvalidAmount("amount is too large")
    return int(value.scaleb(decimals))


def format_amount(minor: int, currency: str) -> str:
    """Minor units to decimal text with exactly the currency's decimals."""
    decimals = currency_decimals(currency)
    if decimals == 0:
        return str(minor)
    sign = "-" if minor < 0 else ""
    whole, fraction = divmod(abs(minor), 10**decimals)
    return f"{sign}{whole}.{fraction:0{decimals}d}"


def split_equal(
    amount_minor: int, participant_ids: list[str], account_order: list[str]
) -> dict[str, int]:
    """Equal shares; leftover cents go one by one following the account's participant order.

    The result always adds up to `amount_minor` (research R2).
    """
    if not participant_ids:
        return {}
    position = {pid: index for index, pid in enumerate(account_order)}
    ordered = sorted(set(participant_ids), key=lambda pid: position.get(pid, len(position)))
    quotient, remainder = divmod(amount_minor, len(ordered))
    return {pid: quotient + (1 if index < remainder else 0) for index, pid in enumerate(ordered)}
