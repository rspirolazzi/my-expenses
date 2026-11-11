# Implementation Plan: Saldos y Reembolsos

**Branch**: `004-balances-settlements` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-balances-settlements/spec.md`

## Summary

La Cuenta suma una pestaña "Saldos", junto a "Gastos", que muestra en este orden:

- el saldo de cada participante activo, con la fila del usuario destacada y un aviso de gastos
  pendientes;
- los reembolsos sugeridos, como máximo N−1 y siempre los mismos para los mismos saldos, cada uno
  con "Marcar como pagado" en un diálogo de importe fijo;
- la lista de reembolsos, que carga de a 50.

Cualquier miembro puede registrar un reembolso manual o eliminar uno (baja lógica, con
confirmación), salvo en una Cuenta Cerrada. El panel principal muestra el saldo del usuario en cada
Cuenta y los totales "Te deben" y "Debés" agrupados por moneda, incluidas las Cuentas Cerradas.

Enfoque técnico: se extiende lo de la feature 003, sin servicios nuevos.

- **Backend**:
  - Colección `settlements`: importes enteros, alta idempotente, baja lógica y auditoría en la
    misma transacción.
  - Endpoint de lectura `GET .../balances`.
  - `myBalance` en el listado de Cuentas.
  - Saldos y sugerencias salen de funciones puras (`balance_math.py`) que reutilizan
    `split_equal`, y no se guardan.
  - El alta y la baja de reembolsos usan el mismo guard de escritura que los gastos, así chocan con
    la remoción de un participante o con el cierre de la Cuenta.
- **Web y Mobile**: suman la pestaña, el formulario manual y el resumen del panel, sin dependencias
  nuevas.

## Technical Context

**Language/Version**: Python 3.13 en el backend. TypeScript 5.x `strict` sobre Node.js v22.13.0 en
Web y Mobile. Igual que en las features anteriores.

**Primary Dependencies**: las de las features 001 a 003. No hay dependencias nuevas: las pestañas
se arman con rutas y con `SegmentedButtons` de React Native Paper ([research.md](research.md) R7).

**Storage**: MongoDB 8.0 (replica set).

- Colección nueva: `settlements`.
- `audit_logs` agrega `entityType: "settlement"` y `metadata.source`.
- `accounts` no cambia de esquema. El contador `expenseWriteSeq` pasa a cubrir también los
  reembolsos.

**Testing**:

- **Backend**: pytest + httpx contra MongoDB real.
  - Unit: saldos y sugerencias, con un test de propiedades con datos aleatorios para la suma cero
    y el tope N−1.
  - Contrato.
  - Integración: permisos, Cuenta Cerrada, carreras con la remoción y con el cierre,
    idempotencia, auditoría y `myBalance`.
  - Perf: saldos y listado de Cuentas.
- **Web y Mobile**: Jest (`next/jest` y `jest-expo`) para pestañas, saldos, diálogo, formulario,
  eliminación, resumen del panel y `totalsByCurrency` (Principio VII).

**Target Platform**: igual que en las features anteriores.

**Project Type**: Web + Mobile + API, los tres proyectos existentes.

**Performance Goals**:

- `GET .../balances` con 500 gastos y 100 reembolsos: p95 < 300 ms en la API y < 2 s hasta verse
  en pantalla (SC-005).
- Alta y baja de un reembolso: p95 < 200 ms.
- `GET /accounts` con 20 Cuentas de 500 gastos: p95 < 500 ms.

**Constraints**:

- Permisos siempre en el backend. Quien no es miembro recibe `404`.
- Toda escritura va con su auditoría en la misma transacción.
- Bajas lógicas.
- Nada de punto flotante para dinero: los totales del cliente se calculan con `BigInt` sobre
  unidades menores.
- Sin actualización automática (FR-025).
- Los logs no incluyen importes ni nombres.

**Scale/Scope**:

- Hasta ~10.000 usuarios.
- Cientos de gastos y reembolsos por Cuenta.
- Hasta 50 participantes por Cuenta.
- ~3 pantallas nuevas o cambiadas por cliente: pestaña Saldos, nuevo reembolso y panel con
  resumen.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Cumplimiento en esta feature | Estado |
|---|---|---|
| I. Acceso Directo y Multiplataforma | Las mismas pestañas y acciones en Web y Mobile sobre `/api/v1`, con JWT validado en cada endpoint | PASS |
| II. Internacionalización | Textos nuevos en `es` y `en`; importes con `Intl` según el idioma; errores por `code` | PASS |
| III. Moneda Única y Exactitud | Reembolsos en la moneda de la Cuenta, sin campo para cambiarla; enteros en unidades menores; partes con `split_equal`; suma de saldos exactamente cero; totales del panel por moneda, sin conversión, con `BigInt` | PASS |
| IV. Auditoría Inmutable y Bajas Lógicas | `settlement.created` y `settlement.deleted` en la misma transacción; baja lógica (`isDeleted`); confirmación "Continuar"/"Cancelar" para eliminar; reembolsos de participantes quitados conservados | PASS |
| V. Strict English Rule | Código, colección `settlements`, campos, rutas y commits en inglés | PASS |
| VI. Privacidad y Datos | Solo nombres de participante, nunca emails ni ids de usuario; sin importes ni nombres en los logs | PASS |
| VII. Test-First | Tests de saldos y sugerencias escritos antes de implementar: centavos, un participante, pagador que no participa, gastos eliminados y pendientes (`paidBy` en `null`), Cuenta Cerrada, participantes vinculados, libres y quitados con reembolsos excluidos; Jest en cada pantalla nueva | PASS |
| VIII. Simplicidad | Sin dependencias, servicios ni saldos materializados; reutiliza `split_equal`, el guard, la paginación por clave y los códigos de error | PASS |
| Reglas del Dominio > Saldos y Reembolsos | Fórmula de saldo, suma cero, gastos sin pagador excluidos y marcados, sugerencias de a lo sumo N−1, "Marcar como pagado" persistido y auditado | PASS |
| Reglas del Dominio > Reembolsos del participante removido | No se eliminan, siguen en la lista marcados y se excluyen de saldos y sugerencias | PASS |
| Reglas del Dominio > Cierre | Una Cuenta Cerrada no permite registrar ni eliminar reembolsos, también en una carrera con el cierre | PASS |
| REST API | `/api/v1/accounts/{account_id}/settlements` (la ruta de ejemplo de la constitución) y `/balances`; membresía verificada en el backend | PASS |
| Nomenclatura | Colección `settlements`; campos en `camelCase` (`fromParticipantId`, `amountMinor`, `isDeleted`); Python en `snake_case` (`compute_balances`); componentes en `PascalCase` (`BalanceList.tsx`) | PASS |
| Seguridad y Datos | Alta y baja con auditoría en transacciones; validación con Pydantic | PASS |

**Resultado del gate (pre-research)**: PASS, sin violaciones que justificar.

**Re-check post-diseño (Phase 1)**: PASS.

- [data-model.md](data-model.md) mantiene importes enteros, bajas lógicas y auditoría por
  transacción, y no guarda datos derivados.
- [contracts/api.md](contracts/api.md) aplica `404` a quien no es miembro y `409 account_closed` a
  las Cuentas Cerradas, y no expone ids de usuario.

## Project Structure

### Documentation (this feature)

```text
specs/004-balances-settlements/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: /balances, /settlements, myBalance
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Solo se listan los archivos nuevos o modificados respecto de la feature 003.

```text
backend/app/
├── core/cursor.py                  # encode/decode del cursor, movido desde expense_service
├── db/indexes.py                   # + índices de settlements
├── schemas/settlement.py           # SettlementCreate, SettlementResponse, SettlementPage,
│                                   # BalanceEntry, SuggestedTransfer, AccountBalances
├── schemas/account.py              # + currencyDecimals y myBalance en AccountSummary
├── repositories/settlements.py     # insert, find_active, find_by_client_request, page,
│                                   # soft_delete, active_for_accounts
├── repositories/expenses.py        # + proyección de gastos activos para saldos (una o varias Cuentas)
├── repositories/accounts.py        # guard_expense_write → guard_money_write
├── services/balance_math.py        # compute_balances, suggest_transfers (funciones puras)
├── services/balance_service.py     # saldos de una Cuenta; myBalance de varias Cuentas
├── services/settlement_service.py  # alta idempotente, listado, baja
├── services/expense_service.py     # usa guard_money_write
├── services/account_service.py     # list_my_accounts agrega myBalance
├── services/audit_service.py       # + settlement.*
├── api/v1/balances.py              # GET /accounts/{account_id}/balances
├── api/v1/settlements.py
└── main.py                         # + routers
backend/tests/{unit,integration,contract,perf}/

web/src/
├── app/(private)/accounts/[accountId]/page.tsx                  # pestaña Gastos (+ AccountTabs)
├── app/(private)/accounts/[accountId]/balances/page.tsx         # pestaña Saldos
├── app/(private)/accounts/[accountId]/settlements/new/page.tsx  # formulario manual
├── app/(private)/dashboard/page.tsx                             # + resumen de saldos
├── app/actions/settlements.ts         # Server Actions: registrar, eliminar, más páginas
├── components/accounts/AccountTabs.tsx
├── components/accounts/AccountList.tsx              # + saldo por Cuenta
├── components/balances/                # BalanceList, SuggestionList, MarkPaidDialog,
│                                       # SettlementList, SettlementForm, BalanceSummary
├── lib/balanceTotals.ts                # totalsByCurrency (BigInt)
├── lib/balancesServer.ts
├── i18n/messages/{es,en}.json          # + balances.*, settlements.*
└── __tests__/

mobile/
├── app/(app)/accounts/[accountId]/balances.tsx
├── app/(app)/accounts/[accountId]/settlements/new.tsx
├── app/(app)/_layout.tsx                         # registra las pantallas nuevas
└── src/
    ├── screens/balances/                 # AccountBalancesScreen, SettlementFormScreen
    ├── screens/expenses/AccountExpensesScreen.tsx   # + AccountTabs
    ├── screens/DashboardScreen.tsx       # + resumen de saldos
    ├── screens/accounts/AccountsScreen.tsx          # + saldo por Cuenta
    ├── components/accounts/AccountTabs.tsx          # SegmentedButtons
    ├── components/balances/              # BalanceList, SuggestionList, SettlementList,
    │                                     # BalanceSummary
    ├── services/api/settlements.ts       # balances, list, create, remove
    ├── utils/balanceTotals.ts            # totalsByCurrency
    ├── i18n/locales/{es,en}.json
    └── __tests__/
```

**Structure Decision**: se mantienen los tres proyectos. Los tipos se regeneran del OpenAPI con
`npm run gen:api`. `totalsByCurrency` se duplica en Web y en Mobile, con los mismos tests, como los
demás helpers.

## Complexity Tracking

No hay violaciones a la constitución ni dependencias nuevas.

Decisiones de diseño no triviales, justificadas en [research.md](research.md):

- Saldos y sugerencias calculados en Python en cada lectura, sin materializar (R1).
- Algoritmo greedy con pares exactos primero, que garantiza N−1 sin buscar el mínimo absoluto (R3).
- `guard_expense_write` renombrado a `guard_money_write` y compartido con los reembolsos (R4).
- Los totales del panel se calculan en el cliente a partir de `myBalance` (R6).
