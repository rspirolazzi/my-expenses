# API Contract: Balances & Settlements (`/api/v1`)

Este documento es la referencia funcional. La fuente ejecutable es el OpenAPI de FastAPI
(`/api/v1/openapi.json`), del que Web y Mobile regeneran sus tipos con `npm run gen:api`.

Se mantienen las convenciones de las features 001 a 003:

- JSON en `camelCase`.
- `Authorization: Bearer <accessToken>`.
- Errores con la forma `{ error: { code, message } }`, con `message` según `Accept-Language`.
- `Money` es texto decimal con exactamente `currencyDecimals` decimales.

## Tipos

```text
ParticipantRef        { id, name }
BalanceEntry          { participant: ParticipantRef, amount: Money, isMe: bool }
                      # amount > 0: le deben; < 0: debe; "0.00": al día
SuggestedTransfer     { from: ParticipantRef, to: ParticipantRef, amount: Money }
AccountBalances       { currency, currencyDecimals: int,
                        balances: BalanceEntry[],          # participantes activos, orden de la Cuenta
                        suggestions: SuggestedTransfer[],  # orden determinístico (research R3)
                        pendingExpenses: int }
SettlementResponse    { id, accountId, date: "YYYY-MM-DD", from: ParticipantRef, to: ParticipantRef,
                        amount: Money, currency, isExcluded: bool, createdAt }
SettlementPage        { items: SettlementResponse[], nextCursor: string | null }
SettlementCreate      { fromParticipantId, toParticipantId, amount: Money, date: "YYYY-MM-DD",
                        clientRequestId: UUID, source?: "suggestion" | "manual" }  # default manual
```

- `ParticipantRef.name` es el nombre actual del participante, también el de uno quitado. Nunca se
  devuelven ids de usuario ni emails.
- `AccountSummary` (`GET /accounts`) agrega `currencyDecimals: int` y `myBalance: Money`. Este
  último es el saldo del participante del usuario, con el mismo signo que `BalanceEntry.amount`.

## Balances

| Método y ruta | Quién | Response | Errores |
|---|---|---|---|
| `GET /accounts/{account_id}/balances` | Miembro | `200 AccountBalances` | `404 not_found` |

Notas:

- La suma de `balances[].amount` es exactamente cero.
- Si todos los saldos son cero, `suggestions` es `[]`.
- La respuesta es la misma con la Cuenta Cerrada.

## Settlements

| Método y ruta | Quién | Request | Response | Errores |
|---|---|---|---|---|
| `GET /accounts/{account_id}/settlements?limit=50&cursor=` | Miembro | `limit` de 1 a 100 (default 50) | `200 SettlementPage`, ordenado por `date` desc, `createdAt` desc, `_id` desc. Incluye los excluidos | `404`; `422 validation_error` (cursor inválido) |
| `POST /accounts/{account_id}/settlements` | Miembro | `SettlementCreate` | `201 SettlementResponse`. Si el `clientRequestId` ya se usó en esa Cuenta, `201` con el existente | `404`; `409 account_closed`; `422 validation_error`; `422 invalid_participant` |
| `DELETE /accounts/{account_id}/settlements/{settlement_id}` | Miembro | — | `204` (baja lógica) | `404` (inexistente o ya eliminado); `409 account_closed` |

`422 validation_error` en el `POST` cubre:

- importe ≤ 0;
- más decimales que la moneda;
- importe mayor que 999.999.999;
- la misma persona como quien paga y quien recibe;
- fecha inválida;
- campos desconocidos, incluida `currency`.

## Reglas transversales

- **Permisos (FR-020)**: quien no es miembro recibe `404 not_found` en todos los endpoints.
- **Cuenta Cerrada (FR-019)**: `POST` y `DELETE` responden `409 account_closed`, también si la
  Cuenta se cerró mientras corría la transacción (`guard_money_write`). Las lecturas siguen
  disponibles.
- **Participantes (FR-022)**: las dos puntas tienen que ser participantes activos de esa Cuenta,
  vinculados o no. Si no, `422 invalid_participant`.
- **Importe libre (FR-014)**: no se valida contra la deuda ni contra la sugerencia vigente
  (research R8).
- **Idempotencia (FR-018)**: `clientRequestId` es obligatorio en el `POST`.
- **Auditoría (FR-021)**: `settlement.created` y `settlement.deleted` se registran en la misma
  transacción ([data-model.md](../data-model.md)).
- **Logs de aplicación (Principio VI)**: no incluyen importes ni nombres.
- **Códigos de error**: no hay nuevos (research R10).
