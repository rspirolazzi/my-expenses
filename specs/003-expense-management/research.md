# Research: Gestión de Gastos y Log de Auditoría

Decisiones técnicas de la Phase 0. No quedan puntos `NEEDS CLARIFICATION`: las cinco dudas de la
spec se resolvieron en las sesiones de clarificación:
- el comprobante queda fuera de esta feature;
- el historial se ve en el detalle del gasto;
- no hay actualización automática;
- el listado muestra solo el total de la Cuenta;
- el listado se carga por partes.

## R1. Importes exactos: unidades menores enteras y decimales por moneda

- **Decision**:
  - **Almacenamiento**: cada gasto guarda `amountMinor`, un entero en unidades menores. Por ejemplo, 100,50 ARS es `10050` y 1.500 JPY es `1500`.
  - **Contrato de la API**: el importe viaja como texto decimal (`"100.50"`), nunca como número JSON.
  - **Conversión en el backend**: el texto se parsea con `decimal.Decimal`. Se rechaza si tiene más decimales que la moneda, si es ≤ 0 o si supera 999.999.999 en la unidad principal (`422`).
  - **Decimales por moneda**: salen de una tabla fija en `app/core/money.py` con las excepciones ISO 4217 a 2 decimales:
    - 0 decimales: JPY, CLP, KRW, PYG, VND, ISK, UGX, XAF, XOF, entre otras;
    - 3 decimales: BHD, KWD, JOD, OMR, TND, entre otras;
    - el resto usa 2 decimales.
  - **Exposición a los clientes**: la Cuenta expone `currencyDecimals` para que Web y Mobile validen y formateen igual que el servidor.
- **Rationale**:
  - El Principio III prohíbe el punto flotante binario. Con enteros, las sumas y la división son exactas y baratas, y el total se calcula con un `$sum` directo en MongoDB.
  - El texto decimal evita que un `number` de JavaScript introduzca errores en el cliente.
  - Los datos de moneda del navegador (ICU) difieren entre entornos, como vimos con `CurrencySelect`. Por eso la fuente de verdad de los decimales es el backend.
- **Alternatives considered**:
  - `Decimal128` en MongoDB: es exacto, pero más incómodo de sumar y repartir.
  - Un número JSON: arriesga errores de redondeo en los clientes.
  - La dependencia `babel` para los decimales: suma un paquete por una tabla de unas 30 entradas.

## R2. División en partes iguales derivada, no guardada

- **Decision**:
  - Las partes no se guardan. Las calcula una función pura `split_equal(amount_minor, participant_ids, account_order)`.
  - El cálculo es `cociente = amount_minor // n` y `resto = amount_minor % n`.
  - Los `resto` centavos sobrantes van de a uno a los primeros participantes del gasto, según el orden en que figuran en el arreglo `participants` de la Cuenta (el orden en que se agregaron).
  - El detalle y la feature de Saldos usan la misma función.
- **Rationale**:
  - El resultado es determinístico y la suma de las partes siempre es igual al total (FR-008, SC-002).
  - Redistribuir al quitar un participante se reduce a sacarlo de `participantIds`: no hay partes guardadas que puedan quedar desincronizadas.
- **Alternatives considered**:
  - Guardar las partes en cada gasto: es redundante y obliga a recalcularlas en cada edición y remoción.
  - Asignar el sobrante al pagador: el pagador puede no participar.

## R3. Fecha del gasto como día calendario

- **Decision**:
  - `date` se guarda como texto ISO 8601 de fecha (`"2026-11-11"`), sin hora ni zona horaria.
  - El valor por defecto lo calcula el cliente con la zona horaria del dispositivo, porque el perfil no guarda una zona horaria.
  - El orden del listado es `date` descendente, luego `createdAt` descendente y luego `_id` descendente como desempate.
  - Al mostrarla, los clientes nunca la convierten a un instante: se formatea con `timeZone: "UTC"` (o a partir de año, mes y día). `new Date("2026-11-11")` es medianoche UTC y en Argentina (UTC−3) se vería como el 10.
  - En Web, la fecha por defecto del formulario se calcula en el cliente después de hidratar: en el servidor (contenedor en UTC) puede ser otro día y provocaría un error de hidratación.
- **Rationale**:
  - Un gasto ocurre "un día", no "un instante". Guardarlo como fecha UTC con hora haría que un gasto del 11 aparezca el 10 o el 12 según quién lo mire.
  - El texto ISO de fecha cumple "fechas en ISO 8601" (Principio III) y ordena bien de forma lexicográfica.
  - `createdAt`, en cambio, sí es un instante UTC.
- **Alternatives considered**: un `datetime` UTC a medianoche, que se corre de día al mostrarlo en otra zona horaria.

## R4. Colección `expenses` y consultas

- **Decision**:
  - Colección nueva `expenses` con referencia `accountId`.
  - **Índice del listado**: `{ accountId, isDeleted, date: -1, createdAt: -1, _id: -1 }`. Cubre tanto el listado como el total.
  - **Índice de la remoción**: `{ accountId, paidById }` y `{ accountId, participantIds }` (multikey), para encontrar los gastos afectados al quitar un participante.
  - **Lecturas**: siempre exigen ser miembro de una Cuenta no dada de baja, con la dependencia de la feature 002. Así, los gastos de una Cuenta dada de baja dejan de verse sin modificarlos (R9 de la 002).
- **Rationale**: los gastos crecen sin límite y se paginan, así que no conviene embeberlos en la Cuenta. Con estos índices, los 500 gastos de SC-006 se leen de a 50 sin recorrer la colección.
- **Alternatives considered**: gastos embebidos en `accounts`, que tiene un límite de 16 MB y obliga a reescribir el documento en cada alta.

## R5. Paginación por cursor y total separado

- **Decision**:
  - `GET .../expenses?limit=50&cursor=<opaco>` usa paginación por clave (keyset). El cursor codifica `(date, createdAt, _id)` del último gasto devuelto, en base64url.
  - La primera página (sin cursor) incluye también `total` (un `$sum` de `amountMinor` sobre los gastos activos, incluidos los pendientes) y `count`.
  - Las páginas siguientes no recalculan el total.
  - El cliente agrupa por día lo que ya tiene cargado, de modo que un día repartido entre dos páginas se ve como un único grupo (FR-035).
- **Rationale**:
  - Un gasto cargado mientras el usuario baja por el listado queda arriba (fecha de hoy) y no desplaza ni duplica las páginas siguientes, a diferencia de `skip/limit`.
  - Aun así, los clientes descartan ids repetidos por si alguien edita la fecha de un gasto mientras otro miembro pagina.
- **Alternatives considered**:
  - `skip/limit`: duplica o saltea gastos cuando hay altas.
  - Traer todo de una vez: descartado en la clarificación.

## R6. Ediciones simultáneas con versión optimista

- **Decision**:
  - Cada gasto tiene `version` (entero, empieza en 1). `PUT` y `DELETE` exigen la `version` que el cliente leyó.
  - La escritura es un `find_one_and_update` condicionado a `version` e `isDeleted: false` que incrementa `version`.
  - Si no coincide:
    - `409 expense_conflict` con el gasto actual en el cuerpo, si todavía existe;
    - `404 not_found`, si fue eliminado.
  - Los ajustes por remoción de un participante también incrementan `version`, así que una edición abierta antes de la remoción recibe el aviso.
- **Rationale**: cumple FR-017 y SC-005 sin locks. Es el mismo patrón de update condicional de la feature 002 (R5).
- **Alternatives considered**:
  - "El último que guarda gana": pierde cambios.
  - Comparar `updatedAt`: la resolución de milisegundos es frágil.
  - El header `If-Match` con ETag: es equivalente, pero más incómodo desde los Server Actions.

## R7. Reintento sin duplicar el alta

- **Decision**:
  - El cliente genera un `clientRequestId` (UUID) al abrir el formulario de alta y lo reenvía en cada reintento.
  - Un índice único parcial `{ accountId, clientRequestId }` impide un segundo gasto.
  - Si el alta ya existe, la API responde `201` con el gasto ya creado, sin una segunda auditoría.
- **Rationale**: cubre el edge case "pérdida de conexión al guardar" sin una colección de idempotencia aparte.
- **Alternatives considered**: el header `Idempotency-Key` con una colección TTL, que suma otra colección para un solo endpoint.

## R8. Auditoría: `accountId`, acciones y lectura del historial

- **Decision**:
  - **Acciones**: `audit_service.record` recibe un `account_id` opcional que se guarda como `accountId`. Se agregan las acciones `expense.created`, `expense.updated` y `expense.deleted`, con el mismo estilo de nombres que `account.*`, en lugar de `CREATE`, `UPDATE` y `DELETE`.
  - **Contenido de cada entrada**:
    - `entityType: "expense"` y `entityId` = id del gasto;
    - `changes` con `{ campo: { before, after } }`, usando los valores guardados (`amountMinor`, `paidById`, `participantIds`, `date`, `title`, `description`, `categoryIcon`);
    - `metadata.actorParticipantId`, con el participante del usuario en esa Cuenta al momento del cambio;
    - `metadata.reason: "participant_removed"` en los ajustes automáticos (FR-027, FR-032).
  - **Entradas existentes (`account.*`)**: no se reescriben.
    - Desde esta feature, toda entrada `account.*` nueva también lleva `accountId`.
    - Las anteriores tienen `entityType: "account"` y `entityId` igual a la Cuenta, que es la misma referencia. Las lecturas por Cuenta usan `accountId ?? entityId`.
  - **Índice nuevo**: `{ entityType, entityId, createdAt: -1 }` ya existe y sirve para el historial de un gasto. Para consultas por Cuenta se agrega `{ accountId, createdAt: -1 }`.
  - **Lectura del historial**: `GET .../expenses/{expense_id}/history` traduce para mostrar:
    - ids de participantes a nombres, tomados del arreglo completo de la Cuenta, incluidos los quitados (FR-031);
    - `amountMinor` a texto decimal con los decimales de la moneda;
    - el actor a su nombre de participante.
  - **Sin datos internos**: nunca se devuelven ids de usuario ni emails.
- **Rationale**:
  - El Principio IV prohíbe editar registros de auditoría, así que agregar `accountId` a los viejos sería reescribirlos. Como la referencia ya existe en `entityId`, no hay dato que migrar.
  - Mostrar el nombre de participante, y no el email ni el nombre del usuario, mantiene la privacidad (Principio VI) y coincide con lo que el grupo ve en los gastos.
- **Alternatives considered**:
  - Migrar los registros viejos con `update_many`: contradice la inmutabilidad.
  - Las acciones `CREATE`, `UPDATE` y `DELETE` del input: rompen la convención existente, sin beneficio.
  - Guardar los nombres ya resueltos en la auditoría: quedan desactualizados si el participante se renombra, y el edge case pide el nombre nuevo.

## R9. Efectos de quitar un participante

- **Decision**:
  - `account_service.remove_participant` hace, en la misma transacción que la baja lógica del participante y su auditoría:
    1. busca los gastos activos de la Cuenta donde `paidById` es el participante o donde figura en `participantIds`;
    2. en cada uno, pone `paidById: null` si correspondía, quita al participante de `participantIds` (`$pull`), incrementa `version` y actualiza `updatedAt`;
    3. inserta un `expense.updated` por gasto, con `before`/`after` de los campos que cambiaron y `reason: "participant_removed"`.
  - Un gasto queda "pendiente de asignación" cuando `paidById` es `null` o `participantIds` queda vacío. `isPending` se deriva en la respuesta y no se guarda.
  - El diálogo pide antes `GET .../participants/{participant_id}/impact`, que devuelve `affectedExpenses` (FR-022).
  - Los gastos eliminados no se tocan.
- **Rationale**:
  - FR-023 exige todo o nada, y MongoDB ya corre como replica set con transacciones.
  - El volumen esperado (cientos de gastos) cabe holgado en una transacción.
  - El conteo previo es solo informativo: si cambia entre el diálogo y la confirmación, la remoción igual aplica las reglas a todos los gastos afectados en ese momento.
- **Alternatives considered**:
  - Un proceso diferido que ajusta los gastos después: deja estados intermedios visibles.
  - No tocar los gastos y resolver al leer: complica cada lectura y la feature de Saldos.

## R10. Validación de pagador y participantes

- **Decision**:
  - En el alta y la edición, `paidById` es requerido y `participantIds` debe tener al menos uno.
  - Todos tienen que ser participantes activos de la Cuenta (`removedAt = null`); si no, `422 invalid_participant`.
  - Los ids repetidos se descartan.
  - Un participante desvinculado (sin usuario) sigue siendo válido.
  - La constitución permite `paidBy: null` solo como resultado de una remoción; por eso la API nunca acepta `null` en un alta o edición.
  - El orden de `participantIds` guardado sigue el orden de la Cuenta, así el reparto no depende del orden en que el cliente los envió.
  - **Guarda contra carreras**: validar leyendo la Cuenta antes de la transacción no alcanza, porque una remoción o un cierre simultáneos escriben otro documento y MongoDB no detecta el conflicto. Por eso el alta y la edición hacen, dentro de su transacción, un update condicional sobre la Cuenta (`$inc: { expenseWriteSeq: 1 }`) con filtro `isClosed: false`, `isDeleted: false` y un `$elemMatch` con `removedAt: null` por el pagador y por cada participante. Como la remoción y el cierre también escriben la Cuenta, las dos transacciones chocan y `run_in_transaction` reintenta una. En el reintento el filtro ya no se cumple y el alta responde `422 invalid_participant` o `409 account_closed` (se relee para distinguir el motivo). No se toca `updatedAt`, para no alterar el orden de "Mis Cuentas".
- **Rationale**: es la regla de negocio 2 del input y FR-005, aplicada en el servidor (FR-019).
- **Alternatives considered**: validar solo en el cliente, que el Principio I y FR-019 prohíben; leer la Cuenta dentro de la transacción sin escribirla (las lecturas no generan conflicto de escritura en MongoDB).

## R11. Categorías

- **Decision**: `categoryIcon` es un valor de un conjunto fijo validado con `Literal`, alineado con los íconos de Cuenta para reutilizar los mismos componentes de dibujo. Los valores son:
  - `other` (por defecto, "Otros");
  - `home` (Casa), `car` (Auto), `hotel`, `beach` (Playa), `food` (Comida), `money` (Dinero);
  - `travel`, `party`, `shopping`, `sports`.
- **Rationale**: cubre las categorías de la constitución sin almacenamiento de archivos.
- **Alternatives considered**: categorías creadas por el usuario, que no las pide la spec.

## R12. Clientes

- **Decision**:
  - **Web**:
    - `/accounts/[accountId]` pasa a ser la vista de gastos: total arriba, listado agrupado por día y botón "Nuevo gasto". La pantalla actual de datos, participantes, invitación y acciones se mueve a `/accounts/[accountId]/settings`, enlazada desde el encabezado.
    - Rutas nuevas: `/accounts/[accountId]/expenses/new`, `/accounts/[accountId]/expenses/[expenseId]` (detalle con partes e historial) y `/accounts/[accountId]/expenses/[expenseId]/edit`.
    - La primera página la arma el Server Component, y las siguientes un Server Action `loadMoreExpenses`.
    - Un botón "Actualizar" llama a `router.refresh()` (FR-033). La fecha se elige con `<input type="date">`.
  - **Mobile**:
    - `app/(app)/accounts/[accountId].tsx` pasa a ser una carpeta `[accountId]/` con:
      - `index.tsx`, la vista de gastos con `SectionList`, `RefreshControl` y `onEndReached`;
      - `settings.tsx`, la pantalla actual de detalle;
      - `expenses/new.tsx`, `expenses/[expenseId]/index.tsx` y `expenses/[expenseId]/edit.tsx`.
    - `useFocusEffect` recarga al volver a la pantalla.
    - La fecha se elige con `@react-native-community/datetimepicker` (dependencia nueva).
  - **Ambos**:
    - Un helper `parseAmountInput(text, locale, decimals)` acepta coma o punto decimal según el idioma y produce el texto decimal de la API.
    - El importe se formatea con `Intl.NumberFormat` usando `currencyDecimals`.
    - Los diálogos de eliminar gasto y de quitar participante (con la cantidad de gastos afectados) usan "Continuar" y "Cancelar".
    - Ante `409 expense_conflict`, el formulario muestra un aviso y recarga la versión actual.
- **Rationale**:
  - La spec pide que la vista principal de la Cuenta sea la de gastos; mover la configuración a una subruta mantiene las pantallas de la 002 casi sin cambios.
  - React Native Paper no trae un selector de fecha, y el de la comunidad es el que Expo documenta para SDK 56 (`npx expo install`).
- **Alternatives considered**:
  - Pestañas dentro de la misma página: más estado y la URL no distingue la sección.
  - `react-native-paper-dates`: una librería de terceros menos mantenida.
  - Un selector de fecha propio: mucho trabajo de accesibilidad.
