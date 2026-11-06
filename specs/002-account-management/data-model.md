# Data Model: Cuentas, Participantes de Texto Libre e Invitaciones

Base: MongoDB 8.0, mismas convenciones que la feature 001 (colecciones plural `snake_case`, campos
`camelCase`, fechas en UTC). Se agrega la colección `accounts`; `audit_logs` se reutiliza.

## `accounts`

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | Requerido; 1–80 caracteres sin contar espacios de los extremos |
| `description` | string \| null | Opcional; hasta 500 caracteres |
| `icon` | enum | Uno de `group`, `home`, `car`, `hotel`, `beach`, `food`, `money`, `travel`, `party`, `shopping`, `work`, `sports`; default `group` |
| `currency` | string (ISO 4217) | Requerido, validado con pycountry; **inmutable** después del alta (Principio III) |
| `ownerId` | ObjectId | Usuario que creó la Cuenta (Owner); inmutable |
| `participants` | array de `Participant` | Al menos un participante activo; hasta 50 activos |
| `inviteCode` | string | 22 caracteres base64url (128 bits); **índice único** |
| `isClosed` | bool | Default `false`; una vez `true` no vuelve a `false` |
| `closedAt` | date \| null | |
| `isDeleted` | bool | Default `false`; baja lógica solo por el Owner |
| `deletedAt` | date \| null | |
| `createdAt` | date | |
| `updatedAt` | date | |

Índices:

- `{ inviteCode: 1 }` único.
- `{ "participants.userId": 1, isDeleted: 1, updatedAt: -1 }` para "Mis Cuentas".

### `Participant` (embebido)

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string (UUID) | Estable; lo referenciarán los gastos |
| `name` | string | 1–40 caracteres, recortado |
| `nameKey` | string | `name` recortado y en minúsculas; único entre los participantes **activos** de la Cuenta |
| `userId` | ObjectId \| null | Usuario vinculado; único entre los participantes activos de la Cuenta |
| `joinedAt` | date | Alta del participante |
| `linkedAt` | date \| null | Última vinculación con un usuario |
| `removedAt` | date \| null | Baja lógica del participante (R3) |

### Reglas derivadas

- **Miembro**: usuario con un participante activo (`removedAt = null`) cuyo `userId` es el suyo.
- **Owner**: `ownerId`. Su participante siempre está activo y vinculado a él: no se puede quitar ni
  desvincular, y el Owner no puede salir.
- **Visibilidad**: una Cuenta es visible para un usuario solo si es miembro y `isDeleted = false`.
  Para cualquier otro, la API responde `404`.
- **Solo lectura**: con `isClosed = true`, ninguna operación de escritura está permitida (edición,
  participantes, salida, regeneración, vinculación). La consulta sí. La única excepción es la baja:
  el Owner puede dar de baja una Cuenta Cerrada, porque no modifica sus datos, solo la oculta.

### Transiciones de estado

```text
Cuenta:        abierta ──cerrar (Owner)──▶ cerrada                      (definitivo)
               abierta | cerrada ──dar de baja (Owner)──▶ dada de baja (definitivo, invisible)

Participante:  libre (userId null) ──vincular──▶ vinculado
               vinculado ──salir (miembro, no Owner)──▶ libre
               libre | vinculado (no Owner) ──quitar──▶ quitado (removedAt, definitivo)
```

## `audit_logs` (existente)

Se reutiliza con `entityType: "account"` y `entityId` = `_id` de la Cuenta. Acciones nuevas:

| Acción | `changes` |
|---|---|
| `account.created` | `name`, `currency`, `icon`, participantes iniciales (nombres) |
| `account.updated` | `{ campo: { before, after } }` de `name`, `description`, `icon` |
| `account.participant_added` | `{ participant: { after: { id, name } } }` |
| `account.participant_renamed` | `{ participant.<id>.name: { before, after } }` |
| `account.participant_removed` | `{ participant: { before: { id, name, userId } } }` |
| `account.member_joined` | `{ participant.<id>.userId: { before: null, after } }` y si se creó el participante |
| `account.member_left` | `{ participant.<id>.userId: { before, after: null } }` |
| `account.invite_regenerated` | sin el código (es un secreto de acceso): `{ inviteCode: "regenerated" }` |
| `account.closed` | `{ isClosed: { before: false, after: true } }` |
| `account.deleted` | `{ isDeleted: { before: false, after: true } }` |

`metadata` incluye `client` (`web` \| `mobile`) como en la feature 001. Cada entrada se inserta en la
misma transacción que el cambio.
