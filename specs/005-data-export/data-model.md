# Data Model: Exportar datos

Esta feature **no agrega colecciones ni cambia esquemas**. Lee `users`, `accounts`, `expenses` y
`settlements` tal como quedaron en las features 001 a 004, y escribe un registro nuevo en
`audit_logs` por exportación. Lo que sigue es el modelo del archivo exportado, que se arma en
memoria ([research.md](research.md) R4) y no se guarda.

## Entidades persistidas que cambian

### Audit Log Entry (`audit_logs`), acciones nuevas

| Acción | `entityType` | `entityId` | `accountId` | `metadata` |
|---|---|---|---|---|
| `account.exported` | `account` | id de la Cuenta | id de la Cuenta | `{format: "csv" \| "json"}` |
| `user.data_exported` | `user` | id del usuario | `null` | `{format: "csv" \| "json", accountCount: int}` |

- `actorUserId` es quien exporta; `createdAt` es la fecha y hora (FR-015).
- `changes` va vacío: nunca se copian datos exportados.
- Se escribe solo si el archivo se generó bien ([research.md](research.md) R10).

## Modelo del archivo exportado

### AccountExport (una Cuenta)

Se arma con una función pura a partir de la Cuenta, sus gastos activos y sus reembolsos activos,
leídos en la misma sesión snapshot ([research.md](research.md) R3).

| Campo | Origen | Reglas |
|---|---|---|
| `id` | `accounts._id` | Texto. Sirve para relacionar tablas |
| `name`, `description` | Cuenta | `description` puede ser `null` |
| `currency`, `currencyDecimals` | Cuenta, `currency_decimals` | |
| `isClosed`, `closedAt` | Cuenta | `closedAt` en UTC con `Z` o `null` |
| `participants[]` | `accounts.participants` en su orden | Activos y quitados |
| `expenses[]` | `expenses` con `isDeleted: false` | Orden: `date` desc, `createdAt` desc, `_id` desc (FR-005) |
| `settlements[]` | `settlements` con `isDeleted: false` | Mismo orden |
| `balances[]` | `compute_balances` | Solo participantes activos, en el orden de la Cuenta; suman 0 |
| `suggestions[]` | `suggest_transfers` | Las mismas que muestra la pestaña Saldos |
| `pendingExpenses` | `compute_balances` | Cantidad de gastos pendientes de asignación |

Campos de la Cuenta que **no** se copian: `ownerId`, `inviteCode`, `icon`, `isDeleted`,
`createdAt`, `updatedAt` y, dentro de cada participante, `userId`, `nameKey`, `joinedAt` y
`linkedAt` (FR-013, [research.md](research.md) R9).

### Participant

| Campo | Reglas |
|---|---|
| `id` | id interno del participante (no es un usuario) |
| `name` | Nombre visible, también el de un participante quitado |
| `isRemoved` | `removedAt != null` |

### Expense

| Campo | Reglas |
|---|---|
| `id` | Texto |
| `date` | `AAAA-MM-DD` (FR-009) |
| `title`, `description` | Texto; `description` puede ser `null` |
| `category`, `categoryLabel` | Código estable (`food`) y nombre en el idioma del usuario |
| `amount`, `currency` | Texto decimal con punto y los decimales de la moneda (`"90.00"`, `"1500"` en JPY) |
| `paidBy` | `{id, name}` o `null` si quedó sin pagador |
| `isPending` | Mismo criterio que `is_pending` de la feature 003 |
| `shares[]` | `{participant: {id, name}, amount}` con `split_equal` en el orden de la Cuenta; suman `amount` |

### Settlement

| Campo | Reglas |
|---|---|
| `id`, `date` | `date` en `AAAA-MM-DD` |
| `from`, `to` | `{id, name}` |
| `amount`, `currency` | Como en Expense |
| `isExcluded` | `true` si `from` o `to` es un participante quitado (igual que la feature 004) |

### Balance y Suggestion

| Entidad | Campos |
|---|---|
| Balance | `participant: {id, name}`, `amount` (con signo: positivo le deben, negativo debe), `currency` |
| Suggestion | `from: {id, name}`, `to: {id, name}`, `amount`, `currency` |

### PersonalExport (todos mis datos)

| Campo | Origen | Reglas |
|---|---|---|
| `profile.firstName`, `profile.lastName` | `users` | Pueden ser `null` |
| `profile.email` | `users.email` | El único email que aparece en cualquier exportación |
| `profile.language`, `profile.defaultCurrency`, `profile.theme` | `users.preferences` | |
| `accounts[]` | Un `AccountExport` por cada Cuenta de `list_for_member` | Sin Cuentas abandonadas ni dadas de baja (FR-007); ordenadas por nombre |

Del usuario no se copian `passwordHash`, `authProviders`, `pendingEmail`, ids de Google, tokens ni
fechas internas.

### Envoltorio común (JSON)

| Campo | Reglas |
|---|---|
| `formatVersion` | `1` |
| `exportedAt` | UTC con `Z` (FR-009) |
| `language` | `es` o `en`, el que se usó para encabezados y etiquetas |
| `scope` | `account` o `all` |
| `account` | Solo si `scope = account` |
| `profile`, `accounts` | Solo si `scope = all` |

## Tablas CSV

Cada tabla es un CSV dentro del ZIP ([research.md](research.md) R5 y R7). Los encabezados se
traducen; acá figuran en inglés con la clave interna de la etiqueta. Las columnas `*_id` permiten
unir tablas.

| Archivo (es / en) | Una fila por | Columnas |
|---|---|---|
| `cuenta.csv` / `account.csv` | La Cuenta (1 fila) | Account ID, Name, Description, Currency, Closed, Closed at, Exported at, Pending expenses |
| `participantes.csv` / `participants.csv` | Participante | Participant ID, Name, Removed |
| `gastos.csv` / `expenses.csv` | Gasto | Expense ID, Date, Title, Description, Category, Amount, Currency, Paid by, Participants (nombres separados por `; `, solo para leer a simple vista; la relación exacta está en `partes.csv`), Pending |
| `partes.csv` / `shares.csv` | Parte de un gasto | Expense ID, Date, Title, Participant ID, Participant, Share, Currency |
| `reembolsos.csv` / `settlements.csv` | Reembolso | Settlement ID, Date, From, To, Amount, Currency, Excluded |
| `saldos.csv` / `balances.csv` | Participante activo | Participant ID, Participant, Balance, Currency |
| `sugerencias.csv` / `suggestions.csv` | Sugerencia | From, To, Amount, Currency |
| `perfil.csv` / `profile.csv` | El usuario (1 fila, solo en "todos mis datos") | First name, Last name, Email, Language, Default currency, Theme, Exported at |

Valores traducidos: sí/no ("Sí"/"No", "Yes"/"No"), categoría, idioma ("Español"/"English") y tema
("Claro", "Oscuro", "Sistema" / "Light", "Dark", "System").

## Invariantes (verificadas por tests)

1. Para cada gasto, la suma de `shares[].amount` es igual a `amount` (SC-001).
2. La suma de `balances[].amount` de cada Cuenta es exactamente 0 (SC-001).
3. Los saldos y las sugerencias son iguales a los de `GET .../balances` en el mismo momento.
4. Ningún archivo contiene emails distintos del propio, ids de usuario, `inviteCode` ni
   `clientRequestId` (SC-007).
5. Un valor escrito por un usuario (nombres de Cuenta y de participantes, conceptos, descripciones,
   nombre y apellido del perfil) que empieza con `=`, `+`, `-`, `@`, tab o retorno de carro sale
   con `'` adelante en cualquier tabla CSV, y sin cambios en JSON ([research.md](research.md) R6).
6. CSV y JSON de la misma exportación tienen las mismas filas.
