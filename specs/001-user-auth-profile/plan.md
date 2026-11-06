# Implementation Plan: Autenticación y Perfil de Usuario

**Branch**: `001-user-auth-profile` (el proyecto todavía no es un repositorio git) | **Date**: 2026-11-06 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-user-auth-profile/spec.md`

## Summary

Registro e inicio de sesión con email y contraseña (con verificación por código), con Google y con
código de un solo uso por email; recuperación de contraseña; perfil con nombre, apellido, email y
preferencias (idioma `es`/`en`, moneda por defecto elegida al registrarse, tema
`light`/`dark`/`system`); avisos de seguridad por email y auditoría de eventos de seguridad.

Enfoque técnico: el backend FastAPI es la única fuente de verdad de usuarios y el único emisor de
tokens (JWT de acceso de 15 minutos + refresh token opaco rotativo con vencimiento deslizante de
30 días). La Web (Next.js 16 + Auth.js) actúa como BFF: el navegador nunca ve los tokens del
backend, que viajan dentro de la cookie de sesión cifrada `HttpOnly` de Auth.js. La App (Expo)
llama a la API directamente y guarda los tokens en `expo-secure-store`. Google se valida en el
backend verificando el ID token, tanto el que obtiene Auth.js en Web como el de
`@react-native-google-signin/google-signin` en Mobile. Esta feature también crea el esqueleto de
los tres proyectos (`backend/`, `web/`, `mobile/`) y agrega backend y web al `docker-compose.yml`.

## Technical Context

**Language/Version**: Python 3.13 (backend); TypeScript 5.x en modo `strict` sobre Node.js
v22.13.0 (web y mobile)

**Primary Dependencies**:
- Backend: FastAPI, Pydantic v2 + pydantic-settings, PyMongo (API async `AsyncMongoClient`),
  PyJWT, pwdlib[argon2], google-auth (verificación de ID tokens), resend, pycountry, Jinja2
  (plantillas de email)
- Web: Next.js ^16.4 (App Router), React ^19, Auth.js v5 (`next-auth`), next-intl, next-themes,
  openapi-typescript (tipos generados del contrato), country-to-currency
- Mobile: Expo SDK ^56 (Expo Router), React Native Paper, `@react-native-google-signin/google-signin`,
  expo-secure-store, expo-localization, i18next + react-i18next, openapi-typescript

**Storage**: MongoDB 8.0 (replica set de un nodo en Docker). Colecciones: `users`,
`pending_registrations`, `verification_codes`, `auth_attempts`, `refresh_tokens`, `audit_logs`

**Testing**: pytest + pytest-asyncio + httpx `AsyncClient` contra MongoDB real del compose (base de
datos de test separada; las transacciones no funcionan en mocks). Web: Jest con `next/jest` +
React Testing Library. Mobile: Jest con preset `jest-expo` + React Native Testing Library

**Target Platform**: Backend y Web en contenedores Linux; Web en navegadores modernos (últimas 2
versiones); Mobile en iOS 16+ y Android 10+ mediante development build de Expo (Google Sign-In no
funciona en Expo Go)

**Project Type**: Web + Mobile + API (tres proyectos en un mismo repositorio)

**Performance Goals**: endpoints de auth con p95 < 500 ms (incluye hash Argon2id de ~100 ms);
endpoints de perfil con p95 < 200 ms; cambio de idioma o tema en la UI < 1 s (SC-004)

**Constraints**: ningún secreto fuera de `.env`; tokens nunca en `localStorage`; respuestas que no
revelan si un email existe (FR-008); emails en el idioma del usuario; toda escritura de usuario
junto con su registro de auditoría en una misma transacción

**Scale/Scope**: hasta ~10.000 usuarios en esta etapa; 2 idiomas; ~8 pantallas por cliente
(login, registro, verificación, código de acceso, recuperación, moneda inicial, perfil, dashboard
vacío)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Cumplimiento en esta feature | Estado |
|---|---|---|
| I. Acceso Directo y Multiplataforma | Google y email+contraseña en Web y Mobile; misma API `/api/v1`; JWT validado en cada endpoint privado | PASS |
| II. Internacionalización | next-intl (Web) e i18next (Mobile) con `es`/`en`; sin strings hardcodeados; emails traducidos; idioma en `preferences.language` | PASS |
| III. Moneda Única y Exactitud | Solo aplica la moneda por defecto: código ISO 4217 validado contra `pycountry`. No hay importes en esta feature | PASS |
| IV. Auditoría Inmutable y Bajas Lógicas | Eventos de seguridad en `audit_logs` (FR-014), en la misma transacción; el código solo inserta en `audit_logs`. Los registros pendientes y códigos vencidos se borran por TTL: no son Cuentas ni Gastos | PASS |
| V. Strict English Rule | Código, colecciones, campos, rutas y commits en inglés; specs en español | PASS |
| VI. Privacidad y Datos | Secretos solo en `.env`; contraseñas, códigos y tokens nunca en logs ni auditoría; Google solo comparte datos para el login. La exportación de datos queda para una feature propia (sin violación: aún no hay datos de gastos) | PASS |
| VII. Test-First | Tests de dominio de auth (códigos, límites, vinculación Google, rotación de refresh) antes de implementar; Jest en cada feature de Web y Mobile | PASS |
| VIII. Simplicidad | Sin paquete compartido de TS: los tipos se generan del OpenAPI en cada cliente. Sin Redis: límites y bloqueos en MongoDB con índices TTL | PASS |
| Stack y versiones | Node 22.13.0, Next.js ^16.4, Expo ^56, React ^19, MongoDB 8.0, Docker 24.0 / Compose 2.22 | PASS |
| Infraestructura local | Se agregan `backend` y `web` al compose; credenciales por `.env` | PASS |
| Seguridad y Datos | Auth.js Google provider en Web; Google Sign-In nativo en Mobile; JWT; cookies `HttpOnly`/`Secure`/`SameSite`; `expo-secure-store`; Argon2id; Resend; validación Pydantic | PASS |
| Nomenclatura / REST | Colecciones `snake_case` plural, campos `camelCase`, rutas en minúscula y `kebab-case` | PASS |

**Resultado del gate (pre-research)**: PASS, sin violaciones a justificar.

**Re-check post-diseño (Phase 1)**: PASS. El diseño de [data-model.md](data-model.md) y
[contracts/api.md](contracts/api.md) no introduce violaciones. Nota: la transacción multi-documento
requiere el replica set ya configurado en `docker-compose.yml`.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth-profile/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: contrato REST /api/v1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; no lo crea /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── Dockerfile
├── pyproject.toml
├── app/
│   ├── main.py                     # FastAPI app, routers, lifespan (índices de Mongo)
│   ├── core/
│   │   ├── config.py               # Settings desde .env (pydantic-settings)
│   │   ├── security.py             # hash de contraseñas, JWT, generación/hash de códigos
│   │   ├── errors.py               # AppError y códigos del contrato
│   │   └── i18n.py                 # mensajes de error es/en
│   ├── db/
│   │   ├── client.py               # AsyncMongoClient, sesiones de transacción
│   │   └── indexes.py
│   ├── schemas/                    # Modelos Pydantic: UserResponse, RegisterRequest, ...
│   ├── repositories/               # acceso a colecciones (users, codes, tokens, audit)
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── google_service.py
│   │   ├── token_service.py
│   │   ├── verification_service.py
│   │   ├── rate_limit_service.py   # límites y bloqueo por email, exista o no
│   │   ├── user_service.py
│   │   ├── email_service.py
│   │   └── audit_service.py
│   ├── api/v1/
│   │   ├── auth.py
│   │   ├── users.py
│   │   └── dependencies.py         # get_current_user (valida JWT)
│   └── templates/emails/           # {es,en}/*.html
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

web/
├── Dockerfile
├── package.json
├── jest.config.ts
└── src/
    ├── auth.ts                     # Auth.js: Google + Credentials (password / code)
    ├── proxy.ts                    # Next.js 16 proxy: protege rutas privadas
    ├── app/
    │   ├── (public)/login/page.tsx
    │   ├── (public)/register/page.tsx
    │   ├── (public)/verify-email/page.tsx
    │   ├── (public)/login-code/page.tsx
    │   ├── (public)/forgot-password/page.tsx
    │   ├── (private)/onboarding/currency/page.tsx
    │   ├── (private)/dashboard/page.tsx
    │   ├── (private)/profile/page.tsx
    │   └── api/auth/[...nextauth]/route.ts
    ├── components/                 # PascalCase: LoginForm.tsx, CodeInput.tsx, ...
    ├── lib/                        # currencySuggestion, displayName, currencies
    ├── lib/api/                    # cliente server-side + schema.d.ts generado
    ├── i18n/                       # next-intl config + messages/{es,en}.json
    └── __tests__/

mobile/
├── app.config.ts                   # config de Expo; lee los client IDs de Google de .env
├── package.json
├── jest.config.js
├── app/                            # Expo Router
│   ├── _layout.tsx
│   ├── (auth)/login.tsx
│   ├── (auth)/register.tsx
│   ├── (auth)/verify-email.tsx
│   ├── (auth)/login-code.tsx
│   ├── (auth)/forgot-password.tsx
│   ├── (app)/onboarding-currency.tsx
│   ├── (app)/index.tsx             # Dashboard
│   └── (app)/profile.tsx
└── src/
    ├── components/
    ├── hooks/                      # useAuth, usePreferences, ...
    ├── services/api/               # cliente con refresh automático + schema.d.ts generado
    ├── services/auth/              # secure-store, Google Sign-In
    ├── i18n/                       # i18next + locales/{es,en}.json
    ├── theme/                      # temas MD3 de React Native Paper
    ├── utils/                      # displayName, ...
    └── __tests__/

docker-compose.yml                  # mongodb (existente) + backend + web
```

**Structure Decision**: tres proyectos hermanos en la raíz (`backend/`, `web/`, `mobile/`), sin
herramienta de monorepo. El contrato entre clientes y API es el OpenAPI que publica FastAPI; cada
cliente genera sus tipos TypeScript con `openapi-typescript`, lo que cumple el tipado estricto de
contratos sin agregar un paquete compartido.

## Complexity Tracking

No hay violaciones a la constitución. El Principio VIII exige justificar cada dependencia nueva;
esta es la lista de las que agrega esta feature (las del stack fijado en la constitución, como
FastAPI, Next.js, Expo, React Native Paper, `@react-native-google-signin/google-signin`, Auth.js,
`expo-secure-store` y Resend, ya están justificadas allí):

| Dependencia | Proyecto | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|---|
| pydantic-settings | backend | Leer y validar la configuración desde `.env` (Principio VI) | `os.environ` a mano: sin validación ni tipos |
| email-validator | backend | Requerida por `EmailStr` de Pydantic para validar emails en el límite de la API | Regex propia: menos correcta |
| pymongo (async) | backend | Driver oficial de MongoDB con transacciones (R9) | Motor: deprecado |
| PyJWT | backend | Firmar y validar los JWT de acceso (R1) | Implementación propia: inseguro |
| pwdlib[argon2] | backend | Hash Argon2id exigido por la constitución (R8) | passlib: sin mantenimiento |
| google-auth + requests | backend | Verificar la firma de los ID tokens de Google (R3) | Endpoint `tokeninfo`: latencia y dependencia de red |
| pycountry | backend | Validar códigos ISO 4217 (FR-020) | Lista hardcodeada: se desactualiza |
| Jinja2 | backend | Plantillas de email `es`/`en` con autoescape (R10) | f-strings: sin escape de HTML |
| pytest, pytest-asyncio, httpx, ruff | backend (dev) | Tests contra la app ASGI y lint (Principio VII) | — |
| next-intl | web | Traducciones en Server y Client Components (Principio II) | Diccionarios propios: sin formato de fechas ni plurales |
| next-themes | web | Tema `light`/`dark`/`system` sin parpadeo al cargar (FR-021) | CSS a mano: parpadeo y sin `system` |
| country-to-currency | web | Sugerir la moneda según la región (R12) | Tabla propia de ~250 países |
| server-only | web | Impedir que el cliente de la API llegue al navegador (R2) | Disciplina manual: sin garantía |
| openapi-typescript | web, mobile (dev) | Tipos estrictos del contrato sin paquete compartido (VIII) | Paquete compartido de tipos: más infraestructura |
| i18next + react-i18next, expo-localization | mobile | Traducciones y región del dispositivo (Principio II, R12) | Diccionarios propios |
| expo-dev-client | mobile | Development build, necesario para Google Sign-In nativo | Expo Go: no soporta Google Sign-In |
| jest, jest-expo, Testing Library, prettier | web, mobile (dev) | Jest obligatorio por el Principio VII; formato | — |

No se agregan servicios ni capas nuevas: no hay Redis, colas ni ODM. Los límites y bloqueos usan
MongoDB (R5, R6).
