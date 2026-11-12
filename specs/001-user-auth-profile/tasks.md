---

description: "Task list for feature 001: User Authentication and Profile Management"
---

# Tasks: Autenticación y Perfil de Usuario

**Input**: documentos de diseño en `specs/001-user-auth-profile/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: incluidos. La constitución (Principio VII, Test-First) exige tests de dominio antes de
implementar, y un test unitario con Jest por feature en Web y en Mobile. Los tests de cada fase se
escriben primero y tienen que fallar antes de implementar.

**Organización**: las tareas están agrupadas por User Story para implementar y probar cada una por
separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: User Story a la que pertenece (US1 a US6).
- Cada tarea indica la ruta exacta del archivo.

## Convenciones

- Tres proyectos hermanos en la raíz: `backend/`, `web/`, `mobile/` (ver plan.md).
- Código, identificadores, colecciones, campos, rutas, commits y textos técnicos en inglés (Principio
  V). Los textos visibles al usuario salen de los archivos de traducción `es`/`en`, nunca
  hardcodeados (Principio II).
- Colecciones en plural `snake_case`; campos en `camelCase`; JSON de la API en `camelCase`.
- Ningún secreto en el código ni en el repositorio: todo sale de `.env` (Principio VI).
- Toda escritura sobre `users` y su `audit_logs` va en la misma transacción (R9).
- Los errores de la API siguen `{ error: { code, message, retryAfterSeconds? } }` (contracts/api.md).

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: crear los tres proyectos, sus herramientas y el entorno local.

- [X] T001 Inicializar el repositorio git en la raíz (`git init`), crear la rama `001-user-auth-profile` y quitar el comentario HTML "Sync Impact Report" del principio de `.specify/memory/constitution.md` antes del primer commit
- [X] T002 Agregar a `.env.example` (con valores vacíos o de ejemplo, nunca reales) las variables `CODE_HASH_SECRET=`, `GOOGLE_CLIENT_IDS=` (lista separada por comas de los client IDs web, Android e iOS), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=`, `EMAIL_DELIVERY=resend` (valores `resend` | `console`), `JWT_ISSUER=chepagame-api`, `JWT_AUDIENCE=chepagame-clients`, `REFRESH_TOKEN_EXPIRE_DAYS=30`, `MONGODB_TEST_DB_NAME=chepagame_test`, `AUTH_URL=http://localhost:3000`, `API_INTERNAL_BASE_URL=http://backend:8000/api/v1` (URL del backend que usa el servidor de Next.js dentro de Docker), `ENVIRONMENT=development` (valores `development` | `test` | `production`) y `GOOGLE_IOS_URL_SCHEME=` (URL scheme invertido del client ID de iOS). Agregar `backend/.dev-outbox/` a `.gitignore`
- [X] T003 Crear el proyecto backend con uv en `backend/pyproject.toml` (Python 3.13): dependencias `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `email-validator`, `pymongo`, `pyjwt`, `pwdlib[argon2]`, `google-auth`, `requests`, `resend`, `pycountry`, `jinja2`; dependencias de desarrollo `pytest`, `pytest-asyncio`, `httpx`, `ruff`; configurar `[tool.pytest.ini_options]` con `asyncio_mode = "auto"` y `testpaths = ["tests"]`, y `[tool.ruff]` con `target-version = "py313"`. Crear los paquetes vacíos `backend/app/{core,db,schemas,repositories,services,api,api/v1}/__init__.py` y `backend/tests/{unit,integration,contract}/__init__.py`
- [X] T004 [P] Crear el proyecto web en `web/` con `create-next-app` (Next.js ^16.4, App Router, TypeScript, ESLint, directorio `src/`, sin Tailwind obligatorio), y agregar `next-auth@5`, `next-intl`, `next-themes`, `country-to-currency`, `server-only`; dependencias de desarrollo `openapi-typescript`, `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/jest`, `prettier`. En `web/tsconfig.json`, `"strict": true`, y en `web/package.json`, `"engines": { "node": "22.13.0" }` (constitución, Stack). Script `"gen:api": "openapi-typescript http://localhost:8000/api/v1/openapi.json -o src/lib/api/schema.d.ts"` en `web/package.json`
- [X] T005 [P] Crear el proyecto mobile en `mobile/` con `create-expo-app` (Expo SDK ^56, plantilla con Expo Router, TypeScript), y agregar `react-native-paper`, `react-native-safe-area-context`, `@react-native-google-signin/google-signin`, `expo-secure-store`, `expo-localization`, `i18next`, `react-i18next`, `expo-dev-client`; dependencias de desarrollo `jest-expo`, `jest`, `@testing-library/react-native`, `@types/jest`, `openapi-typescript`, `prettier`. En `mobile/tsconfig.json`, `"strict": true`, y en `mobile/package.json`, `"engines": { "node": "22.13.0" }`. Script `"gen:api"` igual al de web pero con salida `src/services/api/schema.d.ts`
- [X] T006 [P] Crear `backend/Dockerfile` basado en `python:3.13-slim` con uv: copia `pyproject.toml` y `uv.lock`, corre `uv sync --frozen`, y arranca `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` (R14)
- [X] T007 [P] Crear `web/Dockerfile` basado en `node:22.13.0-alpine`: `npm ci` y `npm run dev -- --hostname 0.0.0.0 --port 3000` (R14)
- [X] T008 Agregar a `docker-compose.yml` los servicios `backend` (build `./backend`, puerto `127.0.0.1:8000:8000`, volumen `./backend:/app` excluyendo `.venv`, `env_file: .env`, `MONGODB_URI` apuntando a `mongodb:27017`) y `web` (build `./web`, puerto `127.0.0.1:3000:3000`, volumen `./web:/app` excluyendo `node_modules` y `.next`, `env_file: .env`), ambos con `depends_on: mongodb: condition: service_healthy`; el servicio `mongodb` existente no se toca. Validar con `docker compose config`
- [X] T009 [P] Configurar formato y lint: `web/.prettierrc` y `mobile/.prettierrc` (mismas reglas), ESLint de `mobile/` con `eslint-config-expo`, y scripts `lint` y `format` en `web/package.json` y `mobile/package.json`
- [X] T010 [P] Configurar Jest en Web: `web/jest.config.ts` con `next/jest`, `testEnvironment: "jsdom"`, `setupFilesAfterEnv` → `web/jest.setup.ts` (importa `@testing-library/jest-dom`), mapeo de `@/` a `src/`, y script `"test": "jest"` en `web/package.json`
- [X] T011 [P] Configurar Jest en Mobile: `mobile/jest.config.js` con preset `jest-expo`, `setupFiles` → `mobile/jest.setup.ts` con mocks de `expo-secure-store` (almacenamiento en memoria), `@react-native-google-signin/google-signin` (`GoogleSignin.configure`, `hasPlayServices`, `signIn`, `signOut`, `statusCodes`) y `expo-localization` (`getLocales` configurable), y script `"test": "jest"` en `mobile/package.json`

**Checkpoint**: `docker compose up -d` levanta `mongodb` (healthy), `backend` y `web`; `npm test` corre (sin tests) en web y mobile; `uv run pytest` corre en backend.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: núcleo que necesitan todas las User Stories: configuración, Mongo, seguridad, tokens,
códigos, emails, auditoría, `GET/PATCH /users/me`, `POST /auth/refresh`, la sesión en cada cliente,
i18n, tema y el onboarding de moneda (FR-020a), que comparten US1 y US2.

**⚠️ CRITICAL**: ninguna User Story empieza antes de terminar esta fase.

### Backend: núcleo

- [X] T012 Implementar `Settings` en `backend/app/core/config.py` con pydantic-settings leyendo `.env`: `mongodb_uri`, `mongodb_db_name`, `jwt_secret`, `jwt_algorithm` (default `HS256`), `jwt_access_token_expire_minutes` (default 15), `jwt_issuer`, `jwt_audience`, `refresh_token_expire_days` (default 30), `code_hash_secret`, `google_client_ids` (lista parseada desde texto separado por comas), `resend_api_key`, `email_from`, `email_delivery` (`Literal["resend", "console"]`, default `resend`), `email_dev_outbox_path` (default `.dev-outbox/emails.jsonl`), `environment` (`Literal["development", "test", "production"]`, default `development`), con un validador que rechaza `email_delivery="console"` si `environment="production"`; función `get_settings()` con `lru_cache`. Ningún valor por defecto para secretos
- [X] T013 [P] Implementar `backend/app/core/errors.py`: clase `AppError(status_code, code, retry_after_seconds=None)` y los códigos del contrato como constantes (`validation_error`, `rate_limited`, `email_unavailable`, `invalid_code`, `invalid_credentials`, `password_login_locked`, `invalid_google_token`, `google_email_not_verified`, `invalid_refresh_token`, `unauthorized`, `email_taken`)
- [X] T014 [P] Implementar `backend/app/core/i18n.py`: `resolve_language(accept_language: str | None) -> Literal["es", "en"]` (default `es`) y un diccionario de mensajes de error `es`/`en` por cada código de `errors.py`
- [X] T015 [P] Escribir tests unitarios (primero, deben fallar) en `backend/tests/unit/test_security.py`: `normalize_email(" Ana@Mail.com ") == "ana@mail.com"`; hash y verificación Argon2id de contraseña; `validate_password` rechaza menos de 8 caracteres, más de 128 y la contraseña igual al email (sin distinguir mayúsculas); `generate_code()` devuelve 6 dígitos; `hash_code` y `hash_email` son determinísticos con la misma clave y distintos con otra, y `hash_email` da el mismo resultado para `Ana@Mail.com ` y `ana@mail.com`; JWT de acceso contiene `sub`, `iss`, `aud`, `iat`, `exp`, `jti` y vence a los 15 minutos; decodificar con `aud` o `iss` incorrectos, firma inválida o vencido falla; `generate_refresh_token()` da 256 bits en base64url y `hash_refresh_token` es SHA-256 hex
- [X] T016 Implementar `backend/app/core/security.py` para que pasen los tests de T015: `normalize_email` (`strip` + `lower`), `hash_password`/`verify_password` con `pwdlib` `PasswordHash.recommended()` (Argon2id) y `verify_and_update` para rehash, `DUMMY_PASSWORD_HASH` para igualar tiempos (R7), `validate_password` ("al menos 8 caracteres", máximo 128, "no puede ser igual al email"), `generate_code` con `secrets.randbelow(10**6)` rellenado a 6 dígitos, `hash_code` y `hash_email` (sobre el email normalizado) con HMAC-SHA256 usando `CODE_HASH_SECRET`, `create_access_token(user_id)` y `decode_access_token(token)` con PyJWT, `generate_refresh_token` (`secrets.token_urlsafe(32)`) y `hash_refresh_token` (SHA-256)
- [X] T017 Implementar `backend/app/db/client.py`: `AsyncMongoClient` único creado en el lifespan, `get_database()` (usa `MONGODB_DB_NAME`, o `MONGODB_TEST_DB_NAME` en tests) y un context manager `transaction()` que abre `client.start_session()` + `session.start_transaction()` y hace commit o abort (R9)
- [X] T018 Implementar `backend/app/db/indexes.py` con `ensure_indexes(db)` según data-model.md: `users.email` único; `users.googleSubject` único parcial (`partialFilterExpression: {googleSubject: {$type: "string"}}`); `pending_registrations.email` único y TTL en `expiresAt` (`expireAfterSeconds: 0`); `verification_codes` compuesto `{email: 1, purpose: 1, createdAt: -1}` y TTL de 1 h en `createdAt` (`expireAfterSeconds: 3600`); `auth_attempts` `{emailHash: 1, type: 1, purpose: 1, createdAt: -1}` y TTL de 1 h en `createdAt` (`expireAfterSeconds: 3600`); `refresh_tokens.tokenHash` único, `refresh_tokens.userId`, `refresh_tokens.familyId` y TTL en `expiresAt` (`expireAfterSeconds: 0`); `audit_logs` `{entityType: 1, entityId: 1, createdAt: -1}` y `{actorUserId: 1, createdAt: -1}`
- [X] T019 Implementar `backend/app/main.py`: app FastAPI con `openapi_url="/api/v1/openapi.json"`, lifespan que crea el cliente Mongo y llama a `ensure_indexes`, router `/api/v1` (incluye `auth` y `users`), handlers que convierten `AppError` y `RequestValidationError` al formato `{ error: { code, message, retryAfterSeconds? } }` con el mensaje en el idioma de `Accept-Language`, y header `Retry-After` en los `429` y `423`
- [X] T020 [P] Implementar los schemas comunes en `backend/app/schemas/common.py`: `CamelModel` (Pydantic v2 con `alias_generator=to_camel`, `populate_by_name=True`), `ErrorBody`, `ErrorResponse`, `Accepted` (`status: Literal["accepted"]`)
- [X] T021 [P] Implementar `backend/app/schemas/user.py`: `Preferences` (`language: Literal["es","en"] = "es"`, `defaultCurrency: str | None = None`, `theme: Literal["light","dark","system"] = "system"`), `UserResponse` (`id`, `email`, `firstName: str | None`, `lastName: str | None`, `authProviders: list[Literal["google","email"]]`, `hasPasswordSet: bool`, `pendingEmail: str | None`, `preferences`, `createdAt`, `updatedAt`), y `UpdateMeRequest` (parcial: `firstName`/`lastName` "1–60 caracteres sin contar espacios de los extremos", `null` los borra; `preferences` parcial; `defaultCurrency` validado contra `pycountry.currencies` como ISO 4217)
- [X] T022 [P] Implementar `backend/app/schemas/auth.py`: `TokenPair` (`accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt`), `AuthResponse` (`tokens`, `user`, `isNewUser`), `RefreshRequest` y `LogoutRequest` (`refreshToken`)

### Backend: repositorios

- [X] T023 [P] Implementar `backend/app/repositories/users.py`: `find_by_id`, `find_by_email` (email normalizado), `find_by_google_subject`, `insert`, `update_fields` (actualiza `updatedAt`), todos aceptando `session` opcional para transacciones; `to_user_response(doc)` que deriva `hasPasswordSet = passwordHash != null` y nunca expone `passwordHash` ni `googleSubject`
- [X] T024 [P] Implementar `backend/app/repositories/pending_registrations.py`: `upsert_by_email` (un registro nuevo reemplaza al anterior del mismo email, `expiresAt = createdAt + 24 h`), `find_by_email`, `delete_by_email`
- [X] T025 [P] Implementar `backend/app/repositories/verification_codes.py`: `insert`, `find_latest_valid(email, purpose)` (válido solo si "`consumedAt` e `invalidatedAt` son `null`, `expiresAt > ahora` y `attempts < 5`"), `invalidate_active(email, purpose)`, `increment_attempts`, `mark_consumed`, `mark_invalidated(id)`
- [X] T026 [P] Implementar `backend/app/repositories/refresh_tokens.py`: `insert`, `find_by_hash`, `mark_rotated`, `revoke_family(familyId)`, `revoke_all_for_user(userId, except_family_id=None)`, `revoke_by_hash`
- [X] T027 [P] Implementar `backend/app/repositories/audit_logs.py` con una única operación `insert(entry, session=None)`; el módulo MUST NOT exponer update ni delete (Principio IV). Campos: `actorUserId`, `action`, `entityType: "user"`, `entityId`, `changes` (`{ field: { before, after } }`), `metadata` (`client`, `method`), `createdAt`
- [X] T028 [P] Implementar `backend/app/repositories/auth_attempts.py` según data-model.md: `insert(email_hash, type, purpose=None)` (`type`: `"email_request"` | `"password_failure"` | `"password_lockout"`; `purpose`: `"register"` | `"login"` | `"password_reset"` | `"change_email"` | `null`, solo para `email_request`), `count_since(email_hash, type, purpose, since)`, `latest(email_hash, type, since)`, `delete_by_id(id)` y `delete_failures(email_hash)`. Nunca guarda el email en claro

### Backend: servicios compartidos

- [X] T029 [P] Implementar `backend/app/services/audit_service.py`: `record(action, actor_user_id, entity_id, changes, metadata, session=None)` que descarta cualquier clave sensible (`password`, `passwordHash`, `code`, `codeHash`, `token`, `tokenHash`, `refreshToken`) de `changes` antes de insertar; las acciones válidas son las de data-model.md (`user.registered`, `user.email_verified`, `user.login_succeeded`, `user.login_failed`, `user.login_locked`, `user.google_linked`, `user.password_set`, `user.password_reset`, `user.email_change_requested`, `user.email_changed`, `user.profile_updated`, `user.logged_out`)
- [X] T030 [P] Implementar `backend/app/services/email_service.py`: `send(template, to, language, context)` que renderiza `backend/app/templates/emails/{es,en}/{template}.html` con Jinja2 (autoescape) y envía con el SDK `resend` usando `EMAIL_FROM`; con `EMAIL_DELIVERY=console` no envía: agrega una línea JSON (destinatario, plantilla, idioma, contexto) a `EMAIL_DEV_OUTBOX_PATH` y nunca escribe destinatarios, códigos ni tokens en el log de la aplicación (Principio VI); ante un error del proveedor lanza `AppError(503, "email_unavailable")` (R10). Crear `backend/app/templates/emails/{es,en}/base.html` con el layout común
- [X] T031 Escribir tests de integración (primero, deben fallar) en `backend/tests/integration/test_rate_limit_service.py`: `check_and_record_email_request(email, purpose)` permite el primero, da `rate_limited` con `retryAfterSeconds` al segundo dentro del mismo minuto y al sexto dentro de la hora, y se comporta igual para un email que no es de ningún usuario; `release(attempt_id)` hace que el pedido no cuente; `record_password_failure` 10 veces en 15 minutos deja el email bloqueado y `check_password_lockout` da `password_login_locked` con `retryAfterSeconds` cercano a 900; `clear_password_failures` reinicia el conteo; en `auth_attempts` solo se guarda `emailHash`, nunca el email
- [X] T032 Implementar `backend/app/services/rate_limit_service.py` para que pasen los tests de T031, sobre `repositories/auth_attempts.py` y `hash_email`: "1 por minuto y 5 por hora por email y propósito" para `email_request`, y "10 fallos en 15 minutos bloquean 15 minutos" para la contraseña (R6)
- [X] T033 Escribir tests de integración (primero, deben fallar) en `backend/tests/integration/test_verification_service.py` contra MongoDB real: crear un código guarda solo `codeHash`; un segundo pedido dentro del mismo minuto da `rate_limited` (vía `rate_limit_service`); pedir un código nuevo invalida el anterior del mismo propósito; un código vencido, consumido, invalidado o con 5 intentos no verifica; cada intento fallido suma `attempts` y al llegar a 5 el código queda inválido aunque después se ingrese el correcto; si el envío falla, el código queda con `invalidatedAt` y el pedido se borra de `auth_attempts`, así que se puede reintentar enseguida
- [X] T034 Implementar `backend/app/services/verification_service.py` para que pasen los tests de T033: `issue_code(email, purpose, user_id, language, template, context)` (llama a `rate_limit_service.check_and_record_email_request` con el `purpose` de límite que le pase quien lo llama, invalida el anterior, guarda el HMAC con `expiresAt = ahora + 15 min`, envía el email y si falla marca `invalidatedAt`, llama a `rate_limit_service.release` y propaga el `503`) y `verify_code(email, purpose, code)` (incrementa `attempts` si no coincide, marca `consumedAt` si coincide, lanza `AppError(400, "invalid_code")` en cualquier caso inválido)
- [X] T035 Escribir tests de integración (primero, deben fallar) en `backend/tests/integration/test_token_service.py`: emitir un par crea un `refresh_tokens` con `familyId` nuevo y `expiresAt = ahora + 30 días`; refrescar rota el token (el anterior queda con `rotatedAt`), conserva el `familyId` y extiende `expiresAt` (vencimiento deslizante, FR-013); presentar un token ya rotado revoca toda la familia y da `invalid_refresh_token`; un token revocado o vencido da `invalid_refresh_token`; `revoke_all_for_user(except_family_id)` deja viva solo esa familia
- [X] T036 Implementar `backend/app/services/token_service.py` para que pasen los tests de T035: `issue_token_pair(user_id, client, family_id=None, session=None) -> TokenPair`, `refresh(refresh_token) -> TokenPair` (con detección de reuso) y `revoke_other_sessions(user_id, current_family_id)`; el token opaco solo se guarda como hash
- [X] T037 [P] Implementar `backend/app/services/user_service.py` con `get_me(user_id)` y `update_me(user_id, request)`: aplica solo los campos enviados, recorta espacios de `firstName`/`lastName`, convierte vacío en `null`, normaliza `defaultCurrency` a mayúsculas, y guarda el cambio y su `user.profile_updated` (con `changes` before/after) en una transacción

### Backend: API compartida

- [X] T038 Implementar `backend/app/api/v1/dependencies.py`: `get_current_user` (lee `Authorization: Bearer`, decodifica el JWT validando firma, `iss`, `aud` y `exp`, y comprueba que el usuario exista; si no, `AppError(401, "unauthorized")`), `get_client` (header `X-Client: web | mobile`, default `web`) y `get_language` (de `Accept-Language`)
- [X] T039 [P] Escribir tests de contrato (primero, deben fallar) en `backend/tests/contract/test_users_me_contract.py`: `GET /api/v1/users/me` sin token o con token inválido da `401 unauthorized`; con token válido devuelve `UserResponse` en camelCase sin `passwordHash`; `PATCH /api/v1/users/me` acepta cambios parciales, `null` en `firstName` lo borra, y da `422 validation_error` con moneda no ISO 4217 (`"XXX1"`), idioma `"fr"`, tema `"blue"` o nombre de 61 caracteres
- [X] T040 Implementar `GET /users/me` y `PATCH /users/me` en `backend/app/api/v1/users.py` usando `user_service` y `get_current_user`
- [X] T041 [P] Escribir tests de contrato (primero, deben fallar) en `backend/tests/contract/test_refresh_contract.py`: `POST /api/v1/auth/refresh` devuelve `200 TokenPair` rotado y `401 invalid_refresh_token` para un token desconocido, revocado o reusado
- [X] T042 Crear `backend/app/api/v1/auth.py` con el router `/auth` e implementar `POST /auth/refresh` usando `token_service.refresh`
- [X] T043 Crear `backend/tests/conftest.py`: fuerza `EMAIL_DELIVERY=console` y la base `MONGODB_TEST_DB_NAME`, borra la base entre módulos, crea índices, expone `client` (`httpx.AsyncClient` con `ASGITransport` sobre la app), `email_outbox` (captura los emails enviados por `email_service` para leer los códigos en los tests), `fake_google_verifier` (override de la dependencia de verificación de Google) y una fábrica `create_user(...)` que inserta usuarios de prueba

### Web: base

- [X] T044 Generar `web/src/lib/api/schema.d.ts` con `npm run gen:api` contra el backend levantado (no editar a mano; regenerar cada vez que cambie el contrato)
- [X] T045 [P] Implementar `web/src/lib/api/client.ts` (con `import "server-only"`): `apiFetch(path, { method, body, accessToken, language })` que usa `API_INTERNAL_BASE_URL`, envía `X-Client: web`, `Accept-Language` y `Authorization` si hay token, tipa la respuesta con `schema.d.ts` y convierte los errores en `ApiError { status, code, retryAfterSeconds }`
- [X] T046 [P] Configurar next-intl sin rutas por idioma: `web/src/i18n/request.ts` (idioma tomado de la sesión, o de `Accept-Language` si no hay sesión, default `es`), `web/src/i18n/messages/es.json` y `web/src/i18n/messages/en.json` (claves iniciales: `common`, `errors` por cada `code` del contrato, `onboarding`, `dashboard`), y el plugin en `web/next.config.ts`
- [X] T047 Implementar el núcleo de Auth.js en `web/src/auth.ts`: estrategia `jwt`; el JWT de Auth.js guarda `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `refreshTokenExpiresAt` y `user`; el callback `jwt` renueva con `POST /auth/refresh` cuando faltan menos de 60 segundos para el vencimiento y marca `error: "RefreshTokenError"` si falla; el callback `session` expone solo `user` (nunca los tokens) y `error`; `session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 }` para que la sesión venza tras 30 días sin uso (FR-013); cookies `HttpOnly`, `Secure` en producción, `SameSite=Lax`; helper server-side `getAccessToken()` para Server Components y Server Actions. Los providers se agregan en cada User Story
- [X] T048 [P] Crear `web/src/app/api/auth/[...nextauth]/route.ts` exportando `GET` y `POST` de los handlers de `auth.ts`
- [X] T049 Implementar `web/src/proxy.ts` (Next.js 16): sin sesión o con `error: "RefreshTokenError"`, las rutas de `(private)` redirigen a `/login?callbackUrl=<ruta actual>` para volver a donde estaba después de entrar (edge case de sesión vencida); con sesión y `user.preferences.defaultCurrency === null`, toda ruta privada salvo `/onboarding/currency` redirige allí (FR-020a); con sesión completa, las rutas públicas de auth redirigen a `/dashboard`
- [X] T050 [P] Implementar `web/src/components/AppProviders.tsx` (`ThemeProvider` de next-themes con `attribute="class"`, `defaultTheme="system"`, `enableSystem`, y `NextIntlClientProvider`) y usarlo en `web/src/app/layout.tsx`, que toma `theme` y `language` de la sesión
- [X] T051 [P] Escribir test unitario (primero, debe fallar) en `web/src/__tests__/lib/currencySuggestion.test.ts`: `suggestCurrency(["es-AR"]) === "ARS"`, `suggestCurrency(["pt-BR", "en"]) === "BRL"`, `suggestCurrency(["en"])` usa la región maximizada (`en-Latn-US` → `USD`), y `suggestCurrency(["xx"])` o `[]` devuelve `null` (sin preselección, FR-020a)
- [X] T052 [P] Implementar `web/src/lib/currencySuggestion.ts` (`suggestCurrency(languages: readonly string[]): string | null` con `Intl.Locale(...).maximize().region` y `country-to-currency`) y `web/src/lib/currencies.ts` (lista de códigos ISO 4217 con nombre localizado vía `Intl.DisplayNames`)
- [X] T053 [P] Escribir test unitario (primero, debe fallar) en `web/src/__tests__/components/CurrencySelect.test.tsx`: muestra la moneda sugerida preseleccionada; sin sugerencia no hay nada seleccionado y el botón "Continuar" está deshabilitado hasta elegir
- [X] T054 Implementar `web/src/components/CurrencySelect.tsx` y la página `web/src/app/(private)/onboarding/currency/page.tsx` con una Server Action que llama a `PATCH /users/me` con `preferences.defaultCurrency`, actualiza la sesión (`unstable_update`) y redirige a `/dashboard`
- [X] T055 [P] Implementar `web/src/lib/displayName.ts` (`firstName + " " + lastName` recortado; si ambos son `null`, el email, FR-017) con su test en `web/src/__tests__/lib/displayName.test.ts`, y el layout privado `web/src/app/(private)/layout.tsx` y la página vacía `web/src/app/(private)/dashboard/page.tsx`
- [X] T056 [P] Escribir test unitario (primero, debe fallar) en `web/src/__tests__/components/SiteHeader.test.tsx`: sin sesión muestra Inicio, Cómo funciona, Quiénes somos, Contacto y Login / Registro; con sesión muestra los mismos enlaces informativos y un menú de usuario (con el nombre visible) con Accounts, Profile y Logout; todos los textos salen de las traducciones
- [X] T057 Implementar `web/src/components/SiteHeader.tsx` y `web/src/components/SiteFooter.tsx` según la sección "Estructura de Navegación y UI Base" de la constitución, usarlos en `web/src/app/layout.tsx`, crear las páginas informativas mínimas `web/src/app/page.tsx` (Inicio), `web/src/app/(public)/how-it-works/page.tsx`, `web/src/app/(public)/about/page.tsx` y `web/src/app/(public)/contact/page.tsx` (contenido provisorio traducido), y agregar las claves `nav.*` y `footer.*` en `web/src/i18n/messages/{es,en}.json`. En el menú, Accounts queda deshabilitado hasta la feature de Cuentas, y Logout se conecta en US6

### Mobile: base

- [X] T058 Generar `mobile/src/services/api/schema.d.ts` con `npm run gen:api` (no editar a mano)
- [X] T059 [P] Implementar `mobile/src/services/auth/tokenStorage.ts` con `expo-secure-store`: `saveTokens(TokenPair)`, `getTokens()`, `clearTokens()`; nunca `AsyncStorage`
- [X] T060 [P] Escribir test unitario (primero, debe fallar) en `mobile/src/__tests__/services/apiClient.test.ts`: agrega `Authorization`, `X-Client: mobile` y `Accept-Language`; ante un `401` refresca una sola vez con `POST /auth/refresh`, guarda el par nuevo y reintenta; si el refresh falla, borra los tokens y emite el evento `sessionExpired`; dos requests simultáneos que reciben `401` comparten un único refresh
- [X] T061 Implementar `mobile/src/services/api/client.ts` para que pase el test de T060, con `EXPO_PUBLIC_API_BASE_URL` como base y errores tipados `ApiError { status, code, retryAfterSeconds }`
- [X] T062 [P] Configurar i18next en `mobile/src/i18n/index.ts` (idioma inicial del usuario o del dispositivo vía `expo-localization`, solo `es`/`en`, default `es`) con `mobile/src/i18n/locales/es.json` y `mobile/src/i18n/locales/en.json` (mismas claves que web: `common`, `errors`, `onboarding`, `dashboard`)
- [X] T063 [P] Implementar `mobile/src/theme/index.ts` con temas MD3 claro y oscuro de React Native Paper, y `useAppTheme(themePreference)` que devuelve el tema según `light`/`dark`, o según `useColorScheme()` si es `system`
- [X] T064 Escribir test unitario (primero, debe fallar) en `mobile/src/__tests__/hooks/useAuth.test.tsx`: al iniciar con tokens guardados carga `GET /users/me` y queda `status: "authenticated"`; sin tokens queda `"unauthenticated"`; `signInWithTokens(authResponse)` guarda los tokens y el usuario; el evento `sessionExpired` lo pasa a `"unauthenticated"` sin perder la ruta actual (edge case de sesión vencida)
- [X] T065 Implementar `mobile/src/hooks/useAuth.tsx` (`AuthProvider` + `useAuth()` con `status`, `user`, `signInWithTokens`, `refreshUser`, `setUser`) para que pase el test de T064
- [X] T066 Implementar `mobile/app/_layout.tsx`: `AuthProvider`, `PaperProvider` con `useAppTheme`, i18n con el idioma del usuario, y redirecciones de Expo Router: sin sesión → grupo `(auth)`; con sesión y `defaultCurrency === null` → `(app)/onboarding-currency`; si no → `(app)/index`. Agregar `mobile/app/(auth)/_layout.tsx` y `mobile/app/(app)/_layout.tsx`
- [X] T067 [P] Escribir test unitario (primero, debe fallar) en `mobile/src/__tests__/screens/OnboardingCurrency.test.tsx`: con `getLocales()[0].currencyCode = "ARS"` la opción viene preseleccionada; con `currencyCode = null` no hay selección y "Continuar" está deshabilitado; al confirmar llama a `PATCH /users/me` y navega al Dashboard
- [X] T068 Implementar `mobile/src/components/CurrencyPicker.tsx` y la pantalla `mobile/app/(app)/onboarding-currency.tsx` para que pase el test de T067
- [X] T069 [P] Implementar `mobile/src/utils/displayName.ts` (misma regla que web, FR-017) con su test en `mobile/src/__tests__/utils/displayName.test.ts`, y el Dashboard vacío `mobile/app/(app)/index.tsx` con el nombre visible y acceso a Perfil

**Checkpoint**: backend con `GET/PATCH /users/me` y `/auth/refresh` probados; Web y Mobile con sesión, i18n, tema, onboarding de moneda y Dashboard vacío. Ya se puede empezar cualquier User Story.

---

## Phase 3: User Story 1 - Registro e inicio de sesión con email y contraseña (Priority: P1) 🎯 MVP

**Goal**: registrarse con email y contraseña, verificar el email con un código, elegir la moneda y
entrar; después, volver a entrar con email y contraseña.

**Independent Test**: registrar un email nuevo, verificarlo con el código recibido, elegir la
moneda, cerrar la app o la pestaña y volver a entrar con la contraseña, en Web y en Mobile
(quickstart, escenarios 1, 2, 3 y 6).

### Tests for User Story 1 ⚠️

> Escribirlos primero; tienen que fallar antes de implementar.

- [X] T070 [P] [US1] Test de contrato en `backend/tests/contract/test_register_login_contract.py`: `POST /auth/register` da `202 {status:"accepted"}` con el mismo cuerpo exista o no el email; `422 validation_error` con contraseña de 7 caracteres o igual al email; `POST /auth/register/resend` da `202`; `POST /auth/register/verify` da `201 AuthResponse` con `isNewUser: true` o `400 invalid_code`; `POST /auth/login` da `200 AuthResponse`, `401 invalid_credentials` (mismo cuerpo exista o no el email) o `423 password_login_locked` con `retryAfterSeconds`; ninguna respuesta incluye `passwordHash`, códigos ni hashes
- [X] T071 [P] [US1] Test de integración en `backend/tests/integration/test_email_registration.py`: el registro crea un `pending_registrations` y no un `users`; con el pendiente sin verificar, `POST /auth/login` da `401 invalid_credentials` (FR-003); verificar con el código del `email_outbox` crea el usuario con `authProviders: ["email"]`, `preferences.defaultCurrency: null`, `language` del registro, borra el pendiente e inserta `user.registered` y `user.email_verified` en la misma transacción; registrar de nuevo el mismo email antes de verificar reemplaza el pendiente (corregir el email); registrar un email ya existente no crea nada, responde `202` y envía la plantilla `account_exists` al dueño (escenario 5); `Ana@Mail.com ` y `ana@mail.com` son el mismo email (FR-015)
- [X] T072 [P] [US1] Test de integración en `backend/tests/integration/test_password_login.py`: login correcto devuelve tokens e inserta `user.login_succeeded`; incorrecto inserta `user.login_failed`; 10 fallos en 15 minutos bloquean el login con contraseña por 15 minutos (`423` con `retryAfterSeconds`, `user.login_locked`) incluso con la contraseña correcta; un login exitoso antes del décimo fallo reinicia el conteo; con un email inexistente, los primeros 9 intentos dan el mismo `401` y el décimo da el mismo `423` que con un email existente (FR-008); un email inexistente ejecuta un hash de prueba (verificar que se llama a `verify_password` con `DUMMY_PASSWORD_HASH`)

### Implementation for User Story 1

- [X] T073 [P] [US1] Agregar a `backend/app/schemas/auth.py`: `RegisterRequest` (`email: EmailStr`, `password` de 8 a 128 caracteres, `firstName`/`lastName` opcionales de "1–60 caracteres sin contar espacios de los extremos", `language: Literal["es","en"] = "es"`), `ResendRegistrationRequest` (`email`), `VerifyCodeRequest` (`email`, `code` de exactamente 6 dígitos) y `LoginRequest` (`email`, `password`)
- [X] T074 [P] [US1] Crear las plantillas de email `backend/app/templates/emails/{es,en}/verify_email.html` (código y vencimiento de 15 minutos) y `backend/app/templates/emails/{es,en}/account_exists.html` ("ya tenés una cuenta": enlaces a iniciar sesión y a recuperar la contraseña, sin código)
- [X] T075 [US1] Implementar en `backend/app/services/auth_service.py`: `register(request, language)` (valida la contraseña con `validate_password`; calcula el hash Argon2id **antes** de comprobar si el email existe, para igualar los tiempos (R7); aplica `rate_limit_service` con `purpose: "register"` en ambos casos; si el email ya está en `users`, envía `account_exists` y no crea nada; si no, `upsert_by_email` en `pending_registrations` con el hash Argon2id y emite el código `verify_email` con `userId: null`), `resend_registration(email)` (aplica el límite `register` siempre y emite otro código solo si existe el pendiente; responde igual en ambos casos) y `verify_registration(email, code, client)` (verifica el código y, en una transacción, crea el `users` desde el pendiente, borra el pendiente, inserta `user.registered` y `user.email_verified` y emite el par de tokens)
- [X] T076 [US1] Implementar `login_password(email, password, client)` en `backend/app/services/auth_service.py`: primero `rate_limit_service.check_password_lockout(email)` (si hay bloqueo, `423 password_login_locked` con `retryAfterSeconds`, sin verificar la contraseña); si el usuario no existe o no tiene `passwordHash`, verifica contra `DUMMY_PASSWORD_HASH`; en un fallo (exista o no el usuario), `rate_limit_service.record_password_failure(email)`, inserta `user.login_failed` (con `actorUserId: null` si no existe) y, si ese fallo produjo el bloqueo, `user.login_locked`; lanza `401 invalid_credentials`. En un acierto, `clear_password_failures`, rehashea si `verify_and_update` lo pide, inserta `user.login_succeeded` (`metadata.method: "password"`) y emite tokens
- [X] T077 [US1] Implementar `POST /auth/register`, `POST /auth/register/resend`, `POST /auth/register/verify` (status `201`) y `POST /auth/login` en `backend/app/api/v1/auth.py`, con `get_client` y `get_language`
- [X] T078 [US1] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`
- [X] T079 [P] [US1] Test unitario (primero) en `web/src/__tests__/components/RegisterForm.test.tsx`: valida email, contraseña de al menos 8 caracteres y distinta del email antes de enviar; muestra el error traducido según `code`; tras `202` navega a `/verify-email?email=...`
- [X] T080 [P] [US1] Test unitario (primero) en `web/src/__tests__/components/LoginForm.test.tsx`: envía email y contraseña; `invalid_credentials` muestra el mensaje genérico; `password_login_locked` muestra los minutos restantes a partir de `retryAfterSeconds` y ofrece el login por código
- [X] T081 [P] [US1] Test unitario (primero) en `web/src/__tests__/components/CodeInput.test.tsx`: acepta solo 6 dígitos, soporta pegar el código completo y envía al completar; el botón "Reenviar" queda deshabilitado con cuenta regresiva cuando llega `rate_limited` con `retryAfterSeconds`
- [X] T082 [US1] Agregar el provider Credentials a `web/src/auth.ts` con `mode` `password` (llama a `POST /auth/login`) y `verify-email` (llama a `POST /auth/register/verify`); `authorize` devuelve los tokens y el usuario para guardarlos en el JWT de Auth.js; los errores se propagan con su `code` del contrato
- [X] T083 [P] [US1] Implementar `web/src/components/RegisterForm.tsx` y `web/src/app/(public)/register/page.tsx`, con una Server Action que llama a `POST /auth/register` enviando el idioma actual
- [X] T084 [P] [US1] Implementar `web/src/components/CodeInput.tsx` y `web/src/app/(public)/verify-email/page.tsx`: ingresar el código (`signIn("credentials", { mode: "verify-email" })`), reenviarlo (Server Action a `POST /auth/register/resend`) y "corregir el email" (vuelve a `/register` con el email cargado); tras verificar, `proxy.ts` lleva al onboarding de moneda
- [X] T085 [P] [US1] Implementar `web/src/components/LoginForm.tsx` y `web/src/app/(public)/login/page.tsx` con `signIn("credentials", { mode: "password" })` (respeta `callbackUrl` si viene en la URL y es una ruta interna) y enlaces a registro, código de acceso y recuperación
- [X] T086 [US1] Agregar las claves de traducción de US1 (`auth.register`, `auth.verifyEmail`, `auth.login`, `errors.*`) en `web/src/i18n/messages/es.json` y `web/src/i18n/messages/en.json`
- [X] T087 [P] [US1] Test unitario (primero) en `mobile/src/__tests__/screens/Register.test.tsx` y `mobile/src/__tests__/screens/Login.test.tsx`: mismas validaciones y mensajes que web; el login exitoso llama a `signInWithTokens`; `password_login_locked` muestra el tiempo restante
- [X] T088 [P] [US1] Test unitario (primero) en `mobile/src/__tests__/screens/VerifyEmail.test.tsx`: el código correcto llama a `signInWithTokens` con el `AuthResponse`; "Reenviar" respeta `retryAfterSeconds`; "Corregir email" vuelve a Registro con el email cargado
- [X] T089 [US1] Implementar `mobile/src/services/api/auth.ts` con `register`, `resendRegistration`, `verifyRegistration` y `loginWithPassword`, tipados con `schema.d.ts`
- [X] T090 [P] [US1] Implementar `mobile/src/components/CodeInput.tsx` y las pantallas `mobile/app/(auth)/register.tsx`, `mobile/app/(auth)/verify-email.tsx` y `mobile/app/(auth)/login.tsx` con React Native Paper
- [X] T091 [US1] Agregar las claves de traducción de US1 en `mobile/src/i18n/locales/es.json` y `mobile/src/i18n/locales/en.json`

**Checkpoint**: US1 funciona sola en Web y en Mobile; pasan sus tests de backend, Web y Mobile.

---

## Phase 4: User Story 2 - Inicio de sesión con Google (Priority: P1)

**Goal**: entrar con Google en un paso; crear el usuario la primera vez o vincular Google a un
usuario existente con el mismo email verificado.

**Independent Test**: entrar con una cuenta de Google nueva en Web y en Mobile, elegir la moneda,
salir y volver a entrar y comprobar que es el mismo usuario; repetir con el email de un usuario de
US1 y comprobar la vinculación (quickstart, escenario 4).

### Tests for User Story 2 ⚠️

- [X] T092 [P] [US2] Test de contrato en `backend/tests/contract/test_google_contract.py` con `fake_google_verifier`: `POST /auth/google` da `200 AuthResponse` con `isNewUser` correcto; `401 invalid_google_token` si el verificador rechaza el token; `403 google_email_not_verified` si `email_verified` es falso
- [X] T093 [P] [US2] Test de integración en `backend/tests/integration/test_google_login.py`: una cuenta nueva crea el usuario con `authProviders: ["google"]`, `googleSubject`, `passwordHash: null`, nombre y apellido de los claims `given_name`/`family_name` si vienen (si no, `null`), `language` según `Accept-Language` e `isNewUser: true`; volver a entrar con el mismo `sub` no crea duplicados; un email existente con contraseña y `email_verified: true` agrega `"google"` a `authProviders`, guarda `googleSubject`, inserta `user.google_linked` y envía el aviso de seguridad `security_google_linked`; con `email_verified: false` no vincula ni crea (FR-011); un `sub` ya vinculado a otro usuario no se reasigna
- [X] T094 [P] [US2] Test unitario en `backend/tests/unit/test_google_service.py`: `verify_google_id_token` llama a `google.oauth2.id_token.verify_oauth2_token` y acepta el token si su `aud` está en `GOOGLE_CLIENT_IDS`; lo rechaza con `invalid_google_token` si la librería lanza `ValueError` o el `aud` no está en la lista

### Implementation for User Story 2

- [X] T095 [P] [US2] Implementar `backend/app/services/google_service.py`: `GoogleClaims` (`sub`, `email`, `email_verified`, `given_name`, `family_name`) y `verify_google_id_token(id_token)` con `google.oauth2.id_token.verify_oauth2_token` y `google.auth.transport.requests.Request()`, validando el `aud` contra `GOOGLE_CLIENT_IDS` (R3); exponerlo como dependencia de FastAPI `get_google_verifier` para poder reemplazarlo en los tests
- [X] T096 [P] [US2] Agregar `GoogleLoginRequest` (`idToken: str`) a `backend/app/schemas/auth.py` y crear la plantilla `backend/app/templates/emails/{es,en}/security_google_linked.html` (aviso sin códigos ni contraseñas, FR-014a)
- [X] T097 [US2] Implementar `login_with_google(id_token, client, language)` en `backend/app/services/auth_service.py`: exige `email_verified` (si no, `403 google_email_not_verified`); busca por `googleSubject`, luego por email normalizado; crea el usuario (`user.registered` con `metadata.method: "google"`) o vincula (`user.google_linked`) en una transacción; envía `security_google_linked` solo al vincular; inserta `user.login_succeeded` y emite tokens
- [X] T098 [US2] Implementar `POST /auth/google` en `backend/app/api/v1/auth.py` usando `get_google_verifier`
- [X] T099 [US2] Regenerar `web/src/lib/api/schema.d.ts` y `mobile/src/services/api/schema.d.ts` con `npm run gen:api`
- [X] T100 [US2] Agregar el provider Google a `web/src/auth.ts` (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`): en el callback `jwt`, cuando `account.provider === "google"`, envía `account.id_token` a `POST /auth/google` y guarda los tokens y el usuario del backend; si el backend responde error, el login falla con ese `code` (R2)
- [X] T101 [P] [US2] Test unitario (primero) en `web/src/__tests__/components/GoogleSignInButton.test.tsx`: llama a `signIn("google")`; y en `web/src/__tests__/app/loginErrors.test.tsx`: la página de login muestra un mensaje traducido para `?error=AccessDenied` (cancelación, escenario 4) y para `google_email_not_verified`
- [X] T102 [US2] Implementar `web/src/components/GoogleSignInButton.tsx`, agregarlo a `web/src/app/(public)/login/page.tsx` y `web/src/app/(public)/register/page.tsx`, mostrar los errores de `?error=` en la página de login, y agregar las claves `auth.google.*` en `web/src/i18n/messages/{es,en}.json`
- [X] T103 [P] [US2] Test unitario (primero) en `mobile/src/__tests__/services/googleSignIn.test.ts`: `signInWithGoogle()` configura `GoogleSignin` con `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, envía el `idToken` a `POST /auth/google` y devuelve el `AuthResponse`; la cancelación (`statusCodes.SIGN_IN_CANCELLED`) devuelve `{ cancelled: true }` sin llamar a la API; un `403 google_email_not_verified` se propaga como `ApiError` con ese `code`
- [X] T104 [US2] Implementar `mobile/src/services/auth/googleSignIn.ts` para que pase el test de T103, y reemplazar `mobile/app.json` por `mobile/app.config.ts`, que registra el plugin `@react-native-google-signin/google-signin` con `iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME` (`app.json` no puede leer variables de entorno; los client IDs nunca van al repositorio)
- [X] T105 [US2] Implementar `mobile/src/components/GoogleSignInButton.tsx`, agregarlo a `mobile/app/(auth)/login.tsx` y `mobile/app/(auth)/register.tsx` con los mensajes de cancelación y de `google_email_not_verified` (ofrece entrar con contraseña o código), y agregar las claves `auth.google.*` en `mobile/src/i18n/locales/{es,en}.json`

**Checkpoint**: US1 y US2 funcionan cada una por su lado; con ambas, un mismo usuario puede entrar por los dos métodos.

---

## Phase 5: User Story 3 - Inicio de sesión con código por email (Priority: P2)

**Goal**: entrar sin contraseña con un código de un solo uso enviado por email.

**Independent Test**: pedir un código para un usuario existente, ingresarlo y entrar; reusar el
mismo código y comprobar que da `invalid_code`; pedir otro antes de 1 minuto y comprobar
`rate_limited` (quickstart, escenario 5).

### Tests for User Story 3 ⚠️

- [X] T106 [P] [US3] Test de contrato en `backend/tests/contract/test_login_code_contract.py`: `POST /auth/login-code` da `202` con el mismo cuerpo exista o no el email, y `429 rate_limited` con `retryAfterSeconds`; `POST /auth/login-code/verify` da `200 AuthResponse` o `400 invalid_code`
- [X] T107 [P] [US3] Test de integración en `backend/tests/integration/test_login_code.py`: para un email inexistente no se crea ningún código ni se envía email, pero un segundo pedido dentro del mismo minuto da el mismo `429` que con un email existente (FR-008); un usuario creado con Google puede entrar con código; el código consumido no vuelve a servir; el login por código funciona aunque el login con contraseña esté bloqueado (edge case); se inserta `user.login_succeeded` con `metadata.method: "code"`

### Implementation for User Story 3

- [X] T108 [P] [US3] Agregar `LoginCodeRequest` (`email`) a `backend/app/schemas/auth.py` y crear `backend/app/templates/emails/{es,en}/login_code.html`
- [X] T109 [US3] Implementar `request_login_code(email, language)` (aplica el límite `login` siempre y emite el código `login` solo si el usuario existe, con el idioma del usuario) y `verify_login_code(email, code, client)` en `backend/app/services/auth_service.py`
- [X] T110 [US3] Implementar `POST /auth/login-code` y `POST /auth/login-code/verify` en `backend/app/api/v1/auth.py`, y regenerar los tipos de web y mobile con `npm run gen:api`
- [X] T111 [P] [US3] Test unitario (primero) en `web/src/__tests__/app/loginCodePage.test.tsx`: paso 1 pide el email y avanza al paso 2 tras `202`; paso 2 envía el código; `invalid_code` muestra el mensaje con la opción de pedir otro
- [X] T112 [US3] Agregar el `mode` `login-code` al provider Credentials en `web/src/auth.ts` (llama a `POST /auth/login-code/verify`) e implementar `web/src/app/(public)/login-code/page.tsx` reutilizando `CodeInput`, con una Server Action para `POST /auth/login-code`; agregar las claves `auth.loginCode.*` en `web/src/i18n/messages/{es,en}.json`
- [X] T113 [P] [US3] Test unitario (primero) en `mobile/src/__tests__/screens/LoginCode.test.tsx`: mismo flujo de dos pasos que web y `signInWithTokens` al verificar
- [X] T114 [US3] Agregar `requestLoginCode` y `verifyLoginCode` a `mobile/src/services/api/auth.ts`, implementar `mobile/app/(auth)/login-code.tsx` reutilizando `CodeInput`, y agregar las claves `auth.loginCode.*` en `mobile/src/i18n/locales/{es,en}.json`

**Checkpoint**: US3 funciona por su lado; el login por código sirve como rescate cuando la contraseña está bloqueada.

---

## Phase 6: User Story 4 - Recuperar la contraseña (Priority: P2)

**Goal**: restablecer o definir por primera vez la contraseña con un código, cerrando las demás
sesiones.

**Independent Test**: con sesiones abiertas en Web y Mobile, recuperar la contraseña desde una de
ellas, entrar con la nueva y comprobar que la otra sesión se cierra en su próximo refresh y que la
contraseña anterior ya no sirve (quickstart, escenario 7).

### Tests for User Story 4 ⚠️

- [X] T115 [P] [US4] Test de contrato en `backend/tests/contract/test_password_reset_contract.py`: `POST /auth/password-reset` da `202` exista o no el email, y `429 rate_limited` al segundo pedido del minuto en ambos casos; `POST /auth/password-reset/confirm` da `200 AuthResponse`, `400 invalid_code` o `422 validation_error` (contraseña de 7 caracteres o igual al email)
- [X] T116 [P] [US4] Test de integración en `backend/tests/integration/test_password_reset.py`: confirmar cambia `passwordHash` (la contraseña anterior da `401`), borra los `password_failure` de ese email en `auth_attempts`, revoca todas las familias de refresh tokens anteriores del usuario (un refresh con un token viejo da `invalid_refresh_token`) y emite un par nuevo; un usuario solo con Google queda con `authProviders: ["google","email"]` e inserta `user.password_set`; un usuario con contraseña inserta `user.password_reset`; en ambos casos se envía `security_password_changed` en el idioma del usuario (FR-014a)

### Implementation for User Story 4

- [X] T117 [P] [US4] Agregar `PasswordResetRequest` (`email`) y `PasswordResetConfirmRequest` (`email`, `code` de 6 dígitos, `newPassword` de 8 a 128 caracteres) a `backend/app/schemas/auth.py`, y crear `backend/app/templates/emails/{es,en}/password_reset.html` y `backend/app/templates/emails/{es,en}/security_password_changed.html`
- [X] T118 [US4] Implementar `request_password_reset(email)` (aplica el límite `password_reset` siempre y emite el código solo si el usuario existe) y `confirm_password_reset(email, code, new_password, client)` en `backend/app/services/auth_service.py`: valida con `validate_password`, verifica el código `password_reset`, y en una transacción actualiza `passwordHash`, agrega `"email"` a `authProviders` si faltaba, llama a `rate_limit_service.clear_password_failures`, inserta la auditoría, revoca todas las sesiones anteriores con `token_service.revoke_other_sessions` y emite el par de la sesión nueva; después envía el aviso de seguridad
- [X] T119 [US4] Implementar `POST /auth/password-reset` y `POST /auth/password-reset/confirm` en `backend/app/api/v1/auth.py`, y regenerar los tipos de web y mobile con `npm run gen:api`
- [X] T120 [P] [US4] Test unitario (primero) en `web/src/__tests__/app/forgotPasswordPage.test.tsx`: paso 1 pide el email y muestra siempre el mismo mensaje; paso 2 pide el código y la contraseña nueva con las validaciones de FR-007; al confirmar inicia la sesión
- [X] T121 [US4] Agregar el `mode` `password-reset` al provider Credentials en `web/src/auth.ts` (llama a `POST /auth/password-reset/confirm`) e implementar `web/src/app/(public)/forgot-password/page.tsx` con `CodeInput` y una Server Action para `POST /auth/password-reset`; agregar las claves `auth.forgotPassword.*` en `web/src/i18n/messages/{es,en}.json`. Con `session.error === "RefreshTokenError"`, `proxy.ts` ya manda a `/login` (cierre de la otra sesión)
- [X] T122 [P] [US4] Test unitario (primero) en `mobile/src/__tests__/screens/ForgotPassword.test.tsx`: mismo flujo que web; al confirmar llama a `signInWithTokens`
- [X] T123 [US4] Agregar `requestPasswordReset` y `confirmPasswordReset` a `mobile/src/services/api/auth.ts`, implementar `mobile/app/(auth)/forgot-password.tsx`, y agregar las claves `auth.forgotPassword.*` en `mobile/src/i18n/locales/{es,en}.json`

**Checkpoint**: US4 funciona por su lado; cambiar la contraseña cierra las demás sesiones en ambos clientes.

---

## Phase 7: User Story 5 - Editar perfil y preferencias (Priority: P2)

**Goal**: editar nombre y apellido, idioma, moneda y tema con efecto inmediato y sincronizado entre
dispositivos, y cambiar el email con verificación.

**Independent Test**: cambiar idioma y tema en Web y ver el cambio al instante; entrar desde Mobile
y comprobar que se aplican las mismas preferencias; cambiar el email con el código y comprobar el
aviso al email anterior (quickstart, escenarios 8 y 9).

### Tests for User Story 5 ⚠️

- [X] T124 [P] [US5] Test de contrato en `backend/tests/contract/test_email_change_contract.py`: `POST /users/me/email-change` da `202` (también si el email nuevo ya es de otro usuario), `422 validation_error` si es igual al actual o no es un email, y `429 rate_limited`; `POST /users/me/email-change/confirm` da `200 UserResponse` con el email nuevo, `400 invalid_code` o `409 email_taken`
- [X] T125 [P] [US5] Test de integración en `backend/tests/integration/test_email_change.py`: pedir el cambio guarda `pendingEmail`, inserta `user.email_change_requested` y envía el código `change_email` al email nuevo; si el email nuevo ya pertenece a otro usuario no se envía nada ni se revela; confirmar reemplaza `email`, borra `pendingEmail`, inserta `user.email_changed` con `changes.email` before/after y envía `security_email_changed` al email anterior (FR-014a); si otro usuario tomó el email mientras tanto da `409 email_taken` y no cambia nada
- [X] T126 [P] [US5] Test de integración en `backend/tests/integration/test_profile_update.py`: cambiar `firstName`, `preferences.language`, `preferences.theme` y `preferences.defaultCurrency` persiste los valores, inserta un único `user.profile_updated` con `changes` before/after, y otro login (otro dispositivo) devuelve las mismas preferencias (SC-005)

### Implementation for User Story 5

- [X] T127 [P] [US5] Agregar `EmailChangeRequest` (`newEmail: EmailStr`) y `EmailChangeConfirmRequest` (`code` de 6 dígitos) a `backend/app/schemas/user.py`, y crear `backend/app/templates/emails/{es,en}/change_email.html` y `backend/app/templates/emails/{es,en}/security_email_changed.html`
- [X] T128 [US5] Implementar `request_email_change(user_id, new_email)` y `confirm_email_change(user_id, code)` en `backend/app/services/user_service.py` (el pedido aplica el límite `change_email` sobre el email nuevo; el código se verifica contra `pendingEmail`; la confirmación vuelve a comprobar que el email no exista y lo cambia en una transacción; el índice único de `users.email` cubre la carrera y se traduce a `409 email_taken`)
- [X] T129 [US5] Implementar `POST /users/me/email-change` y `POST /users/me/email-change/confirm` en `backend/app/api/v1/users.py`, y regenerar los tipos de web y mobile con `npm run gen:api`
- [X] T130 [P] [US5] Test unitario (primero) en `web/src/__tests__/components/PreferencesForm.test.tsx`: cambiar el tema llama a `setTheme` de next-themes antes de que responda la API; cambiar el idioma cambia los textos sin recargar (SC-004); si `PATCH /users/me` falla, vuelve al valor anterior y muestra el error
- [X] T131 [P] [US5] Test unitario (primero) en `web/src/__tests__/components/ProfileForm.test.tsx` y `web/src/__tests__/components/EmailChangeForm.test.tsx`: nombre y apellido opcionales con máximo 60 caracteres; vaciar un campo lo envía como `null`; el cambio de email pide el email nuevo y después el código
- [X] T132 [US5] Implementar `web/src/components/ProfileForm.tsx`, `web/src/components/PreferencesForm.tsx` (idioma `es`/`en`, tema `light`/`dark`/`system`, moneda con `CurrencySelect`; aplica el cambio local al instante y lo persiste con una Server Action a `PATCH /users/me` que actualiza la sesión con `unstable_update`), `web/src/components/EmailChangeForm.tsx` y la página `web/src/app/(private)/profile/page.tsx`; agregar las claves `profile.*` en `web/src/i18n/messages/{es,en}.json`. La moneda precargada al crear Cuentas (FR-020) queda disponible en `session.user.preferences.defaultCurrency` para la feature de Cuentas
- [X] T133 [P] [US5] Test unitario (primero) en `mobile/src/__tests__/hooks/usePreferences.test.tsx`: `setTheme` y `setLanguage` actualizan el estado y llaman a `i18next.changeLanguage` al instante y después a `PATCH /users/me`; si la API falla, revierten; con tema `system`, el tema sigue a `useColorScheme()`
- [X] T134 [US5] Implementar `mobile/src/hooks/usePreferences.ts` para que pase el test de T133 y conectarlo a `PaperProvider` e i18next en `mobile/app/_layout.tsx`
- [X] T135 [P] [US5] Test unitario (primero) en `mobile/src/__tests__/screens/Profile.test.tsx`: muestra el nombre visible con fallback al email, edita nombre y apellido, cambia preferencias y abre el flujo de cambio de email
- [X] T136 [US5] Implementar la pantalla `mobile/app/(app)/profile.tsx` (nombre, apellido, preferencias con `CurrencyPicker` y cambio de email con `CodeInput`), agregar `updateMe`, `requestEmailChange` y `confirmEmailChange` en `mobile/src/services/api/users.ts`, y las claves `profile.*` en `mobile/src/i18n/locales/{es,en}.json`

**Checkpoint**: US5 funciona por su lado; las preferencias se ven al instante y se sincronizan entre Web y Mobile.

---

## Phase 8: User Story 6 - Cerrar sesión (Priority: P3)

**Goal**: cerrar la sesión del dispositivo actual.

**Independent Test**: cerrar sesión y comprobar que las pantallas privadas redirigen al login y que
el refresh token quedó con `revokedAt` (quickstart, escenario 10).

### Tests for User Story 6 ⚠️

- [X] T137 [P] [US6] Test de contrato e integración en `backend/tests/integration/test_logout.py`: `POST /auth/logout` da `204` y deja el refresh token con `revokedAt` (un refresh posterior da `invalid_refresh_token`) e inserta `user.logged_out`; con un token inválido o ya revocado también da `204` (idempotente); las demás sesiones del usuario siguen activas
- [X] T138 [P] [US6] Test unitario (primero) en `web/src/__tests__/components/LogoutButton.test.tsx` y `mobile/src/__tests__/hooks/useAuthLogout.test.tsx`: en web llama a `signOut` con redirección a `/login`; en mobile llama a `POST /auth/logout`, borra los tokens de secure-store, llama a `GoogleSignin.signOut()` y queda `"unauthenticated"` aunque la API falle

### Implementation for User Story 6

- [X] T139 [US6] Implementar `logout(refresh_token)` en `backend/app/services/auth_service.py` (revoca por hash si existe e inserta `user.logged_out`; nunca falla) y `POST /auth/logout` con status `204` en `backend/app/api/v1/auth.py`
- [X] T140 [US6] Agregar el evento `signOut` en `web/src/auth.ts` que llama a `POST /auth/logout` con el refresh token del JWT de Auth.js, e implementar `web/src/components/LogoutButton.tsx` dentro del menú de usuario de `web/src/components/SiteHeader.tsx`; agregar la clave `auth.logout` en `web/src/i18n/messages/{es,en}.json`
- [X] T141 [US6] Agregar `logout()` a `mobile/src/hooks/useAuth.tsx` y un botón "Logout" en `mobile/app/(app)/profile.tsx`; agregar la clave `auth.logout` en `mobile/src/i18n/locales/{es,en}.json`

**Checkpoint**: las seis User Stories funcionan por su lado.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: comprobaciones que cruzan todas las User Stories.

- [X] T142 [P] Test en `web/src/__tests__/i18n/messagesParity.test.ts` y `mobile/src/__tests__/i18n/localesParity.test.ts`: `es.json` y `en.json` tienen exactamente las mismas claves y ningún valor vacío (FR-019); y en `backend/tests/unit/test_email_templates.py`: cada plantilla existe en `es` y `en` y ninguna incluye contraseñas ni hashes en su contexto
- [X] T143 [P] Test en `backend/tests/unit/test_audit_immutability.py`: `backend/app/repositories/audit_logs.py` no define funciones de update ni delete, y ningún módulo de `backend/app/` llama a `update_*`, `delete_*`, `replace_*` o `find_one_and_*` sobre `audit_logs` (Principio IV)
- [X] T144 [P] Test en `backend/tests/integration/test_no_sensitive_data.py`: después de recorrer los flujos de US1 a US6, ningún documento de `audit_logs` ni ningún log capturado contiene la contraseña en texto plano, el código de 6 dígitos ni el refresh token, y ningún log de la aplicación contiene emails de usuarios; `auth_attempts` no contiene ningún email en claro (FR-014, Principio VI)
- [X] T145 Revisión de seguridad: buscar en `backend/`, `web/` y `mobile/` secretos, client IDs o API keys escritos en el código o en `app.config.ts`; comprobar que `.env` y `backend/.dev-outbox/` están en `.gitignore` y que el validador de `backend/app/core/config.py` (T012) rechaza `EMAIL_DELIVERY=console` con `ENVIRONMENT=production`
- [X] T146 [P] Medir con un script en `backend/tests/perf/test_latency.py` (marcado con `@pytest.mark.perf`, excluido por defecto) que `POST /auth/login` tenga p95 < 500 ms y `GET /users/me` p95 < 200 ms sobre 100 requests locales (plan, Performance Goals)
- [X] T147 [P] Escribir `README.md` en la raíz con los prerrequisitos, cómo crear `.env` desde `.env.example`, `docker compose up -d`, cómo correr los tests de los tres proyectos y cómo generar los tipos con `npm run gen:api`, enlazando a `specs/001-user-auth-profile/quickstart.md`
- [X] T148 Correr `ruff check` y `ruff format --check` en `backend/`, y `npm run lint` y `npm test` en `web/` y `mobile/`; corregir lo que falle
- [X] T149 Validar los 10 escenarios manuales de `specs/001-user-auth-profile/quickstart.md` en Web y en Mobile (development build en emulador) y anotar cualquier diferencia como tarea nueva en este archivo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 y T002 primero; T003, T004 y T005 en paralelo; T008
  necesita T006 y T007.
- **Foundational (Phase 2)**: depende de Setup. Bloquea todas las User Stories.
  - Backend: T012 → T013/T014/T020-T022 → T016 (tras T015) → T017-T019 → repositorios
    T023-T028 → servicios T029-T037 (T031 y T032 antes de T033) → API T038-T043.
  - Web (T044-T057) y Mobile (T058-T069) necesitan el backend de esta fase corriendo para generar
    los tipos (T044, T058), pero entre ellos son independientes.
- **User Stories (Phase 3-8)**: dependen solo de Foundational. Se pueden hacer en orden de
  prioridad o en paralelo.
- **Polish (Phase 9)**: después de las User Stories que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: solo Foundational. Es el MVP.
- **US2 (P1)**: solo Foundational. Comparte `login/page.tsx`, `register/page.tsx` y las pantallas
  de Mobile con US1: si van en paralelo, US2 agrega su botón cuando esas páginas existan.
- **US3 (P2)**: solo Foundational. Reutiliza `CodeInput` de US1 (si US1 no está, crearlo en US3).
- **US4 (P2)**: solo Foundational. Reutiliza `CodeInput` de US1.
- **US5 (P2)**: solo Foundational (`PATCH /users/me` y `CurrencySelect` ya están en Phase 2).
- **US6 (P3)**: solo Foundational.

### Within Each User Story

- Los tests se escriben primero y tienen que fallar.
- Schemas y plantillas → servicio → endpoint → regenerar tipos → clientes Web y Mobile.
- Las tareas sobre `backend/app/services/auth_service.py` y `backend/app/api/v1/auth.py` de
  distintas User Stories tocan el mismo archivo: no hacerlas en paralelo entre sí.
- `web/src/auth.ts` lo tocan T047, T082, T100, T112, T121 y T140: secuenciales.

### Parallel Opportunities

- Setup: T004, T005, T006, T007, T009, T010 y T011.
- Foundational: T013, T014, T015, T020, T021 y T022; los seis repositorios T023-T028; T029 y
  T030; y, una vez generados los tipos, todo el bloque Web en paralelo con el bloque Mobile.
- Dentro de cada User Story: todos los tests marcados [P]; schemas y plantillas; los formularios de
  Web en paralelo con las pantallas de Mobile.
- Entre User Stories: el backend de US3, US4, US5 y US6 toca archivos de schemas y templates
  distintos, pero comparte `auth_service.py`/`auth.py`; conviene repartir por cliente (una persona
  en Web y otra en Mobile) más que por historia.

---

## Parallel Example: User Story 1

```bash
# Tests de US1 en paralelo:
Task: "T070 Test de contrato en backend/tests/contract/test_register_login_contract.py"
Task: "T071 Test de integración en backend/tests/integration/test_email_registration.py"
Task: "T072 Test de integración en backend/tests/integration/test_password_login.py"

# Schemas y plantillas en paralelo:
Task: "T073 Schemas de registro y login en backend/app/schemas/auth.py"
Task: "T074 Plantillas verify_email y account_exists en backend/app/templates/emails/{es,en}/"

# Con el backend de US1 listo y los tipos regenerados (T078), Web y Mobile en paralelo:
Task: "T079-T086 Formularios, páginas y traducciones de Web"
Task: "T087-T091 Pantallas, servicios y traducciones de Mobile"
```

## Parallel Example: User Story 5

```bash
Task: "T124 Test de contrato en backend/tests/contract/test_email_change_contract.py"
Task: "T125 Test de integración en backend/tests/integration/test_email_change.py"
Task: "T126 Test de integración en backend/tests/integration/test_profile_update.py"
Task: "T130 Test de PreferencesForm en web/src/__tests__/components/PreferencesForm.test.tsx"
Task: "T133 Test de usePreferences en mobile/src/__tests__/hooks/usePreferences.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup.
2. Phase 2: Foundational (bloquea todo lo demás).
3. Phase 3: US1.
4. **Parar y validar**: quickstart, escenarios 1, 2, 3 y 6, en Web y en Mobile.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → primera entrega (MVP).
3. US2 → validar → entrega (Google, el acceso principal del producto).
4. US3 y US4 → validar → entrega (accesos de rescate).
5. US5 → validar → entrega (perfil y preferencias).
6. US6 → validar → entrega.
7. Polish → feature completa según el criterio de listo de quickstart.md.

### Parallel Team Strategy

Con varias personas, después de Foundational:

- Persona A: backend de US1 → US2 → US3 → US4 → US5 → US6 (comparten `auth_service.py`).
- Persona B: Web de cada historia, siguiendo al backend.
- Persona C: Mobile de cada historia, siguiendo al backend.

---

## Implementation Notes (2026-11-06)

- T149: validación manual en Web (escenarios 1, 3, 4 con Google, 8 y 10) y en Mobile con un development
  build en el emulador de Android, hecha por el usuario el 2026-11-06. Para Google en Web hace falta la
  redirect URI `http://localhost:3000/api/auth/callback/google`; en Android, un client ID de tipo
  Android (package `com.chepagame.app` + SHA-1 de debug) en el mismo proyecto de Google Cloud.
- Desvíos de rutas respecto de las tareas: en Mobile las pantallas viven en `mobile/src/screens/` y
  las rutas de `mobile/app/` las reexportan; `CodeInput` y `ResendButton` están en
  `mobile/src/components/FormBits.tsx`; la prueba de logout de Mobile está en
  `mobile/src/__tests__/hooks/useAuth.test.tsx`. En Web, los formularios de perfil están en
  `web/src/components/ProfileForms.tsx` y los flujos de código (US3/US4) en `CodeSignInFlow.tsx`.
- El email pendiente de verificación se guarda en `sessionStorage` (Web) o en los parámetros de
  navegación (Mobile), no en la URL.
- Refresh tokens: se agregó un período de gracia de 60 s para refrescos concurrentes (research R1).
- Telemetría de Next.js y Expo desactivada (`NEXT_TELEMETRY_DISABLED`, `EXPO_NO_TELEMETRY`) por el
  Principio VI.
- Mobile usa los mismos catálogos que Web con interpolación de llaves simples; el plural ICU de
  `lockedMinutes` se genera como `lockedMinutes_one/_other` para i18next.

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [USn] vincula la tarea con su User Story para trazabilidad.
- Verificar que los tests fallan antes de implementar.
- Hacer commit después de cada tarea o grupo lógico, con mensajes en inglés.
- Antes de implementar US2 hacen falta los client IDs de Google (web, Android e iOS) en `.env`, y
  antes de enviar emails reales, la API key de Resend: los carga el usuario, nunca se pegan en el
  chat.
