# Quickstart: validar Autenticación y Perfil de Usuario

Guía para comprobar la feature de punta a punta, una vez implementada. Los endpoints están en
[contracts/api.md](contracts/api.md) y los datos en [data-model.md](data-model.md).

## Prerrequisitos

- Docker Engine 24.0.x y Compose v2.22.x, en una CPU con AVX.
- Node.js v22.13.0 (`.nvmrc`) y Python 3.13 con uv, si se corre fuera de Docker.
- Un proyecto de Google Cloud con un client ID OAuth web, más los de Android e iOS para Mobile.
- Una API key de Resend con un dominio o remitente verificado.
- Para Mobile: Android Studio o Xcode para el development build (Google Sign-In no funciona en Expo
  Go).

## Configuración

1. Copiar `.env.example` a `.env` y completar las variables. Ningún valor va al repositorio ni al
   chat:
   - **MongoDB**: `MONGO_INITDB_ROOT_*`.
   - **Backend**: `MONGODB_URI`, `JWT_SECRET`, `CODE_HASH_SECRET`, `GOOGLE_CLIENT_IDS`,
     `RESEND_API_KEY`, `EMAIL_FROM`.
   - **Web**: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
   - **Mobile**: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. Levantar los servicios y esperar a que `mongodb` figure como `healthy`:

   ```bash
   docker compose up -d
   ```

3. Comprobar que la API responde: `GET http://localhost:8000/api/v1/openapi.json` devuelve el
   contrato.
4. Web: abrir `http://localhost:3000`.
5. Mobile: desde `mobile/`, correr `npx expo run:android` o `run:ios`. En el emulador de Android,
   la API está en `http://10.0.2.2:8000/api/v1`.

## Tests automáticos

| Proyecto | Comando | Qué cubre |
|---|---|---|
| Backend | `uv run pytest` (en `backend/`, con el compose levantado) | Unit: hash de contraseñas, códigos, JWT, límites. Integration: los flujos de las User Stories 1–6 contra MongoDB real. Contract: respuestas según `api.md` |
| Web | `npm test` (en `web/`) | Formularios de login, registro y código; selector de moneda; aplicación de idioma y tema |
| Mobile | `npm test` (en `mobile/`) | Mismas pantallas y hooks (`useAuth`, `usePreferences`), con Google Sign-In y secure-store mockeados |

## Escenarios manuales

Con `EMAIL_DELIVERY=console`, los códigos aparecen en los logs del backend:

```bash
docker compose logs -f backend
```

1. **Registro con email (US1)**: registrarse con un email nuevo → llega el código → ingresarlo →
   elegir la moneda (viene sugerida según la región) → llegar al Dashboard.
   - Esperado: en `users` hay un documento con `authProviders: ["email"]`; en `audit_logs` están
     `user.registered` y `user.email_verified`.
2. **Email ya registrado (US1, escenario 5)**: registrarse otra vez con el mismo email.
   - Esperado: la pantalla muestra el mismo mensaje que en el paso 1 y llega el email "ya tenés una
     cuenta".
3. **Sin verificar (FR-003)**: registrarse y no ingresar el código.
   - Esperado: no se puede entrar al Dashboard ni a ninguna ruta privada.
4. **Google (US2)**: "Entrar con Google" con una cuenta nueva.
   - Esperado: se crea el usuario y se pide la moneda.
   - Repetir con el email del paso 1: no se crea otro usuario, `authProviders` pasa a
     `["email","google"]` y llega un aviso de seguridad.
5. **Código de acceso (US3)**: pedir un código e ingresarlo → se entra.
   - Esperado: reusar el mismo código da `invalid_code`; pedir otro antes de 1 minuto da
     `rate_limited`.
6. **Bloqueo**: 10 contraseñas incorrectas seguidas.
   - Esperado: `password_login_locked` durante 15 minutos, mientras el login por código sigue
     funcionando.
7. **Recuperación (US4)**: recuperar la contraseña con sesiones abiertas en Web y Mobile.
   - Esperado: la otra sesión se cierra en su próximo refresh y llega un aviso de seguridad.
8. **Preferencias (US5)**: cambiar idioma y tema en Web.
   - Esperado: el cambio se ve al instante, y al abrir la App se aplican los mismos valores. Con
     tema `system`, cambiar el modo del dispositivo cambia la interfaz.
9. **Cambio de email (FR-018)**: pedir el cambio, verificar con el código que llega al email nuevo.
   - Esperado: el email anterior recibe el aviso.
10. **Cerrar sesión (US6)**: Logout.
    - Esperado: las rutas privadas redirigen al login y el refresh token queda con `revokedAt`.

## Criterio de listo

- Pasan los tests automáticos de los tres proyectos.
- Los 10 escenarios manuales se comportan como se espera, en Web y en Mobile.
