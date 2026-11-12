# Research: Exportar datos

Decisiones técnicas de la feature 005. Parten de lo construido en las features 001 a 004:

- importes en unidades menores enteras y `format_amount` (`app/core/money.py`);
- `split_equal` con el orden de participantes de la Cuenta;
- `compute_balances` y `suggest_transfers` (`app/services/balance_math.py`);
- `require_member` (404 a quien no es miembro) y `accounts.list_for_member`;
- auditoría con `audit_service.record`;
- BFF en Web: los tokens del backend nunca llegan al navegador.

## R1. Dónde se genera el archivo: en el backend, en el momento

- **Decision**: el backend arma el archivo completo (ZIP o JSON) en memoria y lo devuelve en la
  misma respuesta. Web y Mobile solo lo descargan y lo guardan o comparten.
- **Rationale**: el contenido es igual en ambos clientes sin duplicar lógica (FR-017). Los centavos,
  los saldos y las sugerencias salen de las mismas funciones que usa la aplicación (SC-001). El
  peor caso de SC-004 (20 Cuentas de 500 gastos, unos 10.000 gastos y 30.000 partes) ocupa pocos MB
  y se arma en bastante menos de un segundo, así que no hace falta una cola ni un trabajo en segundo
  plano.
- **Alternatives considered**: generar en cada cliente a partir de los endpoints existentes (lógica
  duplicada en TypeScript, muchas llamadas paginadas, riesgo de diferencias); trabajo asíncrono con
  aviso cuando termina (infraestructura nueva sin necesidad, contra el Principio VIII).

## R2. Formato de los endpoints: `GET` con `format` en la query

- **Decision**:
  - `GET /api/v1/accounts/{account_id}/export?format=csv|json`
  - `GET /api/v1/users/me/export?format=csv|json`
  - Respuesta `200` con el archivo, `Content-Type` `application/zip` o
    `application/json; charset=utf-8`, `Content-Disposition: attachment` con `filename` ASCII y
    `filename*=UTF-8''...`, y `Cache-Control: no-store`.
- **Rationale**: es una lectura; el registro de auditoría no cambia datos del dominio. `GET` permite
  descargar con un único pedido y se prueba fácil. `no-store` evita que un proxy o el navegador
  guarden datos personales.
- **Alternatives considered**: `POST .../exports` que crea un recurso "exportación" (no hay nada que
  guardar); devolver una URL firmada para descargar después (agrega secretos y almacenamiento).

## R3. Foto consistente: sesión de MongoDB con `snapshot=True`

- **Decision**: todas las lecturas de una exportación (Cuentas, gastos y reembolsos) usan una misma
  sesión `client.start_session(snapshot=True)`, que lee todo en el mismo instante del replica set.
- **Rationale**: cumple el caso borde "cambios durante la exportación": un gasto cargado en el medio
  queda afuera o adentro completo, y los saldos coinciden con los gastos exportados. Solo lectura,
  sin bloquear escrituras. La verificación de membresía también se hace en esa lectura, así no se
  exporta una Cuenta que se dio de baja en el medio.
- **Alternatives considered**: una transacción de solo lectura (sirve igual, pero con el límite de
  60 s y más costo); sin sesión (los saldos podrían no coincidir con los gastos del mismo archivo).

## R4. Modelo intermedio puro y dos renderizadores

- **Decision**: tres capas.
  1. `export_builder.py` (puro): `build_account_export(account, expenses, settlements, labels)`
     devuelve un `AccountExport` con filas ya calculadas: partes con `split_equal`, saldos y
     sugerencias con `balance_math`, nombres resueltos, marcas de pendiente y de excluido.
  2. `export_render.py` (puro): `render_json(...)` y `render_csv_zip(...)` reciben esas filas.
  3. `export_service.py`: permisos, lecturas en la sesión snapshot, auditoría y nombre del archivo.
- **Rationale**: CSV y JSON salen de los mismos datos, así no pueden diferir. Las funciones puras
  se prueban sin base de datos (Principio VII): centavos, suma cero, moneda sin decimales,
  participante quitado, pendientes, caracteres especiales e inyección de fórmulas.
- **Alternatives considered**: renderizar directo desde los documentos de MongoDB (mezcla consulta,
  cálculo y formato; dos caminos que pueden diferir).

## R5. CSV y ZIP con la biblioteca estándar de Python

- **Decision**: `csv` y `zipfile` (con `ZIP_DEFLATED`) sobre `io.BytesIO`. Cada CSV:
  - UTF-8 con BOM, para que las planillas detecten los acentos al abrirlo con doble clic;
  - `,` como separador, `\r\n` entre filas (RFC 4180), `QUOTE_MINIMAL`;
  - primera fila con los encabezados en el idioma del usuario (FR-010, FR-011);
  - importes con punto decimal y exactamente los decimales de la moneda (`format_amount`), en una
    columna aparte de la moneda;
  - sí/no traducidos ("Sí"/"No", "Yes"/"No"); fechas `AAAA-MM-DD`.
- **Rationale**: sin dependencias nuevas (Principio VIII). El BOM es el modo más compatible de
  marcar UTF-8 en planillas comunes.
- **Alternatives considered**: `pandas` (dependencia pesada para escribir texto); un único CSV con
  todas las tablas (descartado en clarify).

## R6. Protección contra inyección de fórmulas

- **Decision**: en toda columna cuyo valor escribió un usuario (nombre y descripción de la Cuenta,
  concepto y descripción del gasto, nombre y apellido del perfil, y cualquier columna con el nombre
  de un participante en todas las tablas: participantes, Pagador, Participantes, partes, De y A de
  reembolsos, saldos y sugerencias) un valor que empieza con `=`, `+`, `-`, `@`,
  tab o retorno de carro se escribe con un apóstrofo adelante (`'=SUMA(...)`), como recomienda
  OWASP. Las columnas numéricas (importes negativos como `-30.00`) y las fechas no se tocan. El JSON
  no se modifica: guarda el texto original.
- **Rationale**: cumple FR-011 y SC-005 sin romper los importes negativos de los saldos. El
  apóstrofo es visible en el CSV pero la planilla lo muestra como texto.
- **Alternatives considered**: quitar el carácter inicial (pierde datos); comillas solas (no evita
  la fórmula).

## R7. Estructura del ZIP y nombres de archivo

- **Decision**:
  - Exportar una Cuenta: un ZIP con siete CSV en la raíz, con nombres en el idioma del usuario
    (`cuenta.csv`, `participantes.csv`, `gastos.csv`, `partes.csv`, `reembolsos.csv`, `saldos.csv`,
    `sugerencias.csv`; en inglés `account.csv`, `participants.csv`, `expenses.csv`, `shares.csv`,
    `settlements.csv`, `balances.csv`, `suggestions.csv`).
  - Exportar todo: `perfil.csv` (`profile.csv`) en la raíz y una carpeta por Cuenta con los siete
    CSV. La carpeta se llama con el nombre de la Cuenta pasado a slug ASCII más los últimos 6
    caracteres de su id, para que dos Cuentas con el mismo nombre no choquen.
  - Archivo descargado: `chepagame_<slug-de-la-cuenta>_<AAAA-MM-DD>.zip|json` y
    `chepagame_<AAAA-MM-DD>.zip|json` para todo (`chepagame_...` en inglés). La fecha es el día
    UTC de la exportación (FR-012).
- **Rationale**: identifica contenido y fecha; los slugs ASCII evitan problemas con nombres de
  archivo en Windows, Android e iOS. El nombre UTF-8 completo va en `filename*`.
- **Alternatives considered**: nombres de archivo fijos en inglés (contradice FR-010).

## R8. JSON: claves estables, importes como texto decimal

- **Decision**: un documento con `formatVersion: 1`, `exportedAt` (UTC con `Z`), `language`,
  `scope` (`account` o `all`), y `account` o `profile` + `accounts`. Las claves están en inglés y en
  `camelCase`, como la API. Los importes son texto decimal con punto (`"30.00"`) junto a
  `currency`, igual que en la API: un número JSON puede perder exactitud al leerse como punto
  flotante (Principio III). Las categorías van con su código estable (`"food"`) y su nombre en el
  idioma del usuario (`categoryLabel`); los booleanos son `true`/`false`.
- **Rationale**: FR-008 y FR-010. `formatVersion` permite cambiar el formato sin romper a quien lo
  lea, y prepara una futura importación.
- **Alternatives considered**: importes como número JSON (riesgo de redondeo); claves traducidas
  (rompe herramientas que lean el archivo).

## R9. Privacidad del contenido

- **Decision**: el modelo intermedio solo copia campos permitidos, nunca el documento completo:
  ids de Cuenta, gastos, reembolsos y participantes (que no son usuarios); nombres de
  participantes; datos de gastos y reembolsos. Nunca `userId`, `ownerId`, `createdBy`, `deletedBy`,
  `inviteCode`, `clientRequestId`, emails de otros ni hashes. El email del propio usuario solo
  aparece en el perfil de "Exportar mis datos". Un test recorre los archivos generados y falla si
  encuentra un email distinto del propio, un `ObjectId` de usuario o el código de invitación
  (SC-007).
- **Rationale**: FR-013 por construcción (lista de permitidos) y verificado por test.
- **Alternatives considered**: borrar campos sensibles de una copia del documento (si mañana se
  agrega un campo sensible, se filtraría).

## R10. Auditoría

- **Decision**: dos acciones nuevas.
  - `account.exported`: `entityType: "account"`, `entityId` y `accountId` de la Cuenta,
    `metadata: {format}`.
  - `user.data_exported`: `entityType: "user"`, `entityId` del usuario,
    `metadata: {format, accountCount}`.
  - Se registra después de generar el archivo y antes de responder. Si la auditoría falla, la
    respuesta es `500` y no se entrega el archivo (SC-008).
- **Rationale**: FR-015 sin copiar datos exportados. La fecha y hora la pone `createdAt` del
  registro.
- **Alternatives considered**: registrar antes de generar (quedaría registrada una exportación que
  falló).

## R11. Consultas para "Exportar mis datos"

- **Decision**: `accounts.list_for_member(user_id)` (ya excluye Cuentas abandonadas y dadas de baja,
  FR-007) y después una consulta de gastos y una de reembolsos con `accountId: {$in: ids}`,
  ordenadas como en la aplicación (`date` desc, `createdAt` desc, `_id` desc) y agrupadas en Python,
  como `my_balances` en la feature 004. Las Cuentas van ordenadas por nombre.
- **Rationale**: tres consultas en total, sin importar la cantidad de Cuentas; usa los índices
  `accountId` + orden que ya existen. Cumple SC-004 con margen.
- **Alternatives considered**: reutilizar la exportación de una Cuenta en un bucle (2 consultas por
  Cuenta, 41 en el peor caso).

## R12. Web: Route Handler en el BFF y descarga con `fetch`

- **Decision**: dos Route Handlers `POST` en Next.js:
  - `web/src/app/api/exports/accounts/[accountId]/route.ts`
  - `web/src/app/api/exports/me/route.ts`

  Leen el token de la sesión en el servidor (`getAccessToken`), llaman al backend con el idioma del
  usuario y devuelven el cuerpo, el `Content-Type` y el `Content-Disposition` sin tocarlos. Un
  componente cliente `ExportButton` hace `fetch` al handler, muestra el progreso, desactiva el
  botón mientras tanto (FR-018), arma un `Blob` y dispara la descarga con un enlace temporal.
  El matcher del proxy ya excluye solo `/api/auth`, así que estas rutas pasan por la verificación de
  sesión.

  El idioma se toma de `getLocale()` (el del Perfil del usuario), igual que el resto de las páginas
  de Web (`web/src/i18n/request.ts`), y se manda al backend como `Accept-Language`. Así el archivo
  sale en el idioma del usuario aunque el navegador esté en otro (FR-010).
- **Rationale**: los tokens no llegan al navegador. `POST` evita que un enlace de otro sitio
  dispare una exportación con las cookies del usuario (la cookie de sesión es `SameSite=Lax`).
  Con `fetch` se puede mostrar progreso y errores, cosa que un `<a download>` no permite.
- **Alternatives considered**: Server Action que devuelve base64 (infla el tamaño y queda en
  memoria del cliente como texto); enlace directo al backend (expondría el token).

## R13. Mobile: `expo/fetch`, `expo-file-system` y `expo-sharing`

- **Decision**:
  - El cliente HTTP suma `requestFile(path)`, con el mismo refresco de token ante `401`, que usa
    `fetch` de `expo/fetch` y devuelve `{bytes, fileName, mimeType}` con `arrayBuffer()`.
  - El archivo se escribe en la caché de la App con la API `File`/`Paths` de `expo-file-system`
    (ya instalado como dependencia de Expo; pasa a declararse en `package.json`).
  - Se abre la hoja de compartir con `Sharing.shareAsync(uri, {mimeType, UTI})` de `expo-sharing`
    (dependencia nueva). Si el usuario la cierra sin elegir, no pasa nada.
  - El archivo de la caché se borra en la siguiente exportación.
- **Rationale**: `expo-sharing` es el módulo oficial de Expo para la hoja de compartir del sistema
  (FR-017); `expo/fetch` lee binarios de forma confiable en React Native. Ambos módulos son nativos:
  hay que recompilar el development build, como en la feature 003.
- **Alternatives considered**: `Share` de React Native (solo comparte texto o URLs, no archivos en
  Android); `File.downloadFileAsync` (no permite leer el código de error del cuerpo ni reintentar
  con el token refrescado).

## R14. Dónde está el botón

- **Decision**:
  - En la Cuenta, un botón "Exportar" en el encabezado, junto a las pestañas Gastos y Saldos, que
    abre un menú con "CSV (planilla)" y "JSON". Dos toques o clics hasta la descarga (SC-002).
    También está en las Cuentas Cerradas (FR-001).
  - En el Perfil, una sección "Exportar mis datos" con los mismos dos botones.
  - El mismo componente sirve para los dos alcances.
- **Rationale**: mismo comportamiento en Web y Mobile; reutiliza el menú de Paper en Mobile.
- **Alternatives considered**: una pantalla aparte de exportación (más toques sin aportar nada).
