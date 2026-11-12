---

description: "Task list for feature 004: Balances and Settlements"
---

# Tasks: Saldos y Reembolsos

**Input**: documentos de diseño en `specs/004-balances-settlements/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: están incluidos. El Principio VII de la constitución exige que el cálculo de saldos, los
reembolsos sugeridos y las reglas de permisos tengan tests escritos antes de implementar, con sus
casos borde obligatorios. También exige al menos un test unitario con Jest por feature en Web y en
Mobile. Los tests de cada fase se escriben primero y tienen que fallar antes de implementar.

**Organización**: las tareas están agrupadas por User Story, para implementar y probar cada una por
separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: la User Story a la que pertenece (US1 a US5).
- Cada tarea indica la ruta exacta del archivo.

## Convenciones

- **Capas**: se extiende el código de la feature 003 con las mismas capas (`schemas` →
  `repositories` → `services` → `api/v1`). En Web se usan Server Actions con `apiFetch`; en Mobile,
  el cliente con refresh.
- **Idioma**:
  - Código, identificadores, colecciones, campos y rutas van en inglés.
  - Los textos visibles salen de los catálogos `es`/`en`: en Web, `web/src/i18n/messages/`; en
    Mobile, `mobile/src/i18n/locales/`.
- **Escrituras sobre `settlements`**:
  - Cada una va con su `audit_logs` en la misma transacción, usando `run_in_transaction`.
  - Cada una pasa por `guard_money_write`.
- **Dinero**:
  - En la base, `amountMinor` es un entero; en la API, un texto decimal.
  - Nunca se usa `float` en Python ni `number` en TypeScript para hacer cuentas con importes. Los
    totales del cliente se calculan con `BigInt`.
- **Permisos**: se reutilizan `require_member` y `require_open` (`404 not_found` para quien no es
  miembro, `409 account_closed` para escribir en una Cuenta Cerrada).
- **Tipos**: se regeneran con `npm run gen:api` cada vez que cambia el contrato.
- **Saldos de prueba**: el ejemplo de la spec (Ana paga 90,00 entre tres → +60,00 / −30,00 /
  −30,00) es el escenario base de los tests.

---

## Phase 1: Setup

**Purpose**: confirmar el punto de partida.

- [X] T001 Confirmar que se trabaja en la rama `004-balances-settlements`, creada desde `003-expense-management`. Verificar que antes de empezar pasan `uv run pytest` en `backend/` y `npm test` en `web/` y en `mobile/`.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: cálculo puro de saldos y sugerencias, modelo de reembolsos, índices, auditoría, guard
compartido y las pestañas de la Cuenta en los clientes.

**⚠️ CRITICAL**: ninguna User Story empieza antes de terminar esta fase.

### Backend

- [X] T002 Escribir tests unitarios de `compute_balances` en `backend/tests/unit/test_balance_math.py`. Se escriben primero y tienen que fallar. Casos:
  - Ejemplo base: +6000 / −3000 / −3000.
  - Centavos no divisibles: 100,00 entre tres. El centavo va al primero según el orden de la Cuenta y la suma da 0.
  - Un solo participante: saldo 0.
  - Pagador que no participa: le deben el total.
  - Gasto con `paidById = None` o con `participantIds = []`: no cuenta y suma 1 a `pending`.
  - Reembolso que cuenta: mueve los dos saldos.
  - Reembolso mayor que la deuda: el signo se invierte.
  - Reembolso con una punta quitada (`removedAt` no nulo): no cuenta.
  - Participante desvinculado (sin `userId`): cuenta.
  - Participante quitado: no aparece en el resultado.
  - Moneda JPY: el cálculo da enteros.
  - Test de propiedades con `random.Random(seed)`: 500 Cuentas con 2 a 10 participantes, gastos y reembolsos aleatorios. La suma siempre es 0.
- [X] T003 Escribir tests unitarios de `suggest_transfers` en `backend/tests/unit/test_balance_math.py`. Se escriben primero y tienen que fallar. Casos:
  - Ejemplo base: Leandro → Ana 3000 y Javier → Ana 3000, en ese orden.
  - Todos en cero: `[]`.
  - Pares exactos primero: {A:+50, B:+30, C:−30, D:−50} da 2 transferencias (C→B 30, D→A 50).
  - Mismo resultado con los saldos en otro orden de entrada.
  - Empates resueltos por el orden de la Cuenta.
  - Ningún importe es 0 ni negativo.
  - Test de propiedades con los saldos aleatorios de T002: aplicar las sugerencias deja todo en 0 y su cantidad es ≤ N−1, con N la cantidad de saldos distintos de cero.
- [X] T004 Crear `backend/app/services/balance_math.py` sin I/O, hasta que pasen T002 y T003. Contenido (research R1–R3):
  - `compute_balances(account, expenses, settlements) -> BalanceResult(balances: dict[str, int], pending: int)`, con los participantes activos en el orden de la Cuenta y usando `money.split_equal`.
  - `suggest_transfers(balances, order) -> list[Transfer(from_id, to_id, amount_minor)]`: pares exactos primero, después greedy mayor deudor → mayor acreedor, con empates por el orden de la Cuenta.
- [X] T005 [P] Crear `backend/app/schemas/settlement.py` según `contracts/api.md`:
  - `SettlementCreate` con `extra="forbid"` y los campos:
    - `fromParticipantId` y `toParticipantId`, obligatorios y distintos entre sí; si son iguales, `validation_error`.
    - `amount: str`, que se valida contra la moneda en el servicio.
    - `date` como `datetime.date`, serializado `YYYY-MM-DD`.
    - `clientRequestId: UUID`.
    - `source: Literal["suggestion","manual"] = "manual"`.
  - `SettlementResponse` con `isExcluded`, y `SettlementPage`.
  - `BalanceEntry`, `SuggestedTransfer` y `AccountBalances`.
  - Se reutiliza `ParticipantRef` de `backend/app/schemas/expense.py`.
- [X] T006 [P] Agregar en `backend/app/db/indexes.py` la colección `settlements` con dos índices:
  - `account_list`: `{accountId: 1, isDeleted: 1, date: -1, createdAt: -1, _id: -1}`.
  - `client_request_unique`: `{accountId: 1, clientRequestId: 1}`, único, con `partialFilterExpression: {clientRequestId: {$type: "string"}}`.
- [X] T007 [P] Extender la auditoría en `backend/app/services/audit_service.py`:
  - `AuditAction` agrega `settlement.created` y `settlement.deleted`.
  - `entityType` acepta `"settlement"`.
  - `metadata.source` se guarda tal cual.
  - El test `backend/tests/unit/test_audit_immutability.py` sigue pasando: no hay `update` ni `delete` sobre `audit_logs`.
- [X] T008 Renombrar `guard_expense_write` a `guard_money_write` en `backend/app/repositories/accounts.py`:
  - El contador de la base sigue siendo `expenseWriteSeq`, sin migración (research R4).
  - Actualizar las llamadas en `backend/app/services/expense_service.py` y en los tests de la 003.
  - Llamarlo sin participantes solo exige que la Cuenta esté abierta.
- [X] T009 Crear `backend/app/repositories/settlements.py`. Todas las funciones aceptan `session` opcional:
  - `new_settlement_document(account, request, amount_minor, user_id)`, con `isDeleted: False`, la `currency` de la Cuenta y `createdAt` en UTC.
  - `insert`, `find_active(account_id, settlement_id)` y `find_by_client_request`.
  - `page(account_id, limit, after)`: paginación por clave sobre `(date, createdAt, _id)` descendentes, solo con `isDeleted: False`. Reutiliza el cursor de los gastos: mover `_encode_cursor` y `_decode_cursor` de `backend/app/services/expense_service.py` a `backend/app/core/cursor.py` como `encode_cursor` y `decode_cursor`, y usarlos desde los dos servicios sin cambiar el formato del cursor.
  - `soft_delete(account_id, settlement_id, user_id, session)`: `update_one` con `isDeleted: False` en el filtro; devuelve si actualizó.
  - `active_for_accounts(account_ids)`: proyección `{accountId, fromParticipantId, toParticipantId, amountMinor}`.
- [X] T010 [P] Agregar `active_for_balances(account_ids)` en `backend/app/repositories/expenses.py`:
  - Proyección `{accountId, amountMinor, paidById, participantIds}`.
  - Solo gastos con `isDeleted: False`, filtrados con `$in`.
- [X] T011 Agregar en `backend/tests/conftest.py` la fábrica `create_settlement(account, by_user, from_participant, to_participant, amount_minor=1000, date=None, deleted=False)`, que inserta el documento directamente para preparar escenarios.

### Web

- [X] T012 Crear `web/src/components/accounts/AccountTabs.tsx`:
  - Enlaces "Gastos" (`/accounts/[accountId]`) y "Saldos" (`/accounts/[accountId]/balances`), con `aria-current="page"` en la activa.
  - Usarlo en `web/src/app/(private)/accounts/[accountId]/page.tsx` y crear `web/src/app/(private)/accounts/[accountId]/balances/page.tsx` con el encabezado de la Cuenta y las pestañas (contenido vacío por ahora).
  - Test en `web/src/__tests__/components/AccountTabs.test.tsx`.
- [X] T013 [P] Agregar en `web/src/i18n/messages/es.json` y `en.json` las claves:
  - `tabs.*`.
  - `balances.*`: te deben, debés, al día, sin deudas, gastos pendientes con plural, sugerencias, nada pendiente, marcar como pagado, diálogo, actualizar.
  - `settlements.*`: lista, vacío, campos, participante quitado, nuevo, eliminar, diálogo con "Continuar"/"Cancelar", ya no existe, validaciones.
  - `dashboard.balances.*`.

### Mobile

- [X] T014 Crear `mobile/src/components/accounts/AccountTabs.tsx`:
  - Usa `SegmentedButtons` de React Native Paper y cambia de pestaña con `router.replace`.
  - Mostrarlo en `mobile/src/screens/expenses/AccountExpensesScreen.tsx`.
  - Crear la ruta `mobile/app/(app)/accounts/[accountId]/balances.tsx` con `mobile/src/screens/balances/AccountBalancesScreen.tsx` (vacía por ahora) y registrarla en `mobile/app/(app)/_layout.tsx`.
  - Regenerar las rutas tipadas con `expo start`.
  - Test en `mobile/src/__tests__/components/accountTabs.test.tsx`.
- [X] T015 [P] Agregar las mismas claves que T013 en `mobile/src/i18n/locales/es.json` y `en.json`, con interpolación con llaves simples y plurales `_one`/`_other`.

**Checkpoint**: el backend tiene el cálculo puro probado, el modelo y la auditoría. Los clientes
tienen las pestañas "Gastos" y "Saldos", con "Saldos" vacía.

---

## Phase 3: User Story 1 - Ver los saldos de la Cuenta (Priority: P1) 🎯 MVP

**Goal**: la pestaña "Saldos" muestra el saldo de cada participante activo, con la fila propia
destacada y el aviso de gastos pendientes.

**Independent Test**: con el ejemplo base, la pestaña muestra Ana +60,00 ("Te deben 60,00"),
Leandro −30,00 y Javier −30,00, en Web y en Mobile (quickstart, escenarios 1 y 2).

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Test de contrato en `backend/tests/contract/test_balances_contract.py`:
  - `GET /api/v1/accounts/{id}/balances` da `200 AccountBalances`: `currency`, `currencyDecimals`, `balances` con `isMe` solo en el participante del usuario, importes como texto, `pendingExpenses` y `suggestions`.
  - Responde `404 not_found` a quien no es miembro, a una Cuenta inexistente y a una dada de baja, siempre con el mismo cuerpo.
- [X] T017 [P] [US1] Test de integración en `backend/tests/integration/test_balances.py`:
  - La suma de `balances` es `"0.00"`.
  - Gasto eliminado: no cuenta.
  - Gasto pendiente por remoción del participante: no cuenta y suma 1 a `pendingExpenses`; al completarlo con `PUT`, vuelve a contar.
  - Cuenta Cerrada: responde igual.
  - Participante desvinculado (miembro que abandonó): conserva su saldo.
  - Participante quitado: no figura y la suma sigue en cero.
  - JPY: importes sin decimales.
  - Gastos y reembolsos de otra Cuenta: no se mezclan.

### Implementation for User Story 1

- [X] T018 [US1] Crear `backend/app/services/balance_service.py` con `get_account_balances(account_id, user_id)`:
  - Exige ser miembro.
  - Lee los gastos y los reembolsos activos de la Cuenta, aplica `compute_balances` y `suggest_transfers`, y arma `AccountBalances`.
  - Los nombres salen de los participantes de la Cuenta y los importes se formatean con `format_amount`.
  - No escribe importes ni nombres en los logs.
- [X] T019 [US1] Crear `backend/app/api/v1/balances.py` con `GET /accounts/{account_id}/balances` e incluir el router en `backend/app/main.py`.
- [X] T020 [US1] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`, y agregar los alias de tipos en `web/src/lib/api/types.ts` y `mobile/src/services/api/types.ts`.
- [X] T021 [P] [US1] Test unitario en `web/src/__tests__/components/BalanceList.test.tsx`. Se escribe primero y tiene que fallar. Casos:
  - Positivo, negativo y cero con `formatMoney` en `es` y en `en`.
  - Fila propia destacada con "Te deben 60,00", "Debés 30,00" o "Estás al día".
  - Aviso "1 gasto pendiente" que enlaza a la pestaña "Gastos".
  - Todos en cero: "No hay deudas".
- [X] T022 [US1] Crear `web/src/lib/balancesServer.ts` (`getBalances`) y `web/src/components/balances/BalanceList.tsx`. Mostrar la lista en `web/src/app/(private)/accounts/[accountId]/balances/page.tsx`, que llama a `notFound()` ante un `404`, con un botón "Actualizar" (`router.refresh()`).
- [X] T023 [P] [US1] Test unitario en `mobile/src/__tests__/screens/balances.test.tsx`. Se escribe primero y tiene que fallar. Mismas reglas que T021, más la recarga al volver a la pantalla (`useFocusEffect`) y con `RefreshControl`.
- [X] T024 [US1] Crear:
  - `mobile/src/services/api/settlements.ts` con `balances`.
  - `mobile/src/components/balances/BalanceList.tsx`.
  - El contenido de `mobile/src/screens/balances/AccountBalancesScreen.tsx`, con `RefreshControl` y `useFocusEffect`.

**Checkpoint**: US1 funciona por su lado: se ven los saldos en Web y en Mobile.

---

## Phase 4: User Story 2 - Reembolsos sugeridos y "Marcar como pagado" (Priority: P1)

**Goal**: la pestaña "Saldos" propone transferencias y cada una se puede marcar como pagada con un
diálogo de importe fijo.

**Independent Test**: con el ejemplo base se ven dos sugerencias. Al marcar Leandro → Ana como
pagada, Leandro queda en 0,00 y queda una sola sugerencia (quickstart, escenario 3).

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Test de contrato en `backend/tests/contract/test_settlements_create_contract.py`. `POST /api/v1/accounts/{id}/settlements`:
  - Da `201 SettlementResponse` con `amount` como texto e `isExcluded: false`.
  - Da `422 validation_error` con: importe `"0"`, `"-1"`, `"10.555"` o `"1000000000"` (texto, para probar el máximo y no el tipo); importe como número (`10`); la misma persona en las dos puntas; fecha inválida; `currency` en el cuerpo; un campo desconocido; sin `clientRequestId`.
  - Da `422 invalid_participant` con una punta inexistente, quitada o de otra Cuenta.
  - Da `404` a quien no es miembro.
- [X] T026 [P] [US2] Test de integración en `backend/tests/integration/test_settlement_creation.py`:
  - `amountMinor` es entero y `currency` es la de la Cuenta.
  - Un participante desvinculado puede pagar y recibir.
  - Un importe mayor que la deuda se acepta e invierte el saldo.
  - Se registra `settlement.created` con `accountId`, `entityType: "settlement"`, `entityId` igual al id del reembolso, `metadata.actorParticipantId` y `metadata.source: "suggestion"`, en la misma transacción.
  - Reintentar con el mismo `clientRequestId` devuelve el mismo reembolso, sin un segundo documento ni una segunda auditoría.
  - En una Cuenta Cerrada da `409 account_closed`.
  - Carreras con `asyncio.gather`, cada una repetida 20 veces:
    - Alta mientras el Owner cierra la Cuenta: o se crea antes del cierre o da `409 account_closed`.
    - Alta mientras se quita a una de las puntas: o se crea antes (y queda excluido) o da `422 invalid_participant`.
  - Después del alta, `GET .../balances` refleja el cambio y las sugerencias se recalculan.

### Implementation for User Story 2

- [X] T027 [US2] Crear `backend/app/services/settlement_service.py` con `create_settlement(account_id, user_id, request, client)`:
  - Exige ser miembro y que la Cuenta esté abierta.
  - Las dos puntas tienen que ser participantes activos de la Cuenta; si no, `422 invalid_participant`.
  - Convierte el importe con `parse_amount` según la moneda de la Cuenta.
  - Es idempotente por `clientRequestId`: si la clave ya existe, devuelve el reembolso existente.
  - Dentro de `run_in_transaction`:
    - Llama a `guard_money_write` con las dos puntas. Si no actualiza, relee la Cuenta y responde `409`, `404` o `422`.
    - Inserta el reembolso y registra `settlement.created` con `account_id` y `source`.
  - Agregar también `to_settlement_response(doc, account)`, con `isExcluded` y los nombres desde el arreglo completo de participantes.
- [X] T028 [US2] Crear `backend/app/api/v1/settlements.py` con `POST /accounts/{account_id}/settlements` (201) e incluir el router en `backend/app/main.py`. Después, regenerar los tipos en Web y en Mobile.
- [X] T029 [P] [US2] Test unitario en `web/src/__tests__/components/SuggestionList.test.tsx`. Se escribe primero y tiene que fallar. Casos:
  - Cada sugerencia muestra quién paga, a quién y el importe.
  - Sin sugerencias: "No hay nada pendiente".
  - "Marcar como pagado" abre un diálogo con los datos y la fecha de hoy, calculada después de hidratar, sin campos editables.
  - "Confirmar" envía `source: "suggestion"` con un `clientRequestId` estable entre reintentos del mismo diálogo.
  - "Cancelar" no envía nada.
  - En una Cuenta Cerrada no se ofrece la acción.
  - `account_closed` e `invalid_participant` muestran el mensaje traducido.
- [X] T030 [US2] Crear `web/src/app/actions/settlements.ts` (`"use server"`) con `createSettlementAction`, que hace `revalidatePath` de la pestaña. Crear `web/src/components/balances/SuggestionList.tsx` y `web/src/components/balances/MarkPaidDialog.tsx`, que reutiliza `ConfirmDialog`, y mostrarlos en la página de saldos.
- [X] T031 [P] [US2] Test unitario en `mobile/src/__tests__/screens/suggestions.test.tsx`. Se escribe primero y tiene que fallar. Mismas reglas que T029.
- [X] T032 [US2] Agregar `create` en `mobile/src/services/api/settlements.ts`. Crear `mobile/src/components/balances/SuggestionList.tsx`, con el diálogo de confirmación de `AccountBits`, y mostrarlo en `AccountBalancesScreen.tsx`. Después de confirmar, la pantalla se recarga.

**Checkpoint**: US1 y US2 funcionan: se ven los saldos y se pueden saldar con las sugerencias.

---

## Phase 5: User Story 3 - Registrar un reembolso manual (Priority: P2)

**Goal**: cualquier miembro registra un pago entre dos participantes y ve la lista de reembolsos.

**Independent Test**: registrar Javier → Ana 10,00. Javier queda en −20,00, Ana en +50,00, y el
reembolso aparece primero en la lista (quickstart, escenario 4).

### Tests for User Story 3 ⚠️

- [X] T033 [P] [US3] Test de contrato en `backend/tests/contract/test_settlements_list_contract.py`. `GET /api/v1/accounts/{id}/settlements`:
  - Da `200 SettlementPage` ordenado por `date` desc y después `createdAt` desc.
  - Con 120 reembolsos se recorren las páginas de 50 sin repetidos.
  - Da `422 validation_error` con `limit` fuera de 1–100 o con un cursor inválido.
  - Da `404` a quien no es miembro.
  - Los reembolsos eliminados no aparecen.
  - Los de un participante quitado aparecen con `isExcluded: true`.

### Implementation for User Story 3

- [X] T034 [US3] Agregar `list_settlements(account_id, user_id, limit, cursor)` en `backend/app/services/settlement_service.py` y `GET /accounts/{account_id}/settlements` en `backend/app/api/v1/settlements.py`. Después, regenerar los tipos.
- [X] T035 [P] [US3] Test unitario en `web/src/__tests__/components/SettlementForm.test.tsx` y `SettlementList.test.tsx`. Se escribe primero y tiene que fallar. Casos:
  - El formulario tiene quién paga y quién recibe (solo participantes activos), el importe en la moneda de la Cuenta y la fecha de hoy después de hidratar.
  - Rechaza la misma persona en las dos puntas y los errores de `parseAmountInput`.
  - En JPY no acepta decimales.
  - Envía `source: "manual"`.
  - La lista muestra fecha, quién pagó, quién recibió e importe, con la marca "Participante quitado" cuando corresponde, y tiene "Cargar más".
- [X] T036 [US3] Crear:
  - `listSettlements` en `web/src/lib/balancesServer.ts` y `loadMoreSettlementsAction` en `web/src/app/actions/settlements.ts`.
  - `web/src/components/balances/SettlementForm.tsx` y `web/src/components/balances/SettlementList.tsx`.
  - La página `web/src/app/(private)/accounts/[accountId]/settlements/new/page.tsx`.
  - En la pestaña "Saldos", el botón "Registrar reembolso" (oculto si la Cuenta está Cerrada) y la lista debajo de las sugerencias.
- [X] T037 [P] [US3] Test unitario en `mobile/src/__tests__/screens/settlementForm.test.tsx`. Se escribe primero y tiene que fallar. Mismas reglas que T035, con el selector de fecha nativo. Además, en `AccountBalancesScreen` el botón "Registrar reembolso" navega a `settlements/new` y no se muestra si la Cuenta está Cerrada.
- [X] T038 [US3] Crear:
  - `list` en `mobile/src/services/api/settlements.ts`.
  - `mobile/src/components/balances/SettlementList.tsx`.
  - `mobile/src/screens/balances/SettlementFormScreen.tsx`, que reutiliza el selector de fecha de `ExpenseFormScreen.tsx`.
  - La ruta `mobile/app/(app)/accounts/[accountId]/settlements/new.tsx`, registrada en `_layout.tsx`.
  - La lista con carga por partes en `AccountBalancesScreen.tsx`, debajo de las sugerencias.
  - En `AccountBalancesScreen.tsx`, el botón "Registrar reembolso", que navega a `/accounts/[accountId]/settlements/new` y está oculto si la Cuenta está Cerrada (FR-019).

**Checkpoint**: US3 funciona por su lado.

---

## Phase 6: User Story 4 - Eliminar un reembolso (Priority: P2)

**Goal**: cualquier miembro elimina un reembolso tras confirmar, y los saldos vuelven a como estaban.

**Independent Test**: eliminar el reembolso de Leandro y confirmar con "Continuar": la sugerencia
vuelve a aparecer. Si otro miembro intenta eliminarlo de nuevo, ve el aviso de que ya no existe
(quickstart, escenarios 5 y 7).

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Test de integración en `backend/tests/integration/test_settlement_deletion.py`. `DELETE /api/v1/accounts/{id}/settlements/{sid}`:
  - Da `204`, deja `isDeleted: true` con `deletedAt` y `deletedBy`, y el documento sigue en la base.
  - Registra `settlement.deleted` con `entityId` igual al id del reembolso, en la misma transacción.
  - Un segundo `DELETE` da `404`.
  - Un reembolso excluido (una punta quitada) se puede eliminar: da `204` y los saldos no cambian.
  - Dos `DELETE` simultáneos con `asyncio.gather`, repetido 20 veces: uno da `204`, el otro `404`, y hay una sola auditoría.
  - En una Cuenta Cerrada da `409 account_closed`.
  - Da `404` a quien no es miembro y a un reembolso de otra Cuenta.
  - Después de eliminar, los saldos vuelven a los valores anteriores.

### Implementation for User Story 4

- [X] T040 [US4] Agregar `delete_settlement(account_id, settlement_id, user_id, client)` en `backend/app/services/settlement_service.py`:
  - Exige ser miembro.
  - Dentro de `run_in_transaction`: `guard_money_write` sin participantes (si no actualiza, `409 account_closed`), después `soft_delete` (si no actualiza, `404`), y después registra `settlement.deleted`.
  - Agregar el endpoint `DELETE` en `backend/app/api/v1/settlements.py`.
- [X] T041 [P] [US4] Test unitario en `web/src/__tests__/components/SettlementList.test.tsx`. Se escribe primero y tiene que fallar. Casos:
  - "Eliminar" abre un diálogo con "Continuar" y "Cancelar", y solo "Continuar" llama a la acción.
  - Ante `not_found` muestra "Este reembolso ya no existe" y recarga.
  - En una Cuenta Cerrada no se ofrece eliminar.
- [X] T042 [US4] Agregar `deleteSettlementAction` en `web/src/app/actions/settlements.ts` y el botón "Eliminar" con `ConfirmDialog` en `SettlementList.tsx`.
- [X] T043 [P] [US4] Test unitario en `mobile/src/__tests__/screens/settlementDelete.test.tsx`. Se escribe primero y tiene que fallar. Mismas reglas que T041.
- [X] T044 [US4] Agregar `remove` en `mobile/src/services/api/settlements.ts` y la acción de eliminar, con `ConfirmDialog`, en `mobile/src/components/balances/SettlementList.tsx`.

**Checkpoint**: US4 funciona por su lado.

---

## Phase 7: User Story 5 - Resumen de saldos en el panel principal (Priority: P3)

**Goal**: el panel principal muestra el saldo del usuario en cada Cuenta y los totales "Te deben" y
"Debés" por moneda, incluidas las Cuentas Cerradas.

**Independent Test**: con dos Cuentas en ARS (una Cerrada) y una en USD, el panel muestra el saldo
de cada una y los totales separados por moneda, contando la Cerrada (quickstart, escenario 8).

### Tests for User Story 5 ⚠️

- [X] T045 [P] [US5] Test de integración en `backend/tests/integration/test_account_list_balances.py`. `GET /api/v1/accounts`:
  - Trae `myBalance` y `currencyDecimals` en cada `AccountSummary`.
  - `myBalance` coincide con el `BalanceEntry` de `isMe` de `GET .../balances` en cada Cuenta, incluida una Cerrada.
  - Una Cuenta sin gastos tiene `"0.00"`.
  - En JPY no hay decimales.
  - Una Cuenta abandonada no figura.
  - Una Cuenta dada de baja por el Owner no figura.
  - Se hacen solo dos consultas de saldos para todas las Cuentas.
- [X] T046 [P] [US5] Tests de rendimiento en `backend/tests/perf/test_balances_perf.py`:
  - `GET .../balances` con 500 gastos y 100 reembolsos: p95 < 300 ms.
  - `GET /accounts` con 20 Cuentas de 500 gastos: p95 < 500 ms.

### Implementation for User Story 5

- [X] T047 [US5] Agregar `currency_decimals` y `my_balance` a `AccountSummary` en `backend/app/schemas/account.py`:
  - Agregar `my_balances(accounts, user_id)` en `backend/app/services/balance_service.py`, que usa `expenses.active_for_balances` y `settlements.active_for_accounts` con todas las Cuentas en una consulta cada uno, y `compute_balances` por Cuenta.
  - Usarlo en `list_my_accounts` de `backend/app/services/account_service.py`.
  - Actualizar los tests de contrato de la 002 que comparan el cuerpo completo.
  - Regenerar los tipos.
- [X] T048 [P] [US5] Tests unitarios. Se escriben primero y tienen que fallar.
  - `web/src/__tests__/lib/balanceTotals.test.ts`. Casos de `totalsByCurrency(accounts)`:
    - Separa por moneda y nunca mezcla monedas.
    - Suma por separado los positivos ("Te deben") y los negativos ("Debés").
    - Incluye las Cuentas Cerradas.
    - Es exacto con `BigInt`: 0,10 + 0,20 da 0,30, y los importes grandes no pierden precisión.
    - Respeta los decimales de cada moneda.
    - Con todo en cero no muestra totales.
  - `web/src/__tests__/components/BalanceSummary.test.tsx`: el saldo por Cuenta y la marca de Cerrada.
- [X] T049 [US5] Crear `web/src/lib/balanceTotals.ts` y `web/src/components/balances/BalanceSummary.tsx`:
  - Mostrar el resumen en `web/src/app/(private)/dashboard/page.tsx`, con los totales sobre todas las Cuentas y la lista de recientes con su saldo.
  - Agregar el saldo por Cuenta en `web/src/components/accounts/AccountList.tsx`.
- [X] T050 [P] [US5] Tests unitarios en `mobile/src/__tests__/utils/balanceTotals.test.ts` y `mobile/src/__tests__/screens/dashboardBalances.test.tsx`. Se escriben primero y tienen que fallar. Mismos casos que T048.
- [X] T051 [US5] Crear `mobile/src/utils/balanceTotals.ts` y `mobile/src/components/balances/BalanceSummary.tsx`. Mostrar el resumen en `mobile/src/screens/DashboardScreen.tsx` y el saldo por Cuenta en `AccountListItems` de `mobile/src/screens/accounts/AccountsScreen.tsx`.

**Checkpoint**: las cinco User Stories funcionan por su lado.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T052 [P] Verificar que pasan los tests de paridad de catálogos (`web/src/__tests__/i18n/messagesParity.test.ts` y `mobile/src/__tests__/i18n/localesParity.test.ts`) y el de inmutabilidad de la auditoría con las claves y los módulos nuevos.
- [X] T053 [P] Revisar que ningún componente nuevo convierta importes a `number` para hacer cuentas. Buscar `parseFloat`, `Number(` y `* 100` en `web/src/**/balances*`, `web/src/lib/balanceTotals.ts`, `mobile/src/**/balances*` y `mobile/src/utils/balanceTotals.ts`. Revisar también que la página de saldos de la Web no tenga diferencias de hidratación.
- [X] T054 Actualizar `README.md` con una sección "Balances and settlements (feature 004)": rutas nuevas, endpoints y la regla de las sugerencias.
- [X] T055 Correr `uv run ruff check .` y `uv run ruff format --check .` en `backend/`; `npm run lint`, `npx tsc --noEmit` y `npm test` en `web/` y en `mobile/`; y `npx next build` en `web/`. Corregir lo que falle.
- [X] T056 Validar los 11 escenarios manuales de `specs/004-balances-settlements/quickstart.md` en Web y en Mobile.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no tiene dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las User Stories.
  - **Backend**:
    - T002 y T003 (tests) van antes que T004.
    - T005, T006 y T007 pueden ir en paralelo.
    - T008 va antes que T009, y T009 antes que T011.
    - T010 puede ir en paralelo.
  - **Web y Mobile**: T012 a T015 no dependen del backend.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1, porque muestra las sugerencias en la misma pestaña y usa el endpoint de saldos.
- **US3 (Phase 5)**: depende de US2 en el backend, porque reutiliza `create_settlement`. En los clientes, puede ir en paralelo con US2 después de T028.
- **US4 (Phase 6)**: depende de US3, porque se elimina desde la lista.
- **US5 (Phase 7)**: depende solo de Foundational y de T018 (`balance_service`). Puede hacerse en paralelo con US2 a US4.
- **Polish (Phase 8)**: después de las User Stories que se quieran entregar.

### Within Each User Story

- El orden es: tests primero (tienen que fallar), después servicio, endpoint, regenerar tipos y clientes.
- Varias historias tocan los mismos archivos, así que esas tareas van en secuencia:
  - `backend/app/services/settlement_service.py` y `backend/app/api/v1/settlements.py`.
  - `web/src/app/actions/settlements.ts` y `web/src/app/(private)/accounts/[accountId]/balances/page.tsx`.
  - `mobile/src/services/api/settlements.ts` y `AccountBalancesScreen.tsx`.

### Parallel Opportunities

- **Foundational**: T005, T006, T007 y T010 en el backend; T013 y T015 en los clientes.
- **Tests de cada historia** marcados [P]: por ejemplo, T016 y T017; T025 y T026; T045 y T046.
- **Web y Mobile de una misma historia**: por ejemplo, T021–T022 y T023–T024, una vez regenerados los tipos.
- **US5** en paralelo con US2 a US4, después de T018.

## Parallel Example: User Story 2

```text
Juntas: T025 (contrato POST) y T026 (integración del alta)
Después de T027–T028: T029–T030 (Web) y T031–T032 (Mobile) en paralelo
```

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 y Phase 2. El cálculo puro y probado es la base de todo.
2. US1: saldos visibles. Validar con el ejemplo base.
3. US2: sugerencias y "Marcar como pagado". Con eso la Cuenta cubre el ciclo completo: cargar, ver y
   saldar.
4. **STOP and VALIDATE**: escenarios 1 a 3 del quickstart.

### Incremental Delivery

1. MVP (US1 + US2).
2. US3: reembolsos manuales y lista.
3. US4: eliminar reembolsos.
4. US5: resumen en el panel principal.
5. Polish y validación manual completa.
