---

description: "Task list for feature 005: Data Export"
---

# Tasks: Exportar datos

**Input**: documentos de diseño en `specs/005-data-export/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: están incluidos. El Principio VII de la constitución exige tests escritos antes de
implementar para la exactitud de los importes, los permisos y la privacidad, y al menos un test
unitario con Jest por feature en Web y en Mobile. Los tests de cada fase se escriben primero y
tienen que fallar antes de implementar.

**Organización**: las tareas están agrupadas por User Story, para implementar y probar cada una por
separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: la User Story a la que pertenece (US1 o US2).
- Cada tarea indica la ruta exacta del archivo.

## Convenciones

- **Capas**: `repositories` → `services` (`export_builder` y `export_render` puros,
  `export_service` con I/O) → `api/v1`. Sin schemas Pydantic de respuesta: los endpoints devuelven
  un `Response` binario; el modelo intermedio son `dataclass` congeladas.
- **Idioma**:
  - Código, identificadores, claves del JSON y rutas van en inglés.
  - Encabezados, nombres de tablas y valores traducibles del archivo salen de
    `backend/app/core/export_labels.py` (`es`/`en`), según `Accept-Language`.
  - Los textos de la interfaz salen de `web/src/i18n/messages/` y `mobile/src/i18n/locales/`.
- **Dinero**: los importes salen siempre de unidades menores con `format_amount`; nunca `float` en
  Python ni `number` en TypeScript.
- **Privacidad**: el modelo intermedio copia solo campos permitidos ([research.md](research.md)
  R9). Nada del contenido exportado va a los logs.
- **Permisos**: se reutiliza `require_member` (`404 not_found` a quien no es miembro).
- **Tipos**: se regeneran con `npm run gen:api` cuando cambia el contrato.
- **Datos de prueba**: el ejemplo base es el de la feature 004 (Ana paga 90,00 entre tres y
  Leandro le reembolsa 30,00 → Ana +30,00, Leandro 0,00, Javier −30,00).

---

## Phase 1: Setup

**Purpose**: confirmar el punto de partida e instalar los módulos de Mobile.

- [X] T001 Confirmar que se trabaja en la rama `005-data-export`, creada desde `004-balances-settlements`. Verificar que antes de empezar pasan `uv run pytest` en `backend/` y `npm test` en `web/` y en `mobile/`.
- [X] T002 [P] Instalar en Mobile `expo-sharing` y declarar `expo-file-system` con `npx expo install expo-sharing expo-file-system` (versiones de Expo SDK 56) en `mobile/package.json`. Agregar sus mocks de Jest en `mobile/jest.setup.ts` (`shareAsync`, `isAvailableAsync`, `File`, `Paths`).

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: el modelo intermedio puro, los dos renderizadores, las etiquetas traducidas, la sesión
snapshot y la auditoría. Las dos User Stories los usan.

**⚠️ CRITICAL**: ninguna User Story empieza antes de terminar esta fase.

### Backend

- [X] T003 [P] Crear `backend/app/core/export_labels.py` con `LABELS: dict[Language, ...]` para `es` y `en` (research R5, R7; data-model "Tablas CSV"):
  - Nombres de archivo de las tablas (`cuenta.csv` / `account.csv`, ..., `perfil.csv` / `profile.csv`) y prefijo del archivo descargado (`chepagame` / `chepagame`).
  - Encabezados de cada columna de cada tabla.
  - Sí/No, las 11 categorías (`other`, `home`, `car`, `hotel`, `beach`, `food`, `money`, `travel`, `party`, `shopping`, `sports`), idioma y tema.
  - Test en `backend/tests/unit/test_export_labels.py`: `es` y `en` tienen exactamente las mismas claves y ninguna está vacía.
- [X] T004 [P] Agregar en `backend/app/db/client.py` el context manager `snapshot_session()`, que abre `client.start_session(snapshot=True)` (research R3). Agregar `session` opcional a `accounts.list_for_member` en `backend/app/repositories/accounts.py` (`find_for_member` ya lo acepta).
- [X] T005 [P] Agregar `active_for_export(account_ids, session)` en `backend/app/repositories/expenses.py` y en `backend/app/repositories/settlements.py`:
  - Solo `isDeleted: False`, filtrado con `$in`, orden `date` desc, `createdAt` desc, `_id` desc (FR-005).
  - Proyección sin `clientRequestId`, `createdBy`, `deletedBy` ni `version` (research R9).
- [X] T006 [P] Extender `backend/app/services/audit_service.py`: `AuditAction` agrega `account.exported` y `user.data_exported` (data-model "Audit Log Entry"). El test `backend/tests/unit/test_audit_immutability.py` sigue pasando.
- [X] T007 Escribir tests unitarios de `build_account_export` en `backend/tests/unit/test_export_builder.py`. Se escriben primero y tienen que fallar. Casos:
  - Ejemplo base: un gasto de 9000 con tres partes de 3000, el reembolso Leandro → Ana, saldos +3000 / 0 / −3000 y una sugerencia Javier → Ana 3000; iguales a `compute_balances` y `suggest_transfers`.
  - Centavos no divisibles (100,00 entre tres): las partes suman el importe y el centavo va al primero según el orden de la Cuenta.
  - Test de propiedades con `random.Random(seed)`: en 200 Cuentas aleatorias, las partes de cada gasto suman su importe y los saldos suman 0 (SC-001).
  - Moneda JPY: importes sin decimales.
  - Gasto pendiente (`paidById = None` o sin participantes): `isPending = true` y `paidBy = None`.
  - Reembolso con una punta quitada: `isExcluded = true`; el participante quitado figura con `isRemoved = true` y no tiene saldo.
  - Participante desvinculado: figura solo con su nombre.
  - Cuenta Cerrada y Cuenta sin gastos ni reembolsos (listas vacías, saldos en 0).
  - Orden de gastos y reembolsos igual al de entrada (ya viene ordenado de la base).
  - Privacidad: el resultado no contiene `userId`, `ownerId`, `inviteCode`, `createdBy` ni `clientRequestId`, aunque los documentos de entrada los tengan.
  - `categoryLabel` en `es` y en `en`.
- [X] T008 Crear `backend/app/services/export_builder.py` sin I/O, hasta que pase T007:
  - `dataclass` congeladas `ParticipantRow`, `ExpenseRow` (con `shares`), `SettlementRow`, `BalanceRow`, `SuggestionRow`, `AccountExport`, `ProfileExport` y `PersonalExport` (data-model "Modelo del archivo exportado").
  - `build_account_export(account, expenses, settlements, language) -> AccountExport`, que reutiliza `split_equal`, `compute_balances`, `suggest_transfers`, `is_pending` y `format_amount`.
  - Copia solo campos permitidos (research R9).
- [X] T009 Escribir tests unitarios de los renderizadores en `backend/tests/unit/test_export_render.py`. Se escriben primero y tienen que fallar. Casos:
  - `render_csv_zip` de una Cuenta: el ZIP tiene los siete archivos con los nombres en `es` y en `en`; cada uno empieza con BOM UTF-8, usa `,` y `\r\n`, y tiene los encabezados en la primera fila aunque no haya filas.
  - Importes con punto decimal (`90.00`, `-30.00`, `1500` en JPY) y fechas `AAAA-MM-DD`; sí/no traducidos.
  - Textos con comas, comillas, saltos de línea y emojis: `csv.reader` los lee de vuelta idénticos.
  - Inyección de fórmulas (research R6): conceptos, descripciones, nombres de Cuenta y de participantes que empiezan con `=`, `+`, `-`, `@`, tab o `\r` salen con `'` adelante; los importes negativos no. Un participante llamado `=1+1` sale como `'=1+1` en `participantes.csv`, en las columnas Pagador y Participantes de `gastos.csv`, y en `partes.csv`, `reembolsos.csv`, `saldos.csv` y `sugerencias.csv`.
  - `render_json`: `formatVersion`, `exportedAt` con `Z`, `language`, `scope`, claves en `camelCase` iguales en `es` y en `en`; importes como texto; el texto original sin apóstrofo.
  - CSV y JSON del mismo `AccountExport` tienen la misma cantidad de filas por tabla.
  - `slugify`: acentos, espacios, símbolos, nombre vacío (`cuenta` / `account`) y tope de 40 caracteres.
  - `file_name(scope, slug, format, language, exported_at)`: `chepagame_vacaciones_2026-11-12.zip`, `chepagame_2026-11-12.json`; `content_disposition(...)` con `filename` ASCII y `filename*=UTF-8''`.
- [X] T010 Crear `backend/app/services/export_render.py` sin I/O, hasta que pase T009: `render_csv_zip`, `render_json`, `slugify`, `file_name` y `content_disposition`, con `csv`, `zipfile` (`ZIP_DEFLATED`), `json` e `io.BytesIO` (research R5–R8, contracts "Headers de la respuesta").

### Web

- [X] T011 [P] Agregar en `web/src/i18n/messages/es.json` y `en.json` las claves `exports.*`: "Exportar", "CSV (planilla)", "JSON", "Exportando…", error con "Reintentar", "Exportar mis datos" y su explicación en el Perfil.
- [X] T012 [P] Crear `web/src/lib/download.ts` con `fileNameFromDisposition(header, fallback)` (prefiere `filename*`) y `saveBlob(blob, fileName)` (enlace temporal y `URL.revokeObjectURL`). Test en `web/src/__tests__/lib/download.test.ts`.

### Mobile

- [X] T013 [P] Agregar las mismas claves que T011 en `mobile/src/i18n/locales/es.json` y `en.json`.
- [X] T014 [P] Crear `mobile/src/utils/shareFile.ts` con `fileNameFromDisposition` (mismas reglas que T012) y `shareFile(bytes, fileName, mimeType)`: borra el archivo de la exportación anterior, escribe en `Paths.cache` con `File` de `expo-file-system` y llama a `Sharing.shareAsync(uri, {mimeType, UTI})`; cerrar la hoja sin elegir no es un error. Test en `mobile/src/__tests__/utils/shareFile.test.ts`.
- [X] T015 Agregar `requestFile(path)` en `mobile/src/services/api/client.ts`: usa `fetch` de `expo/fetch`, el mismo refresco de token ante `401` que `request`, y devuelve `{bytes: Uint8Array, fileName, mimeType}`; ante un error lee el JSON `{error: {code}}` y lanza `ApiError` como el resto (research R13). Test en `mobile/src/__tests__/services/requestFile.test.ts`.

**Checkpoint**: el backend arma y renderiza exportaciones probadas sin base de datos. Los clientes
tienen los textos y las utilidades para guardar o compartir un archivo.

---

## Phase 3: User Story 1 - Exportar una Cuenta (Priority: P1) 🎯 MVP

**Goal**: cualquier miembro exporta una Cuenta, abierta o Cerrada, en CSV o JSON desde un botón
junto a las pestañas.

**Independent Test**: con el ejemplo base, el miembro exporta en CSV y en JSON desde Web y Mobile y
obtiene el gasto con sus partes, el reembolso y los saldos +30,00 / 0,00 / −30,00 (quickstart,
escenarios 1 a 8).

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Test de contrato en `backend/tests/contract/test_account_export_contract.py`:
  - `GET /api/v1/accounts/{id}/export?format=json` da `200` con `application/json; charset=utf-8`, `Content-Disposition` con `filename` y `filename*`, y `Cache-Control: no-store`; el cuerpo tiene la forma `ExportDocument` con `scope: "account"`.
  - `format=csv` da `200` con `application/zip` y un ZIP válido.
  - `format` ausente u otro valor: `422 validation_error`.
  - Sin token: `401`. Quien no es miembro, Cuenta inexistente o dada de baja: `404 not_found` con el mismo cuerpo.
- [X] T017 [P] [US1] Test de integración en `backend/tests/integration/test_account_export.py`:
  - El contenido coincide con `GET .../balances` y con `GET .../expenses` en el mismo momento.
  - Gastos y reembolsos eliminados no aparecen; los de otra Cuenta tampoco.
  - Cuenta Cerrada: se exporta igual.
  - Con `Accept-Language: en`: archivos y encabezados en inglés, mismos importes.
  - Auditoría: una entrada `account.exported` con `metadata.format`, `actorUserId` y `accountId`, sin datos exportados; un `404` no deja entrada.
  - Privacidad (SC-007): en el JSON y en cada CSV no aparecen el email de ningún usuario, ningún id de usuario, el `inviteCode` ni los `clientRequestId`.
  - Si `audit_service.record` falla, la respuesta es `500` y no hay archivo.
  - La membresía se comprueba en la misma lectura de un único momento: con `find_for_member` simulado para que devuelva `None` dentro de esa lectura, la respuesta es `404` y no hay auditoría.

### Implementation for User Story 1

- [X] T018 [US1] Crear `backend/app/services/export_service.py` con `export_account(account_id, user_id, format, language) -> ExportFile(content, media_type, file_name)`:
  - Dentro de `snapshot_session()`, verificar la membresía con `find_for_member(account_id, user_id, session)` y responder `404 not_found` si no la encuentra (mismo cuerpo que `require_member`). Así la Cuenta, los gastos y los reembolsos se leen en el mismo momento en que se comprueba el permiso. Después, las lecturas de gastos y reembolsos en la misma sesión.
  - `build_account_export` y el renderizador según `format`.
  - Registra `account.exported` después de generar y antes de devolver.
  - No escribe nombres, importes ni contenido en los logs (FR-016).
- [X] T019 [US1] Crear `backend/app/api/v1/exports.py` con `GET /accounts/{account_id}/export` (`format: Literal["csv","json"]` obligatorio en la query, idioma con `resolve_language`) que devuelve `Response` con los headers del contrato. Incluir el router en `backend/app/main.py`.
- [X] T020 [US1] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`.
- [X] T021 [P] [US1] Tests en `web/src/__tests__/api/exportAccountRoute.test.ts`, escritos primero: el Route Handler responde `401` sin sesión, reenvía `Accept-Language`, el cuerpo binario, `Content-Type` y `Content-Disposition` del backend con `Cache-Control: no-store`, y propaga el status y el JSON de un error (`404`). Con el Perfil en `en` y el navegador en `es-AR`, el backend recibe `Accept-Language: en`.
- [X] T022 [US1] Crear `web/src/app/api/exports/accounts/[accountId]/route.ts` (`POST`, `format` en la query) con `getAccessToken` y `fetch` al backend, hasta que pase T021. El token nunca sale del servidor. El idioma sale de `getLocale()` de next-intl (el del Perfil y, si no hay, el del navegador) y se manda como `Accept-Language`; nunca se copia el header del navegador.
- [X] T023 [P] [US1] Test en `web/src/__tests__/components/ExportButton.test.tsx`, escrito primero: abre el menú con "CSV (planilla)" y "JSON"; al elegir uno llama al handler con el formato, muestra "Exportando…" y desactiva el botón (un segundo clic no hace otro pedido); al terminar llama a `saveBlob` con el nombre del header; ante un error muestra el mensaje y "Reintentar", que repite el pedido. Con dos clics (Exportar → formato) se hace el pedido (SC-002).
- [X] T024 [US1] Crear `web/src/components/exports/ExportButton.tsx` (componente cliente con `endpoint` como prop) hasta que pase T023, y agregarlo al encabezado de `web/src/app/(private)/accounts/[accountId]/page.tsx` y de `web/src/app/(private)/accounts/[accountId]/balances/page.tsx`, también con la Cuenta Cerrada.
- [X] T025 [P] [US1] Crear `mobile/src/services/api/exports.ts` con `exportAccount(accountId, format)`, que usa `requestFile`.
- [X] T026 [P] [US1] Test en `mobile/src/__tests__/components/exportButton.test.tsx`, escrito primero: `Menu` con los dos formatos; progreso y botón desactivado durante el pedido (doble toque no repite); llama a `shareFile` con los bytes, el nombre y el tipo; ante un error muestra el mensaje y "Reintentar"; cerrar la hoja sin elegir no muestra error. Con dos toques (Exportar → formato) se hace el pedido (SC-002).
- [X] T027 [US1] Crear `mobile/src/components/exports/ExportButton.tsx` (con una función `run(format)` como prop) hasta que pase T026, y agregarlo a `mobile/src/screens/expenses/AccountExpensesScreen.tsx` y `mobile/src/screens/balances/AccountBalancesScreen.tsx`, junto a `AccountTabs`.
- [X] T028 [P] [US1] Test de rendimiento en `backend/tests/perf/test_export_perf.py`: una Cuenta con 500 gastos y 100 reembolsos, `format=csv` y `json`, p95 < 1 s en la API (SC-003).

**Checkpoint**: US1 funciona por su lado: se exporta una Cuenta en Web y en Mobile.

---

## Phase 4: User Story 2 - Exportar todos mis datos (Priority: P2)

**Goal**: desde el Perfil, el usuario exporta su perfil y todas las Cuentas de las que es miembro.

**Independent Test**: un usuario miembro de una Cuenta ARS abierta y una USD Cerrada exporta todo
en JSON y en CSV y obtiene su perfil y las dos Cuentas completas, cada una en su moneda
(quickstart, escenario 9).

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Agregar a `backend/tests/unit/test_export_builder.py` y `backend/tests/unit/test_export_render.py` los casos de `build_personal_export` y del render "todo", escritos primero:
  - El perfil copia solo nombre, apellido, email propio, idioma, moneda por defecto y tema; nunca `passwordHash`, `authProviders`, `pendingEmail` ni ids de Google.
  - Cuentas ordenadas por nombre, cada una con su moneda; sin Cuentas, solo el perfil.
  - ZIP con `perfil.csv` / `profile.csv` en la raíz y una carpeta `<slug>_<últimos 6 del id>` por Cuenta con las siete tablas; dos Cuentas con el mismo nombre no chocan.
  - JSON con `scope: "all"`, `profile` y `accounts`.
  - Un nombre de perfil que empieza con `=` sale protegido en `perfil.csv`.
- [X] T030 [P] [US2] Test de contrato en `backend/tests/contract/test_my_export_contract.py`: `GET /api/v1/users/me/export` con `format=json` y `csv` da `200` con los headers del contrato y el nombre `chepagame_<fecha>`; `422` con `format` inválido; `401` sin token.
- [X] T031 [P] [US2] Test de integración en `backend/tests/integration/test_my_export.py`:
  - Incluye las Cuentas abiertas y Cerradas de las que es miembro; no las que abandonó, las dadas de baja ni las ajenas (FR-007).
  - Usuario sin Cuentas: solo el perfil.
  - Cada importe con la moneda de su Cuenta; nada suma monedas distintas.
  - Auditoría: una entrada `user.data_exported` con `format` y `accountCount`.
  - Privacidad: el único email en los archivos es el del propio usuario; ningún id de usuario.

### Implementation for User Story 2

- [X] T032 [US2] Agregar en `backend/app/services/export_builder.py` `build_personal_export(user, accounts, expenses_by_account, settlements_by_account, language)` y en `backend/app/services/export_render.py` el render "todo" (perfil y carpetas), hasta que pase T029.
- [X] T033 [US2] Agregar `export_mine(user, format, language)` en `backend/app/services/export_service.py`: en `snapshot_session()`, `list_for_member` y una sola consulta de gastos y una de reembolsos para todas las Cuentas, agrupadas en Python (research R11); registra `user.data_exported`.
- [X] T034 [US2] Agregar `GET /users/me/export` en `backend/app/api/v1/exports.py` y regenerar los tipos de Web y Mobile con `npm run gen:api`.
- [X] T035 [P] [US2] Crear `web/src/app/api/exports/me/route.ts` (`POST`) con los mismos casos de T021 en `web/src/__tests__/api/exportMeRoute.test.ts`, escritos primero. Si conviene, extraer el reenvío común a `web/src/lib/exportProxy.ts`.
- [X] T036 [US2] Agregar en `web/src/app/(private)/profile/page.tsx` la sección "Exportar mis datos" con `ExportButton` apuntando a `/api/exports/me`. Test en `web/src/__tests__/components/ProfileExport.test.tsx`.
- [X] T037 [US2] Agregar `exportMine(format)` en `mobile/src/services/api/exports.ts` y la sección "Exportar mis datos" con `ExportButton` en `mobile/src/screens/ProfileScreen.tsx`. Test en `mobile/src/__tests__/screens/profileExport.test.tsx`.
- [X] T038 [P] [US2] Agregar a `backend/tests/perf/test_export_perf.py` el caso de 20 Cuentas de 500 gastos: p95 < 3 s en la API (SC-004).

**Checkpoint**: las dos User Stories funcionan por su lado en Web y en Mobile.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T039 [P] Verificar que pasan los tests de paridad de catálogos (`web/src/__tests__/i18n/messagesParity.test.ts` y `mobile/src/__tests__/i18n/localesParity.test.ts`), el de `export_labels` y el de inmutabilidad de la auditoría.
- [X] T040 [P] Revisar que `export_service.py`, `exports.py` y los Route Handlers no escriban contenido, nombres ni importes en los logs (FR-016), y que ningún componente nuevo convierta importes a `number`.
- [X] T041 Actualizar `README.md` con una sección "Data export (feature 005)": dónde está el botón, los endpoints, los formatos, el aviso de "Importar CSV" en planillas en español, y que hay que recompilar el development build de Mobile. Agregar el enlace al quickstart de la 005 en "Feature validation".
- [X] T042 Correr `uv run ruff check .` y `uv run ruff format --check .` en `backend/`; `npm run lint`, `npx tsc --noEmit` y `npm test` en `web/` y en `mobile/`; y `npx next build` en `web/`. Corregir lo que falle.
- [X] T043 Validar los 12 escenarios manuales de `specs/005-data-export/quickstart.md` en Web y en Mobile.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no tiene dependencias. T002 puede ir en paralelo con todo el backend.
- **Foundational (Phase 2)**: depende de Setup y bloquea las User Stories.
  - **Backend**: T003 a T006 en paralelo. T007 va antes que T008; T009 antes que T010; T010 usa las filas de T008.
  - **Web**: T011 y T012 en paralelo, sin depender del backend.
  - **Mobile**: T013, T014 y T015 en paralelo; T014 depende de T002.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: en el backend depende de T018 y T019 (mismo servicio y mismo router). En los clientes reutiliza `ExportButton` (T024 y T027).
- **Polish (Phase 5)**: después de las User Stories que se quieran entregar.

### Within Each User Story

- El orden es: tests primero (tienen que fallar), después servicio, endpoint, regenerar tipos y clientes.
- Archivos compartidos entre historias, que van en secuencia: `backend/app/services/export_builder.py`, `export_render.py`, `export_service.py`, `backend/app/api/v1/exports.py` y `mobile/src/services/api/exports.ts`.

### Parallel Opportunities

- **Foundational**: T003, T004, T005 y T006 en el backend; T011–T012 en Web y T013–T015 en Mobile, mientras se hace el backend.
- **Tests de cada historia** marcados [P]: T016 y T017; T029, T030 y T031.
- **Web y Mobile de US1**: T021–T024 y T025–T027 en paralelo después de T020.
- **Perf**: T028 y T038 en paralelo con los clientes.

## Parallel Example: User Story 1

```text
Juntas: T016 (contrato) y T017 (integración)
Después de T018–T020: T021–T024 (Web) y T025–T027 (Mobile) en paralelo, y T028 (perf)
```

## Implementation Strategy

### MVP First (US1)

1. Phase 1 y Phase 2: el modelo intermedio y los renderizadores, probados sin base de datos.
2. US1: exportar una Cuenta. Con eso ya se cumple el Principio VI para el contenido compartido.
3. **STOP and VALIDATE**: escenarios 1 a 8 y 10 a 12 del quickstart.

### Incremental Delivery

1. MVP (US1).
2. US2: exportar todos mis datos desde el Perfil.
3. Polish y validación manual completa.
