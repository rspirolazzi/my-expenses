# Feature Specification: Gestión de Gastos y Log de Auditoría

**Feature Branch**: `003-expense-management`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Feature 03: Expense Management and Audit Log": crear, modificar,
eliminar y listar gastos dentro de una Cuenta abierta, con división en partes iguales entre los
participantes elegidos, edición colaborativa por cualquier miembro y un registro de auditoría
inmutable de cada cambio sobre gastos y sobre la Cuenta.

**Ajustes respecto del input** (para cumplir la constitución v4.4.0 y las features 001 y 002):

- El stack técnico y los esquemas de base de datos se quitaron de la spec; se definen en el plan.
- Los importes se manejan con valores exactos y respetan los decimales de la moneda de la Cuenta
  (Principio III). Al dividir, los centavos que sobran se asignan con una regla fija y la suma de
  las partes es siempre igual al total.
- La fecha del gasto es un día (por defecto, hoy en la zona horaria del usuario), como fija la
  constitución. Dentro del mismo día, los gastos se ordenan por el momento en que se cargaron.
- La categoría se elige de un conjunto fijo de íconos, igual que el ícono de la Cuenta.
- El log de auditoría ya existe desde la feature 001 y ya registra los cambios sobre la Cuenta
  (feature 002). Esta feature lo extiende a los gastos y agrega a cada registro la Cuenta a la que
  pertenece.
- La feature 002 dejó pendientes los efectos de quitar un participante sobre los gastos. Esta
  feature los implementa como fija la constitución: pagador vacío, redistribución de su parte y
  gastos pendientes de asignación.
- Los saldos, los reembolsos sugeridos y "marcar como pagado" quedan para la feature siguiente.

## Clarifications

### Session 2026-11-07

- Q: ¿Cómo se adjunta el comprobante de un gasto? → A: En esta etapa el gasto no lleva
  comprobante; se implementará en una feature futura.
- Q: ¿Los miembros ven el historial de cambios? → A: Sí, en el detalle de cada gasto: quién lo
  cargó y cada cambio, con el valor anterior y el nuevo.

### Session 2026-11-11

- Q: ¿Cómo ven los demás miembros un gasto nuevo o cambiado? → A: Al abrir la Cuenta, al volver a
  la pantalla o al deslizar para actualizar; no hay actualización automática.
- Q: ¿Qué totales muestra el listado de gastos? → A: Solo el total gastado en la Cuenta, arriba del
  listado; sin subtotales por día.
- Q: ¿El listado trae todos los gastos de una vez o por partes? → A: Por partes (por ejemplo, de a
  50) a medida que el usuario baja; el total se calcula aparte, sobre todos los gastos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar un gasto (Priority: P1)

Un miembro de una Cuenta abierta carga un gasto: concepto, importe, quién pagó y entre quiénes se
divide. El gasto aparece en la Cuenta para todos los miembros.

**Why this priority**: cargar gastos es el flujo central del producto; sin esto las Cuentas no
sirven para nada.

**Independent Test**: en una Cuenta con tres participantes, cargar "Cena" por 90,00, pagada por
"Ana" y dividida entre los tres, y verla en el listado con el ícono, el pagador y el importe.

**Acceptance Scenarios**:

1. **Given** un miembro en una Cuenta abierta, **When** abre "Nuevo gasto", **Then** la fecha es
   hoy, el pagador es su propio participante, están seleccionados todos los participantes activos y
   la moneda es la de la Cuenta (no editable).
2. **Given** el formulario con concepto "Cena", importe 90,00, pagador "Ana" y tres participantes,
   **When** lo guarda, **Then** el gasto queda registrado y cada participante debe 30,00.
3. **Given** un importe de 100,00 dividido entre tres, **When** se guarda, **Then** las partes son
   33,34, 33,33 y 33,33, y suman exactamente 100,00.
4. **Given** el formulario, **When** el importe está vacío, es cero o negativo, o tiene más
   decimales de los que admite la moneda, **Then** no se guarda y se indica el error.
5. **Given** el formulario, **When** no hay concepto o no hay ningún participante seleccionado,
   **Then** no se guarda y se indica qué falta.
6. **Given** un pagador que no está entre los participantes del gasto, **When** se guarda,
   **Then** se acepta: pagó, pero no comparte el gasto.
7. **Given** una Cuenta Cerrada o un usuario que no es miembro, **When** intenta cargar un gasto
   (también por fuera de la interfaz), **Then** se rechaza.

---

### User Story 2 - Ver los gastos de la Cuenta (Priority: P1)

Un miembro abre la Cuenta y ve sus gastos agrupados por día, del más reciente al más antiguo.

**Why this priority**: sin el listado nadie puede comprobar qué se cargó; es lo que da
transparencia al grupo.

**Independent Test**: con gastos en tres días distintos, abrir la Cuenta y ver tres grupos por
fecha, cada gasto con su ícono, concepto, pagador e importe en la moneda de la Cuenta.

**Acceptance Scenarios**:

1. **Given** una Cuenta con gastos, **When** un miembro la abre, **Then** ve los gastos agrupados
   por día (más reciente primero), con la fecha en su idioma y zona horaria.
2. **Given** un gasto, **When** se muestra en el listado, **Then** se ve su ícono de categoría,
   concepto, nombre del pagador e importe total formateado en la moneda de la Cuenta.
3. **Given** un gasto sin pagador o sin participantes (por la remoción de un participante),
   **When** se muestra, **Then** aparece marcado como "pendiente de asignación".
4. **Given** una Cuenta sin gastos, **When** se abre, **Then** se ve un mensaje que invita a cargar
   el primero (si la Cuenta está abierta).
5. **Given** un gasto del listado, **When** el miembro lo abre, **Then** ve todos sus datos:
   fecha, concepto, descripción, importe, pagador, participantes y la parte de cada uno.
6. **Given** un gasto eliminado, **When** se abre la Cuenta, **Then** no figura en el listado.

---

### User Story 3 - Editar o eliminar un gasto (Priority: P2)

Cualquier miembro corrige o elimina cualquier gasto de la Cuenta, aunque lo haya cargado otro.

**Why this priority**: los errores de carga son frecuentes y cualquiera del grupo debe poder
corregirlos, pero la Cuenta ya es útil solo con altas.

**Independent Test**: un miembro que no cargó el gasto cambia su importe y su pagador; los demás
ven el cambio. Luego lo elimina tras confirmar y deja de figurar.

**Acceptance Scenarios**:

1. **Given** un gasto cargado por otro miembro, **When** un miembro cambia su importe, pagador,
   participantes, fecha, concepto, categoría o descripción, **Then** se guarda con
   las mismas validaciones que el alta.
2. **Given** un gasto, **When** un miembro elige eliminarlo, **Then** se pide confirmación con
   "Continuar" y "Cancelar"; con "Continuar" el gasto deja de figurar para todos, sin borrar sus
   datos.
3. **Given** un gasto pendiente de asignación, **When** un miembro le asigna pagador y
   participantes, **Then** deja de estar pendiente.
4. **Given** dos miembros editando el mismo gasto, **When** el segundo guarda después de que el
   primero ya guardó, **Then** el segundo recibe un aviso de que el gasto cambió y ve la versión
   actual antes de volver a guardar; ningún cambio se pierde sin aviso.
5. **Given** una Cuenta Cerrada, **When** un miembro intenta editar o eliminar un gasto (también
   por fuera de la interfaz), **Then** se rechaza y la interfaz no ofrece esas acciones.

---

### User Story 4 - Efectos de quitar un participante (Priority: P2)

Cuando un miembro quita a un participante de la Cuenta, sus gastos se conservan y se ajustan según
las reglas de la constitución.

**Why this priority**: sin esto, quitar un participante dejaría gastos con personas que ya no
están en la Cuenta y repartos que no suman bien.

**Independent Test**: quitar a "Beto", que pagó un gasto y comparte otro con "Ana" y "Caro";
el primero queda sin pagador y marcado como pendiente, y en el segundo la parte de Beto se
reparte entre Ana y Caro.

**Acceptance Scenarios**:

1. **Given** un gasto pagado por el participante quitado, **When** se lo quita, **Then** el gasto
   queda sin pagador y marcado como pendiente de asignación.
2. **Given** un gasto compartido por el participante quitado y otros, **When** se lo quita,
   **Then** deja de figurar entre los participantes y el importe se divide en partes iguales entre
   los restantes.
3. **Given** un gasto cuyo único participante era el quitado, **When** se lo quita, **Then** el
   gasto queda sin participantes y marcado como pendiente de asignación.
4. **Given** el diálogo de confirmación para quitar un participante, **When** ese participante
   tiene gastos, **Then** el diálogo avisa cuántos gastos se van a ver afectados.
5. **Given** cualquiera de estos ajustes, **When** ocurre, **Then** cada gasto modificado queda en
   la auditoría con el valor anterior y el nuevo.

---

### User Story 5 - Trazabilidad de los cambios (Priority: P3)

Cada alta, modificación y baja de un gasto o de la Cuenta queda registrada de forma inmutable: quién
lo hizo, qué cambió y cuándo.

**Why this priority**: la auditoría da confianza al grupo y es obligatoria por la constitución, pero
el registro en sí no cambia lo que el usuario hace día a día.

**Independent Test**: crear un gasto, cambiar su importe de 90,00 a 120,00 y eliminarlo; quedan
tres registros con el usuario, la fecha y hora, y el importe anterior y nuevo en la modificación.
Antes de eliminarlo, el detalle del gasto muestra el alta y la modificación.

**Acceptance Scenarios**:

1. **Given** un gasto nuevo, **When** se guarda, **Then** queda un registro de alta con quién lo
   cargó, cuándo y sus datos.
2. **Given** una modificación, **When** se guarda, **Then** queda un registro con los campos que
   cambiaron, con su valor anterior y nuevo.
3. **Given** una eliminación, **When** se confirma, **Then** queda un registro de baja.
4. **Given** un registro de auditoría, **When** alguien intenta editarlo o borrarlo por cualquier
   medio que ofrezca la plataforma, **Then** no es posible.
5. **Given** un gasto con cambios, **When** un miembro abre su detalle, **Then** ve su historial,
   del más reciente al más antiguo: quién hizo cada acción, cuándo y, en las modificaciones, el
   valor anterior y el nuevo de cada campo que cambió.
6. **Given** el historial de un gasto, **When** muestra pagador, participantes o importes, **Then**
   se ven nombres de participantes (también de los ya quitados) e importes formateados, nunca
   identificadores internos.
7. **Given** un ajuste automático por la remoción de un participante, **When** se ve el historial,
   **Then** figura como modificación hecha por quien quitó al participante e indica el motivo.

---

### Edge Cases

- **Importe que no se divide exacto**: los centavos sobrantes se asignan, de a uno, a los
  participantes del gasto en el orden en que figuran en la Cuenta; siempre el mismo resultado.
- **Moneda sin decimales** (por ejemplo, JPY o CLP): el importe se carga sin decimales y la
  división reparte unidades enteras.
- **Un único participante**: asume el importe completo.
- **Pagador que no participa**: válido; pagó todo y no tiene parte en el gasto.
- **Participante quitado o no activo**: no puede elegirse como pagador ni como participante en un
  alta o edición.
- **Participante desvinculado** (su usuario salió de la Cuenta): sigue figurando con su nombre en
  sus gastos y puede seguir eligiéndose, porque sigue siendo un participante activo.
- **Participante renombrado**: sus gastos muestran el nombre nuevo.
- **Cuenta cerrada después de abrir el formulario**: al guardar, se rechaza con un mensaje claro,
  aunque el cierre ocurra en el mismo instante que el guardado.
- **Participante quitado mientras se carga un gasto que lo incluye**: al guardar, se rechaza como
  participante inválido; nunca queda un gasto con un participante ya quitado.
- **Cuenta dada de baja**: sus gastos dejan de figurar para todos, junto con la Cuenta.
- **Gasto eliminado mientras otro lo edita**: al guardar, se avisa que el gasto ya no existe.
- **Importe muy grande**: se rechaza por encima de un máximo razonable (ver Assumptions).
- **Fecha futura**: se permite (por ejemplo, una reserva ya pagada para un día que todavía no llegó).
- **Concepto con espacios de más**: se recortan; un concepto solo con espacios es inválido.
- **Otro miembro cambió gastos mientras la Cuenta está abierta**: no se ven hasta volver a la
  pantalla o actualizar; si el miembro edita un gasto que cambió, aplica el aviso de FR-017.
- **Gasto cargado mientras el usuario baja por el listado**: no se intercala en las partes que
  siguen ni duplica gastos ya mostrados; aparece al actualizar (FR-033).
- **Pérdida de conexión al guardar**: el usuario ve el error y puede reintentar sin crear el gasto
  dos veces.

## Requirements *(mandatory)*

### Functional Requirements

**Alta**

- **FR-001**: Cualquier miembro MUST poder cargar un gasto en una Cuenta abierta, en Web y en
  Mobile.
- **FR-002**: Un gasto MUST tener fecha (un día; por defecto, hoy en la zona horaria del usuario),
  concepto (obligatorio, 1 a 80 caracteres sin contar espacios al inicio y al final), importe
  (obligatorio, mayor a cero, con como máximo los decimales de la moneda), pagador (un
  participante), participantes (uno o más) y categoría (de un conjunto fijo, con una por defecto).
  Opcional: descripción (hasta 500 caracteres).
- **FR-003**: La moneda del gasto MUST ser siempre la de la Cuenta, y MUST NOT poder elegirse ni
  cambiarse.
- **FR-004**: Al abrir el formulario, el pagador MUST venir precargado con el participante del
  usuario y los participantes con todos los participantes activos de la Cuenta.
- **FR-005**: El pagador y los participantes MUST ser participantes activos de la Cuenta; el
  pagador PUEDE no estar entre los participantes.
- **FR-006**: El gasto MUST NOT incluir comprobante en esta feature; queda para una feature futura
  (ver Fuera de alcance).

**División**

- **FR-007**: El importe MUST dividirse en partes iguales solo entre los participantes del gasto.
- **FR-008**: Si el importe no se divide exacto, los centavos sobrantes MUST asignarse de a uno a
  los participantes del gasto en el orden en que figuran en la Cuenta, y la suma de las partes
  MUST ser igual al total.
- **FR-009**: Los importes MUST calcularse y guardarse con valores exactos, nunca con aproximaciones.

**Listado y detalle**

- **FR-010**: La Cuenta MUST mostrar sus gastos activos agrupados por día, del más reciente al más
  antiguo; dentro de un día, el último cargado primero.
- **FR-011**: Cada gasto del listado MUST mostrar ícono de categoría, concepto, nombre del pagador e
  importe total formateado según la moneda de la Cuenta y el idioma del usuario.
- **FR-012**: El detalle de un gasto MUST mostrar todos sus datos y la parte de cada participante.
- **FR-013**: Los gastos sin pagador o sin participantes MUST mostrarse marcados como "pendiente de
  asignación".
- **FR-014**: Los gastos eliminados MUST NOT figurar en el listado ni en el detalle.
- **FR-033**: El listado y el detalle MUST mostrar los datos vigentes al abrir la Cuenta, al volver a
  la pantalla y cuando el miembro pide actualizar (deslizar hacia abajo en Mobile, acción de
  actualizar en Web). MUST NOT actualizarse solos mientras están abiertos.
- **FR-034**: Arriba del listado, la Cuenta MUST mostrar el total gastado: la suma de los importes
  de sus gastos activos (incluidos los pendientes de asignación), formateada según la moneda de la
  Cuenta y el idioma del usuario. El listado MUST NOT mostrar subtotales por día.
- **FR-035**: El listado MUST cargar los gastos por partes, de a 50, en el orden de FR-010, y traer
  la parte siguiente cuando el usuario llega al final de lo cargado. Un día que queda repartido
  entre dos partes MUST verse como un único grupo. El total de FR-034 MUST calcularse sobre todos
  los gastos activos, no solo sobre los cargados.

**Edición y baja**

- **FR-015**: Cualquier miembro MUST poder editar cualquier gasto de una Cuenta abierta, sin
  importar quién lo cargó, con las mismas validaciones que el alta.
- **FR-016**: Cualquier miembro MUST poder eliminar cualquier gasto de una Cuenta abierta tras
  confirmar en un diálogo con "Continuar" y "Cancelar". La baja MUST ser lógica.
- **FR-017**: Si un gasto cambió o se eliminó desde que el miembro lo abrió, guardar MUST NOT pisar
  ese cambio: el miembro MUST recibir un aviso y ver la versión actual.
- **FR-018**: En una Cuenta Cerrada MUST NOT poder cargarse, editarse ni eliminarse gastos, y la
  interfaz MUST NOT ofrecer esas acciones.
- **FR-019**: Los permisos MUST validarse en el servidor: quien no es miembro MUST NOT poder ver ni
  modificar gastos, y la Cuenta MUST comportarse para él como inexistente (igual que en la feature
  002).

**Remoción de participantes**

- **FR-020**: Al quitar un participante, en cada gasto que pagó el pagador MUST quedar vacío.
- **FR-021**: Al quitar un participante, MUST quitarse de los participantes de cada gasto que
  compartía, y el importe MUST volver a dividirse en partes iguales entre los restantes; si no queda
  ninguno, el gasto MUST quedar pendiente de asignación.
- **FR-022**: El diálogo de confirmación para quitar un participante MUST indicar cuántos gastos
  se verán afectados.
- **FR-023**: La remoción y todos sus ajustes sobre gastos MUST aplicarse juntos: o se aplican
  todos, o ninguno.

**Auditoría**

- **FR-024**: Cada alta, modificación y baja de un gasto, y cada cambio sobre la Cuenta, MUST
  generar un registro de auditoría con: la Cuenta, el tipo de elemento (gasto o Cuenta), el
  elemento afectado, la acción (alta, modificación o baja), el usuario que la hizo, los valores
  anteriores y nuevos de lo que cambió, y la fecha y hora.
- **FR-025**: Cada registro de auditoría MUST guardarse junto con el cambio que registra: si uno
  falla, no se guarda ninguno.
- **FR-026**: Los registros de auditoría MUST NOT poder editarse ni eliminarse mediante la
  plataforma.
- **FR-027**: Los ajustes automáticos por remoción de un participante MUST registrarse como
  modificaciones de cada gasto, atribuidas al usuario que quitó al participante.
- **FR-028**: Los registros de auditoría MUST NOT contener datos sensibles (contraseñas, códigos,
  tokens ni el código de invitación), como en las features anteriores.

**Idioma**

- **FR-029**: Todos los textos de esta feature MUST estar disponibles en español e inglés, y las
  fechas e importes MUST formatearse según el idioma del usuario.

**Historial del gasto**

- **FR-030**: El detalle de un gasto MUST mostrar su historial a los miembros de la Cuenta, del más
  reciente al más antiguo: acción, usuario que la hizo, fecha y hora y, en las modificaciones, el
  valor anterior y el nuevo de cada campo que cambió.
- **FR-031**: El historial MUST mostrar los valores de forma legible: nombres de participantes
  (también de los ya quitados), importes formateados según la moneda e ícono o nombre de la
  categoría; MUST NOT mostrar identificadores internos.
- **FR-032**: Los ajustes automáticos por remoción de un participante MUST figurar en el historial
  identificados como tales.

**Fuera de alcance de esta feature**

- Saldos, reembolsos sugeridos y "marcar como pagado" (feature siguiente).
- Divisiones que no sean en partes iguales (por montos, porcentajes o proporciones).
- Varios pagadores para un mismo gasto.
- Gastos en otra moneda o conversión de tipo de cambio (Principio III).
- Búsqueda, filtros y exportación de gastos. La exportación de datos del usuario (CSV/JSON) que exige
  la constitución (Principio VI) queda para una feature propia.
- Recuperar un gasto eliminado.
- Comprobante o ticket del gasto (enlace o archivo); se implementará en una feature futura.
- Actualización automática o en tiempo real del listado mientras está abierto.
- Una vista de historial de toda la Cuenta; el historial se ve solo en el detalle de cada gasto.

### Key Entities *(include if feature involves data)*

- **Expense (Gasto)**: un gasto de una Cuenta. Atributos: fecha, concepto, descripción, importe, moneda (la de la Cuenta), pagador (un participante, o vacío), participantes (los que lo
  comparten), categoría, si está eliminado, quién lo cargó, fechas de alta y de última
  modificación.
- **Share (Parte)**: lo que le corresponde a cada participante de un gasto; se deriva del importe y
  de los participantes con la regla de división, no se carga a mano.
- **Category (Categoría)**: ícono de un conjunto fijo que clasifica el gasto.
- **Audit Log Entry (Registro de auditoría)**: registro inmutable de una acción sobre un gasto o
  sobre la Cuenta: Cuenta, tipo y elemento afectados, acción, usuario, valores anteriores y nuevos,
  y fecha y hora.
- **Participant (Participante)** y **Account (Cuenta)**: definidos en la feature 002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro carga un gasto con los valores precargados en menos de 20 segundos.
- **SC-002**: En el 100% de los gastos, la suma de las partes es exactamente igual al importe total.
- **SC-003**: El 100% de las altas, modificaciones y bajas de gastos y de cambios sobre la Cuenta
  quedan en la auditoría con quién, qué y cuándo.
- **SC-004**: El 0% de los intentos de cargar, editar o eliminar gastos en una Cuenta Cerrada, o por
  parte de quien no es miembro, tienen éxito, aunque se intenten por fuera de la interfaz.
- **SC-005**: Ningún cambio de un miembro sobre un gasto se pierde sin aviso cuando otro miembro lo
  editó al mismo tiempo.
- **SC-006**: Una Cuenta con 500 gastos se abre y muestra el total y la primera parte del listado en
  menos de 2 segundos; cada parte siguiente aparece en menos de 1 segundo.
- **SC-007**: Después de quitar un participante, el 100% de sus gastos quedan ajustados según las
  reglas (pagador vacío, parte redistribuida o pendiente de asignación).

## Assumptions

- "Miembro" tiene el mismo significado que en la feature 002: un usuario vinculado a un
  participante de la Cuenta, incluido el Owner.
- El importe máximo de un gasto es 999.999.999 en la unidad principal de la moneda.
- El conjunto de categorías es fijo y se define en el diseño; incluye al menos Casa, Auto, Hotel,
  Playa, Comida, Dinero y una categoría por defecto ("Otros").
- El orden de los participantes en la Cuenta, que define a quién van los centavos sobrantes, es el
  orden en que se agregaron.
- La auditoría ya registra los cambios sobre la Cuenta desde la feature 002; esta feature agrega
  la referencia a la Cuenta en todos los registros de gastos y de la Cuenta.
- Los gastos y su listado se ven igual en Web y en Mobile.
- Esta feature depende de las features 001 (usuario, idioma y zona horaria) y 002 (Cuentas,
  participantes, membresía y cierre).
