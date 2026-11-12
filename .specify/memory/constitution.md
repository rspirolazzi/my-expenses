# ChePagame Constitution

**ChePagame** es una plataforma multiplataforma (Web y App Mobile) para gestionar y simplificar la
división de gastos grupales entre personas de forma intuitiva, transparente y sin fricciones.

## Core Principles

### I. Acceso Directo y Multiplataforma

- La autenticación MUST ser simple e inmediata tanto desde Web como desde la App Mobile, para
  consultar y gestionar saldos entre usuarios.
- El inicio de sesión con Google (Gmail) y el registro/inicio de sesión con email y contraseña
  MUST estar disponibles en Web y Mobile.
- Toda funcionalidad de negocio MUST exponerse mediante la misma REST API versionada, de modo que
  Web y Mobile ofrezcan el mismo comportamiento.
- Web y Mobile MUST autenticarse contra la API con JWT; el backend MUST validar el JWT en cada
  request a un endpoint privado.

Rationale: el valor del producto depende de que cualquier integrante pueda entrar y ver su saldo
en segundos, desde cualquier dispositivo.

### II. Internacionalización

- Todo texto visible al usuario MUST provenir de recursos de traducción; no se permiten strings de
  UI hardcodeados.
- El idioma MUST ser configurable por usuario desde su Perfil.
- Fechas e importes MUST formatearse según el idioma/región del usuario.

Rationale: el soporte multi-idioma es un requisito de primer nivel de la interfaz.

### III. Moneda Única por Cuenta y Exactitud Monetaria (NON-NEGOTIABLE)

- La moneda (código ISO 4217) MUST definirse al crear una Cuenta. Todos los gastos y reembolsos de
  esa Cuenta MUST registrarse exclusivamente en esa moneda.
- La plataforma MUST NOT realizar conversiones automáticas de tipo de cambio.
- Los importes MUST almacenarse y calcularse con valores exactos (unidades menores enteras o
  `Decimal128`); MUST NOT usarse punto flotante binario para dinero.
- Al dividir un importe, los centavos sobrantes MUST asignarse con una regla determinística y la
  suma de las partes MUST ser igual al total.
- Las fechas MUST almacenarse en ISO 8601 / UTC y mostrarse en la zona horaria del usuario.

Rationale: un saldo que difiere en un centavo destruye la confianza entre amigos.

### IV. Auditoría Inmutable y Bajas Lógicas (NON-NEGOTIABLE)

- Toda creación, modificación o eliminación de Cuentas, Gastos y Reembolsos MUST registrarse en un
  log de auditoría inmutable (colección `audit_logs`) con: quién ejecutó la acción, qué cambió
  (valores anteriores y nuevos) y cuándo.
- Los registros de auditoría MUST NOT poder editarse ni eliminarse mediante la API.
- Las eliminaciones de Cuentas y Gastos MUST ser bajas lógicas (`isDeleted`), nunca borrado físico.
- Las operaciones destructivas MUST requerir confirmación explícita del usuario.
- Los cambios de esquema MUST incluir una migración que preserve los datos existentes.

Rationale: el modelo de edición libre entre amigos solo es viable si todo cambio es trazable.

### V. Strict English Rule (NON-NEGOTIABLE)

- Todo el código fuente, esquemas de base de datos, APIs, variables, funciones, commits y
  comentarios técnicos MUST escribirse estrictamente en inglés.
- La documentación funcional, specs y discusiones de negocio PUEDEN escribirse en español.
- Las convenciones de nomenclatura de la sección "Stack Tecnológico y Convenciones Técnicas" son
  obligatorias.

Rationale: un único idioma técnico mantiene el código consistente y accesible.

### VI. Privacidad y Propiedad de los Datos

- Los datos de los usuarios MUST NOT enviarse a terceros (analytics, publicidad, telemetría,
  servicios de IA) sin consentimiento explícito (opt-in).
- El usuario MUST poder exportar sus datos en formato abierto (CSV y/o JSON).
- Secretos (API keys, tokens, credenciales, contraseñas de base de datos, secretos de JWT) MUST
  NOT agregarse al código, commitearse al repositorio, loguearse ni compartirse en ningún chat
  (incluidos asistentes de IA). Solo MUST residir en archivos `.env` locales.
- Los archivos `.env` MUST estar en `.gitignore`. El repositorio MUST incluir un `.env.example`
  con todas las variables requeridas y valores de ejemplo vacíos o ficticios, nunca reales.
- Si un secreto se expone, MUST rotarse de inmediato.
- Los logs de aplicación MUST NOT contener datos personales ni detalles completos de gastos o
  comprobantes.

Rationale: los gastos compartidos revelan información personal sensible.

### VII. Test-First para Lógica de Dominio

- El cálculo de saldos, la división de gastos, los reembolsos sugeridos y las reglas de permisos
  MUST tener tests automatizados escritos antes o junto con la implementación, y esos tests MUST
  fallar antes de que la implementación los haga pasar.
- Casos borde obligatorios: importe cero, centavos no divisibles, un único participante,
  participante que pagó sin participar, gastos eliminados, cuentas cerradas, participantes
  asociados/no asociados a un usuario, participantes removidos (incluida la redistribución de su parte y sus reembolsos excluidos) y
  gastos con `paidBy` en `null`.
- El frontend Web y la App Mobile MUST tener tests unitarios con Jest: cada feature MUST incluir
  al menos un test unitario de sus componentes, hooks o lógica.
- Un cambio que rompa un test existente MUST NOT integrarse hasta que el test pase o el cambio de
  comportamiento esté documentado en la spec.

Rationale: los errores en lógica financiera son silenciosos; los tests son el único detector fiable.

### VIII. Simplicidad y Entrega Incremental

- Se MUST comenzar con el diseño más simple que cumpla la spec vigente (YAGNI). Nuevas
  dependencias, servicios o capas de abstracción MUST justificarse en la sección Complexity
  Tracking del plan.
- Las funcionalidades MUST entregarse como incrementos usables de forma independiente, cada uno
  trazable a una user story de la spec.
- El flujo central (cargar un gasto, ver saldos, registrar un reembolso) MUST mantenerse rápido y
  usable; las funcionalidades secundarias MUST NOT degradarlo.

Rationale: una herramienta entre amigos se adopta por ser confiable y rápida, no por su amplitud.

## Reglas del Dominio y Modelo de Negocio

### Cuentas (`Account`)

- **Alta:** cualquier usuario registrado MUST poder crear una Cuenta con Nombre, Moneda,
  Descripción (opcional) e Ícono (elegido de un conjunto fijo, con uno por defecto; no se suben
  imágenes). El creador es el **Owner**.
- **Participantes híbridos:** el creador define inicialmente los participantes como nombres en
  texto libre. La Cuenta MUST generar una invitación vinculable. Cuando un usuario acepta la
  invitación y se registra/inicia sesión, su perfil MUST asociarse al participante de texto libre
  que elija, o agregarse como nuevo participante si no existía.
- **Modificación:** cualquier miembro MUST poder modificar Nombre, Descripción, Ícono y agregar o
  quitar participantes.
- **Remoción de participantes:** cualquier miembro MUST poder quitar a un participante de la
  Cuenta, tenga o no saldo distinto de cero. Sus gastos MUST NOT eliminarse: en cada gasto que
  había pagado, `paidBy` MUST quedar en `null` y la UI MUST mostrar el pagador como vacío. La
  remoción y cada cambio de `paidBy` a `null` MUST quedar auditados (Principio IV). Reasignar el
  pagador queda delegado a los miembros, editando el gasto.
- **Parte del participante removido:** si el participante removido estaba entre los
  `participants` de un gasto, MUST quitarse de esa lista y el importe MUST volver a dividirse en
  partes iguales entre los participantes restantes, quedando auditado. Si no queda ningún
  participante, el gasto MUST tratarse como pendiente de asignación (igual que un gasto sin
  pagador) hasta que un miembro elija nuevos participantes.
- **Reembolsos del participante removido:** los reembolsos registrados que el participante
  removido pagó o recibió MUST NOT eliminarse; MUST conservarse como historial auditado y MUST
  excluirse del cálculo de saldos y de los reembolsos sugeridos.
- **Baja:** solo el Owner MUST poder realizar la baja lógica de la Cuenta completa.
- **Salida:** un miembro invitado MUST NOT poder eliminar la Cuenta, pero MUST poder abandonarla,
  incluso con saldo distinto de cero; la Cuenta deja de figurar en su panel y sigue visible para el
  Owner y los demás miembros. Su participante MUST permanecer en la Cuenta (desvinculado de su
  usuario) con su nombre de texto libre, que MUST seguir figurando en sus gastos, junto con su saldo
  histórico, de modo que la suma de saldos siga siendo cero.
- **Cierre:** solo el Owner MUST poder marcar la Cuenta como Cerrada (`isClosed`), sin importar si
  el saldo es cero. Una Cuenta Cerrada es estrictamente de solo lectura: MUST NOT permitir crear,
  editar ni eliminar gastos, ni registrar reembolsos o liquidaciones. Su propósito es solo
  histórico y de consulta.

### Gastos (`Expense`)

- **Atributos:** fecha (por defecto, hoy), nombre/concepto, importe, moneda (heredada de la Cuenta,
  no editable), `paidBy` (un participante; por defecto, quien registra el gasto; MUST ser requerido al crear o
  editar, aunque en la base de datos PUEDE quedar en `null` por la remoción de un participante), `participants`
  (uno o más participantes que comparten el gasto) y categoría/ícono (ej. Casa, Auto, Hotel,
  Playa, Comida, Dinero). Opcionales: descripción y comprobante/ticket.
- **División:** el importe de cada gasto MUST dividirse en partes iguales únicamente entre los
  `participants` seleccionados para ese gasto (no necesariamente todos los miembros de la Cuenta).
  Los participantes no seleccionados no asumen parte de ese gasto.
- **Edición colaborativa:** todo miembro de la Cuenta MUST poder editar o eliminar cualquier gasto
  de la misma, sin importar quién lo registró; cada acción queda auditada (Principio IV).

### Saldos y Reembolsos (`Balances & Settlements`)

- **Saldos:** el saldo de cada participante MUST calcularse como lo pagado menos su parte en los
  gastos, más/menos los reembolsos registrados. La suma de todos los saldos de una Cuenta MUST ser
  exactamente cero.
- **Gastos sin pagador:** los gastos con `paidBy` en `null` MUST excluirse del cálculo de saldos y
  de los reembolsos sugeridos hasta que un miembro les asigne un pagador, y la UI MUST marcarlos
  como pendientes de asignación.
- **Reembolsos sugeridos:** la vista de Saldos MUST proponer un conjunto de transferencias que
  salde todas las deudas, minimizando su cantidad; como mínimo MUST requerir no más de N−1
  transferencias, siendo N la cantidad de participantes con saldo distinto de cero.
- **Marcar como pagado:** cada sugerencia MUST ofrecer una acción manual que registre el reembolso
  como un movimiento persistido y auditado, que actualiza los saldos.

## Stack Tecnológico y Convenciones Técnicas

### Stack

| Componente | Versión | Notas |
|------------|---------|-------|
| Node.js | v22.13.0 LTS | Base para Expo SDK 56 y Next.js 16 |
| Frontend Web: Next.js | ^16.4.0 | Con React 19 y TypeScript |
| Mobile App: Expo SDK | ^56.0.0 | React Native 0.85 y React 19, con TypeScript |
| UI Mobile: React Native Paper | — | Componentes y theming Light/Dark/System de la App |
| React | ^19.0.0 | Versión compartida entre Next.js y Expo |
| Backend API: Python (FastAPI) | Python 3.13.x | Dependencias gestionadas con uv |
| Base de Datos: MongoDB | 8.0.x | Requiere CPU con soporte AVX en el host |
| Docker Engine | 24.0.x | Imágenes oficiales de MongoDB 8.0 |
| Docker Compose | v2.22.x | Orquestación local |
| JDK (build nativo Android) | 17 | Requerido por React Native 0.85 (Gradle `jvmToolchain(17)`) |

- Web y Mobile MUST usar TypeScript con tipado estricto (`strict`) para los contratos de API y los
  modelos de datos compartidos; MUST NOT agregarse archivos `.js` / `.jsx` de aplicación.
- Web y Mobile MUST usar la misma versión major de React.
- La versión de Node.js MUST fijarse en el repositorio (ej. `.nvmrc` y `engines` en
  `package.json`), y la de Python también (ej. `.python-version` y `requires-python` en
  `pyproject.toml`).

Cambiar cualquier componente del stack o su versión major requiere una enmienda a esta
constitución.

### Infraestructura Local (Docker)

- MongoDB MUST ejecutarse en desarrollo local mediante la imagen oficial `mongo:8.0` con Docker
  Compose, junto con el backend FastAPI y la app Next.js.
- MongoDB MUST configurarse como replica set (de un nodo en desarrollo), ya que las transacciones
  multi-documento requeridas en "Seguridad y Datos" no funcionan en un servidor standalone.
- Los datos de MongoDB MUST persistir en un volumen nombrado de Docker.
- Las credenciales de MongoDB y demás servicios MUST leerse desde `.env` (ej. `env_file` o
  interpolación de variables en Compose); MUST NOT escribirse en `docker-compose.yml`.
- Los puertos de MongoDB SHOULD publicarse solo en `127.0.0.1` en desarrollo.

### Nomenclatura

- **MongoDB:** colecciones en plural y `snake_case` (`users`, `accounts`, `expenses`,
  `audit_logs`); campos en `camelCase` (`createdAt`, `paidBy`, `totalAmount`, `isClosed`,
  `isDeleted`).
- **Backend (Python):** módulos, funciones y variables en `snake_case`
  (`calculate_account_balances()`, `account_id`, `audit_service.py`); clases y modelos Pydantic en
  `PascalCase` (`AccountCreate`, `ExpenseResponse`, `UserModel`).
- **Frontend / Mobile:** componentes y pantallas en `PascalCase` (`AccountDetailScreen.tsx`,
  `ExpenseListItem.tsx`); hooks, funciones y contextos en `camelCase` (`useAccountDetails()`,
  `formatCurrency()`).
- **Excepción Next.js / Expo Router:** los nombres de archivo reservados por el framework
  (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `_layout.tsx`, carpetas de rutas en
  `kebab-case`) MUST respetar la convención del framework; los componentes que exportan siguen en
  `PascalCase`.

### REST API

- Rutas en minúsculas, recursos en plural en inglés y `kebab-case` para palabras compuestas, bajo
  el prefijo versionado `/api/v1`:
  - `POST /api/v1/auth/register`
  - `GET /api/v1/accounts`
  - `POST /api/v1/accounts/{account_id}/expenses`
  - `GET /api/v1/accounts/{account_id}/settlements`
- Cada endpoint privado MUST verificar que el usuario autenticado sea miembro de la Cuenta y
  aplicar las reglas de permisos (Owner vs. miembro) en el backend, nunca solo en el cliente.

### Seguridad y Datos

- Toda comunicación MUST usar TLS fuera del entorno local.
- **Autenticación Web:** el login con Google MUST implementarse con el provider de Google de
  Auth.js (NextAuth) en Next.js.
- **Autenticación de la API:** la sesión del usuario frente a la API MUST representarse con JWT
  firmados, con expiración corta y verificación de firma, emisor y expiración en el backend. Los
  JWT MUST NOT guardarse en `localStorage` en Web (usar cookies `HttpOnly`, `Secure`, `SameSite`)
  y MUST guardarse en almacenamiento seguro en Mobile (ej. `expo-secure-store`).
- **Autenticación Mobile:** el login con Google MUST implementarse con
  `@react-native-google-signin/google-signin` (requiere development build de Expo; no funciona en
  Expo Go).
- **Email y contraseña:** las contraseñas MUST almacenarse con un hash adaptativo moderno
  (Argon2id o bcrypt) y MUST NOT viajar ni guardarse en texto plano fuera del request de login o
  registro.
- **Email:** el envío de emails (ej. invitaciones) MUST hacerse con Resend; su API key MUST
  residir solo en `.env` del backend.
- Las escrituras que afectan varios documentos (ej. gasto + registro de auditoría) MUST ser
  atómicas (transacciones de MongoDB).
- Toda entrada de usuario MUST validarse en el límite de la API (modelos Pydantic).

## Estructura de Navegación y UI Base

### Web

- **Header (no logueado):** Inicio | Cómo funciona | Quiénes somos | Contacto | Login / Registro
- **Header (logueado):** Inicio | Cómo funciona | Quiénes somos | Contacto | menú desplegable de
  usuario (`Accounts`, `Profile`, `Logout`)
- **Footer:** links informativos y legales.

### Panel Principal (Mobile App y Web App)

- **Dashboard / Home:** resumen visual de cuentas activas y saldos consolidados.
- **Accounts ("Mis Cuentas"):** listado de cuentas compartidas.
- **Profile:** Nombre, Apellido, Idioma, Moneda por defecto y Theme (Light/Dark/System, donde
  System sigue el modo claro u oscuro del dispositivo).

## Fuera de Alcance (esta versión)

- Notificaciones, invitaciones o autenticación por SMS.
- Notificaciones, invitaciones o autenticación por WhatsApp.

## Flujo de Desarrollo y Quality Gates

- El trabajo sigue el flujo Spec Kit: specify → (clarify) → plan → tasks → implement. Los cambios
  no triviales MUST tener spec y plan antes de implementarse.
- Cada plan MUST incluir un Constitution Check que verifique el cumplimiento de cada principio;
  las violaciones MUST justificarse o resolverse antes de generar las tasks.
- Un cambio está terminado cuando: todos los tests pasan, linting/formato pasan, y el
  comportamiento visible fue probado en la app en ejecución (Web y/o Mobile según corresponda).
- Los commits MUST estar en inglés (Principio V) y SHOULD ser pequeños y referenciar su feature.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica del proyecto; ante un conflicto,
  manda la constitución hasta que sea enmendada.
- Las enmiendas MUST realizarse mediante `/speckit-constitution`, documentarse con un Sync Impact
  Report y revisarse contra los planes de features activos.
- Versionado semántico: MAJOR al eliminar o redefinir un principio o cambiar el stack, MINOR al
  agregar un principio/sección o ampliar materialmente una guía, PATCH para aclaraciones y
  redacción.
- El cumplimiento se revisa en el Constitution Check de cada plan y en la revisión de cada cambio;
  toda complejidad adicional MUST justificarse por escrito.

**Version**: 4.4.1 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-12
