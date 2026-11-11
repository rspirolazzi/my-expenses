# Data Model: Gestión de Gastos y Log de Auditoría

Base: MongoDB 8.0, mismas convenciones que las features 001 y 002 (colecciones plural `snake_case`,
campos `camelCase`, instantes en UTC). Se agrega la colección `expenses`; `accounts` y `audit_logs`
se extienden sin migrar datos existentes.

## `expenses` (nueva)

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `accountId` | ObjectId | Cuenta del gasto; inmutable |
| `date` | string `YYYY-MM-DD` | Requerido; día calendario sin zona horaria (research R3). Se permiten fechas futuras |
| `title` | string | Requerido; 1–80 caracteres después de recortar espacios |
| `description` | string \| null | Opcional; hasta 500 caracteres; vacío se guarda como `null` |
| `amountMinor` | int64 | Requerido; > 0 y ≤ 999.999.999 × 10^decimales de la moneda (R1) |
| `currency` | string (ISO 4217) | Copia de la moneda de la Cuenta al crear; inmutable (FR-003) |
| `paidById` | string (UUID de participante) \| null | Requerido en el alta y la edición; `null` solo por remoción del participante (R9) |
| `participantIds` | string[] | ≥ 1 en el alta y la edición, sin repetidos, ordenados según la Cuenta; puede quedar `[]` por remoción |
| `categoryIcon` | enum | `other` (default), `home`, `car`, `hotel`, `beach`, `food`, `money`, `travel`, `party`, `shopping`, `sports` (R11) |
| `version` | int | Empieza en 1; +1 en cada escritura (R6) |
| `clientRequestId` | string (UUID) \| null | Idempotencia del alta (R7) |
| `isDeleted` | bool | Default `false`; baja lógica |
| `deletedAt` | date \| null | |
| `createdBy` | ObjectId | Usuario que lo cargó (no se expone en la API) |
| `createdAt` | date | Instante UTC del alta; desempata el orden dentro de un día |
| `updatedAt` | date | |

No hay campo `receiptUrl`: el comprobante quedó fuera de esta feature (clarificación).

Índices:

- `{ accountId: 1, isDeleted: 1, date: -1, createdAt: -1, _id: -1 }` (`account_list`): listado
  paginado y total.
- `{ accountId: 1, paidById: 1 }` (`account_payer`) y `{ accountId: 1, participantIds: 1 }`
  (`account_participants`, multikey): gastos afectados por la remoción de un participante.
- `{ accountId: 1, clientRequestId: 1 }` único con
  `partialFilterExpression: { clientRequestId: { $type: "string" } }` (`client_request_unique`).

### Reglas derivadas

- **Pendiente de asignación** (`isPending`): `paidById = null` o `participantIds = []`. No se guarda.
- **Partes** (`shares`): `split_equal(amountMinor, participantIds, orden de participants en la
  Cuenta)`: cociente para todos y un centavo más, de a uno, para los primeros `resto` según el orden
  de la Cuenta (R2). La suma siempre es `amountMinor`. Si `participantIds = []`, no hay partes.
- **Visibilidad**: un gasto es visible solo para miembros de su Cuenta, con la Cuenta no dada de baja
  y `isDeleted = false`. Para cualquier otro caso, `404 not_found`.
- **Escritura**: requiere ser miembro, el update condicional de `expenseWriteSeq` en la Cuenta (pagador
  y participantes activos, Cuenta abierta) dentro de la misma transacción, (`isClosed = false`, si no `409
  account_closed`) y la `version` vigente (si no `409 expense_conflict`).
- **Nombres**: pagador y participantes se muestran con el nombre actual del participante en la
  Cuenta, incluidos los quitados (solo pueden aparecer en el historial, porque la remoción los saca
  de los gastos).

### Transiciones de estado

```text
Gasto:  activo ──editar (miembro, versión vigente)──▶ activo (version + 1)
        activo ──quitar participante (pagador o compartía)──▶ activo o pendiente (version + 1)
        pendiente ──editar asignando pagador y participantes──▶ activo
        activo | pendiente ──eliminar (miembro, confirmación)──▶ eliminado (definitivo, invisible)
        (Cuenta Cerrada: ninguna transición; Cuenta dada de baja: invisible)
```

## `accounts` (existente)

Un solo campo nuevo, `expenseWriteSeq` (int, opcional; se crea con el primer `$inc`): lo incrementan
el alta y la edición de gastos dentro de su transacción para chocar con una remoción o un cierre
simultáneos (research R10). No se expone en la API ni cambia `updatedAt`. La respuesta de la API
agrega `currencyDecimals` (derivado de `currency`, R1). El
orden del arreglo `participants` es el orden en que se agregaron y define el reparto de centavos.

## `audit_logs` (existente, extendido)

| Campo | Cambio |
|---|---|
| `accountId` | **Nuevo**, ObjectId \| ausente. Se guarda en toda entrada nueva `account.*` y `expense.*`. Las entradas `account.*` anteriores no se reescriben (Principio IV): su `entityId` ya es la Cuenta y las lecturas usan `accountId ?? entityId` (R8) |
| `entityType` | Agrega `"expense"` |
| `metadata.actorParticipantId` | **Nuevo** en `expense.*`: participante del actor en la Cuenta al momento del cambio |
| `metadata.reason` | **Nuevo**, `"participant_removed"` en los ajustes automáticos |

Índice nuevo: `{ accountId: 1, createdAt: -1 }` (`account_created`). El historial de un gasto usa el
existente `{ entityType, entityId, createdAt: -1 }`.

Acciones nuevas:

| Acción | `changes` |
|---|---|
| `expense.created` | `{ campo: { after } }` de `date`, `title`, `description`, `amountMinor`, `currency`, `paidById`, `participantIds`, `categoryIcon` |
| `expense.updated` | `{ campo: { before, after } }` solo de los campos que cambiaron |
| `expense.deleted` | `{ isDeleted: { before: false, after: true } }` |

Un ajuste por remoción es un `expense.updated` con `actorUserId` = quien quitó al participante,
`metadata.reason = "participant_removed"` y los cambios de `paidById` y/o `participantIds`
(FR-027). La remoción misma sigue registrando `account.participant_removed`, ahora con `accountId`.

Todas las entradas se insertan en la misma transacción que el cambio (FR-025) y pasan por el
filtro de claves sensibles de `audit_service` (FR-028).
