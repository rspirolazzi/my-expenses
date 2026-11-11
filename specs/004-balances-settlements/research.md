# Research: Saldos y Reembolsos

Decisiones técnicas de la feature 004. Parten de lo construido en las features 001 a 003: importes
en unidades menores enteras (`app/core/money.py`), `split_equal` con el orden de participantes de
la Cuenta, guard de escritura sobre la Cuenta (`accounts.guard_expense_write`), auditoría en la
misma transacción y paginación por clave.

## R1. Cálculo de saldos: en Python, a partir de una proyección mínima

- **Decision**: una función pura `compute_balances(account, expenses, settlements)` en
  `app/services/balance_math.py` recibe la Cuenta (orden y estado de los participantes), los gastos
  activos proyectados a `amountMinor`, `paidById` y `participantIds`, y los reembolsos activos
  proyectados a `fromParticipantId`, `toParticipantId` y `amountMinor`. Devuelve un `dict` de
  participante activo a saldo en unidades menores y la cantidad de gastos pendientes. Las partes
  salen de `split_equal`, la misma función que usa el detalle del gasto (FR-003).
- **Rationale**: la regla de centavos depende del orden de participantes de la Cuenta y no se
  puede expresar de forma clara en una agregación de MongoDB. Con 500 gastos y 100 reembolsos la
  proyección pesa unos pocos KB y el cálculo en Python lleva menos de 10 ms. Una función pura se
  prueba sin base de datos, que es lo que exige el Principio VII.
- **Alternatives considered**: una agregación `$group` en MongoDB (no reproduce el reparto de
  centavos sin duplicar la regla); guardar saldos materializados y actualizarlos en cada escritura
  (más código y más riesgo de desincronizar; la spec dice que no se guardan).

## R2. Qué cuenta en los saldos

- **Decision**:
  - Cuenta un gasto con `isDeleted = false`, `paidById` no nulo y `participantIds` no vacío. Los
    demás gastos activos se cuentan como pendientes.
  - Cuenta un reembolso con `isDeleted = false` cuando quien paga y quien recibe son participantes
    activos (`removedAt = null`). Si uno de los dos fue quitado, no cuenta, pero sigue en la lista
    con la marca `isExcluded`.
  - Los participantes desvinculados siguen activos y cuentan.
- **Rationale**: es lo que piden FR-004 y FR-005. La suma sigue dando cero: en la feature 003, la
  remoción ya saca al participante de todos los gastos, así que su aporte por gastos es cero, y sus
  reembolsos se excluyen completos, es decir, las dos puntas.
- **Invariante probado**: `sum(balances.values()) == 0` en cada test unitario y en un test de
  propiedades con datos aleatorios.

## R3. Reembolsos sugeridos: greedy determinístico con pares exactos primero

- **Decision**: `suggest_transfers(balances, order)` en `balance_math.py`:
  1. Separa a quienes deben (saldo < 0) de quienes cobran (saldo > 0) y descarta los saldos en
     cero.
  2. Primero empareja deudores y acreedores con el mismo importe absoluto. Recorre en el orden de
     la Cuenta y cada par se salda con una transferencia.
  3. Con el resto, toma siempre el mayor deudor y el mayor acreedor, transfiere el menor de los
     dos importes y repite. Los empates se resuelven por el orden de participantes de la Cuenta.
- **Rationale**: en cada paso al menos uno de los dos queda en cero, así que nunca hay más de N−1
  transferencias (FR-010). Emparejar primero los importes iguales evita transferencias de más en
  el caso más común. El resultado depende solo de los saldos y del orden de la Cuenta (FR-011).
  Encontrar el mínimo exacto es NP-difícil (se reduce a partición de subconjuntos), así que la spec
  no lo exige.
- **Alternatives considered**: búsqueda exacta por subconjuntos de suma cero (exponencial con 50
  participantes); greedy sin el paso de pares exactos (a veces da una transferencia de más).

## R4. Colección `settlements` y concurrencia

- **Decision**:
  - Colección nueva `settlements`. Los importes se guardan como enteros y la fecha como un día
    `YYYY-MM-DD`, igual que los gastos.
  - El alta es idempotente con `clientRequestId` (índice único parcial).
  - La baja es lógica, con `isDeleted`, `deletedAt` y `deletedBy`.
  - No hay `version`: los reembolsos no se editan, y la única carrera posible es eliminar dos
    veces. El `update_one` filtra por `isDeleted: false`, y si no coincide ningún documento
    responde `404`.
  - El alta y la baja hacen el mismo update condicional sobre la Cuenta que los gastos (R10 de la
    feature 003), así chocan con la remoción de un participante o con el cierre de la Cuenta.
    `guard_expense_write` pasa a llamarse `guard_money_write`. Para la baja se llama sin
    participantes, porque solo exige que la Cuenta esté abierta.
- **Rationale**: un reembolso con un participante recién quitado, o en una Cuenta recién cerrada,
  no puede colarse (FR-019, FR-022). Reusar el guard evita un mecanismo nuevo.
- **Alternatives considered**: `version` como en los gastos (innecesario sin edición); validar
  fuera de la transacción (se cuela en una carrera).

## R5. API: una lectura para la pestaña "Saldos"

- **Decision**:
  - `GET /api/v1/accounts/{account_id}/balances` devuelve en una sola respuesta los saldos, las
    sugerencias y `pendingExpenses`.
  - `GET /api/v1/accounts/{account_id}/settlements` pagina de a 50 por (`date` desc,
    `createdAt` desc, `_id` desc), con el mismo cursor base64url de los gastos.
  - La pestaña hace las dos llamadas en paralelo.
- **Rationale**: los saldos y las sugerencias son una misma foto y no se deben mezclar estados. La
  lista de reembolsos crece con el tiempo, así que se pagina de a 50 como la de gastos (decisión
  por defecto registrada al cerrar el clarify).
- **Alternatives considered**: un solo endpoint con todo (la lista sin paginar crece sin límite);
  calcular las sugerencias en el cliente (duplicaría el algoritmo en Web y Mobile y podría dar
  resultados distintos entre plataformas).

## R6. Resumen del panel principal: `myBalance` en `AccountSummary`

- **Decision**:
  - `GET /api/v1/accounts` agrega a cada `AccountSummary` los campos `myBalance` (Money) y
    `currencyDecimals`.
  - El servicio lee en dos consultas (con `$in`) los gastos y los reembolsos activos de todas las
    Cuentas del usuario, con la proyección de R1, y aplica `compute_balances` por Cuenta.
  - Web y Mobile calculan los totales por moneda con un helper puro, `totalsByCurrency`, que pasa
    a unidades menores con `BigInt`. Los totales incluyen las Cuentas Cerradas (clarificación).
- **Rationale**: el panel ya pide la lista completa de Cuentas, así que no hace falta otra
  llamada. Sumar con enteros en el cliente es exacto y fácil de probar. El listado "Mis Cuentas"
  también muestra el saldo, sin costo extra.
- **Alternatives considered**: un endpoint aparte con los totales (una llamada más y otra forma
  de los mismos datos); saldos cacheados en la Cuenta (ver R1).
- **Rendimiento**: con 20 Cuentas de 500 gastos se proyectan unos 10.000 documentos chicos. Se
  prueba con un test de rendimiento: p95 < 500 ms.

## R7. Navegación por pestañas sin dependencias nuevas

- **Decision**:
  - **Web**: rutas hermanas `/accounts/[accountId]` ("Gastos") y `/accounts/[accountId]/balances`
    ("Saldos"), con un componente `AccountTabs` de enlaces con `aria-current`.
  - **Mobile**: rutas `accounts/[accountId]/index` y `accounts/[accountId]/balances`, con
    `SegmentedButtons` de React Native Paper que cambian de ruta con `router.replace`.
  - En los dos casos el formulario manual está en `.../settlements/new`.
- **Rationale**: cada pestaña tiene su URL (se puede compartir y recargar), reutiliza la carga de
  datos de cada pantalla y no suma una librería de pestañas (Principio VIII).
- **Alternatives considered**: `@react-navigation/material-top-tabs` (dependencia nueva); pestañas
  solo de estado en el cliente (se pierden al recargar).

## R8. "Marcar como pagado" con importe fijo

- **Decision**:
  - El diálogo de confirmación muestra quién paga, a quién, el importe y la fecha de hoy, y no se
    puede editar.
  - Al confirmar, el cliente hace `POST /settlements` con esos datos y un `clientRequestId` nuevo
    por sugerencia confirmada.
  - El servidor no vuelve a validar que el importe coincida con la sugerencia vigente: registra lo
    que el miembro vio y confirmó (caso borde "sugerencia desactualizada").
  - `metadata.source` en la auditoría distingue `suggestion` de `manual`.
- **Rationale**: es lo que se clarificó y lo que pide la spec para las sugerencias
  desactualizadas. La fecha de hoy se calcula en el cliente con su zona horaria, igual que la
  fecha por defecto de los gastos.
- **Alternatives considered**: rechazar si la sugerencia cambió (frustra al usuario y no es un
  error: el pago se hizo).

## R9. Auditoría de reembolsos

- **Decision**:
  - Acciones `settlement.created` y `settlement.deleted`, con `entityType: "settlement"`,
    `accountId` y `metadata.actorParticipantId`. `settlement.created` también guarda
    `metadata.source`.
  - `changes` de `settlement.created`: `{ campo: { after } }` de `date`, `fromParticipantId`,
    `toParticipantId`, `amountMinor` y `currency`.
  - `changes` de `settlement.deleted`: `{ isDeleted: { before: false, after: true } }`.
  - La entrada de auditoría se inserta en la misma transacción que el cambio.
- **Rationale**: es el mismo patrón que `expense.*` (Principio IV, FR-021). No hay pantalla de
  historial (está fuera de alcance).

## R10. Errores

- **Decision**: sin códigos nuevos.
  - Mismo participante en las dos puntas: `422 validation_error`.
  - Participante inexistente, quitado o de otra Cuenta: `422 invalid_participant`.
  - Cuenta Cerrada: `409 account_closed`.
  - Reembolso inexistente o ya eliminado: `404 not_found`.
  - Quien no es miembro: `404 not_found`.
- **Rationale**: los códigos ya existen y ya están traducidos en Web y Mobile.
