---

description: "Task list for feature 002: Account Management, Free-text Participants and Invitations"
---

# Tasks: Cuentas, Participantes de Texto Libre e Invitaciones

**Input**: documentos de diseño en `specs/002-account-management/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: incluidos. La constitución (Principio VII) exige tests de las reglas de permisos antes de
implementar y un test unitario con Jest por feature en Web y en Mobile. Los tests de cada fase se
escriben primero y tienen que fallar antes de implementar.

**Organización**: las tareas están agrupadas por User Story para implementar y probar cada una por
separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: User Story a la que pertenece (US1 a US5).
- Cada tarea indica la ruta exacta del archivo.

## Convenciones

- Se extiende el código de la feature 001: mismas capas (`schemas` → `repositories` → `services` →
  `api/v1`), mismo cliente server-side en Web (`web/src/lib/api/client.ts`, Server Actions) y mismo
  cliente con refresh en Mobile (`mobile/src/services/api/client.ts`).
- Código, identificadores, colecciones, campos y rutas en inglés; textos visibles desde los catálogos
  `es`/`en` (Web: `web/src/i18n/messages/`; Mobile: `mobile/src/i18n/locales/`).
- Toda escritura sobre `accounts` y su `audit_logs` (`entityType: "account"`) va en la misma
  transacción (`app.db.client.transaction`).
- Permisos (research R6): quien no es miembro recibe `404 not_found`; un miembro en una acción de
  Owner, `403`; cualquier escritura sobre una Cuenta Cerrada, `409 account_closed`, salvo la baja.
- Los tipos TypeScript se regeneran con `npm run gen:api` (en `web/` y `mobile/`) cada vez que cambia
  el contrato del backend.

---

## Phase 1: Setup

**Purpose**: preparar la rama y confirmar las dependencias.

- [X] T001 Crear la rama `002-account-management` desde `main` (`git checkout -b 002-account-management`)
- [X] T002 Confirmar que `@expo/vector-icons` figura en `mobile/package.json` (instalado durante el plan con `npx expo install @expo/vector-icons`) y que `npx expo install --check` en `mobile/` no reporta incompatibilidades

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: modelo, errores, repositorio, permisos y piezas de UI compartidas por todas las User
Stories.

**⚠️ CRITICAL**: ninguna User Story empieza antes de terminar esta fase.

### Backend

- [X] T003 Agregar a `backend/app/core/errors.py` los códigos `NOT_FOUND` (ya existe, verificar), `ACCOUNT_CLOSED = "account_closed"`, `OWNER_ONLY = "owner_only"`, `OWNER_CANNOT_LEAVE = "owner_cannot_leave"`, `OWNER_PARTICIPANT = "owner_participant"`, `DUPLICATE_PARTICIPANT_NAME = "duplicate_participant_name"`, `INVALID_INVITATION = "invalid_invitation"`, `ALREADY_MEMBER = "already_member"`, `PARTICIPANT_TAKEN = "participant_taken"`, e incluirlos en `ERROR_CODES`
- [X] T004 [P] Agregar los mensajes `es`/`en` de cada código nuevo de T003 en `ERROR_MESSAGES` de `backend/app/core/i18n.py`
- [X] T005 [P] Crear `backend/app/schemas/account.py`: `AccountIcon = Literal["group","home","car","hotel","beach","food","money","travel","party","shopping","work","sports"]`; nombre de Cuenta "1–80 caracteres sin contar espacios de los extremos"; descripción "hasta 500 caracteres" (`null` la borra; vacía → `null`); nombre de participante "1–40 caracteres, recortado"; moneda ISO 4217 reutilizando `_currency_code` de `backend/app/schemas/user.py`; modelos `AccountCreate` (`name`, `description?`, `icon` default `"group"`, `currency`, `myParticipantName`, `otherParticipants: list[str]`, como máximo 50 participantes en total), `AccountUpdate` (parcial `name?`, `description?`, `icon?`; con `extra="forbid"`, así que enviar `currency` o un campo desconocido da `422`), `ParticipantName` (`name`), `AcceptInvitation` (exactamente uno de `participantId` o `newParticipantName`), y las respuestas `ParticipantResponse`, `AccountSummary`, `AccountResponse`, `InvitationPreview` tal como están en `specs/002-account-management/contracts/api.md`
- [X] T006 [P] Agregar a `backend/app/db/indexes.py` la colección `accounts` con `{inviteCode: 1}` único y `{"participants.userId": 1, isDeleted: 1, updatedAt: -1}`
- [X] T007 [P] Agregar a `AuditAction` en `backend/app/services/audit_service.py` las acciones `account.created`, `account.updated`, `account.participant_added`, `account.participant_renamed`, `account.participant_removed`, `account.member_joined`, `account.member_left`, `account.invite_regenerated`, `account.closed`, `account.deleted`; y agregar `inviteCode` a `SENSITIVE_KEYS` para que nunca llegue a la auditoría
- [X] T008 Crear `backend/app/repositories/accounts.py` según `data-model.md`: `new_participant(name, user_id=None)` (UUID `id`, `nameKey = name.strip().lower()`, `joinedAt`, `linkedAt`, `removedAt: None`), `new_account_document(...)` (`isClosed: False`, `isDeleted: False`, `inviteCode = secrets.token_urlsafe(16)`), `insert`, `find_by_id`, `find_by_invite_code`, `find_for_member(account_id, user_id)` (solo si `isDeleted` es falso y hay un participante activo con ese `userId`), `list_for_member(user_id)` (ordenado por `updatedAt` descendente), `update(account_id, update_doc, session, extra_filter=None)` con `find_one_and_update` y `updatedAt`; todas con `session` opcional. `audit_logs` no se toca desde aquí
- [X] T009 Escribir tests unitarios (primero, deben fallar) en `backend/tests/unit/test_account_permissions.py`: `to_account_response` omite participantes con `removedAt` y nunca incluye `userId`; `require_member` da `404` para un usuario sin participante activo, para una Cuenta `isDeleted` y para un id inválido; `require_owner` da `403` a un miembro; `require_open` da `409` con `isClosed`
- [X] T010 Crear `backend/app/services/account_permissions.py`: `active_participants(doc)`, `my_participant(doc, user_id)`, `is_owner(doc, user_id)`, `require_member(account_id, user_id)` (`AppError(404, "not_found")` si no es miembro, no existe o está dada de baja), `require_owner(doc, user_id)` (`403 owner_only`), `require_open(doc)` (`409 account_closed`) y `to_account_response(doc, user_id)` / `to_account_summary(doc, user_id)` (solo participantes activos; `isLinked` sin revelar el usuario; `isMe`, `isOwner`, `myParticipantId`)
- [X] T011 Agregar en `backend/tests/conftest.py` una fábrica `create_account(owner, name="Viaje", currency="ARS", others=("Leandro","Javier"), closed=False, deleted=False)` que inserta una Cuenta con el participante del Owner vinculado, y un helper `link(account, participant_name, user)` para vincular usuarios en tests

### Web

- [X] T012 [P] Crear `web/src/lib/accountIcons.ts` con el conjunto fijo de íconos (mismo orden y nombres que `AccountIcon`, default `group`) y su glifo para la Web, y `web/src/components/accounts/AccountIcon.tsx`
- [X] T013 [P] Crear `web/src/components/accounts/ConfirmDialog.tsx`: diálogo accesible (`role="dialog"`, foco en el botón de cancelar, cierre con Escape) con título, mensaje y botones configurables ("Continuar"/"Cancelar" por defecto), y su test en `web/src/__tests__/components/ConfirmDialog.test.tsx` (Cancelar no llama a `onConfirm`; Continuar sí)
- [X] T014 [P] Agregar en `web/src/i18n/messages/es.json` y `en.json` las claves `accounts.*` (títulos, campos, íconos, acciones, diálogos), `invite.*` y los `errors.*` nuevos de T003; agregar `/accounts` e `/invite` a `PRIVATE_PREFIXES` en `web/src/proxy.ts`
- [X] T015 [P] En `web/src/components/SiteHeader.tsx`, convertir "Accounts" del menú de usuario en un enlace a `/accounts` (hoy está deshabilitado) y actualizar `web/src/__tests__/components/SiteHeader.test.tsx`

### Mobile

- [X] T016 [P] Crear `mobile/src/utils/accountIcons.ts` (mismo conjunto, mapeado a nombres de Material Community de `@expo/vector-icons`) y `mobile/src/components/accounts/AccountIcon.tsx`
- [X] T017 [P] Crear `mobile/src/components/accounts/ConfirmDialog.tsx` con `Portal` + `Dialog` de React Native Paper (botones "Continuar"/"Cancelar" configurables) y su test en `mobile/src/__tests__/components/ConfirmDialog.test.tsx`
- [X] T018 [P] Agregar las claves `accounts.*`, `invite.*` y los `errors.*` nuevos en `mobile/src/i18n/locales/es.json` y `en.json` (mismas claves que Web; interpolación con llaves simples)

**Checkpoint**: backend con modelo, permisos e índices; clientes con íconos, diálogo de confirmación y
textos. Ya se puede empezar cualquier User Story.

---

## Phase 3: User Story 1 - Crear una Cuenta con participantes (Priority: P1) 🎯 MVP

**Goal**: crear una Cuenta con nombre, ícono, moneda y participantes, y verla en "Mis Cuentas".

**Independent Test**: crear "Vacaciones" con "Leandro" y "Javier", verla en "Mis Cuentas" y en su
detalle, en Web y en Mobile (quickstart, escenario 1).

### Tests for User Story 1 ⚠️

- [X] T019 [P] [US1] Test de contrato en `backend/tests/contract/test_accounts_create_contract.py`: `POST /api/v1/accounts` da `201 AccountResponse` con `isOwner: true` y `myParticipantId`; `422` con nombre vacío o de 81 caracteres, moneda `"XXX1"`, participante vacío o de 41 caracteres, más de 50 participantes y `duplicate_participant_name` ("Leandro" y "leandro "); `GET /api/v1/accounts` da `200 AccountSummary[]`; `GET /api/v1/accounts/{id}` da `200` a un miembro y `404 not_found` a un no miembro y a un id inexistente, con el mismo cuerpo
- [X] T020 [P] [US1] Test de integración en `backend/tests/integration/test_account_creation.py`: el creador queda como `ownerId` y como participante vinculado con `myParticipantName`; `icon` por defecto `group`; `inviteCode` de 22 caracteres; se inserta un `account.created` en la misma transacción; "Mis Cuentas" lista solo Cuentas del usuario, abiertas y cerradas, sin las dadas de baja, de la más reciente a la más antigua; `PATCH` con `currency` da `422` y la moneda no cambia (FR-003)

### Implementation for User Story 1

- [X] T021 [US1] Crear `backend/app/services/account_service.py` con `create_account(user_id, request, client)` (valida unicidad de nombres normalizados, crea el documento y audita `account.created` con nombre, moneda, ícono y nombres de participantes en una transacción), `list_my_accounts(user_id)` y `get_account(account_id, user_id)` usando `account_permissions`
- [X] T022 [US1] Crear `backend/app/api/v1/accounts.py` con `POST /accounts` (201), `GET /accounts` y `GET /accounts/{account_id}`, e incluir el router en `backend/app/main.py`
- [X] T023 [US1] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`, y agregar los alias de tipos de cuentas en `web/src/lib/api/types.ts` y `mobile/src/services/api/types.ts`
- [X] T024 [P] [US1] Test unitario (primero) en `web/src/__tests__/components/AccountForm.test.tsx`: moneda precargada con `user.preferences.defaultCurrency`; participante propio precargado con el nombre visible del usuario; agregar y quitar filas de participantes; detecta nombres duplicados sin distinguir mayúsculas ni espacios antes de enviar; el selector de íconos marca `group` por defecto
- [X] T025 [US1] Crear `web/src/app/actions/accounts.ts` (`"use server"`) con `createAccountAction` usando `apiFetch` y `getAccessToken`, que devuelve `ActionResult<AccountResponse>`, y los componentes `web/src/components/accounts/IconPicker.tsx` y `web/src/components/accounts/AccountForm.tsx` (reutiliza `CurrencySelect`)
- [X] T026 [US1] Crear las páginas `web/src/app/(private)/accounts/page.tsx` ("Mis Cuentas": lista con ícono, nombre, moneda, cantidad de participantes, marca de Cerrada y fecha de última modificación formateada según el idioma del usuario con `useFormatter` de next-intl; botón "Nueva Cuenta"), `web/src/app/(private)/accounts/new/page.tsx` y `web/src/app/(private)/accounts/[accountId]/page.tsx` (detalle de solo lectura en esta historia: datos y participantes); y mostrar las Cuentas recientes en `web/src/app/(private)/dashboard/page.tsx`
- [X] T027 [P] [US1] Test unitario (primero) en `mobile/src/__tests__/screens/accounts.test.tsx`: la lista muestra las Cuentas de `accountsApi.list`; el alta precarga moneda y nombre propio, valida duplicados y llama a `accountsApi.create`
- [X] T028 [US1] Crear `mobile/src/services/api/accounts.ts` (`list`, `get`, `create`), `mobile/src/components/accounts/IconPicker.tsx`, las pantallas `mobile/src/screens/accounts/AccountsScreen.tsx` (fechas con `Intl.DateTimeFormat` en el idioma del usuario), `NewAccountScreen.tsx` y `AccountDetailScreen.tsx` (solo lectura en esta historia), y las rutas `mobile/app/(app)/accounts/index.tsx`, `new.tsx` y `[accountId].tsx`; enlazar "Mis Cuentas" desde `mobile/src/screens/DashboardScreen.tsx` y registrar las rutas en `mobile/app/(app)/_layout.tsx`

**Checkpoint**: US1 funciona sola en Web y en Mobile.

---

## Phase 4: User Story 2 - Invitar y vincularse a un participante (Priority: P1)

**Goal**: compartir el enlace, que otra persona se vincule a un participante o se agregue, y que el
Owner pueda regenerar el enlace.

**Independent Test**: B abre el enlace de una Cuenta de A sin sesión, entra, elige "Leandro" y ve la
Cuenta en su panel; A sigue viendo "Leandro" (quickstart, escenarios 2, 3 y 7).

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Test de contrato en `backend/tests/contract/test_invitations_contract.py`: `GET /api/v1/invitations/{code}` da `200 InvitationPreview` (`availableParticipants` sin los vinculados ni los quitados) y `404 invalid_invitation` con el mismo cuerpo para un código inexistente, uno regenerado, una Cuenta Cerrada y una dada de baja; `POST /api/v1/invitations/{code}/accept` da `200 AccountResponse` con `participantId` o con `newParticipantName`, `422` si vienen los dos o ninguno, `409 already_member`, `409 participant_taken` y `422 duplicate_participant_name`; `POST /api/v1/accounts/{id}/invite-code` da `200` con un código nuevo al Owner y `403 owner_only` a un miembro
- [X] T030 [P] [US2] Test de integración en `backend/tests/integration/test_invitations.py`: vincularse a "Leandro" deja `userId` y `linkedAt` y audita `account.member_joined`; la Cuenta aparece en "Mis Cuentas" del invitado; agregarse como participante nuevo crea uno vinculado; un usuario ya miembro no puede vincularse a otro participante; dos usuarios aceptan el mismo participante con `asyncio.gather` y exactamente uno obtiene `200` y el otro `409 participant_taken` (SC-006); tras regenerar, el código viejo da `404` y se audita `account.invite_regenerated` sin el código; unirse como participante nuevo con 50 participantes activos da `422 validation_error`

### Implementation for User Story 2

- [X] T031 [US2] Crear `backend/app/services/invitation_service.py` con `preview(code, user_id)` y `accept(code, user_id, request, client)`: un único `find_one_and_update` condicional (Cuenta abierta y no dada de baja; participante activo y sin `userId`; ningún participante activo con ese `userId`; para participante nuevo, `nameKey` libre) y relectura para distinguir `already_member` / `participant_taken` / `invalid_invitation` (research R5); como máximo 50 participantes activos al agregarse como nuevo; auditoría en la misma transacción
- [X] T032 [US2] Agregar `regenerate_invite_code(account_id, user_id, client)` en `backend/app/services/account_service.py` (Owner y Cuenta abierta) y el endpoint `POST /accounts/{account_id}/invite-code` en `backend/app/api/v1/accounts.py`; crear `backend/app/api/v1/invitations.py` con `GET /invitations/{code}` y `POST /invitations/{code}/accept`, incluido en `backend/app/main.py`; regenerar los tipos en Web y Mobile
- [X] T033 [P] [US2] Test unitario (primero) en `web/src/__tests__/components/InvitePanel.test.tsx` y `web/src/__tests__/components/JoinAccountForm.test.tsx`: el panel muestra el enlace `<origen>/invite/<code>` y lo copia; solo el Owner ve "Generar enlace nuevo", que pide confirmación; el formulario lista los participantes libres, permite elegir uno o escribir un nombre nuevo, muestra `participant_taken` y refresca la lista, y con `alreadyMember` lleva a la Cuenta
- [X] T034 [US2] Agregar `previewInvitationAction`, `acceptInvitationAction` y `regenerateInviteAction` en `web/src/app/actions/accounts.ts`; crear `web/src/components/accounts/InvitePanel.tsx` y `web/src/components/accounts/JoinAccountForm.tsx`, y la página `web/src/app/(private)/invite/[code]/page.tsx` (sin sesión, `proxy.ts` manda a `/login?callbackUrl=/invite/<code>`, FR-009); mostrar `InvitePanel` en el detalle de la Cuenta
- [X] T035 [US2] Conservar el destino en los flujos de la Web que hoy terminan en rutas fijas (FR-009): crear `web/src/lib/pendingRedirect.ts` (guarda en `sessionStorage` el `callbackUrl` seguro según `safeCallbackUrl`, lo lee una vez y lo borra); que la página de login pase `callbackUrl` a los enlaces de registro y de código; que `RegisterForm.tsx` y `CodeSignInFlow.tsx` lo guarden al empezar; y que `VerifyEmailForm.tsx` (hoy `/onboarding/currency`), `OnboardingCurrencyForm.tsx` (hoy `/dashboard`) y `CodeSignInFlow.tsx` (hoy `/dashboard`) vayan al destino guardado si existe. Test (primero) en `web/src/__tests__/lib/pendingRedirect.test.ts` y en los tests existentes de esos tres componentes: un registro iniciado desde `/invite/<code>` termina, tras verificar y elegir la moneda, en esa invitación
- [X] T036 [P] [US2] Test unitario (primero) en `mobile/src/__tests__/hooks/usePendingInvite.test.tsx` y `mobile/src/__tests__/screens/join.test.tsx`: un código recibido sin sesión se recuerda y se abre al pasar a autenticado; "Unirme" acepta un código pegado o el enlace completo; la pantalla de invitación vincula o agrega y maneja `participant_taken` y `already_member`
- [X] T037 [US2] Agregar `previewInvitation`, `acceptInvitation` y `regenerateInviteCode` en `mobile/src/services/api/accounts.ts`; crear `mobile/src/hooks/usePendingInvite.ts`, `mobile/src/components/accounts/InvitePanel.tsx` (comparte el enlace web con `Share` de React Native), las pantallas `mobile/src/screens/accounts/JoinScreen.tsx` e `InvitationScreen.tsx`, y las rutas `mobile/app/(app)/join.tsx` y `mobile/app/invite/[code].tsx` (deep link `myexpenses://invite/<code>` fuera de los grupos protegidos, que delega en `usePendingInvite` si no hay sesión); declarar la ruta `invite/[code]` en el `Stack` de `mobile/app/_layout.tsx` fuera de los `Stack.Protected`, para que sea alcanzable con sesión y sin ella, y conectar ahí el hook

**Checkpoint**: US1 y US2 funcionan; una Cuenta ya se puede compartir.

---

## Phase 5: User Story 3 - Editar la Cuenta y sus participantes (Priority: P2)

**Goal**: cualquier miembro edita nombre, descripción e ícono, y agrega, renombra o quita
participantes.

**Independent Test**: un miembro que no es Owner cambia el nombre, agrega "Martina" y quita "Javier";
el Owner ve los cambios (quickstart, escenario 4).

### Tests for User Story 3 ⚠️

- [X] T038 [P] [US3] Test de contrato en `backend/tests/contract/test_account_edit_contract.py`: `PATCH /api/v1/accounts/{id}` (parcial; `description: null` la borra; `currency` da `422 validation_error` y la moneda no cambia); `POST /participants` da `201`; `PATCH /participants/{pid}` da `200`; `DELETE /participants/{pid}` da `200`; `422 duplicate_participant_name`; `409 owner_participant` al quitar el participante del Owner; `404` para no miembros y participantes inexistentes o ya quitados
- [X] T039 [P] [US3] Test de integración en `backend/tests/integration/test_account_edit.py`: los cambios de un miembro no Owner se guardan y los ve el Owner; renombrar audita `account.participant_renamed` con antes y después; quitar marca `removedAt` (no borra) y audita `account.participant_removed`; si el quitado estaba vinculado, ese usuario recibe `404` al pedir la Cuenta y deja de verla en "Mis Cuentas"; un nombre de un participante quitado puede reutilizarse; no se puede dejar la Cuenta sin participantes; agregar el participante 51 da `422 validation_error`; dos miembros que editan a la vez datos distintos (por ejemplo, el nombre y el ícono, con `asyncio.gather`) conservan ambos cambios y quedan dos entradas de auditoría

### Implementation for User Story 3

- [X] T040 [US3] Agregar `update_account`, `add_participant`, `rename_participant` y `remove_participant` en `backend/app/services/account_service.py` (miembro, Cuenta abierta, unicidad de `nameKey` entre activos, como máximo 50 participantes activos al agregar, el participante del Owner no se quita, auditoría con antes/después en la transacción) y sus endpoints en `backend/app/api/v1/accounts.py`; regenerar los tipos en Web y Mobile
- [X] T041 [P] [US3] Test unitario (primero) en `web/src/__tests__/components/ParticipantList.test.tsx` y `web/src/__tests__/components/AccountEditForm.test.tsx`: renombrar en línea, agregar, quitar con `ConfirmDialog`; el participante del Owner no tiene "Quitar"; errores `duplicate_participant_name` traducidos
- [X] T042 [US3] Agregar `updateAccountAction`, `addParticipantAction`, `renameParticipantAction` y `removeParticipantAction` en `web/src/app/actions/accounts.ts`; crear `web/src/components/accounts/AccountEditForm.tsx` y `web/src/components/accounts/ParticipantList.tsx`, y usarlos en `web/src/app/(private)/accounts/[accountId]/page.tsx`
- [X] T043 [P] [US3] Test unitario (primero) en `mobile/src/__tests__/screens/accountEdit.test.tsx`: mismas reglas que Web en la pantalla de detalle
- [X] T044 [US3] Agregar `update`, `addParticipant`, `renameParticipant` y `removeParticipant` en `mobile/src/services/api/accounts.ts`; crear `mobile/src/components/accounts/ParticipantList.tsx` (quitar pide confirmación con `ConfirmDialog`; el participante del Owner no tiene "Quitar") y hacer editable `mobile/src/screens/accounts/AccountDetailScreen.tsx`

**Checkpoint**: US3 funciona por su lado.

---

## Phase 6: User Story 4 - Salir de una Cuenta (Priority: P2)

**Goal**: un miembro no Owner abandona la Cuenta; su participante queda, desvinculado.

**Independent Test**: B sale; la Cuenta desaparece de su panel, A sigue viendo "Leandro" sin vincular
y B puede volver con el enlace (quickstart, escenario 6).

### Tests for User Story 4 ⚠️

- [X] T045 [P] [US4] Test de contrato e integración en `backend/tests/integration/test_account_leave.py`: `POST /api/v1/accounts/{id}/leave` da `204` a un miembro no Owner, deja el participante activo con `userId: null` y audita `account.member_left`; después el usuario recibe `404` y no ve la Cuenta; puede volver a unirse por la invitación al mismo participante; el Owner recibe `403 owner_cannot_leave`; en una Cuenta Cerrada da `409 account_closed`

### Implementation for User Story 4

- [X] T046 [US4] Agregar `leave_account(account_id, user_id, client)` en `backend/app/services/account_service.py` y `POST /accounts/{account_id}/leave` en `backend/app/api/v1/accounts.py`; regenerar los tipos en Web y Mobile
- [X] T047 [P] [US4] Test unitario (primero) en `web/src/__tests__/components/AccountActions.test.tsx` (parte de salida): un miembro no Owner ve "Salir", que pide confirmación y lleva a `/accounts`; el Owner no ve "Salir"
- [X] T048 [US4] Agregar `leaveAccountAction` en `web/src/app/actions/accounts.ts` y crear `web/src/components/accounts/AccountActions.tsx` con la acción "Salir", usado en el detalle de la Cuenta
- [X] T049 [US4] Agregar `leave` en `mobile/src/services/api/accounts.ts`, la acción "Salir" con `ConfirmDialog` en `mobile/src/screens/accounts/AccountDetailScreen.tsx`, y su caso en `mobile/src/__tests__/screens/accountEdit.test.tsx`

**Checkpoint**: US4 funciona por su lado.

---

## Phase 7: User Story 5 - Cerrar o dar de baja una Cuenta (Priority: P3)

**Goal**: el Owner cierra la Cuenta (definitivo, solo lectura) o la da de baja (abierta o Cerrada)
con un diálogo "Continuar"/"Cancelar".

**Independent Test**: A cierra una Cuenta y nadie puede editarla ni unirse; A da de baja otra y
desaparece para todos (quickstart, escenarios 8 y 9).

### Tests for User Story 5 ⚠️

- [X] T050 [P] [US5] Test de contrato en `backend/tests/contract/test_account_close_delete_contract.py`: `POST /api/v1/accounts/{id}/close` da `200` con `isClosed: true` al Owner, `403 owner_only` a un miembro y `409 account_closed` si ya está cerrada; `DELETE /api/v1/accounts/{id}` da `204` al Owner (también con la Cuenta Cerrada) y `403 owner_only` a un miembro
- [X] T051 [P] [US5] Test de integración en `backend/tests/integration/test_account_close_delete.py`: con la Cuenta Cerrada, `PATCH`, alta/renombre/baja de participantes, salida, regeneración y aceptación de invitaciones dan `409 account_closed` o `404 invalid_invitation`, y la lectura sigue dando `200`; no existe forma de reabrirla; la baja deja `isDeleted: true` y `deletedAt`, audita `account.deleted`, la Cuenta da `404` a todos los miembros, desaparece de "Mis Cuentas" y su invitación da `404`; los datos siguen en la colección (baja lógica)

### Implementation for User Story 5

- [X] T052 [US5] Agregar `close_account` y `delete_account` en `backend/app/services/account_service.py` (Owner; `close` exige Cuenta abierta; `delete` acepta abierta o Cerrada; auditoría en la transacción) y los endpoints `POST /accounts/{account_id}/close` y `DELETE /accounts/{account_id}` en `backend/app/api/v1/accounts.py`; verificar que `require_open` se aplica en todas las escrituras de US2 a US4; regenerar los tipos
- [X] T053 [P] [US5] Test unitario (primero) en `web/src/__tests__/components/AccountActions.test.tsx` (parte de Owner): "Cerrar" muestra un diálogo que avisa que es definitivo; "Dar de baja" muestra "Continuar" y "Cancelar", con "Cancelar" no llama a la acción y con "Continuar" llama y lleva a `/accounts`; un miembro no ve esas acciones; con la Cuenta Cerrada no hay controles de edición ni de invitación, se ve la marca "Cerrada" y "Dar de baja" sigue disponible para el Owner
- [X] T054 [US5] Agregar `closeAccountAction` y `deleteAccountAction` en `web/src/app/actions/accounts.ts`, las acciones de Owner en `web/src/components/accounts/AccountActions.tsx`, y el modo de solo lectura de Cuenta Cerrada en `web/src/app/(private)/accounts/[accountId]/page.tsx`, `AccountEditForm.tsx`, `ParticipantList.tsx` e `InvitePanel.tsx`
- [X] T055 [P] [US5] Test unitario (primero) en `mobile/src/__tests__/screens/accountClose.test.tsx`: mismas reglas que Web para cerrar, dar de baja y el modo de solo lectura
- [X] T056 [US5] Agregar `close` y `remove` en `mobile/src/services/api/accounts.ts`, y las acciones de Owner y el modo de solo lectura en `mobile/src/screens/accounts/AccountDetailScreen.tsx`

**Checkpoint**: las cinco User Stories funcionan por su lado.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T057 [P] Extender `backend/tests/integration/test_no_sensitive_data.py` con el flujo de Cuentas: ningún `inviteCode` en `audit_logs` ni en los logs de la aplicación, y ningún nombre de Cuenta o participante en los logs
- [X] T058 [P] Agregar a `backend/tests/perf/test_latency.py` la medición de `GET /api/v1/accounts` con 100 Cuentas del usuario (p95 < 200 ms)
- [X] T059 [P] Verificar que pasan los tests de paridad de catálogos (`web/src/__tests__/i18n/messagesParity.test.ts`, `mobile/src/__tests__/i18n/localesParity.test.ts`) y el de inmutabilidad de auditoría (`backend/tests/unit/test_audit_immutability.py`) con las claves y módulos nuevos
- [X] T060 Actualizar `README.md` (rutas nuevas y el deep link `myexpenses://invite/<code>`) y la tabla de tests de `specs/002-account-management/quickstart.md` si cambió algún nombre de archivo
- [X] T061 Correr `uv run ruff check .` y `uv run ruff format --check .` en `backend/`, `npm run lint`, `npx tsc --noEmit` y `npm test` en `web/` y `mobile/`, y `npx next build` en `web/`; corregir lo que falle
- [X] T062 Validar los 10 escenarios manuales de `specs/002-account-management/quickstart.md` en Web y en Mobile

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las User Stories. Backend: T003 →
  T004/T005/T006/T007 → T008 → T009 (test) → T010 → T011. Web (T012–T015) y Mobile (T016–T018) son
  independientes del backend en esta fase.
- **US1 (Phase 3)**: depende de Foundational. Las demás historias usan la Cuenta creada en US1, así que
  conviene hacer US1 primero.
- **US2–US5 (Phases 4–7)**: dependen de US1 (necesitan crear y leer Cuentas). Entre sí son
  independientes en el backend, salvo que comparten `account_service.py` y `accounts.py`.
- **Polish (Phase 8)**: después de las User Stories que se quieran entregar.

### Within Each User Story

- Tests primero (tienen que fallar), después servicio, endpoint, regenerar tipos, y clientes.
- `backend/app/services/account_service.py`, `backend/app/api/v1/accounts.py`,
  `web/src/app/actions/accounts.ts` y `mobile/src/services/api/accounts.ts` los tocan varias
  historias: esas tareas van en secuencia.

### Parallel Opportunities

- Foundational: T004, T005, T006 y T007; todo el bloque Web (T012–T015) en paralelo con el bloque
  Mobile (T016–T018) y con el backend.
- Dentro de cada historia: los tests marcados [P]; y, con los tipos regenerados, Web en paralelo con
  Mobile.

---

## Parallel Example: User Story 2

```bash
# Tests de backend en paralelo:
Task: "T029 Test de contrato en backend/tests/contract/test_invitations_contract.py"
Task: "T030 Test de integración en backend/tests/integration/test_invitations.py"

# Con el backend de US2 listo y los tipos regenerados (T032), clientes en paralelo:
Task: "T033-T035 InvitePanel, JoinAccountForm, /invite/[code] y el regreso tras registrarse en web/"
Task: "T036-T037 usePendingInvite, Join e Invitation en mobile/"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 y Phase 2.
2. Phase 3 (US1).
3. **Parar y validar**: quickstart, escenario 1, en Web y en Mobile.

### Incremental Delivery

1. US1 → Cuentas propias (MVP).
2. US2 → Cuentas compartidas: es lo que le da sentido al producto.
3. US3 y US4 → edición y salida.
4. US5 → cierre y baja.
5. Polish → feature completa según el criterio de listo del quickstart.

---

## Implementation Notes (2026-11-06)

- T062 queda abierta: la validación manual con dos usuarios (invitación entre cuentas distintas,
  carrera, salida) y todo Mobile en un development build la hace el usuario. Se probó a mano en la
  Web, con un usuario: alta, detalle, invitación propia ("ya sos miembro"), invitación inválida,
  diálogo de baja con "Continuar"/"Cancelar", baja lógica auditada, y el regreso a `/accounts` tras
  el login.
- Hallazgos durante la implementación:
  - Transacciones concurrentes sobre la misma Cuenta generan conflictos de escritura en MongoDB.
    Se agregó `run_in_transaction` (`backend/app/db/client.py`), que usa `with_transaction` y los
    reintenta: así la segunda persona que elige el mismo participante recibe `409 participant_taken`
    y dos ediciones simultáneas de campos distintos se conservan.
  - El servidor de desarrollo de Next.js imprimía los argumentos de las Server Actions (incluidas
    contraseñas). Se desactivó con `logging.serverFunctions: false` en `web/next.config.ts`
    (Principio VI).
  - La fecha de "Mis Cuentas" usaba un formato con nombre inexistente y se mostraba cruda; se pasó a
    `{ dateStyle: "medium" }` con test en `es` y `en`.
- Desvíos de rutas respecto de las tareas:
  - Mobile: `AccountIcon`, `IconPicker` y `ConfirmDialog` están en
    `mobile/src/components/accounts/AccountBits.tsx`; la lista de participantes, el panel de
    invitación y las acciones están dentro de `mobile/src/screens/accounts/AccountDetailScreen.tsx`;
    `JoinScreen` e `InvitationScreen` están en `mobile/src/screens/accounts/JoinScreens.tsx`. Los
    tests de `usePendingInvite` están en `mobile/src/__tests__/screens/join.test.tsx` y el de
    `ConfirmDialog` en `mobile/src/__tests__/screens/accounts.test.tsx`.
  - Web: se agregó `/join` (pegar un código) y `web/src/components/accounts/AccountDetail.tsx`, que
    agrupa el detalle; los íconos usan emojis.
  - Variable nueva `EXPO_PUBLIC_WEB_BASE_URL` (Mobile arma con ella el enlace web que comparte).

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [USn] vincula la tarea con su User Story.
- Verificar que los tests fallan antes de implementar.
- Commits en inglés, después de cada tarea o grupo lógico.
- Los gastos todavía no existen: los efectos de quitar un participante o de dar de baja la Cuenta sobre
  los gastos se implementan en la feature de Gastos, filtrando por `isDeleted` y por `removedAt`.
