"""Exported texts exist in both languages (feature 005, FR-010 and FR-019)."""

from typing import get_args

from app.core.export_labels import LABELS, TABLES, category_label
from app.schemas.expense import CategoryIcon


def test_spanish_and_english_have_the_same_keys() -> None:
    assert LABELS["es"].keys() == LABELS["en"].keys()
    for group in LABELS["es"]:
        assert LABELS["es"][group].keys() == LABELS["en"][group].keys(), group


def test_no_label_is_empty() -> None:
    for language, groups in LABELS.items():
        for group, texts in groups.items():
            for key, text in texts.items():
                assert text.strip(), (language, group, key)


def test_every_table_and_category_has_a_name() -> None:
    for language in LABELS:
        assert set(TABLES) <= LABELS[language]["files"].keys()
        for category in get_args(CategoryIcon):
            assert category in LABELS[language]["categories"], (language, category)
    assert category_label("unknown", "en") == "Other"
