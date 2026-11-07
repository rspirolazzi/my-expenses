# Mis Gastos (MyExpenses)

Group expense splitting for Web and Mobile. This repository has three sibling projects:

| Folder | Stack | What it is |
|---|---|---|
| `backend/` | Python 3.13, FastAPI, PyMongo (async) | REST API under `/api/v1`, the only issuer of JWTs |
| `web/` | Next.js 16, React 19, Auth.js v5, next-intl | Web app; works as a BFF, so backend tokens never reach the browser |
| `mobile/` | Expo SDK 56, React Native Paper, Expo Router | iOS and Android app (development build) |

Specs, plans and tasks live in `specs/` (Spec Kit). The project rules are in
`.specify/memory/constitution.md`.

## Prerequisites

- Docker Engine 24.0.x and Docker Compose v2.22.x, on a CPU with AVX (MongoDB 8.0).
- Node.js v22.13.0 (`.nvmrc`) and, to run the backend outside Docker, Python 3.13 with [uv](https://docs.astral.sh/uv/).
- For Mobile: Android Studio or Xcode. Google Sign-In does not work in Expo Go.

## Configuration

1. Copy `.env.example` to `.env` and fill in the values. Secrets only live in `.env`: never commit
   them or paste them anywhere.
2. Mobile reads its own `mobile/.env` (Expo only loads env files from the project folder). Copy
   the `EXPO_PUBLIC_*`, `GOOGLE_IOS_URL_SCHEME` and `EXPO_NO_TELEMETRY` variables there.
3. With `EMAIL_DELIVERY=console` (development only) emails are not sent: they are appended to
   `backend/.dev-outbox/emails.jsonl`, where you can read the codes. They never go to the logs.

## Run

```bash
docker compose up -d --build
```

- API: http://localhost:8000/api/v1 (OpenAPI at `/api/v1/openapi.json`, docs at `/api/v1/docs`)
- Web: http://localhost:3000
- Mobile: `cd mobile && npx expo run:android` (or `run:ios`). Needs JDK 17 and the Android SDK
  (`ANDROID_HOME`). Inside the emulator `localhost` is the emulator itself: set
  `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1` in `mobile/.env`, or keep `localhost` and
  run `adb reverse tcp:8000 tcp:8000` after starting the emulator.

## Accounts and invitations (feature 002)

- Web: "My Accounts" at `/accounts`, a new account at `/accounts/new`, invitations at
  `/invite/<code>` (signing in or up from there comes back to the invitation) and `/join` to paste a
  code.
- Mobile: the same screens under "Mis Cuentas"; invitations open with the deep link
  `myexpenses://invite/<code>` or by pasting the code in "Join with a code". Shared links use
  `EXPO_PUBLIC_WEB_BASE_URL`.

## Tests

```bash
cd backend && uv run pytest          # needs the compose MongoDB running; uses myexpenses_test
cd backend && uv run pytest -m perf  # latency goals (optional)
cd web && npm test
cd mobile && npm test
```

Lint and format: `uv run ruff check . && uv run ruff format --check .` (backend), `npm run lint`
(web and mobile).

## API types

Web and Mobile generate their TypeScript types from the backend OpenAPI. With the backend
running:

```bash
cd web && npm run gen:api
cd mobile && npm run gen:api
```

## Feature validation

End-to-end scenarios: [specs/001-user-auth-profile/quickstart.md](specs/001-user-auth-profile/quickstart.md).
