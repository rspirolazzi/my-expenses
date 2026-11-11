# API Contract: Expenses (`/api/v1`)

Referencia funcional; la fuente ejecutable es el OpenAPI de FastAPI (`/api/v1/openapi.json`), del que
Web y Mobile regeneran sus tipos (`npm run gen:api`). Mismas convenciones que las features 001 y 002:
JSON en `camelCase`, `Authorization: Bearer <accessToken>`, `X-Client` opcional y errores
`{ error: { code, message } }` con `message` según `Accept-Language`.

## Tipos

```text
Money              string decimal con punto y exactamente currencyDecimals decimales: "100.50",
                   "1500" (JPY). En requests se aceptan hasta currencyDecimals decimales.
CategoryIcon       "other" | "home" | "car" | "hotel" | "beach" | "food" | "money" | "travel"
                   | "party" | "shopping" | "sports"
ParticipantRef     { id, name }
ExpenseListItem    { id, date: "YYYY-MM-DD", title, categoryIcon, amount: Money,
                     paidBy: ParticipantRef | null, isPending: bool }
ExpensePage        { items: ExpenseListItem[], nextCursor: string | null,
                     total: Money | null, count: int | null }   # total y count solo sin cursor
ShareResponse      { participant: ParticipantRef, amount: Money }
ExpenseResponse    { id, accountId, date, title, description: string | null, amount: Money,
                     currency, categoryIcon, paidBy: ParticipantRef | null,
                     participants: ParticipantRef[], shares: ShareResponse[], isPending: bool,
                     version: int, createdAt, updatedAt }
ExpenseWrite       { date, title, description?: string | null, amount: Money, paidById,
                     participantIds: string[], categoryIcon?: CategoryIcon }
HistoryChange      { field: "date" | "title" | "description" | "amount" | "paidBy"
                            | "participants" | "categoryIcon",
                     before: string | ParticipantRef | ParticipantRef[] | null,
                     after:  string | ParticipantRef | ParticipantRef[] | null }
HistoryEntry       { id, action: "created" | "updated" | "deleted",
                     actorName: string | null,          # nombre de participante; null si no se conoce
                     reason: "participant_removed" | null, at: datetime,
                     changes: HistoryChange[] }
ParticipantImpact  { affectedExpenses: int }
```

- `amount` en `HistoryChange` es `Money`; `paidBy` es `ParticipantRef | null`; `participants` es
  `ParticipantRef[]`. Nunca se devuelven ids de usuario ni emails.
- `AccountResponse` (feature 002) agrega `currencyDecimals: int`.

## Expenses

| Método y ruta | Quién | Request | Response | Errores |
|---|---|---|---|---|
| `GET /accounts/{account_id}/expenses?limit=50&cursor=` | Miembro | `limit` 1–100 (default 50) | `200 ExpensePage`, orden `date` desc, `createdAt` desc | `404 not_found`; `422 validation_error` (cursor inválido) |
| `POST /accounts/{account_id}/expenses` | Miembro | `ExpenseWrite` + `clientRequestId` (UUID) | `201 ExpenseResponse`; si el `clientRequestId` ya se usó en esa Cuenta, `201` con el gasto existente | `404`; `409 account_closed`; `422 validation_error` (título, descripción, fecha, importe ≤ 0, más decimales que la moneda, > 999.999.999, `participantIds` vacío); `422 invalid_participant` |
| `GET /accounts/{account_id}/expenses/{expense_id}` | Miembro | — | `200 ExpenseResponse` | `404` (Cuenta, gasto inexistente o eliminado) |
| `PUT /accounts/{account_id}/expenses/{expense_id}` | Miembro | `ExpenseWrite` + `version` | `200 ExpenseResponse` (`version` + 1) | `404` (incluye eliminado mientras se editaba); `409 account_closed`; `409 expense_conflict` con `{ error, current: ExpenseResponse }`; `422` como en el alta |
| `DELETE /accounts/{account_id}/expenses/{expense_id}?version=` | Miembro | — | `204` (baja lógica) | `404`; `409 account_closed`; `409 expense_conflict` con el gasto actual |
| `GET /accounts/{account_id}/expenses/{expense_id}/history` | Miembro | — | `200 HistoryEntry[]`, más reciente primero | `404` |

## Accounts (cambios sobre la feature 002)

| Método y ruta | Cambio |
|---|---|
| `GET /accounts/{account_id}` y demás respuestas `AccountResponse` | Agregan `currencyDecimals` |
| `GET /accounts/{account_id}/participants/{participant_id}/impact` | **Nuevo**. Miembro. `200 ParticipantImpact` con la cantidad de gastos activos que pagó o comparte. `404` si no existe o ya fue quitado |
| `DELETE /accounts/{account_id}/participants/{participant_id}` | Además de la baja lógica, ajusta los gastos (pagador vacío, se quita de participantes) en la misma transacción y audita cada ajuste (FR-020 a FR-023, FR-027) |

## Reglas transversales

- **Permisos (FR-019)**: quien no es miembro recibe siempre `404 not_found`, igual que para una
  Cuenta o un gasto inexistente. No hay acciones de Owner en esta feature: cualquier miembro edita y
  elimina cualquier gasto.
- **Cuenta Cerrada (FR-018)**: `POST`, `PUT` y `DELETE` de gastos responden `409 account_closed`;
  las lecturas siguen disponibles.
- **Moneda (FR-003)**: `ExpenseWrite` no tiene `currency`; un campo desconocido da `422`.
- **Pagador y participantes (FR-005)**: deben ser participantes activos de la Cuenta; el pagador
  puede no estar entre los participantes. `paidById: null` no se acepta.
- **Concurrencia (FR-017)**: `version` obligatoria en `PUT` y `DELETE`.
- **Auditoría (FR-024 a FR-028)**: cada escritura inserta su `audit_logs` en la misma transacción
  ([data-model.md](../data-model.md)).
- **Logs de aplicación (Principio VI)**: no incluyen títulos, descripciones, importes ni nombres.
- **Códigos de error nuevos**: `expense_conflict`, `invalid_participant`. Web y Mobile los traducen en
  `es` y `en`.
