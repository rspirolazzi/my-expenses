"""Translated texts of the exported files (FR-010, research R5 and R7).

Only what a person reads changes with the language: table file names, column headers and
translatable values. JSON keys and the file contents' numbers and dates never do.
"""

from typing import Final

from app.core.i18n import Language

# Tables in the order they are written to the ZIP.
TABLES: Final = (
    "account",
    "participants",
    "expenses",
    "shares",
    "settlements",
    "balances",
    "suggestions",
)

LABELS: Final[dict[Language, dict[str, dict[str, str]]]] = {
    "es": {
        "files": {
            "prefix": "mis-gastos",
            "account_fallback": "cuenta",
            "profile": "perfil.csv",
            "account": "cuenta.csv",
            "participants": "participantes.csv",
            "expenses": "gastos.csv",
            "shares": "partes.csv",
            "settlements": "reembolsos.csv",
            "balances": "saldos.csv",
            "suggestions": "sugerencias.csv",
        },
        "columns": {
            "account_id": "ID de la cuenta",
            "name": "Nombre",
            "description": "Descripción",
            "currency": "Moneda",
            "closed": "Cerrada",
            "closed_at": "Cerrada el (UTC)",
            "exported_at": "Exportado el (UTC)",
            "pending_expenses": "Gastos pendientes",
            "participant_id": "ID del participante",
            "participant": "Participante",
            "removed": "Quitado",
            "expense_id": "ID del gasto",
            "date": "Fecha",
            "title": "Concepto",
            "category": "Categoría",
            "amount": "Importe",
            "paid_by": "Pagó",
            "participants": "Participantes",
            "pending": "Pendiente de asignación",
            "share": "Parte",
            "settlement_id": "ID del reembolso",
            "from": "De",
            "to": "Para",
            "excluded": "Excluido",
            "balance": "Saldo",
            "first_name": "Nombre",
            "last_name": "Apellido",
            "email": "Email",
            "language": "Idioma",
            "default_currency": "Moneda por defecto",
            "theme": "Tema",
        },
        "values": {
            "yes": "Sí",
            "no": "No",
            "language_es": "Español",
            "language_en": "Inglés",
            "theme_light": "Claro",
            "theme_dark": "Oscuro",
            "theme_system": "Sistema",
        },
        "categories": {
            "other": "Otros",
            "home": "Casa",
            "car": "Auto",
            "hotel": "Hotel",
            "beach": "Playa",
            "food": "Comida",
            "money": "Dinero",
            "travel": "Viaje",
            "party": "Fiesta",
            "shopping": "Compras",
            "sports": "Deportes",
        },
    },
    "en": {
        "files": {
            "prefix": "my-expenses",
            "account_fallback": "account",
            "profile": "profile.csv",
            "account": "account.csv",
            "participants": "participants.csv",
            "expenses": "expenses.csv",
            "shares": "shares.csv",
            "settlements": "settlements.csv",
            "balances": "balances.csv",
            "suggestions": "suggestions.csv",
        },
        "columns": {
            "account_id": "Account ID",
            "name": "Name",
            "description": "Description",
            "currency": "Currency",
            "closed": "Closed",
            "closed_at": "Closed at (UTC)",
            "exported_at": "Exported at (UTC)",
            "pending_expenses": "Pending expenses",
            "participant_id": "Participant ID",
            "participant": "Participant",
            "removed": "Removed",
            "expense_id": "Expense ID",
            "date": "Date",
            "title": "Title",
            "category": "Category",
            "amount": "Amount",
            "paid_by": "Paid by",
            "participants": "Participants",
            "pending": "Pending assignment",
            "share": "Share",
            "settlement_id": "Settlement ID",
            "from": "From",
            "to": "To",
            "excluded": "Excluded",
            "balance": "Balance",
            "first_name": "First name",
            "last_name": "Last name",
            "email": "Email",
            "language": "Language",
            "default_currency": "Default currency",
            "theme": "Theme",
        },
        "values": {
            "yes": "Yes",
            "no": "No",
            "language_es": "Spanish",
            "language_en": "English",
            "theme_light": "Light",
            "theme_dark": "Dark",
            "theme_system": "System",
        },
        "categories": {
            "other": "Other",
            "home": "Home",
            "car": "Car",
            "hotel": "Hotel",
            "beach": "Beach",
            "food": "Food",
            "money": "Money",
            "travel": "Travel",
            "party": "Party",
            "shopping": "Shopping",
            "sports": "Sports",
        },
    },
}


def labels(language: Language) -> dict[str, dict[str, str]]:
    return LABELS.get(language, LABELS["es"])


def category_label(category: str, language: Language) -> str:
    categories = labels(language)["categories"]
    return categories.get(category, categories["other"])


def yes_no(value: bool, language: Language) -> str:
    return labels(language)["values"]["yes" if value else "no"]
