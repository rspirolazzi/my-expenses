# API Contract: Data Export (`/api/v1` y BFF de Web)

Este documento es la referencia funcional. La fuente ejecutable es el OpenAPI de FastAPI
(`/api/v1/openapi.json`). Se mantienen las convenciones de las features 001 a 004:

- `Authorization: Bearer <accessToken>`.
- Errores JSON con la forma `{ error: { code, message } }`, con `message` según `Accept-Language`.
- `Money` es texto decimal con punto y exactamente `currencyDecimals` decimales.

El idioma del archivo (encabezados, nombres de tablas y valores traducibles) es el de
`Accept-Language`, que los clientes ya mandan con el idioma del usuario. Solo se aceptan `es` y
`en`; cualquier otro valor usa `es`.

## Backend

| Método y ruta | Quién | Query | Response | Errores |
|---|---|---|---|---|
| `GET /accounts/{account_id}/export` | Miembro, Cuenta abierta o Cerrada | `format=csv\|json` (obligatorio) | `200` archivo | `401 unauthorized`, `404 not_found`, `422 validation_error` |
| `GET /users/me/export` | Usuario autenticado | `format=csv\|json` (obligatorio) | `200` archivo | `401 unauthorized`, `422 validation_error` |

- Quien no es miembro, o una Cuenta dada de baja o inexistente, recibe `404 not_found` igual que en
  el resto de la API (FR-014). No se registra auditoría en ese caso.
- `format` con otro valor o ausente: `422 validation_error`.
- Cada respuesta `200` registra una entrada de auditoría ([data-model.md](../data-model.md)). Si la
  auditoría falla, la respuesta es `500 internal_error` y no hay archivo.

### Headers de la respuesta `200`

| Header | Valor |
|---|---|
| `Content-Type` | `application/zip` (csv) o `application/json; charset=utf-8` (json) |
| `Content-Disposition` | `attachment; filename="<ascii>"; filename*=UTF-8''<utf8 codificado>` |
| `Cache-Control` | `no-store` |

Nombres de archivo ([research.md](../research.md) R7), con la fecha UTC del día de exportación:

| Alcance | es | en |
|---|---|---|
| Una Cuenta | `chepagame_<slug>_<AAAA-MM-DD>.zip\|json` | `chepagame_<slug>_<AAAA-MM-DD>.zip\|json` |
| Todo | `chepagame_<AAAA-MM-DD>.zip\|json` | `chepagame_<AAAA-MM-DD>.zip\|json` |

`<slug>` es el nombre de la Cuenta sin acentos, en minúsculas, con `-` en lugar de espacios y
símbolos, y como máximo 40 caracteres (`cuenta` / `account` si queda vacío).

### Cuerpo JSON (`format=json`)

```text
ExportDocument   { formatVersion: 1, exportedAt: "2026-11-12T14:03:00Z", language: "es" | "en",
                   scope: "account" | "all",
                   account?: AccountExport,                  # scope = account
                   profile?: ProfileExport, accounts?: AccountExport[] }   # scope = all
ProfileExport    { firstName, lastName, email, language, defaultCurrency, theme }
AccountExport    { id, name, description, currency, currencyDecimals: int, isClosed: bool,
                   closedAt: datetime | null, pendingExpenses: int,
                   participants: { id, name, isRemoved: bool }[],
                   expenses: ExpenseExport[], settlements: SettlementExport[],
                   balances: { participant: ParticipantRef, amount: Money, currency }[],
                   suggestions: { from: ParticipantRef, to: ParticipantRef, amount: Money,
                                  currency }[] }
ExpenseExport    { id, date: "YYYY-MM-DD", title, description, category, categoryLabel,
                   amount: Money, currency, paidBy: ParticipantRef | null, isPending: bool,
                   shares: { participant: ParticipantRef, amount: Money }[] }
SettlementExport { id, date: "YYYY-MM-DD", from: ParticipantRef, to: ParticipantRef,
                   amount: Money, currency, isExcluded: bool }
ParticipantRef   { id, name }
```

- Las claves no cambian con el idioma; solo `categoryLabel` va traducido.
- Ningún campo contiene emails de otros usuarios, ids de usuario, códigos de invitación ni tokens.

### Cuerpo ZIP (`format=csv`)

Tablas y columnas en [data-model.md](../data-model.md#tablas-csv).

```text
# Una Cuenta (es)                 # Todos mis datos (es)
cuenta.csv                        perfil.csv
participantes.csv                 viaje-a-bariloche_a1b2c3/
gastos.csv                            cuenta.csv
partes.csv                            participantes.csv
reembolsos.csv                        ... (las siete tablas)
saldos.csv                        departamento_d4e5f6/
sugerencias.csv                       ...
```

Cada CSV: UTF-8 con BOM, `,`, `\r\n`, comillas cuando hace falta, encabezados en la primera fila,
importes con punto decimal y textos libres protegidos contra fórmulas
([research.md](../research.md) R5 y R6).

## BFF de Web (Next.js Route Handlers)

| Método y ruta | Llama a | Response |
|---|---|---|
| `POST /api/exports/accounts/{accountId}?format=csv\|json` | `GET /api/v1/accounts/{accountId}/export` | El cuerpo y los headers `Content-Type` y `Content-Disposition` del backend, con `Cache-Control: no-store` |
| `POST /api/exports/me?format=csv\|json` | `GET /api/v1/users/me/export` | Igual |

- Sin sesión: `401` con `{ error: { code: "unauthorized" } }`.
- Errores del backend: el mismo status y el mismo cuerpo JSON de error.
- El token del backend se lee de la sesión en el servidor y nunca llega al navegador.

## Mobile

Sin endpoints propios: `requestFile` llama directo a los dos endpoints del backend con el token y
el idioma de la App ([research.md](../research.md) R13).
