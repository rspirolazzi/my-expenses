# Implementation Plan: Gestión de Gastos y Log de Auditoría

**Branch**: `003-expense-management` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-expense-management/spec.md`

## Summary

Gastos dentro de una Cuenta abierta: alta con fecha, concepto, descripción, importe exacto en la
moneda de la Cuenta, pagador, participantes y categoría; división en partes iguales con regla fija
para los centavos; listado agrupado por día, cargado de a 50, con el total de la Cuenta arriba;
detalle con la parte de cada participante y su historial de cambios; edición y baja lógica por
cualquier miembro, con aviso si otro cambió el gasto; efectos de quitar un participante (pagador
vacío, redistribución, pendiente de asignación); y auditoría de cada cambio con la Cuenta a la que
pertenece.

Enfoque técnico: se extiende la base de las features 001 y 002 sin servicios nuevos. El backend
agrega la colección `expenses` (importes en unidades menores enteras, fecha como día calendario,
`version` para concurrencia optimista), los endpoints `/api/v1/accounts/{account_id}/expenses` y el
historial legible a partir de `audit_logs`. La remoción de participantes de la 002 pasa a ajustar los
gastos en la misma transacción. Las partes no se guardan: se derivan con una función pura que
también usará la feature de Saldos. Web (BFF con Server Actions) y Mobile (cliente directo) cambian
la vista principal de la Cuenta por la de gastos y mueven la configuración a una subruta.

## Technical Context

**Language/Version**: Python 3.13 (backend); TypeScript 5.x `strict` sobre Node.js v22.13.0 (web y
mobile). Igual que las features anteriores.

**Primary Dependencies**: las de las features 001 y 002, más una sola nueva en Mobile:
`@react-native-community/datetimepicker` (selector de fecha que documenta Expo SDK 56). Los
decimales por moneda salen de una tabla propia, sin `babel` ([research.md](research.md) R1, R12).

**Storage**: MongoDB 8.0 (replica set). Colección nueva `expenses`; `audit_logs` agrega `accountId`,
`entityType: "expense"` y un índice; `accounts` sin cambios de esquema.

**Testing**: pytest + httpx contra MongoDB real (unit de división e importes; contrato; integración de
permisos, Cuenta Cerrada, conflictos de versión, idempotencia, remoción e historial; perf del
listado); Jest en Web (`next/jest`) y Mobile (`jest-expo`) para formularios, listado, detalle,
historial y helpers de importe (Principio VII).

**Target Platform**: igual que las features anteriores: backend y web en contenedores; Mobile iOS 16+
y Android 10+ con development build.

**Project Type**: Web + Mobile + API (los tres proyectos existentes).

**Performance Goals**: con 500 gastos, la primera página (50) más el total en p95 < 300 ms en la API
y < 2 s hasta verse en pantalla; cada página siguiente < 1 s (SC-006). Alta y edición p95 < 200 ms.
Quitar un participante con 500 gastos afectados en una sola transacción < 2 s.

**Constraints**: permisos siempre en el backend; quien no es miembro recibe `404` (FR-019);
escrituras con su auditoría en una transacción; bajas lógicas; sin punto flotante para dinero
(Principio III); sin actualización automática (FR-033); los logs de la aplicación no incluyen
títulos, importes ni nombres (Principio VI).

**Scale/Scope**: hasta ~10.000 usuarios; cientos de gastos por Cuenta (diseñado para miles con
paginación por clave); hasta 50 participantes por Cuenta; ~5 pantallas nuevas por cliente (gastos de
la Cuenta, nuevo gasto, detalle con historial, edición, configuración movida).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Cumplimiento en esta feature | Estado |
|---|---|---|
| I. Acceso Directo y Multiplataforma | Mismas operaciones en Web y Mobile sobre `/api/v1`; JWT validado en cada endpoint | PASS |
| II. Internacionalización | Textos nuevos en `es`/`en`; fechas e importes con `Intl` según el idioma; errores por `code` | PASS |
| III. Moneda Única y Exactitud | Moneda del gasto = la de la Cuenta, sin campo para cambiarla; importes como enteros en unidades menores y texto decimal en la API; reparto determinístico con suma exacta; día calendario ISO 8601 e instantes en UTC | PASS |
| IV. Auditoría Inmutable y Bajas Lógicas | `expense.created/updated/deleted` en la misma transacción; ajustes por remoción auditados; baja lógica (`isDeleted`); confirmación para eliminar y para quitar participante; registros viejos sin reescribir, nuevo campo opcional compatible (R8) | PASS |
| V. Strict English Rule | Código, colecciones, campos, rutas y commits en inglés | PASS |
| VI. Privacidad y Datos | El historial muestra nombres de participante, nunca emails ni ids de usuario; sin datos de gastos en los logs; sin comprobantes ni archivos | PASS |
| VII. Test-First | Tests de división (centavos, un participante, pagador que no participa), importe cero, gastos eliminados, Cuenta Cerrada, participantes vinculados y libres, remoción con redistribución y `paidBy` en `null`, escritos antes de implementar; Jest en cada pantalla nueva | PASS |
| VIII. Simplicidad | Sin servicios ni colecciones de soporte; partes derivadas; una sola dependencia nueva justificada en Complexity Tracking | PASS |
| Reglas del Dominio > Gastos | Atributos de la constitución (el comprobante, opcional, queda para otra feature por clarificación); `paidBy` requerido al crear y editar, `null` solo por remoción; división solo entre `participants`; edición colaborativa | PASS |
| Reglas del Dominio > Remoción de participantes | Pagador vacío, se quita de los participantes con redistribución, pendiente si no queda ninguno, todo auditado | PASS |
| REST API | `/api/v1/accounts/{account_id}/expenses` y subrecursos; membresía verificada en el backend | PASS |
| Nomenclatura | Colección `expenses`; campos `camelCase` (`paidById`, `participantIds`, `amountMinor`, `isDeleted`); Python `snake_case`; componentes `PascalCase` (`ExpenseListItem.tsx`) | PASS |
| Seguridad y Datos | Gasto + auditoría y remoción + ajustes en transacciones; validación con Pydantic | PASS |

**Resultado del gate (pre-research)**: PASS, sin violaciones a justificar.

**Re-check post-diseño (Phase 1)**: PASS. [data-model.md](data-model.md) mantiene bajas lógicas,
importes enteros y auditoría por transacción, y no reescribe registros de auditoría;
[contracts/api.md](contracts/api.md) aplica `404` a quien no es miembro, `409 account_closed` a
Cuentas Cerradas y `409 expense_conflict` a versiones viejas; no expone ids de usuario.

## Project Structure

### Documentation (this feature)

```text
specs/003-expense-management/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: /api/v1/accounts/{account_id}/expenses
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Solo se listan los archivos nuevos o modificados respecto de la feature 002.

```text
backend/app/
├── core/errors.py                  # + expense_conflict, invalid_participant
├── core/money.py                   # decimales por moneda, parse/format de importes, split_equal
├── db/indexes.py                   # + índices de expenses y audit_logs.accountId
├── schemas/expense.py              # ExpenseWrite, ExpenseCreate, ExpenseResponse, ExpenseListItem,
│                                   # ExpensePage, HistoryEntry, ParticipantImpact, CategoryIcon
├── schemas/account.py              # + currencyDecimals en AccountResponse
├── repositories/expenses.py
├── repositories/audit_logs.py      # + accountId, lectura por entidad (solo lectura e inserción)
├── services/expense_service.py     # alta idempotente, listado paginado y total, detalle, edición, baja
├── services/expense_history.py     # historial legible desde audit_logs
├── services/account_service.py     # remove_participant ajusta gastos; impacto de la remoción
├── services/account_permissions.py # + currencyDecimals en la respuesta
├── services/audit_service.py       # + expense.*, account_id
├── api/v1/expenses.py
├── api/v1/accounts.py              # + GET .../participants/{participant_id}/impact
└── main.py                         # + router de expenses
backend/tests/{unit,integration,contract,perf}/   # división, importes, gastos, remoción, historial

web/src/
├── app/(private)/accounts/[accountId]/page.tsx              # vista de gastos (antes: configuración)
├── app/(private)/accounts/[accountId]/settings/page.tsx     # configuración de la 002, movida
├── app/(private)/accounts/[accountId]/expenses/new/page.tsx
├── app/(private)/accounts/[accountId]/expenses/[expenseId]/page.tsx       # detalle + historial
├── app/(private)/accounts/[accountId]/expenses/[expenseId]/edit/page.tsx
├── app/actions/expenses.ts                    # Server Actions (crear, editar, eliminar, más páginas)
├── components/expenses/                       # ExpenseList, ExpenseListItem, ExpenseForm,
│                                              # ExpenseDetail, ExpenseHistory, CategoryIcon, ...
├── components/accounts/ParticipantList.tsx    # diálogo de quitar con cantidad de gastos afectados
├── lib/money.ts                               # parseAmountInput, formatMoney
├── lib/expenseGroups.ts                       # agrupar por día y descartar repetidos
├── lib/expensesServer.ts
├── i18n/messages/{es,en}.json                 # + expenses.*, history.*
└── __tests__/

mobile/
├── app/(app)/accounts/[accountId]/index.tsx               # vista de gastos (reemplaza [accountId].tsx)
├── app/(app)/accounts/[accountId]/settings.tsx            # configuración de la 002, movida
├── app/(app)/accounts/[accountId]/expenses/new.tsx
├── app/(app)/accounts/[accountId]/expenses/[expenseId]/index.tsx
├── app/(app)/accounts/[accountId]/expenses/[expenseId]/edit.tsx
└── src/
    ├── screens/expenses/                     # AccountExpensesScreen, ExpenseFormScreen,
    │                                         # ExpenseDetailScreen
    ├── components/expenses/                  # ExpenseListItem, CategoryIcon, ExpenseHistory
    ├── utils/categoryIcons.ts
    ├── screens/accounts/AccountDetailScreen.tsx   # diálogo de quitar con cantidad de gastos afectados
    ├── services/api/expenses.ts
    ├── utils/money.ts                        # parseAmountInput, formatMoney
    ├── utils/expenseGroups.ts
    ├── i18n/locales/{es,en}.json
    └── __tests__/
```

**Structure Decision**: se mantienen los tres proyectos. Los tipos TypeScript se regeneran del
OpenAPI con `npm run gen:api` en Web y Mobile; no hay paquete compartido (los helpers de importe y
agrupación se duplican, con los mismos tests, como en las features anteriores).

## Complexity Tracking

No hay violaciones a la constitución que justificar. Dependencias nuevas (Principio VIII):

| Dependencia | Proyecto | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|---|
| `@react-native-community/datetimepicker` | mobile | Elegir la fecha del gasto con el selector nativo de iOS y Android; es el que documenta Expo SDK 56 | Un selector propio (mucho trabajo de accesibilidad); `react-native-paper-dates` (tercero menos mantenido) |

Decisiones de modelado no triviales, justificadas en [research.md](research.md):

- Partes derivadas y no guardadas (R2).
- `accountId` en la auditoría solo para registros nuevos, sin reescribir los anteriores (R8).
- Ajuste de gastos dentro de la transacción de remoción del participante (R9).
