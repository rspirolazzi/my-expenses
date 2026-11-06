# Research: Cuentas, Participantes de Texto Libre e Invitaciones

Decisiones técnicas de la Phase 0. No quedan puntos `NEEDS CLARIFICATION`: las tres dudas de la spec
se resolvieron en la sesión de clarificación (ícono, cierre definitivo, regeneración por el Owner).

## R1. Participantes embebidos en la Cuenta

- **Decision**: los participantes viven como arreglo dentro del documento de `accounts`, cada uno con
  un `id` propio (UUID), su nombre, una clave normalizada para la unicidad y el `userId` vinculado.
- **Rationale**: una Cuenta tiene pocos participantes (hasta 50) y siempre se leen junto con ella.
  Un solo documento permite validar la unicidad y vincular atómicamente con un update condicional,
  sin transacciones entre colecciones. Los gastos de la feature siguiente referenciarán el `id` del
  participante, que es estable aunque cambie el nombre.
- **Alternatives considered**: una colección `participants` aparte (más consultas y transacciones
  para algo que siempre se lee junto); identificar al participante por su nombre (se rompe al
  renombrar).

## R2. Membresía derivada de los participantes

- **Decision**: un usuario es miembro de una Cuenta si existe un participante activo con su `userId`.
  "Mis Cuentas" es una consulta por `participants.userId` (índice multikey). El Owner es el usuario
  de `ownerId`, y su participante no se puede quitar ni desvincular.
- **Rationale**: no hay una lista de miembros que pueda quedar desincronizada con la de
  participantes: vincularse, salir o ser quitado cambian un solo campo.
- **Alternatives considered**: un arreglo `memberIds` paralelo (dos fuentes de verdad); una colección
  `memberships` (otra colección y transacciones).

## R3. Baja lógica de participantes

- **Decision**: quitar un participante marca `removedAt` (y desvincula su `userId`); no se borra del
  arreglo. Los participantes quitados no cuentan para la unicidad de nombres, no aparecen en la lista
  ni en la invitación, y no pueden volver a activarse (si hace falta, se agrega uno nuevo).
- **Rationale**: la constitución pide que los gastos y reembolsos del participante removido se
  conserven como historial auditado; las features de Gastos y Saldos necesitan su nombre para
  mostrarlo. Además, el Principio IV pide bajas lógicas.
- **Alternatives considered**: borrarlo del arreglo (el historial quedaría con referencias a un
  participante inexistente).

## R4. Código de invitación

- **Decision**: `inviteCode` de 128 bits con `secrets.token_urlsafe(16)` (22 caracteres), con índice
  único. El enlace es `<AUTH_URL>/invite/<code>`. Solo el Owner puede regenerarlo; el anterior deja
  de servir al instante porque se reemplaza. Las invitaciones de Cuentas Cerradas o dadas de baja
  responden igual que un código inexistente.
- **Rationale**: 128 bits no se pueden adivinar ni enumerar; el código no contiene datos personales,
  así que puede viajar en la URL. La vista previa de la invitación exige sesión, por lo que alguien
  sin cuenta no ve datos de la Cuenta (Principio VI).
- **Alternatives considered**: códigos cortos de 6 a 8 caracteres (fáciles de dictar, pero
  enumerables sin límites de intentos); invitaciones por email (fuera de alcance).

## R5. Vinculación concurrente

- **Decision**: aceptar una invitación es un único `find_one_and_update` condicional sobre la Cuenta:
  exige que la Cuenta esté abierta y no dada de baja, que el participante elegido siga sin
  vincular y activo, y que ningún participante tenga ya ese `userId`. Si la condición no se cumple,
  se distingue el motivo con una relectura (`participant_taken`, `already_member`). Agregarse como
  participante nuevo usa la misma condición más la unicidad del nombre normalizado.
- **Rationale**: cubre los edge cases de "otro tomó el participante un instante antes" y "un usuario
  ya vinculado" sin locks. La auditoría se inserta en la misma transacción.
- **Alternatives considered**: leer, validar y escribir en pasos separados (condición de carrera).

## R6. Permisos y respuestas

- **Decision**: una dependencia `get_account_for_member` carga la Cuenta solo si el usuario es
  miembro y no está dada de baja; si no, `404 not_found`. Las acciones de Owner devuelven
  `403 owner_only` a un miembro. Cualquier escritura sobre una Cuenta Cerrada devuelve
  `409 account_closed`.
- **Rationale**: FR-007 y SC-004 piden que quien no es miembro no pueda distinguir una Cuenta ajena
  de una inexistente. El `403` solo se le da a quien ya es miembro, que conoce la Cuenta.
- **Alternatives considered**: `403` para no miembros (revela que la Cuenta existe).

## R7. Ícono de la Cuenta

- **Decision**: `icon` es un valor de un conjunto fijo definido en el backend (validado con un
  `Literal`) y espejado en los clientes: `group` (por defecto), `home`, `car`, `hotel`, `beach`,
  `food`, `money`, `travel`, `party`, `shopping`, `work`, `sports`. Web lo dibuja con emojis o SVG
  propios; Mobile con los íconos de Material Community de `@expo/vector-icons` (dependencia nueva,
paquete oficial de Expo).
- **Rationale**: sin almacenamiento de archivos (Principio VIII, enmienda v4.4.0). Incluye las
  categorías que la constitución usa para gastos.
- **Alternatives considered**: subir imágenes (descartado en la clarificación).

## R8. Clientes

- **Decision**:
  - **Web**: rutas privadas `/accounts`, `/accounts/new`, `/accounts/[accountId]` e
    `/invite/[code]`. `/invite` es privada en `proxy.ts`, así que sin sesión se va a
    `/login?callbackUrl=/invite/<code>` y se vuelve sola (FR-009). Las escrituras son Server Actions
    que llaman al backend con el token de la sesión. "Accounts" del menú de usuario se habilita.
  - **Mobile**: pantallas en `(app)/accounts`. La invitación llega por deep link
    `myexpenses://invite/<code>` o pegando el código en "Unirme a una Cuenta". Si el usuario no tiene
    sesión, `usePendingInvite` guarda el código en memoria y lo abre al terminar de loguearse.
    Compartir usa `Share` de React Native con el enlace web.
  - **Ambos**: diálogos de confirmación para quitar, salir, cerrar, regenerar y dar de baja; el de
    baja tiene "Continuar" y "Cancelar" (clarificación). La moneda del alta se precarga con
    `preferences.defaultCurrency` (FR-003).
- **Rationale**: reutiliza los patrones de la feature 001 (BFF en Web, cliente con refresh en Mobile).
  Los universal links / app links requieren un dominio verificado, que todavía no existe; el deep link
  propio y el código pegado cubren Mobile hasta entonces.
- **Alternatives considered**: universal links (sin dominio aún); una pantalla de invitación pública
  sin sesión (expone datos de la Cuenta).

## R9. Efectos de la baja de la Cuenta sobre los gastos

- **Decision**: la baja marca `isDeleted` y `deletedAt` en la Cuenta. Las features de Gastos y Saldos
  filtran siempre por Cuentas no dadas de baja, de modo que sus gastos dejan de figurar sin
  modificarlos (clarificación: "la Cuenta y todos sus gastos dejan de estar disponibles").
- **Rationale**: un solo cambio atómico y auditado; los datos se conservan (Principio IV).
- **Alternatives considered**: marcar cada gasto como dado de baja (muchas escrituras y más difícil
  de auditar como una sola acción).
