# API Contract: Auth & Users (`/api/v1`)

Esta es la referencia funcional. La fuente de verdad ejecutable es el OpenAPI que publica FastAPI
(`/api/v1/openapi.json`), del que Web y Mobile generan sus tipos.

- Cuerpos JSON en `camelCase`.
- Los endpoints privados requieren `Authorization: Bearer <accessToken>`.
- El header opcional `X-Client: web | mobile` se registra en la auditoría.

## Tipos comunes

```text
TokenPair    { accessToken: string, accessTokenExpiresAt: datetime,
               refreshToken: string, refreshTokenExpiresAt: datetime }
UserResponse { id, email, firstName: string|null, lastName: string|null,
               authProviders: ("google"|"email")[], hasPasswordSet: bool,
               pendingEmail: string|null,
               preferences: { language: "es"|"en", defaultCurrency: string|null,
                              theme: "light"|"dark"|"system" },
               createdAt, updatedAt }
AuthResponse { tokens: TokenPair, user: UserResponse, isNewUser: bool }
Accepted     { status: "accepted" }   # 202, mismo cuerpo exista o no el email (FR-008)
Error        { error: { code: string, message: string, retryAfterSeconds?: int } }
```

`message` se devuelve en el idioma de `Accept-Language` (`es` por defecto). Los clientes muestran
sus propios textos traducidos según `code`.

## Auth (públicos)

| Método y ruta | Request | Response | Errores |
|---|---|---|---|
| `POST /auth/register` | `{ email, password, firstName?, lastName?, language }` | `202 Accepted`. Envía un código `verify_email`; si el email ya existe, envía el email "ya tenés una cuenta" | `422 validation_error` (contraseña < 8, igual al email); `429 rate_limited`; `503 email_unavailable` |
| `POST /auth/register/resend` | `{ email }` | `202 Accepted` | `429 rate_limited`; `503 email_unavailable` |
| `POST /auth/register/verify` | `{ email, code }` | `201 AuthResponse` (`isNewUser: true`); el usuario queda creado | `400 invalid_code` (incorrecto, vencido, consumido o con 5 intentos) |
| `POST /auth/login` | `{ email, password }` | `200 AuthResponse` | `401 invalid_credentials` (igual exista o no el email); `423 password_login_locked` con `retryAfterSeconds` |
| `POST /auth/login-code` | `{ email }` | `202 Accepted`. Envía un código `login` si el usuario existe | `429 rate_limited`; `503 email_unavailable` |
| `POST /auth/login-code/verify` | `{ email, code }` | `200 AuthResponse` | `400 invalid_code` |
| `POST /auth/google` | `{ idToken }` | `200 AuthResponse` (`isNewUser` indica si se creó el usuario). Vincula Google a un email existente si `email_verified` | `401 invalid_google_token`; `403 google_email_not_verified` |
| `POST /auth/password-reset` | `{ email }` | `202 Accepted`. Envía un código `password_reset` si el usuario existe | `429 rate_limited`; `503 email_unavailable` |
| `POST /auth/password-reset/confirm` | `{ email, code, newPassword }` | `200 AuthResponse`. Revoca las demás sesiones, agrega `"email"` a `authProviders` y envía aviso de seguridad | `400 invalid_code`; `422 validation_error` |
| `POST /auth/refresh` | `{ refreshToken }` | `200 TokenPair` (rotado) | `401 invalid_refresh_token` (vencido o revocado; si se reusa uno rotado, revoca la familia) |
| `POST /auth/logout` | `{ refreshToken }` | `204` | Idempotente: un token inválido también devuelve `204` |

## Users (privados)

| Método y ruta | Request | Response | Errores |
|---|---|---|---|
| `GET /users/me` | — | `200 UserResponse` | `401 unauthorized` |
| `PATCH /users/me` | Parcial: `{ firstName?, lastName?, preferences?: { language?, defaultCurrency?, theme? } }`; `null` en nombre o apellido los borra | `200 UserResponse` | `422 validation_error` (moneda no ISO 4217, idioma o tema inválidos, nombre > 60) |
| `POST /users/me/email-change` | `{ newEmail }` | `202 Accepted`. Envía un código `change_email` al email nuevo si no pertenece a otro usuario | `422 validation_error`; `429 rate_limited`; `503 email_unavailable` |
| `POST /users/me/email-change/confirm` | `{ code }` | `200 UserResponse` con el email nuevo. Envía aviso al email anterior | `400 invalid_code`; `409 email_taken` (lo tomó otro usuario mientras tanto) |

## Reglas transversales

- **Seguridad del JWT**: el backend valida firma, `iss`, `aud` y `exp`, y que el usuario exista.
- **Límites (`429`)**: incluyen `retryAfterSeconds`. Aplican 1 código por minuto y 5 por hora, por
  email y propósito.
- **Auditoría**: cada endpoint que cambia datos inserta un `audit_logs` según
  [data-model.md](../data-model.md).
- **Avisos de seguridad por email (FR-014a)**: `password-reset/confirm`, definir contraseña,
  vinculación de Google en `POST /auth/google` y `email-change/confirm`.
- **Contenido sensible**: ninguna respuesta incluye `passwordHash`, códigos ni hashes.
