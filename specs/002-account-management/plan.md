# Implementation Plan: Cuentas, Participantes de Texto Libre e Invitaciones

**Branch**: `002-account-management` (se crea al implementar; hoy se trabaja sobre `main`) |
**Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-account-management/spec.md`

## Summary

Cuentas para agrupar gastos compartidos: alta con nombre, descripción, ícono y moneda fija;
participantes de texto libre con nombre único por Cuenta; invitación por enlace que vincula a un
usuario con un participante (o lo agrega como participante nuevo); edición por cualquier miembro;
salida de miembros; cierre definitivo de solo lectura y baja lógica, ambos solo para el Owner; y
auditoría de cada cambio.

Enfoque técnico: se extiende la base de la feature 001 sin capas nuevas. El backend agrega la
colección `accounts`, con los participantes embebidos, y los endpoints `/api/v1/accounts` e
`/api/v1/invitations`. La membresía se deriva de los participantes (un usuario es miembro si está
vinculado a un participante activo), así no hay una colección de membresías que mantener en
sincronía. Quitar un participante es una baja lógica (`removedAt`), porque las features de Gastos y
Saldos necesitan su nombre para el historial. Web (BFF con Server Actions) y Mobile (cliente directo)
agregan "Mis Cuentas", el alta, el detalle con edición y la pantalla de invitación.

## Technical Context

**Language/Version**: Python 3.13 (backend); TypeScript 5.x `strict` sobre Node.js v22.13.0 (web y
mobile). Igual que la feature 001.

**Primary Dependencies**: las de la feature 001, más una sola nueva en Mobile:
`@expo/vector-icons` (paquete oficial de Expo) para dibujar los íconos de las Cuentas, que React
Native Paper también usa. El código de invitación sale de `secrets` (stdlib), la validación de moneda
reutiliza `pycountry`, y Mobile comparte el enlace con `Share` de React Native y abre deep links con
`expo-linking`, ya instalado. Ver [research.md](research.md) R7 y R8.

**Storage**: MongoDB 8.0. Colección nueva `accounts` (participantes embebidos). Reutiliza
`audit_logs` con `entityType: "account"`.

**Testing**: pytest + httpx contra MongoDB real (contrato e integración, incluidos permisos y
carreras de vinculación); Jest en Web (`next/jest`) y Mobile (`jest-expo`) para cada pantalla y hook
nuevo (Principio VII).

**Target Platform**: igual que la feature 001: backend y web en contenedores; Mobile iOS 16+ y
Android 10+ con development build.

**Project Type**: Web + Mobile + API (los tres proyectos existentes).

**Performance Goals**: endpoints de Cuentas con p95 < 200 ms; "Mis Cuentas" con hasta 100 Cuentas
por usuario en una sola consulta indexada.

**Constraints**: permisos validados siempre en el backend (FR-020); quien no es miembro recibe `404`
igual que si la Cuenta no existiera (FR-007); toda escritura junto con su auditoría en una
transacción; bajas siempre lógicas (Principio IV).

**Scale/Scope**: hasta ~10.000 usuarios; hasta 50 participantes por Cuenta; ~5 pantallas nuevas por
cliente (Mis Cuentas, nueva Cuenta, detalle/edición, participantes, invitación).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Cumplimiento en esta feature | Estado |
|---|---|---|
| I. Acceso Directo y Multiplataforma | Mismas operaciones en Web y Mobile sobre la misma API `/api/v1`; JWT validado en cada endpoint | PASS |
| II. Internacionalización | Textos nuevos en `es`/`en` en ambos clientes; mensajes de error por `code` | PASS |
| III. Moneda Única y Exactitud | Moneda ISO 4217 fijada al crear la Cuenta y no editable; sin importes en esta feature | PASS |
| IV. Auditoría Inmutable y Bajas Lógicas | Cada cambio inserta un `audit_logs` (`entityType: "account"`) en la misma transacción; baja de Cuenta (`isDeleted`) y de participante (`removedAt`) lógicas; confirmación explícita para quitar, salir, cerrar, regenerar y dar de baja | PASS |
| V. Strict English Rule | Código, colecciones, campos, rutas y commits en inglés | PASS |
| VI. Privacidad y Datos | La invitación muestra solo nombre, moneda, ícono y participantes libres de la Cuenta, y solo a usuarios autenticados; códigos no adivinables; sin datos de Cuentas en los logs | PASS |
| VII. Test-First | Tests de permisos (Owner vs. miembro vs. ajeno), vinculación concurrente, nombres duplicados y Cuenta Cerrada antes de implementar; Jest en cada pantalla nueva | PASS |
| VIII. Simplicidad | Sin servicios nuevos; una sola dependencia nueva (`@expo/vector-icons`), justificada en Complexity Tracking; participantes embebidos en la Cuenta; membresía derivada; íconos de un conjunto fijo (sin almacenamiento de archivos) | PASS |
| Reglas del Dominio > Cuentas | Alta con Nombre, Moneda, Descripción e Ícono; participantes híbridos con invitación; modificación por cualquier miembro; remoción sin borrar datos; baja solo del Owner; salida con el participante conservado; cierre solo del Owner y de solo lectura | PASS |
| REST API | `/api/v1/accounts`, `/api/v1/accounts/{account_id}/participants`, `/api/v1/invitations/{code}`; permisos de Owner y miembro en el backend | PASS |
| Nomenclatura | Colección `accounts`, campos `camelCase` (`isClosed`, `isDeleted`, `inviteCode`); Python `snake_case`; componentes `PascalCase` | PASS |

**Resultado del gate (pre-research)**: PASS, sin violaciones a justificar.

**Re-check post-diseño (Phase 1)**: PASS. [data-model.md](data-model.md) mantiene las bajas lógicas y
la auditoría por transacción; [contracts/api.md](contracts/api.md) aplica `404` a quien no es
miembro, `403` a acciones de Owner y `409` a Cuentas Cerradas.

## Project Structure

### Documentation (this feature)

```text
specs/002-account-management/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: /api/v1/accounts e /api/v1/invitations
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Solo se listan los archivos nuevos o modificados respecto de la feature 001.

```text
backend/app/
├── core/errors.py                  # + not_member (404), owner_only (403), account_closed (409), ...
├── db/indexes.py                   # + índices de accounts
├── schemas/account.py              # AccountCreate, AccountUpdate, AccountResponse, ParticipantResponse, ...
├── repositories/accounts.py
├── services/account_service.py     # alta, edición, participantes, salida, cierre, baja, regeneración
├── services/account_permissions.py # miembro / Owner / Cuenta abierta y armado de respuestas
├── services/invitation_service.py  # vista previa y aceptación de invitaciones
├── services/audit_service.py       # + acciones account.*
├── api/v1/accounts.py
├── api/v1/invitations.py
└── main.py                         # + routers
backend/tests/{unit,integration,contract}/   # tests de cuentas, participantes, invitaciones y permisos

web/src/
├── app/(private)/accounts/page.tsx           # Mis Cuentas
├── app/(private)/accounts/new/page.tsx
├── app/(private)/accounts/[accountId]/page.tsx   # detalle, edición, participantes, acciones
├── app/(private)/invite/[code]/page.tsx      # aceptar invitación
├── app/actions/accounts.ts                   # Server Actions
├── components/accounts/                      # AccountForm, AccountIcon, IconPicker, ParticipantList,
│                                             # InvitePanel, ConfirmDialog, JoinAccountForm, ...
├── lib/accountIcons.ts
├── components/SiteHeader.tsx                 # "Accounts" deja de estar deshabilitado
├── proxy.ts                                  # /accounts y /invite como rutas privadas
├── lib/pendingRedirect.ts                    # destino tras registro o login por código (FR-009)
├── i18n/messages/{es,en}.json                # + accounts.*, invite.*
└── __tests__/

mobile/
├── app/(app)/accounts/index.tsx              # Mis Cuentas
├── app/(app)/accounts/new.tsx
├── app/(app)/accounts/[accountId].tsx
├── app/invite/[code].tsx                     # deep link chepagame://invite/<code>, fuera de los grupos protegidos
├── app/(app)/join.tsx                        # unirse pegando el código
└── src/
    ├── screens/accounts/                     # pantallas reutilizadas por las rutas
    ├── components/accounts/                  # AccountIcon, IconPicker, ParticipantList, ConfirmDialog
    ├── services/api/accounts.ts
    ├── hooks/usePendingInvite.ts             # recuerda la invitación mientras el usuario se loguea
    ├── i18n/locales/{es,en}.json
    └── __tests__/
```

**Structure Decision**: se mantienen los tres proyectos. Los tipos TypeScript se regeneran del
OpenAPI con `npm run gen:api` en Web y Mobile; no hay paquete compartido.

## Complexity Tracking

No hay violaciones a la constitución que justificar. Dependencias nuevas (Principio VIII):

| Dependencia | Proyecto | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|---|
| `@expo/vector-icons` | mobile | Dibujar los íconos de las Cuentas; también resuelve los íconos de React Native Paper, que hoy avisa que falta una librería de íconos | Imágenes propias por ícono (más archivos que mantener) |

La única decisión de modelado no trivial, la baja lógica de participantes en lugar de quitarlos del
arreglo, se justifica en [research.md](research.md) R3.
