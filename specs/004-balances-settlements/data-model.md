# Data Model: Saldos y Reembolsos

Base: MongoDB 8.0, mismas convenciones que las features 001 a 003. Se agrega la colección
`settlements`. `accounts` y `audit_logs` se extienden sin migrar datos. Saldos y sugerencias no se
guardan: se calculan en cada lectura ([research.md](research.md) R1).

## `settlements` (nueva)

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `accountId` | ObjectId | Cuenta del reembolso; inmutable |
| `fromParticipantId` | string (UUID de participante) | Quien paga; participante activo de la Cuenta al registrar |
| `toParticipantId` | string (UUID de participante) | Quien recibe; participante activo y distinto de `fromParticipantId` |
| `amountMinor` | int64 | > 0 y ≤ 999.999.999 × 10^decimales de la moneda (igual que los gastos) |
| `currency` | string (ISO 4217) | Copia de la moneda de la Cuenta; inmutable |
| `date` | string `YYYY-MM-DD` | Requerido; día calendario. Por defecto, hoy en el cliente |
| `clientRequestId` | string (UUID) \| null | Idempotencia del alta (R4). La API siempre lo exige; `null` solo aparece en documentos insertados directamente por los tests (fábrica de `conftest.py`), y el índice parcial los ignora |
| `isDeleted` | bool | Default `false`; baja lógica |
| `deletedAt` | date \| null | |
| `deletedBy` | ObjectId \| null | Usuario que lo eliminó (no se expone) |
| `createdBy` | ObjectId | Usuario que lo registró (no se expone) |
| `createdAt` | date | Desempata el orden dentro de un día |

No hay `version` ni `updatedAt`: un reembolso no se edita (FR-017).

Índices:

- `{ accountId: 1, isDeleted: 1, date: -1, createdAt: -1, _id: -1 }` (`account_list`): lista
  paginada y lectura de los activos para los saldos.
- `{ accountId: 1, clientRequestId: 1 }` único, con
  `partialFilterExpression: { clientRequestId: { $type: "string" } }` (`client_request_unique`).

### Reglas derivadas

- **Excluido** (`isExcluded`): `fromParticipantId` o `toParticipantId` es un participante con
  `removedAt` no nulo. Sigue en la lista, pero no cuenta en los saldos (FR-005, FR-015).
- **Visibilidad**: solo para miembros de la Cuenta (no dada de baja) y con `isDeleted = false`. En
  cualquier otro caso, `404`.
- **Escritura** (alta y baja): exige ser miembro y que `guard_money_write` (antes
  `guard_expense_write`) coincida dentro de la transacción: Cuenta abierta y, en el alta, las dos
  puntas activas. Si la Cuenta está cerrada, `409 account_closed`; si una punta no es válida,
  `422 invalid_participant`.

### Transiciones de estado

```text
Reembolso: (nuevo) ──registrar (miembro, Cuenta abierta)──▶ activo
           activo ──eliminar (miembro, confirmación, Cuenta abierta)──▶ eliminado (definitivo)
           activo ──quitar a una de sus puntas──▶ activo y excluido (sin escribir el reembolso)
           (Cuenta Cerrada: ninguna transición; Cuenta dada de baja: invisible)
```

## Valores derivados (no se guardan)

| Valor | Cálculo |
|---|---|
| Saldo de un participante activo | Σ `amountMinor` de los gastos que cuentan y pagó − Σ su parte (`split_equal`) en los gastos que cuentan + Σ reembolsos que cuentan y pagó − Σ reembolsos que cuentan y recibió |
| Gasto que cuenta | `isDeleted = false`, `paidById ≠ null` y `participantIds ≠ []` |
| Gastos pendientes | Gastos activos con `paidById = null` o `participantIds = []` |
| Reembolso que cuenta | `isDeleted = false` y no excluido |
| Sugerencias | `suggest_transfers(saldos, orden de la Cuenta)` (R3): ≤ N−1, determinísticas |
| `myBalance` | Saldo del participante del usuario en esa Cuenta |

Invariante: Σ saldos = 0 en toda Cuenta (FR-002, SC-001).

## `accounts` (existente)

Sin campos nuevos. El contador `expenseWriteSeq` se sigue llamando igual en la base de datos, para
no migrar, y ahora también lo incrementan el alta y la baja de reembolsos. `AccountSummary` (API)
agrega `currencyDecimals` y `myBalance`.

## `audit_logs` (existente, extendido)

| Campo | Cambio |
|---|---|
| `entityType` | Agrega `"settlement"` |
| `metadata.source` | **Nuevo**, `"suggestion"` o `"manual"` en `settlement.created` |

Acciones nuevas (siempre con `accountId` y `metadata.actorParticipantId`):

| Acción | `changes` |
|---|---|
| `settlement.created` | `{ campo: { after } }` de `date`, `fromParticipantId`, `toParticipantId`, `amountMinor` y `currency` |
| `settlement.deleted` | `{ isDeleted: { before: false, after: true } }` |

La entrada se inserta en la misma transacción que el cambio (FR-021). Los registros existentes no
se modifican.
