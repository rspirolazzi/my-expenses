# API Contract: Accounts & Invitations (`/api/v1`)

Referencia funcional; la fuente ejecutable es el OpenAPI de FastAPI (`/api/v1/openapi.json`), del que
Web y Mobile regeneran sus tipos. Mismas convenciones que la feature 001: JSON en `camelCase`,
`Authorization: Bearer <accessToken>` en todos los endpoints de este contrato, `X-Client` opcional y
errores `{ error: { code, message, retryAfterSeconds? } }` con `message` según `Accept-Language`.

## Tipos

```text
AccountIcon        "group" | "home" | "car" | "hotel" | "beach" | "food" | "money" | "travel"
                   | "party" | "shopping" | "work" | "sports"
ParticipantResponse { id, name, isLinked: bool, isMe: bool, isOwner: bool }
AccountSummary     { id, name, icon, currency, isClosed, isOwner: bool,
                     participantCount: int, updatedAt }
AccountResponse    { id, name, description: string|null, icon, currency, isClosed,
                     closedAt: datetime|null, isOwner: bool, myParticipantId: string,
                     participants: ParticipantResponse[], inviteCode: string,
                     createdAt, updatedAt }
InvitationPreview  { accountName, icon, currency, alreadyMember: bool,
                     accountId: string|null,          # solo si alreadyMember
                     availableParticipants: { id, name }[] }
```

- `participants` solo incluye participantes activos. `isLinked` indica si tiene usuario, sin revelar
  cuál.
- `inviteCode` se devuelve a todos los miembros, que pueden compartirlo (FR-008).

## Accounts

| Método y ruta | Quién | Request | Response | Errores |
|---|---|---|---|---|
| `GET /accounts` | Autenticado | — | `200 AccountSummary[]` (Cuentas donde es miembro, no dadas de baja, más recientes primero) | `401` |
| `POST /accounts` | Autenticado | `{ name, description?, icon?, currency, myParticipantName, otherParticipants: string[] }` | `201 AccountResponse` | `422 validation_error` (nombre vacío o > 80, moneda no ISO 4217, participante vacío o > 40, `duplicate_participant_name`, > 50 participantes) |
| `GET /accounts/{account_id}` | Miembro | — | `200 AccountResponse` | `404 not_found` (no existe, dada de baja o no es miembro) |
| `PATCH /accounts/{account_id}` | Miembro | Parcial `{ name?, description?, icon? }`; `description: null` la borra | `200 AccountResponse` | `404`; `409 account_closed`; `422 validation_error` (incluye enviar `currency` o cualquier campo desconocido) |
| `POST /accounts/{account_id}/participants` | Miembro | `{ name }` | `201 AccountResponse` | `404`; `409 account_closed`; `422 duplicate_participant_name`; `422 validation_error` (ya hay 50 participantes activos) |
| `PATCH /accounts/{account_id}/participants/{participant_id}` | Miembro | `{ name }` | `200 AccountResponse` | `404` (Cuenta o participante); `409 account_closed`; `422 duplicate_participant_name` |
| `DELETE /accounts/{account_id}/participants/{participant_id}` | Miembro | — | `200 AccountResponse` (baja lógica; si estaba vinculado, ese usuario deja de ser miembro) | `404`; `409 account_closed`; `409 owner_participant` |
| `POST /accounts/{account_id}/leave` | Miembro no Owner | — | `204` | `404`; `403 owner_cannot_leave`; `409 account_closed` |
| `POST /accounts/{account_id}/invite-code` | Owner | — | `200 AccountResponse` con el `inviteCode` nuevo | `404`; `403 owner_only`; `409 account_closed` |
| `POST /accounts/{account_id}/close` | Owner | — | `200 AccountResponse` (`isClosed: true`) | `404`; `403 owner_only`; `409 account_closed` (ya cerrada) |
| `DELETE /accounts/{account_id}` | Owner | — | `204` (baja lógica; también para una Cuenta Cerrada) | `404`; `403 owner_only` |

## Invitations

| Método y ruta | Quién | Request | Response | Errores |
|---|---|---|---|---|
| `GET /invitations/{code}` | Autenticado | — | `200 InvitationPreview` | `404 invalid_invitation` (inexistente, regenerada, Cuenta Cerrada o dada de baja: mismo cuerpo) |
| `POST /invitations/{code}/accept` | Autenticado | `{ participantId }` o `{ newParticipantName }` (exactamente uno) | `200 AccountResponse` | `404 invalid_invitation`; `409 already_member` (el cliente obtiene el `accountId` de la vista previa); `409 participant_taken`; `422 duplicate_participant_name`; `422 validation_error` (incluye unirse como participante nuevo con 50 activos) |

## Reglas transversales

- **Permisos en el backend (FR-020)**: quien no es miembro recibe siempre `404 not_found`; un miembro
  que intenta una acción de Owner recibe `403`.
- **Cuenta Cerrada (FR-018)**: toda escritura responde `409 account_closed`; la lectura sigue
  disponible. La única excepción es la baja por el Owner.
- **Moneda (FR-003)**: no hay forma de cambiarla después del alta; un `PATCH` con `currency` da
  `422`.
- **Límite de participantes**: como máximo 50 activos por Cuenta, en el alta, al agregar y al
  unirse como participante nuevo.
- **Auditoría (FR-021)**: cada escritura inserta su `audit_logs` en la misma transacción
  ([data-model.md](../data-model.md)).
- **Sin datos sensibles**: los logs de la aplicación no incluyen nombres de Cuentas, participantes ni
  códigos de invitación; la auditoría no guarda el código.
- **Códigos de error nuevos**: `not_found`, `account_closed`, `owner_only`, `owner_cannot_leave`,
  `owner_participant`, `duplicate_participant_name`, `invalid_invitation`, `already_member`,
  `participant_taken`. Web y Mobile los traducen en `es` y `en`.
