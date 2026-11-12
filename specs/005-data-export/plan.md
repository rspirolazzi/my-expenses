# Implementation Plan: Exportar datos

**Branch**: `005-data-export` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-data-export/spec.md`

## Summary

Cualquier miembro exporta una Cuenta, abierta o Cerrada, en CSV o JSON desde un botón "Exportar"
junto a las pestañas Gastos y Saldos. Desde el Perfil, el usuario exporta todos sus datos: su
perfil y cada Cuenta de la que es miembro.

- El CSV va en un ZIP con un archivo por tabla y una carpeta por Cuenta en "todos mis datos".
- El JSON es un único documento con claves estables.
- Los importes son exactos, con punto decimal; los encabezados y valores traducibles salen en el
  idioma del usuario.
- Sin emails ni ids de otros usuarios ni secretos. Cada exportación queda en la auditoría.

Enfoque técnico ([research.md](research.md)):

- **Backend**: dos endpoints `GET .../export?format=csv|json` que leen todo en una sesión snapshot
  de MongoDB, arman un modelo intermedio con funciones puras (`export_builder.py`, que reutiliza
  `split_equal`, `compute_balances` y `suggest_transfers`) y lo renderizan con `csv`, `zipfile` y
  `json` de la biblioteca estándar (`export_render.py`). Sin colecciones ni índices nuevos; dos
  acciones de auditoría nuevas.
- **Web**: dos Route Handlers `POST` en el BFF que reenvían el archivo y un `ExportButton` cliente
  que descarga con `fetch` y un `Blob`, con progreso y reintento.
- **Mobile**: `requestFile` en el cliente HTTP (`expo/fetch`), el archivo en la caché con
  `expo-file-system` y la hoja de compartir con `expo-sharing` (dependencia nueva).

## Technical Context

**Language/Version**: Python 3.13 en el backend. TypeScript 5.x `strict` sobre Node.js v22.13.0 en
Web y Mobile. Igual que en las features anteriores.

**Primary Dependencies**: las de las features 001 a 004.

- Backend: ninguna nueva (`csv`, `zipfile`, `json` e `io` de la biblioteca estándar, R5).
- Web: ninguna nueva.
- Mobile: `expo-sharing` (nueva) y `expo-file-system` (ya instalada por Expo, pasa a declararse),
  en las versiones de Expo SDK 56 que fija `npx expo install` (R13).

**Storage**: MongoDB 8.0 (replica set). Sin colecciones, campos ni índices nuevos. `audit_logs`
suma las acciones `account.exported` y `user.data_exported`. Los archivos se arman en memoria y no
se guardan en el servidor; en Mobile quedan en la caché de la App hasta la siguiente exportación.

**Testing**:

- **Backend**: pytest + httpx contra MongoDB real.
  - Unit: `build_account_export`, `render_csv_zip`, `render_json`, slug y nombre de archivo, con los
    casos de [quickstart.md](quickstart.md).
  - Contrato: los dos endpoints, headers y `422`.
  - Integración: permisos, Cuenta Cerrada, Cuentas abandonadas y dadas de baja, usuario sin
    Cuentas, auditoría, privacidad (ningún email ajeno ni id de usuario en los archivos).
  - Perf: una Cuenta de 500 gastos y 100 reembolsos; 20 Cuentas de 500 gastos.
- **Web y Mobile**: Jest (`next/jest` y `jest-expo`) para `ExportButton`, los Route Handlers y las
  secciones nuevas de la Cuenta y del Perfil (Principio VII).

**Target Platform**: igual que en las features anteriores.

**Project Type**: Web + Mobile + API, los tres proyectos existentes.

**Performance Goals**:

- `GET /accounts/{id}/export` con 500 gastos y 100 reembolsos: p95 < 1 s en la API y < 5 s hasta
  tener el archivo (SC-003).
- `GET /users/me/export` con 20 Cuentas de 500 gastos: p95 < 3 s en la API y < 15 s hasta tener el
  archivo (SC-004).

**Constraints**:

- Permisos siempre en el backend; quien no es miembro recibe `404`.
- Nada de punto flotante para dinero: importes desde unidades menores con `format_amount`.
- Lista de campos permitidos: el archivo nunca copia documentos completos (R9).
- Los logs no incluyen el contenido exportado ni los nombres (FR-016).
- Respuestas con `Cache-Control: no-store`.

**Scale/Scope**:

- Hasta ~10.000 usuarios; cientos de gastos y reembolsos por Cuenta; hasta 50 participantes.
- Una exportación "todo" de ~10.000 gastos pesa unos pocos MB.
- Por cliente: un botón en la Cuenta y una sección en el Perfil.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Cumplimiento en esta feature | Estado |
|---|---|---|
| I. Acceso Directo y Multiplataforma | Mismo botón, mismos formatos y mismo contenido en Web y Mobile; el archivo lo arma el backend en `/api/v1` con JWT | PASS |
| II. Internacionalización | Textos nuevos en `es` y `en`; encabezados, nombres de tablas y valores traducibles según `Accept-Language`; importes y fechas independientes del idioma | PASS |
| III. Moneda Única y Exactitud | Importes desde unidades menores con `format_amount`, siempre junto a la moneda de su Cuenta; partes con `split_equal`; saldos de `compute_balances` (suma cero); nunca se suman monedas distintas; en JSON, importes como texto decimal | PASS |
| IV. Auditoría Inmutable y Bajas Lógicas | `account.exported` y `user.data_exported` por cada exportación exitosa; no se exportan registros dados de baja; no hay escrituras de dominio | PASS |
| V. Strict English Rule | Código, rutas, claves del JSON y commits en inglés; solo los valores traducibles del archivo cambian de idioma | PASS |
| VI. Privacidad y Propiedad de los Datos | Es la implementación de "el usuario MUST poder exportar sus datos en formato abierto (CSV y/o JSON)"; lista de permitidos sin emails ni ids de otros usuarios ni secretos; `no-store`; logs sin contenido; sin envío a terceros | PASS |
| VII. Test-First | Tests de las funciones puras antes de implementarlas: centavos, suma cero, moneda sin decimales, pendientes, excluidos, caracteres especiales, inyección de fórmulas, privacidad; Jest en cada componente nuevo | PASS |
| VIII. Simplicidad | Generación en el momento, sin colas ni almacenamiento; biblioteca estándar en el backend; una sola dependencia nueva en Mobile, justificada abajo | PASS |
| Reglas del Dominio > Saldos | Los saldos y sugerencias exportados salen de las mismas funciones que la pestaña Saldos | PASS |
| REST API | `/api/v1/accounts/{account_id}/export` y `/api/v1/users/me/export`; membresía verificada en el backend | PASS |
| Nomenclatura | Python en `snake_case` (`build_account_export`); componentes en `PascalCase` (`ExportButton.tsx`); claves en `camelCase` | PASS |
| Seguridad y Datos | Validación de `format` con Pydantic/FastAPI; tokens del backend solo en el servidor de Next.js; `POST` en el BFF contra disparos desde otros sitios | PASS |

**Resultado del gate (pre-research)**: PASS, sin violaciones que justificar.

**Re-check post-diseño (Phase 1)**: PASS.

- [data-model.md](data-model.md) no agrega datos persistidos fuera de la auditoría y define las
  invariantes de exactitud y privacidad que verifican los tests.
- [contracts/api.md](contracts/api.md) aplica `404` a quien no es miembro, no expone ids de usuario
  y fija `no-store`.

## Project Structure

### Documentation (this feature)

```text
specs/005-data-export/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: /accounts/{id}/export, /users/me/export, BFF
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Solo se listan los archivos nuevos o modificados respecto de la feature 004.

```text
backend/app/
├── core/export_labels.py           # encabezados, nombres de tablas y valores traducibles es/en
├── db/client.py                    # + snapshot_session() (R3)
├── repositories/expenses.py        # + active_for_export(account_ids, session)
├── repositories/settlements.py     # + active_for_export(account_ids, session)
├── repositories/accounts.py        # find_for_member / list_for_member aceptan session
├── services/export_builder.py      # AccountExport, PersonalExport, build_* (funciones puras)
├── services/export_render.py       # render_json, render_csv_zip, slugify, file_name (puras)
├── services/export_service.py      # permisos, lecturas snapshot, auditoría, respuesta
├── services/audit_service.py       # + account.exported, user.data_exported
├── api/v1/exports.py               # GET /accounts/{account_id}/export, GET /users/me/export
└── main.py                         # + router
backend/tests/{unit,integration,contract,perf}/

web/src/
├── app/api/exports/accounts/[accountId]/route.ts  # POST, reenvía el archivo del backend
├── app/api/exports/me/route.ts                    # POST
├── app/(private)/accounts/[accountId]/page.tsx    # + ExportButton en el encabezado
├── app/(private)/accounts/[accountId]/balances/page.tsx  # + ExportButton
├── app/(private)/profile/page.tsx                 # + sección "Exportar mis datos"
├── components/exports/ExportButton.tsx            # menú CSV/JSON, progreso, error y reintento
├── lib/download.ts                                # Blob + enlace temporal; nombre desde Content-Disposition
├── i18n/messages/{es,en}.json                     # + exports.*
└── __tests__/

mobile/
├── package.json                    # + expo-sharing, expo-file-system
└── src/
    ├── services/api/client.ts      # + requestFile (expo/fetch, refresco de token)
    ├── services/api/exports.ts     # exportAccount, exportMine
    ├── utils/shareFile.ts          # escribe en Paths.cache y abre Sharing.shareAsync
    ├── components/exports/ExportButton.tsx   # Menu de Paper, progreso, error y reintento
    ├── screens/expenses/AccountExpensesScreen.tsx   # + ExportButton
    ├── screens/balances/AccountBalancesScreen.tsx   # + ExportButton
    ├── screens/ProfileScreen.tsx   # + sección "Exportar mis datos"
    ├── i18n/locales/{es,en}.json
    └── __tests__/
```

**Structure Decision**: se mantienen los tres proyectos. El archivo se genera solo en el backend;
los clientes no duplican lógica de exportación, así que no hay helpers repetidos en Web y Mobile
salvo el parseo de `Content-Disposition`, que es trivial y va con sus tests en cada cliente. Los
tipos se regeneran del OpenAPI con `npm run gen:api` (solo cambian las rutas nuevas).

## Complexity Tracking

| Decisión | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Dependencia nueva `expo-sharing` en Mobile | FR-017 pide la hoja de compartir del sistema con un archivo; es el módulo oficial de Expo | `Share` de React Native no comparte archivos en Android |
| Sesión snapshot de MongoDB (R3) | El archivo tiene que reflejar un único momento; los saldos deben coincidir con los gastos exportados | Lecturas sueltas: podrían quedar saldos que no cuadran con los gastos del mismo archivo |
| Route Handlers en el BFF de Web (R12) | Las Server Actions no devuelven binarios; el token no puede llegar al navegador | Enlace directo al backend (expone el token) |

Otras decisiones no triviales, justificadas en [research.md](research.md):

- Generación síncrona en el backend, sin colas (R1).
- Modelo intermedio puro con dos renderizadores (R4).
- Apóstrofo solo en columnas de texto libre contra la inyección de fórmulas (R6).
- Importes como texto decimal también en JSON (R8).
- Lista de campos permitidos para la privacidad (R9).
