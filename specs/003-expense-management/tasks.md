---

description: "Task list for feature 003: Expense Management and Audit Log"
---

# Tasks: Gestión de Gastos y Log de Auditoría

**Input**: documentos de diseño en `specs/003-expense-management/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: incluidos. La constitución (Principio VII) exige tests de la división de gastos y de las
reglas de permisos antes de implementar, con sus casos borde obligatorios, y un test unitario con
Jest por feature en Web y en Mobile. Los tests de cada fase se escriben primero y tienen que fallar
antes de implementar.

**Organización**: las tareas están agrupadas por User Story para implementar y probar cada una por
separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: User Story a la que pertenece (US1 a US5).
- Cada tarea indica la ruta exacta del archivo.

## Convenciones

- Se extiende el código de las features 001 y 002: mismas capas (`schemas` → `repositories` →
  `services` → `api/v1`), Server Actions con `apiFetch` en Web y cliente con refresh en Mobile.
- Código, identificadores, colecciones, campos y rutas en inglés; textos visibles desde los catálogos
  `es`/`en` (Web: `web/src/i18n/messages/`; Mobile: `mobile/src/i18n/locales/`).
- Toda escritura sobre `expenses` (y la remoción de participantes con sus ajustes) va con su
  `audit_logs` en la misma transacción, con `run_in_transaction` de `backend/app/db/client.py`.
- Dinero (research R1): `amountMinor` entero en la base; texto decimal (`"100.50"`) en la API; nunca
  `float` en Python ni `number` en TypeScript para hacer cuentas con importes.
- Permisos: reutilizar `require_member` y `require_open` de
  `backend/app/services/account_permissions.py` (`404 not_found` para no miembros; `409
  account_closed` para escrituras en Cuentas Cerradas).
- Los tipos TypeScript se regeneran con `npm run gen:api` (en `web/` y `mobile/`) cada vez que cambia
  el contrato del backend.
- En Mobile los helpers van en `mobile/src/utils/` (convención existente); en Web, en `web/src/lib/`.

---

## Phase 1: Setup

**Purpose**: confirmar la rama e instalar la única dependencia nueva.

- [ ] T001 Confirmar que se trabaja en la rama `003-expense-management` (creada desde `002-account-management`) y que `uv run pytest` en `backend/` y `npm test` en `web/` y `mobile/` pasan antes de empezar
- [ ] T002 Instalar el selector de fecha en Mobile con `npx expo install @react-native-community/datetimepicker` (en `mobile/`), verificar `npx expo install --check` sin incompatibilidades y anotar en `README.md` que hay que recompilar el development build

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: dinero exacto, modelo, índices, auditoría extendida, errores y la nueva estructura de
rutas de la Cuenta en los clientes.

**⚠️ CRITICAL**: ninguna User Story empieza antes de terminar esta fase.

### Backend

- [ ] T003 Escribir tests unitarios (primero, deben fallar) en `backend/tests/unit/test_money.py`: `currency_decimals` da 2 para ARS/USD/EUR, 0 para JPY/CLP/KRW/PYG/ISK, 3 para BHD/KWD/JOD/OMR/TND; `parse_amount("100.5", "ARS")` da `10050`; `parse_amount("1500", "JPY")` da `1500`; rechazan `"0"`, `"-5"`, `"10.555"` en ARS, `"10.5"` en JPY, `"1e3"`, `"abc"`, `"1,5"` y más de `999999999` en la unidad principal; `format_amount(10050, "ARS")` da `"100.50"` y `format_amount(1500, "JPY")` da `"1500"`; `split_equal(10000, ["a","b","c"], ["a","b","c"])` da `{"a":3334,"b":3333,"c":3333}`; con orden de Cuenta `["c","a","b"]` el centavo va a `c`; un solo participante recibe el total; `split_equal(1000, ["x","y","z"], ...)` en JPY da `334/333/333`; `[]` da `{}`; la suma de las partes es siempre el total (probar 1..500 importes × 1..7 participantes)
- [ ] T004 Crear `backend/app/core/money.py` (sin `float`): tabla `_DECIMALS` con las excepciones ISO 4217 a 2 decimales (0: BIF, CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG, RWF, UGX, UYI, VND, VUV, XAF, XOF, XPF; 3: BHD, IQD, JOD, KWD, LYD, OMR, TND; 4: CLF, UYW), `currency_decimals(code)`, `MAX_MAJOR_AMOUNT = 999_999_999`, `parse_amount(text, currency) -> int` con `decimal.Decimal` (solo dígitos y un punto; > 0; como máximo `currency_decimals` decimales; tope de 999.999.999 en la unidad principal), `format_amount(minor, currency) -> str` y `split_equal(amount_minor, participant_ids, account_order) -> dict[str, int]` (research R2), hasta que pase T003
- [ ] T005 [P] Agregar a `backend/app/core/errors.py` `EXPENSE_CONFLICT = "expense_conflict"` e `INVALID_PARTICIPANT = "invalid_participant"` en `ERROR_CODES`, y sus mensajes `es`/`en` en `ERROR_MESSAGES` de `backend/app/core/i18n.py`; permitir que `AppError` lleve un cuerpo extra (`current`) para el `409 expense_conflict` y que el manejador de errores lo serialice junto a `error`
- [ ] T006 [P] Crear `backend/app/schemas/expense.py` según `contracts/api.md`: `CategoryIcon = Literal["other","home","car","hotel","beach","food","money","travel","party","shopping","sports"]`; `ExpenseWrite` (`extra="forbid"`; `date` como `datetime.date` serializado `YYYY-MM-DD`; `title` "1–80 caracteres después de recortar espacios" (solo espacios es inválido); `description` "hasta 500 caracteres; vacío se guarda como `null`"; `amount: str` (se valida contra la moneda en el servicio); `paidById: str` requerido, sin `null`; `participantIds: list[str]` con al menos 1, repetidos descartados; `categoryIcon` default `"other"`); `ExpenseCreate(ExpenseWrite)` + `clientRequestId: UUID`; `ExpenseUpdate(ExpenseWrite)` + `version: int ≥ 1`; respuestas `ParticipantRef`, `ExpenseListItem`, `ExpensePage`, `ShareResponse`, `ExpenseResponse`, `HistoryChange`, `HistoryEntry`, `ParticipantImpact`
- [ ] T007 [P] Agregar en `backend/app/schemas/account.py` el campo `currency_decimals: int` a `AccountResponse` y completarlo en `to_account_response` de `backend/app/services/account_permissions.py` con `money.currency_decimals`; actualizar los tests de contrato de la 002 que comparan el cuerpo completo
- [ ] T008 [P] Agregar a `backend/app/db/indexes.py` la colección `expenses` con `account_list` `{accountId: 1, isDeleted: 1, date: -1, createdAt: -1, _id: -1}`, `account_payer` `{accountId: 1, paidById: 1}`, `account_participants` `{accountId: 1, participantIds: 1}` y `client_request_unique` `{accountId: 1, clientRequestId: 1}` único con `partialFilterExpression: {clientRequestId: {$type: "string"}}`; y en `audit_logs` el índice `account_created` `{accountId: 1, createdAt: -1}`
- [ ] T009 Extender la auditoría (research R8): en `backend/app/repositories/audit_logs.py`, `insert` recibe `account_id: ObjectId | None` y guarda `accountId` solo si viene, y se agrega `list_for_entity(entity_type, entity_id)` (más reciente primero; solo lectura); en `backend/app/services/audit_service.py`, `record` recibe `account_id`, y `AuditAction` agrega `expense.created`, `expense.updated`, `expense.deleted`; en `backend/app/services/account_service.py`, `_audit` pasa `account_id=doc["_id"]` en todas las acciones `account.*` (la invitación también, en `backend/app/services/invitation_service.py`). No se reescriben registros existentes. Extender `backend/tests/unit/test_audit_immutability.py` para que siga sin haber `update`/`delete` sobre `audit_logs` y agregar un test que verifique `accountId` en un `account.updated` nuevo
- [ ] T010 Crear `backend/app/repositories/expenses.py`: `new_expense_document(account, request, amount_minor, user_id)` (`version: 1`, `isDeleted: False`, `participantIds` ordenados según `account.participants`, `currency` de la Cuenta, `createdAt`/`updatedAt` UTC), `insert`, `find_active(account_id, expense_id)`, `find_by_client_request(account_id, client_request_id)`, `page(account_id, limit, after)` (keyset por `(date, createdAt, _id)` descendentes, solo `isDeleted: False`), `totals(account_id)` (`$sum` de `amountMinor` y `count` de los activos), `update_versioned(account_id, expense_id, version, update_doc, session)` (`find_one_and_update` con `version` e `isDeleted: False`, incrementa `version` y fija `updatedAt`), `find_affected_by_participant(account_id, participant_id, session)`; todas con `session` opcional. Agregar además en `backend/app/repositories/accounts.py` `guard_expense_write(account_id, participant_ids, session)`: `update_one` con filtro `isClosed: false`, `isDeleted: false` y un `$elemMatch` `{id, removedAt: null}` por cada participante, y `$inc: {expenseWriteSeq: 1}` sin tocar `updatedAt`; devuelve si actualizó (research R10)
- [ ] T011 Agregar en `backend/tests/conftest.py` una fábrica `create_expense(account, by_user, title="Cena", amount_minor=10000, paid_by=None, participants=None, date=None, deleted=False)` (por defecto, pagador = participante de `by_user` y todos los participantes activos) que inserta el documento directamente, para preparar escenarios

### Web

- [ ] T012 Mover la configuración de la Cuenta a una subruta: crear `web/src/app/(private)/accounts/[accountId]/settings/page.tsx` con el contenido actual de `web/src/app/(private)/accounts/[accountId]/page.tsx` (`AccountDetail`), y dejar en `[accountId]/page.tsx` la vista de gastos con encabezado (ícono, nombre, marca de Cerrada, enlace "Configuración") y el botón "Nuevo gasto" (oculto si está Cerrada); actualizar los enlaces y redirecciones que apuntaban al detalle (después de crear la Cuenta, aceptar una invitación o editarla) y sus tests
- [ ] T013 [P] Crear `web/src/lib/categoryIcons.ts` (mismo conjunto y orden que `CategoryIcon`, default `other`, con glifo emoji como `accountIcons.ts`) y `web/src/components/expenses/CategoryIcon.tsx`
- [ ] T014 [P] Escribir tests (primero) en `web/src/__tests__/lib/money.test.ts` y crear `web/src/lib/money.ts`: `parseAmountInput(text, locale, decimals)` acepta "100,50" en `es` y "100.50" en `en`, separadores de miles del idioma, devuelve el texto decimal de la API o un error (`empty`, `invalid`, `tooManyDecimals`, `notPositive`, `tooLarge`); `formatMoney(amount, currency, decimals, locale)` con `Intl.NumberFormat` pasando el texto (no un `number`) y `minimumFractionDigits = maximumFractionDigits = decimals`
- [ ] T015 [P] Agregar en `web/src/i18n/messages/es.json` y `en.json` las claves `expenses.*` (listado, total, vacío, campos, categorías, pendiente de asignación, diálogos, conflicto, actualizar, cargar más), `history.*` (acciones, campos, ajuste automático) y los `errors.expense_conflict` / `errors.invalid_participant`

### Mobile

- [ ] T016 Convertir la ruta `mobile/app/(app)/accounts/[accountId].tsx` en la carpeta `mobile/app/(app)/accounts/[accountId]/` con `settings.tsx` (la pantalla actual `AccountDetailScreen`) e `index.tsx` (vista de gastos: encabezado con ícono, nombre, marca de Cerrada, acceso a "Configuración" y botón "Nuevo gasto" oculto si está Cerrada); registrar las rutas en `mobile/app/(app)/_layout.tsx` y actualizar las navegaciones a la Cuenta y sus tests
- [ ] T017 [P] Crear `mobile/src/utils/categoryIcons.ts` (mismo conjunto, con nombres de Material Community) y `mobile/src/components/expenses/CategoryIcon.tsx`
- [ ] T018 [P] Escribir tests (primero) en `mobile/src/__tests__/utils/money.test.ts` y crear `mobile/src/utils/money.ts` con `parseAmountInput` y `formatMoney`, mismas reglas y casos que T014
- [ ] T019 [P] Agregar las claves `expenses.*`, `history.*` y los errores nuevos en `mobile/src/i18n/locales/es.json` y `en.json` (mismas claves que Web; interpolación con llaves simples)

**Checkpoint**: backend con dinero exacto, modelo, índices y auditoría con `accountId`; clientes con la
Cuenta abriendo en la vista de gastos (todavía vacía), helpers de importe y textos.

---

## Phase 3: User Story 1 - Cargar un gasto (Priority: P1) 🎯 MVP

**Goal**: cualquier miembro carga un gasto con valores precargados y ve la parte de cada participante.

**Independent Test**: en una Cuenta con tres participantes, cargar "Cena" de 100,00 con los valores
por defecto y ver 33,34 / 33,33 / 33,33 en su detalle, en Web y en Mobile (quickstart, escenarios 1
y 2).

### Tests for User Story 1 ⚠️

- [ ] T020 [P] [US1] Test de contrato en `backend/tests/contract/test_expenses_create_contract.py`: `POST /api/v1/accounts/{id}/expenses` da `201 ExpenseResponse` (`amount` como texto con los decimales de la moneda, `shares`, `version: 1`, `isPending: false`); `422 validation_error` con título vacío, solo espacios o de 81 caracteres, descripción de 501, fecha inválida, importe `"0"`, `"-1"`, `"10.555"`, `1000000000`, `participantIds: []`, `paidById: null`, `currency` en el cuerpo y un campo desconocido; `422 invalid_participant` con un pagador o participante inexistente o quitado; `GET /api/v1/accounts/{id}/expenses/{expense_id}` da `200` a un miembro y `404 not_found` a un no miembro, a un id inexistente y a un gasto de otra Cuenta, con el mismo cuerpo
- [ ] T021 [P] [US1] Test de integración en `backend/tests/integration/test_expense_creation.py`: `amountMinor` entero y `currency` de la Cuenta; `participantIds` guardados en el orden de la Cuenta aunque lleguen desordenados; pagador que no participa es válido y no tiene parte; participante desvinculado (sin usuario) es válido; un solo participante asume el total; JPY sin decimales; fecha futura permitida; `expense.created` con `accountId`, `entityType: "expense"` y `metadata.actorParticipantId` en la misma transacción; reintentar con el mismo `clientRequestId` devuelve el mismo gasto, sin un segundo documento ni una segunda auditoría; en una Cuenta Cerrada da `409 account_closed`; en una Cuenta dada de baja, `404`; carrera con `asyncio.gather` (repetida 20 veces): alta mientras el Owner cierra la Cuenta → o se crea antes del cierre o da `409 account_closed`

### Implementation for User Story 1

- [ ] T022 [US1] Crear `backend/app/services/expense_service.py` con `create_expense(account_id, user_id, request, client)` (miembro, Cuenta abierta, valida pagador y participantes activos → `422 invalid_participant` (research R10), `parse_amount` con la moneda de la Cuenta, idempotencia por `clientRequestId` capturando la clave duplicada y devolviendo el existente (R7), dentro de `run_in_transaction`: `guard_expense_write` con pagador y participantes (si no actualiza, relee la Cuenta y responde `409 account_closed`, `404` o `422 invalid_participant`), inserción y `expense.created` con `account_id`), `get_expense(account_id, expense_id, user_id)` y `to_expense_response(doc, account)` (nombres desde el arreglo completo de participantes de la Cuenta, `shares` con `split_equal`, `isPending`, importes con `format_amount`); sin títulos, importes ni nombres en los logs
- [ ] T023 [US1] Crear `backend/app/api/v1/expenses.py` con `POST /accounts/{account_id}/expenses` (201) y `GET /accounts/{account_id}/expenses/{expense_id}`, e incluir el router en `backend/app/main.py`
- [ ] T024 [US1] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`, y agregar los alias de tipos de gastos en `web/src/lib/api/types.ts` y `mobile/src/services/api/types.ts`
- [ ] T025 [P] [US1] Test unitario (primero) en `web/src/__tests__/components/ExpenseForm.test.tsx`: fecha precargada con hoy en la zona horaria del navegador, calculada recién después de hidratar (con `renderToString` el campo sale vacío y sin fecha del servidor, como en `CurrencySelect.test.tsx`); pagador precargado con `myParticipantId`; todos los participantes activos marcados; la moneda se muestra y no se puede elegir; con JPY el importe no acepta decimales; errores traducidos de `parseAmountInput`, concepto vacío y sin participantes antes de enviar; se envía un `clientRequestId` estable entre reintentos del mismo formulario; `invalid_participant` y `account_closed` traducidos
- [ ] T026 [US1] Crear `web/src/app/actions/expenses.ts` (`"use server"`) con `createExpenseAction`; los componentes `web/src/components/expenses/ExpenseForm.tsx` (fecha con `<input type="date">`, cuyo valor por defecto se calcula en el cliente después de hidratar con `useSyncExternalStore`, research R3; concepto, importe, pagador, participantes con casillas, categoría con `CategoryIcon`, descripción) y `web/src/components/expenses/ExpenseDetail.tsx` (datos, pagador, participantes y la parte de cada uno con `formatMoney`); las páginas `web/src/app/(private)/accounts/[accountId]/expenses/new/page.tsx` y `web/src/app/(private)/accounts/[accountId]/expenses/[expenseId]/page.tsx` (`notFound()` ante `404`); después de crear, ir al detalle
- [ ] T027 [P] [US1] Test unitario (primero) en `mobile/src/__tests__/screens/expenseForm.test.tsx`: mismas reglas que T025 en la pantalla de alta, y el detalle muestra las partes
- [ ] T028 [US1] Crear `mobile/src/services/api/expenses.ts` (`create`, `get`), las pantallas `mobile/src/screens/expenses/ExpenseFormScreen.tsx` (selector de fecha con `@react-native-community/datetimepicker`, teclado decimal) y `mobile/src/screens/expenses/ExpenseDetailScreen.tsx`, y las rutas `mobile/app/(app)/accounts/[accountId]/expenses/new.tsx` y `mobile/app/(app)/accounts/[accountId]/expenses/[expenseId]/index.tsx`

**Checkpoint**: US1 funciona sola en Web y en Mobile: se carga un gasto y se ve su detalle con las partes.

---

## Phase 4: User Story 2 - Ver los gastos de la Cuenta (Priority: P1)

**Goal**: la Cuenta muestra el total y sus gastos agrupados por día, cargados de a 50, y se actualiza
a pedido.

**Independent Test**: con gastos en tres días, la Cuenta los muestra agrupados del más reciente al más
antiguo con ícono, concepto, pagador e importe, el total arriba; con 120 gastos, se cargan de a 50
sin repetir (quickstart, escenarios 3, 4 y 5).

### Tests for User Story 2 ⚠️

- [ ] T029 [P] [US2] Test de contrato en `backend/tests/contract/test_expenses_list_contract.py`: `GET /api/v1/accounts/{id}/expenses` da `200 ExpensePage`; sin cursor trae `total` y `count`, con cursor ambos en `null`; `limit` fuera de 1–100 y un cursor inválido dan `422 validation_error`; un no miembro recibe `404 not_found`
- [ ] T030 [P] [US2] Test de integración en `backend/tests/integration/test_expense_list.py`: orden por `date` descendente y, dentro del día, el último cargado primero; los eliminados no figuran ni suman; el total incluye los pendientes de asignación; recorrer 120 gastos con `limit=50` devuelve 50 + 50 + 20 sin repetidos ni faltantes y `nextCursor: null` al final; un gasto creado entre la primera y la segunda página no aparece repetido ni desplaza las siguientes; `paidBy` es `null` e `isPending: true` en un gasto sin pagador; los gastos de una Cuenta dada de baja dan `404`; una Cuenta Cerrada se sigue leyendo
- [ ] T031 [P] [US2] Agregar a `backend/tests/perf/test_latency.py` la medición de la primera página con total de una Cuenta con 500 gastos (p95 < 300 ms) y de una página siguiente (p95 < 300 ms)

### Implementation for User Story 2

- [ ] T032 [US2] Agregar `list_expenses(account_id, user_id, limit, cursor)` en `backend/app/services/expense_service.py` (cursor base64url de `(date, createdAt, _id)`, `422` si no se puede decodificar; `totals` solo sin cursor; `to_list_item` con nombre del pagador) y el endpoint `GET /accounts/{account_id}/expenses` en `backend/app/api/v1/expenses.py`; regenerar los tipos en Web y Mobile
- [ ] T033 [P] [US2] Escribir tests (primero) en `web/src/__tests__/lib/expenseGroups.test.ts` y crear `web/src/lib/expenseGroups.ts`: `mergePages(existing, page)` descarta ids repetidos; `groupByDay(items)` agrupa por `date` manteniendo el orden, y un día repartido entre dos páginas queda en un solo grupo; el título del grupo se formatea con el idioma del usuario y `timeZone: "UTC"`; test con `"2026-11-11"` en `es` y con `process.env.TZ = "America/Argentina/Buenos_Aires"` que muestra el 11, no el 10 (research R3)
- [ ] T034 [P] [US2] Test unitario (primero) en `web/src/__tests__/components/ExpenseList.test.tsx`: muestra el total formateado, los grupos por día y cada fila con ícono, concepto, pagador e importe; "pendiente de asignación" cuando corresponde; estado vacío que invita a cargar (sin invitación si está Cerrada); "Cargar más" pide la página siguiente y no aparece sin `nextCursor`; "Actualizar" llama a `router.refresh()`
- [ ] T035 [US2] Crear `web/src/lib/expensesServer.ts` (primera página server-side), `loadMoreExpensesAction` en `web/src/app/actions/expenses.ts`, los componentes `web/src/components/expenses/ExpenseList.tsx` y `web/src/components/expenses/ExpenseListItem.tsx` (cada fila enlaza al detalle; carga la página siguiente al llegar al final con `IntersectionObserver` y botón "Cargar más" como respaldo), y usarlos en `web/src/app/(private)/accounts/[accountId]/page.tsx` (página dinámica, sin caché, para que volver a la pantalla traiga datos vigentes, FR-033)
- [ ] T036 [P] [US2] Escribir tests (primero) en `mobile/src/__tests__/utils/expenseGroups.test.ts` y crear `mobile/src/utils/expenseGroups.ts` con las mismas reglas que T033, incluido el formato de fecha con `timeZone: "UTC"` y su test en zona negativa (secciones para `SectionList`)
- [ ] T037 [P] [US2] Test unitario (primero) en `mobile/src/__tests__/screens/accountExpenses.test.tsx`: mismas reglas que T034; `RefreshControl` vuelve a pedir la primera página; `onEndReached` pide la siguiente una sola vez; al volver a la pantalla (`useFocusEffect`) se recarga
- [ ] T038 [US2] Agregar `list` en `mobile/src/services/api/expenses.ts`, crear `mobile/src/components/expenses/ExpenseListItem.tsx` y `mobile/src/screens/expenses/AccountExpensesScreen.tsx` (`SectionList` agrupada por día, total arriba, `RefreshControl`, `onEndReached`, `useFocusEffect`), y usarla en `mobile/app/(app)/accounts/[accountId]/index.tsx`

**Checkpoint**: US1 y US2 funcionan: se cargan gastos y se ven en la Cuenta con el total.

---

## Phase 5: User Story 3 - Editar o eliminar un gasto (Priority: P2)

**Goal**: cualquier miembro edita o elimina cualquier gasto, sin pisar cambios ajenos.

**Independent Test**: un miembro que no cargó el gasto cambia su importe y pagador; los demás lo ven;
luego lo elimina tras confirmar y deja de figurar (quickstart, escenarios 6 y 7).

### Tests for User Story 3 ⚠️

- [ ] T039 [P] [US3] Test de contrato en `backend/tests/contract/test_expenses_edit_contract.py`: `PUT /api/v1/accounts/{id}/expenses/{expense_id}` da `200` con `version` + 1; sin `version` o con `paidById: null` da `422`; con `version` vieja da `409 expense_conflict` con `current` (el gasto vigente); `DELETE ...?version=` da `204`, `409 expense_conflict` con versión vieja y `404` si ya estaba eliminado; ambos dan `409 account_closed` en una Cuenta Cerrada y `404 not_found` a un no miembro
- [ ] T040 [P] [US3] Test de integración en `backend/tests/integration/test_expense_edit.py`: un miembro edita un gasto que cargó otro con las mismas validaciones que el alta; `expense.updated` guarda en `changes` solo los campos que cambiaron con `before`/`after`; dos `PUT` con la misma versión en `asyncio.gather`: uno `200` y otro `409 expense_conflict`, y el primer cambio se conserva (SC-005); editar un gasto eliminado da `404`; la baja deja `isDeleted: true` y `deletedAt` sin borrar el documento y audita `expense.deleted`; después no figura en el listado ni en el total y su detalle da `404`; un gasto pendiente de asignación se completa editándolo con pagador y participantes
- [ ] T041 [P] [US3] Extender `backend/tests/unit/test_money.py` (o un test nuevo en `backend/tests/unit/test_expense_changes.py`) para `diff_expense(before, after)`: solo incluye los campos que cambiaron y compara `participantIds` como lista ordenada

### Implementation for User Story 3

- [ ] T042 [US3] Agregar en `backend/app/services/expense_service.py` `update_expense(account_id, expense_id, user_id, request, client)` (mismas validaciones que el alta, incluido `guard_expense_write` dentro de la transacción; `update_versioned`; si no actualiza, relee: eliminado → `404`, otra versión → `409 expense_conflict` con `current`; `expense.updated` con `diff_expense` en la transacción) y `delete_expense(account_id, expense_id, user_id, version, client)` (baja lógica versionada y `expense.deleted`); los endpoints `PUT` y `DELETE` en `backend/app/api/v1/expenses.py`; regenerar los tipos en Web y Mobile
- [ ] T043 [P] [US3] Test unitario (primero) en `web/src/__tests__/components/ExpenseEdit.test.tsx`: el formulario de edición viene con los valores actuales; ante `409 expense_conflict` muestra el aviso y carga los valores de `current`; ante `404` informa que el gasto ya no existe y vuelve a la Cuenta; "Eliminar" muestra "Continuar" y "Cancelar", con "Cancelar" no llama a la acción y con "Continuar" llama y vuelve a la Cuenta; con la Cuenta Cerrada no hay "Editar" ni "Eliminar"
- [ ] T044 [US3] Agregar `updateExpenseAction` y `deleteExpenseAction` en `web/src/app/actions/expenses.ts`; reutilizar `ExpenseForm` en `web/src/app/(private)/accounts/[accountId]/expenses/[expenseId]/edit/page.tsx`; agregar "Editar" y "Eliminar" (con `ConfirmDialog`) en `web/src/components/expenses/ExpenseDetail.tsx`
- [ ] T045 [P] [US3] Test unitario (primero) en `mobile/src/__tests__/screens/expenseEdit.test.tsx`: mismas reglas que T043
- [ ] T046 [US3] Agregar `update` y `remove` en `mobile/src/services/api/expenses.ts`; la ruta `mobile/app/(app)/accounts/[accountId]/expenses/[expenseId]/edit.tsx` con `ExpenseFormScreen` en modo edición; "Editar" y "Eliminar" (con `ConfirmDialog` de `mobile/src/components/accounts/AccountBits.tsx`) en `ExpenseDetailScreen.tsx`

**Checkpoint**: US3 funciona por su lado.

---

## Phase 6: User Story 4 - Efectos de quitar un participante (Priority: P2)

**Goal**: al quitar un participante, sus gastos se ajustan solos y el diálogo avisa cuántos se
afectan.

**Independent Test**: con un gasto pagado por "Javier" y otro compartido solo por él, quitar a
"Javier": el diálogo indica 2 gastos; después ambos quedan "pendiente de asignación" y los que
compartía con otros se reparten entre los restantes (quickstart, escenario 9).

### Tests for User Story 4 ⚠️

- [ ] T047 [P] [US4] Test de contrato en `backend/tests/contract/test_participant_impact_contract.py`: `GET /api/v1/accounts/{id}/participants/{participant_id}/impact` da `200 { affectedExpenses }` a un miembro, `404` para un participante inexistente o ya quitado y `404 not_found` a un no miembro
- [ ] T048 [P] [US4] Test de integración en `backend/tests/integration/test_participant_removal_effects.py`: `affectedExpenses` cuenta los gastos activos que pagó o comparte (sin repetir los que cumplen ambas cosas, sin los eliminados); al quitarlo: `paidById` queda `null` en los que pagó; se quita de `participantIds` y las partes de 100,00 entre tres pasan a 50,00 / 50,00; si era el único participante, `participantIds` queda `[]` e `isPending: true`; cada gasto ajustado incrementa `version` y tiene un `expense.updated` con `actorUserId` = quien quitó, `metadata.reason: "participant_removed"` y `accountId`; los gastos eliminados no se tocan; cada gasto ajustado queda con `version` incrementada en la base (el aviso de conflicto al editar se prueba en US3, T040); si falla la inserción de una auditoría (simulada), no se aplica ni la remoción ni ningún ajuste (FR-023); quitar a un participante desvinculado funciona igual; carreras (con `asyncio.gather`, 20 veces) entre crear o editar un gasto que incluye a un participante y quitarlo: o la edición da `422 invalid_participant`, o se aplica antes y la remoción la ajusta; nunca queda un gasto activo con un participante quitado
- [ ] T049 [P] [US4] Test de rendimiento en `backend/tests/perf/test_latency.py`: quitar un participante con 500 gastos afectados termina en menos de 2 s

### Implementation for User Story 4

- [ ] T050 [US4] En `backend/app/services/account_service.py`, `remove_participant` aplica dentro de la misma transacción los ajustes de research R9 (por cada gasto afectado: `paidById: null` si correspondía, `$pull` de `participantIds`, `version` + 1, `updatedAt`; un `expense.updated` por gasto con `before`/`after`, `reason` y `account_id`, insertados con `insert_many` o en bucle dentro de la sesión); agregar `participant_impact(account_id, user_id, participant_id)` y el endpoint `GET /accounts/{account_id}/participants/{participant_id}/impact` en `backend/app/api/v1/accounts.py`; regenerar los tipos en Web y Mobile
- [ ] T051 [P] [US4] Test unitario (primero) en `web/src/__tests__/components/ParticipantList.test.tsx`: al elegir "Quitar", se pide el impacto y el diálogo dice "Se verán afectados N gastos" (con 0, un texto sin advertencia); si el pedido falla, el diálogo igual permite continuar con un aviso genérico
- [ ] T052 [US4] Agregar `participantImpactAction` en `web/src/app/actions/accounts.ts` y mostrar la cantidad en el diálogo de quitar de `web/src/components/accounts/ParticipantList.tsx`; en `web/src/components/expenses/ExpenseForm.tsx`, al editar un gasto pendiente, exigir pagador y participantes antes de guardar
- [ ] T053 [P] [US4] Test unitario (primero) en `mobile/src/__tests__/screens/accountEdit.test.tsx`: mismas reglas que T051 en la pantalla de configuración
- [ ] T054 [US4] Agregar `participantImpact` en `mobile/src/services/api/accounts.ts` y la cantidad en el diálogo de quitar de `mobile/src/screens/accounts/AccountDetailScreen.tsx`; misma exigencia que T052 en `ExpenseFormScreen.tsx`

**Checkpoint**: US4 funciona por su lado.

---

## Phase 7: User Story 5 - Trazabilidad de los cambios (Priority: P3)

**Goal**: cada cambio queda auditado y el detalle del gasto muestra su historial legible.

**Independent Test**: crear un gasto, cambiar su importe de 90,00 a 120,00 y abrir el detalle: se ve
el alta y la modificación con quién, cuándo y "90,00 → 120,00"; al eliminarlo quedan tres registros
(quickstart, escenario 8).

### Tests for User Story 5 ⚠️

- [ ] T055 [P] [US5] Test de contrato en `backend/tests/contract/test_expense_history_contract.py`: `GET /api/v1/accounts/{id}/expenses/{expense_id}/history` da `200 HistoryEntry[]` (más reciente primero) a un miembro, también con la Cuenta Cerrada; `404` para un gasto eliminado o inexistente y `404 not_found` a un no miembro; ninguna respuesta contiene `actorUserId`, emails ni ids de usuario
- [ ] T056 [P] [US5] Test de integración en `backend/tests/integration/test_expense_history.py`: alta, edición de importe y de pagador y ajuste por remoción producen tres entradas legibles: `amount` como `"90.00"` → `"120.00"`, `paidBy` y `participants` como nombres (el del participante quitado sigue apareciendo con su nombre), `actorName` = nombre de participante del actor (y el nombre actual si se renombró), `reason: "participant_removed"` en el ajuste; no hay forma de editar ni borrar una entrada por la API; `test_no_sensitive_data.py` extendido: ni títulos, ni importes, ni nombres en los logs de la aplicación durante altas, ediciones y bajas de gastos

### Implementation for User Story 5

- [ ] T057 [US5] Crear `backend/app/services/expense_history.py` con `history(account_id, expense_id, user_id)`: lee `list_for_entity("expense", id)`, mapea cada acción a `created`/`updated`/`deleted`, traduce `amountMinor` con `format_amount`, `paidById` y `participantIds` a `ParticipantRef` con el arreglo completo de participantes de la Cuenta, el actor con `metadata.actorParticipantId` (`null` si no se conoce) y `reason`; agregar `GET /accounts/{account_id}/expenses/{expense_id}/history` en `backend/app/api/v1/expenses.py`; regenerar los tipos en Web y Mobile
- [ ] T058 [P] [US5] Test unitario (primero) en `web/src/__tests__/components/ExpenseHistory.test.tsx`: lista del más reciente al más antiguo con actor, fecha y hora en el idioma del usuario; "Cargó el gasto" para el alta; cada cambio con etiqueta traducida y valor anterior → nuevo (importes con `formatMoney`, fechas de gasto con `timeZone: "UTC"` para que no se corran de día, categoría con su nombre, participantes como lista de nombres); el ajuste automático se marca como tal; actor desconocido muestra "Un miembro"
- [ ] T059 [US5] Crear `web/src/components/expenses/ExpenseHistory.tsx` y mostrarlo debajo del detalle en `web/src/app/(private)/accounts/[accountId]/expenses/[expenseId]/page.tsx` (se carga junto con el gasto en el servidor)
- [ ] T060 [P] [US5] Test unitario (primero) en `mobile/src/__tests__/screens/expenseHistory.test.tsx`: mismas reglas que T058
- [ ] T061 [US5] Agregar `history` en `mobile/src/services/api/expenses.ts` y crear `mobile/src/components/expenses/ExpenseHistory.tsx`, mostrado en `ExpenseDetailScreen.tsx`

**Checkpoint**: las cinco User Stories funcionan por su lado.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Verificar que pasan los tests de paridad de catálogos (`web/src/__tests__/i18n/messagesParity.test.ts`, `mobile/src/__tests__/i18n/localesParity.test.ts`) y el de inmutabilidad de auditoría (`backend/tests/unit/test_audit_immutability.py`) con las claves y módulos nuevos
- [ ] T063 [P] Revisar que ningún componente nuevo convierte importes a `number` para hacer cuentas (búsqueda de `parseFloat`, `Number(` y `* 100` en `web/src/**/expenses*` y `mobile/src/**/expenses*`) y que la Web no tiene diferencias de hidratación en el listado (fechas y totales formateados igual en servidor y cliente)
- [ ] T064 Actualizar `README.md` (rutas nuevas de la Cuenta y de gastos, dependencia del selector de fecha) y la tabla de tests de `specs/003-expense-management/quickstart.md` si cambió algún nombre de archivo
- [ ] T065 Correr `uv run ruff check .` y `uv run ruff format --check .` en `backend/`, `npm run lint`, `npx tsc --noEmit` y `npm test` en `web/` y `mobile/`, y `npx next build` en `web/`; corregir lo que falle
- [ ] T066 Validar los 13 escenarios manuales de `specs/003-expense-management/quickstart.md` en Web y en Mobile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las User Stories. Backend: T003 (test)
  → T004; T005/T006/T007/T008 en paralelo; T009 → T010 → T011. Web (T012–T015) y Mobile (T016–T019)
  son independientes del backend en esta fase.
- **US1 (Phase 3)**: depende de Foundational. Las demás historias necesitan gastos creados por la API,
  así que conviene hacer US1 primero.
- **US2 (Phase 4)**: depende de US1 (el listado enlaza al detalle creado en US1).
- **US3 (Phase 5)**: depende de US1; independiente de US2 en el backend.
- **US4 (Phase 6)**: depende de US1; independiente de US2 y US3 (verifica `version` directamente en la
  base).
- **US5 (Phase 7)**: depende de US1; muestra mejor su valor con US3 y US4 hechas.
- **Polish (Phase 8)**: después de las User Stories que se quieran entregar.

### Within Each User Story

- Tests primero (tienen que fallar), después servicio, endpoint, regenerar tipos, y clientes.
- `backend/app/services/expense_service.py`, `backend/app/api/v1/expenses.py`,
  `web/src/app/actions/expenses.ts` y `mobile/src/services/api/expenses.ts` los tocan varias
  historias: esas tareas van en secuencia.

### Parallel Opportunities

- Foundational: T005, T006, T007 y T008; el bloque Web (T012–T015) en paralelo con el bloque Mobile
  (T016–T019) y con el backend.
- Dentro de cada historia: los tests marcados [P]; y, con los tipos regenerados, Web en paralelo con
  Mobile.

---

## Parallel Example: User Story 2

```bash
# Tests de backend en paralelo:
Task: "T029 Test de contrato en backend/tests/contract/test_expenses_list_contract.py"
Task: "T030 Test de integración en backend/tests/integration/test_expense_list.py"
Task: "T031 Perf del listado en backend/tests/perf/test_latency.py"

# Con el endpoint de listado listo y los tipos regenerados (T032), clientes en paralelo:
Task: "T033-T035 expenseGroups, ExpenseList y la vista de gastos en web/"
Task: "T036-T038 expenseGroups, AccountExpensesScreen en mobile/"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 y Phase 2.
2. Phase 3 (US1).
3. **Parar y validar**: quickstart, escenarios 1 y 2, en Web y en Mobile.

### Incremental Delivery

1. US1 → cargar gastos (MVP).
2. US2 → ver los gastos de la Cuenta con el total: el uso diario.
3. US3 → corregir y eliminar.
4. US4 → quitar participantes sin dejar gastos inconsistentes.
5. US5 → historial visible.
6. Polish → feature completa según el criterio de listo del quickstart.

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [USn] vincula la tarea con su User Story.
- Verificar que los tests fallan antes de implementar.
- Commits en inglés, después de cada tarea o grupo lógico.
- La feature de Saldos reutilizará `split_equal` de `backend/app/core/money.py` y excluirá los gastos
  pendientes de asignación.
