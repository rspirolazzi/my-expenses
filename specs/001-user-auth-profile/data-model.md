# Data Model: Autenticación y Perfil de Usuario

Base: MongoDB 8.0. Colecciones en plural `snake_case`, campos en `camelCase` (constitución). Todas
las fechas en UTC. Los emails se guardan normalizados (`trim` + minúsculas, FR-015).

## `users`

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | Requerido, normalizado, **índice único** |
| `firstName` | string \| null | Opcional, 1–60 caracteres sin contar espacios de los extremos (FR-016) |
| `lastName` | string \| null | Opcional, 1–60 caracteres sin contar espacios de los extremos |
| `authProviders` | array de `"google"` \| `"email"` | Al menos uno; sin repetidos (FR-010) |
| `googleSubject` | string \| null | `sub` del ID token de Google; **índice único parcial** (solo si existe) |
| `passwordHash` | string \| null | Argon2id; `null` si nunca definió contraseña |
| _(`hasPasswordSet`)_ | bool | **No se guarda**: se calcula como `passwordHash != null` al armar `UserResponse` |
| `pendingEmail` | string \| null | Email nuevo en proceso de verificación (FR-018) |
| `preferences.language` | `"es"` \| `"en"` | Default `"es"` (FR-019) |
| `preferences.defaultCurrency` | string (ISO 4217) \| null | `null` hasta el onboarding (FR-020a); validado con pycountry |
| `preferences.theme` | `"light"` \| `"dark"` \| `"system"` | Default `"system"` (FR-021) |
| `createdAt` | date | |
| `updatedAt` | date | |

Reglas:

- El nombre visible es `firstName + lastName`; si ambos son `null`, los clientes muestran `email`
  (FR-017). No se guarda un campo derivado.
- `authProviders` incluye `"email"` solo si `passwordHash != null`. El login por código está
  disponible para cualquier usuario, porque todos tienen email verificado.
- Un usuario con `preferences.defaultCurrency = null` puede autenticarse, pero los clientes lo
  envían al onboarding antes del Dashboard.

## `pending_registrations`

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | Normalizado, **índice único** (un registro nuevo reemplaza al anterior del mismo email) |
| `passwordHash` | string | Argon2id |
| `firstName` / `lastName` | string \| null | Opcionales |
| `language` | `"es"` \| `"en"` | Idioma con el que se registró (para el email) |
| `createdAt` | date | |
| `expiresAt` | date | `createdAt + 24 h`; **índice TTL** |

Transición: al verificar el código `verify_email`, el documento se convierte en un `users` (dentro
de una transacción) y se elimina.

## `verification_codes`

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | Normalizado (para `change_email`, el email **nuevo**) |
| `userId` | ObjectId \| null | `null` para `verify_email` (todavía no existe el usuario) |
| `purpose` | `"verify_email"` \| `"login"` \| `"password_reset"` \| `"change_email"` | |
| `codeHash` | string | HMAC-SHA256 del código de 6 dígitos |
| `attempts` | int | Máximo 5; al llegar a 5 el código queda inválido |
| `consumedAt` | date \| null | Se marca al usarse; un código consumido no vuelve a servir |
| `invalidatedAt` | date \| null | Se marca al pedir otro código del mismo propósito o si falla el envío |
| `expiresAt` | date | `createdAt + 15 min` (FR-003, FR-005) |
| `createdAt` | date | **Índice TTL** de 1 h (limpieza) |

Índices: `{ email: 1, purpose: 1, createdAt: -1 }`.

Validez: un código es válido solo si `consumedAt` e `invalidatedAt` son `null`,
`expiresAt > ahora` y `attempts < 5`. Los límites de reenvío no se calculan sobre esta colección,
sino sobre `auth_attempts`.

## `auth_attempts`

Registra pedidos de email y fallos de contraseña por email, **exista o no el usuario**, para que los
límites y el bloqueo no revelen qué emails están registrados (FR-008, R6).

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `emailHash` | string | HMAC-SHA256 del email normalizado con `CODE_HASH_SECRET`; nunca el email en claro |
| `type` | `"email_request"` \| `"password_failure"` \| `"password_lockout"` | |
| `purpose` | `"register"` \| `"login"` \| `"password_reset"` \| `"change_email"` \| null | Solo para `email_request`. `register` cubre el código `verify_email` y el email "ya tenés una cuenta" |
| `createdAt` | date | **Índice TTL** de 1 h |

Índice: `{ emailHash: 1, type: 1, purpose: 1, createdAt: -1 }`.

Reglas (edge cases):

- **Límite de envíos**: antes de enviar, si hay un `email_request` del mismo `emailHash` y
  `purpose` en el último minuto, o 5 en la última hora, se responde `429` con
  `retryAfterSeconds`. Si no, se inserta el pedido, se envíe o no un email. Si el envío falla, el
  pedido se borra.
- **Bloqueo de contraseña**: cada login con contraseña fallido inserta un `password_failure`. Al
  llegar a 10 en los últimos 15 minutos se inserta un `password_lockout`. Mientras haya un
  `password_lockout` de menos de 15 minutos, el login con contraseña responde `423` con
  `retryAfterSeconds = createdAt + 15 min - ahora`, sin verificar la contraseña ni sumar fallos. Un
  login exitoso, o un cambio de contraseña, borra los `password_failure` de ese `emailHash`.

## `refresh_tokens`

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | Índice |
| `familyId` | string (UUID) | Igual para todos los tokens de una misma sesión |
| `tokenHash` | string | SHA-256 del token opaco; **índice único** |
| `client` | `"web"` \| `"mobile"` | Informativo |
| `createdAt` | date | |
| `expiresAt` | date | `createdAt + 30 días` (FR-013); **índice TTL**. Cada uso rota el token y el nuevo vence a los 30 días, así que el vencimiento es deslizante |
| `rotatedAt` | date \| null | Cuando se usó para emitir el siguiente token |
| `revokedAt` | date \| null | Logout, cambio de contraseña o detección de reuso |

Estados de un refresh token: `active` → `rotated` (se usó) | `revoked` | expirado (TTL).

- Presentar un token `rotated` revoca todos los tokens de su `familyId`.
- Cambiar o definir la contraseña revoca todas las familias del usuario salvo la de la sesión
  actual (FR-006).

## `audit_logs` (solo inserción)

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | |
| `actorUserId` | ObjectId \| null | `null` si la acción es anónima (por ejemplo, un registro) |
| `action` | string | `user.registered`, `user.email_verified`, `user.login_succeeded`, `user.login_failed`, `user.login_locked`, `user.google_linked`, `user.password_set`, `user.password_reset`, `user.email_change_requested`, `user.email_changed`, `user.profile_updated`, `user.logged_out` |
| `entityType` | `"user"` | En features siguientes: `account`, `expense`, `settlement` |
| `entityId` | ObjectId \| null | |
| `changes` | object | `{ field: { before, after } }`, sin contraseñas, hashes, códigos ni tokens |
| `metadata` | object | `client` (`web` \| `mobile`) y método (`google` \| `password` \| `code`) |
| `createdAt` | date | Índices `{ entityType: 1, entityId: 1, createdAt: -1 }` y `{ actorUserId: 1, createdAt: -1 }` |

El código de la aplicación no expone update ni delete sobre `audit_logs` (Principio IV). Los
eventos que cambian un `users` se insertan en la misma transacción. `login_failed` se inserta solo,
sin transacción.
