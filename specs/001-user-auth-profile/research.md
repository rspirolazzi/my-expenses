# Research: Autenticación y Perfil de Usuario

Decisiones técnicas de la Phase 0. No quedan puntos `NEEDS CLARIFICATION` en el Technical Context.
Las versiones exactas de cada dependencia se fijan al instalarlas (tasks), respetando los rangos de
la constitución.

## R1. Quién emite y valida los tokens

- **Decision**: el backend FastAPI es el único emisor. Emite un JWT de acceso (HS256, 15 minutos,
  claims `sub`, `iss`, `aud`, `iat`, `exp`, `jti`) y un refresh token opaco (256 bits aleatorios)
  que se guarda hasheado (SHA-256) en `refresh_tokens`. Cada uso del refresh lo rota y extiende el
  vencimiento a "ahora + 30 días" (vencimiento deslizante, FR-013). Si se presenta un refresh token
  ya rotado, se revoca toda su familia (detección de robo).
- **Rationale**: Web y Mobile usan el mismo mecanismo (Principio I). Guardar los refresh tokens
  permite cerrar sesión en un dispositivo (FR-012) y cerrar las demás sesiones al cambiar la
  contraseña (FR-006), cosa que un JWT de larga vida no permite.
- **Alternatives considered**: usar el JWT de Auth.js como token de la API (no sirve para Mobile,
  que no usa Auth.js); JWT de acceso de 30 días sin refresh (no se puede revocar); sesiones con
  estado en Redis (agrega un servicio, contra el Principio VIII).

## R2. Integración de Auth.js en la Web

- **Decision**: Auth.js v5 con estrategia de sesión `jwt` y dos providers:
  - **Google**: Auth.js obtiene el `id_token`; en el callback `jwt` se envía a
    `POST /api/v1/auth/google` y se guardan los tokens del backend en la sesión.
  - **Credentials**: tres modos (`password`, `login-code`, `verify-email`) que llaman a los
    endpoints del backend y devuelven sus tokens.

  La sesión de Auth.js (cookie cifrada, `HttpOnly`, `Secure`, `SameSite=Lax`) contiene los tokens
  del backend. El callback `jwt` renueva el access token con el refresh cuando faltan menos de 60
  segundos para su vencimiento. La Web funciona como BFF: las llamadas a la API se hacen del lado
  del servidor (Server Components, Server Actions y route handlers), así que los tokens nunca llegan
  al JavaScript del navegador. `src/proxy.ts` (el reemplazo de `middleware.ts` en Next.js 16)
  protege las rutas privadas y redirige al onboarding de moneda cuando falta.
- **Rationale**: cumple "Auth.js Google provider" y "JWT en cookies `HttpOnly`" de la constitución
  sin duplicar la lógica de usuarios en Next.js.
- **Alternatives considered**: el adapter de MongoDB de Auth.js (duplica usuarios fuera de FastAPI);
  exponer el access token al cliente (más superficie de ataque, contra la regla de `localStorage`).

## R3. Google Sign-In en Mobile y validación en el backend

- **Decision**: `@react-native-google-signin/google-signin` configurado con el `webClientId`, de
  modo que el `idToken` emitido para Mobile tenga como audiencia el client ID web. El backend
  verifica cualquier ID token de Google con `google.oauth2.id_token.verify_oauth2_token`, contra la
  lista `GOOGLE_CLIENT_IDS` (`.env`), y exige `email_verified = true` para vincular o crear usuarios
  (FR-004, FR-011).
- **Rationale**: un solo endpoint `POST /auth/google` para Web y Mobile. La verificación con la
  librería oficial de Google valida firma, emisor, audiencia y vencimiento.
- **Alternatives considered**: `expo-auth-session` (la constitución fijó la librería nativa); validar
  el token llamando al endpoint `tokeninfo` de Google (agrega latencia y depende de la red).

## R4. Registro pendiente y verificación de email

- **Decision**: el registro con email crea un documento en `pending_registrations` (TTL de 24 h),
  no en `users`. El usuario se crea recién al verificar el código, junto con su auditoría y sus
  tokens, en una transacción. "Corregir el email" es volver a registrarse con el email correcto; el
  pendiente anterior vence solo.
- **Rationale**: cumple FR-003 (sin acceso hasta verificar) sin un estado "no verificado" en
  `users` que cada endpoint tendría que controlar, y un email no verificado no bloquea al dueño
  real.
- **Alternatives considered**: un campo `isEmailVerified` en `users` con un token de alcance
  limitado (más casos de permisos y de tests).

## R5. Códigos de un solo uso y límites

- **Decision**: códigos de 6 dígitos generados con `secrets.randbelow`, guardados como HMAC-SHA256
  (clave `CODE_HASH_SECRET`) en `verification_codes`, con `purpose` (`verify_email`, `login`,
  `password_reset`, `change_email`), `expiresAt` (15 minutos), `attempts` (máximo 5) y TTL de
  limpieza de 1 hora desde la creación. Los límites de reenvío (1 por minuto y 5 por hora por email
  y propósito) se calculan contando los documentos recientes. Pedir un código nuevo invalida el
  anterior del mismo propósito.
- **Rationale**: no hace falta otro servicio. El HMAC impide usar los códigos aunque se filtre la
  base, y es rápido (Argon2 sería innecesariamente lento para 6 dígitos con 5 intentos).
- **Alternatives considered**: Redis con contadores (otro servicio); magic links (fuera de alcance:
  requieren deep links en Mobile).

## R6. Bloqueo por intentos fallidos de contraseña

- **Decision**: campos en `users.passwordLogin`: `failedAttempts`, `windowStartedAt` y
  `lockedUntil`. Con 10 fallos dentro de una ventana de 15 minutos se bloquea el login con
  contraseña por 15 minutos. Un login exitoso reinicia los contadores. El login por código sigue
  disponible durante el bloqueo.
- **Rationale**: implementa el edge case de la spec con un update atómico sobre el mismo documento.
- **Alternatives considered**: una colección aparte de intentos (más lecturas, sin beneficio).

## R7. No revelar si un email existe (FR-008)

- **Decision**: `register`, `login-code`, `password-reset` y `email-change` responden siempre
  `202 Accepted` con el mismo cuerpo. Si alguien intenta registrar un email que ya existe, se le
  envía al dueño un email de "ya tenés una cuenta, iniciá sesión o recuperá la contraseña", en
  lugar de un error. El login con contraseña incorrecta o con un email inexistente devuelve el mismo
  `401`, y en el caso del email inexistente se ejecuta igual un hash de prueba para igualar los
  tiempos.
- **Rationale**: el escenario 5 de la User Story 1 ("se le ofrece iniciar sesión") se cumple por
  email sin revelar nada en la pantalla, así que es consistente con FR-008. La spec se ajustó en
  ese sentido.
- **Alternatives considered**: devolver `409 Conflict` en el registro (revela qué emails existen).

## R8. Hash de contraseñas

- **Decision**: `pwdlib` con Argon2id y parámetros por defecto; rehash automático si cambian los
  parámetros. Contraseña de 8 a 128 caracteres, distinta del email (FR-007).
- **Rationale**: Argon2id es lo que exige la constitución, y `pwdlib` es la opción mantenida y
  recomendada por la documentación de FastAPI (reemplaza a passlib).
- **Alternatives considered**: bcrypt (permitido, pero tiene un límite de 72 bytes); passlib (sin
  mantenimiento).

## R9. Driver de MongoDB y transacciones

- **Decision**: PyMongo con su API async nativa (`AsyncMongoClient`). Cada operación que cambia un
  usuario usa `client.start_session()` + `session.start_transaction()` e inserta el `audit_log`
  dentro de la misma transacción. Los índices se crean al iniciar la app (lifespan).
- **Rationale**: Motor quedó deprecado en favor de la API async de PyMongo. Las transacciones
  cumplen la regla de escrituras atómicas de la constitución.
- **Alternatives considered**: Motor (deprecado); Beanie/ODM (otra capa de abstracción, Principio
  VIII).

## R10. Envío de emails con Resend

- **Decision**: SDK oficial `resend` en `email_service.py`, con plantillas Jinja2 por idioma (`es`,
  `en`) y por tipo (código de verificación, código de acceso, recuperación, cambio de email, cuenta
  ya existente, avisos de seguridad). Si Resend falla, el endpoint responde `503` con un error
  reintentable, y el código generado se invalida para que no cuente en el límite. En los tests,
  `EMAIL_DELIVERY=console` imprime el código en lugar de enviarlo (nunca en producción).
- **Rationale**: cumple la constitución (Resend, API key solo en el `.env` del backend) y permite
  probar sin enviar emails reales.
- **Alternatives considered**: cola de envíos asíncrona (no hace falta para el volumen previsto).

## R11. Internacionalización y preferencias en los clientes

- **Decision**:
  - **Web**: next-intl sin rutas por idioma; el idioma sale de la sesión del usuario (o de
    `Accept-Language` sin sesión). Tema con next-themes (`light`/`dark`/`system`).
  - **Mobile**: i18next + react-i18next; el tema de React Native Paper (MD3 claro y oscuro) sigue
    `preferences.theme` o `useColorScheme()` si es `system`.
  - **Ambos**: el cambio se aplica en el estado local al instante (SC-004) y se persiste con
    `PATCH /users/me`, que es la fuente para otros dispositivos (SC-005).
- **Rationale**: la URL no necesita llevar el idioma, porque es una preferencia del usuario.
- **Alternatives considered**: rutas `/es/...` y `/en/...` (útil para SEO, que no aplica a pantallas
  privadas).

## R12. Moneda sugerida según la región (FR-020a)

- **Decision**:
  - **Mobile**: `expo-localization` → `getLocales()[0].currencyCode`.
  - **Web**: región de `navigator.languages` (con `Intl.Locale(...).maximize()`) convertida a moneda
    con `country-to-currency`.
  - **Ambos**: si no hay región, no se preselecciona nada. El backend valida el código contra
    `pycountry.currencies`. `preferences.defaultCurrency` es `null` hasta que se elige, y ese `null`
    es el que dispara el onboarding.
- **Rationale**: sugerencia local sin servicios externos de geolocalización por IP (Principio VI).
- **Alternatives considered**: geolocalización por IP (envía datos a terceros).

## R13. Tests

- **Decision**:
  - **Backend**: pytest con un MongoDB real (el del compose, base `myexpenses_test`, que se borra
    entre módulos), `httpx.AsyncClient` sobre la app ASGI, `EMAIL_DELIVERY=console`, y Google
    simulado inyectando un verificador falso por dependencia.
  - **Web**: Jest (`next/jest`) + React Testing Library para formularios y hooks.
  - **Mobile**: Jest (`jest-expo`) + React Native Testing Library, con
    `@react-native-google-signin/google-signin` y `expo-secure-store` mockeados.
- **Rationale**: las transacciones y los índices TTL y únicos solo se prueban de verdad en MongoDB
  real. Jest es obligatorio en Web y Mobile por el Principio VII.
- **Alternatives considered**: mongomock (no soporta transacciones); testcontainers (duplica el
  compose ya existente).

## R14. Docker para backend y web

- **Decision**:
  - **`backend`**: `python:3.13-slim` + uv, `uvicorn --reload` con el código montado.
  - **`web`**: `node:22.13.0-alpine`, `next dev` con el código montado.
  - **Ambos**: dependen de `mongodb` con `condition: service_healthy` y leen su configuración de
    `.env`.
  - **Mobile**: no va al compose; se ejecuta con `npx expo run:android` o `run:ios`.
- **Rationale**: cumple la sección "Infraestructura Local" (MongoDB junto al backend y Next.js).
- **Alternatives considered**: correr backend y web fuera de Docker (válido para depurar, y queda
  documentado en el quickstart).
