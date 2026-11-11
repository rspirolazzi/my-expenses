# Feature Specification: Saldos y Reembolsos

**Feature Branch**: `004-balances-settlements`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Feature 04: Balances and Settlements": mostrar el saldo de cada
participante de una Cuenta, sugerir los reembolsos que saldan las deudas con la menor cantidad de
transferencias, registrar reembolsos ("marcar como pagado" o manuales), eliminarlos con baja
lógica, excluir gastos pendientes y reembolsos de participantes quitados, y mostrar en el panel
principal un resumen de saldos por Cuenta.

**Ajustes respecto del input** (para cumplir la constitución v4.4.0 y las features 001 a 003):

- Los saldos se calculan con la misma división de gastos de la feature 003, en la moneda de la
  Cuenta y con valores exactos (Principio III). No hay conversión entre monedas: el resumen del
  panel nunca suma importes de monedas distintas.
- La constitución exige como mínimo no más de N−1 transferencias; la spec pide eso y que el
  resultado sea siempre el mismo para los mismos saldos, sin exigir el mínimo matemático absoluto.
- Un reembolso no se edita: si se cargó mal, se elimina (baja lógica) y se carga de nuevo. Así cada
  movimiento de dinero queda auditado como un alta o una baja.
- Como en la feature 003, los cambios de otros miembros se ven al abrir la pantalla, al volver a
  ella o al actualizar; no hay actualización automática.

## Clarifications

### Session 2026-11-11

- Q: ¿Dónde ve el miembro los saldos, las sugerencias y los reembolsos dentro de una Cuenta? → A:
  La Cuenta tiene dos pestañas, "Gastos" (la lista actual) y "Saldos"; la pestaña "Saldos" muestra,
  en orden, los saldos, las sugerencias y la lista de reembolsos.
- Q: En el panel principal, ¿los totales "Te deben" y "Debés" incluyen el saldo de las Cuentas
  Cerradas? → A: Sí; los totales suman todas las Cuentas, abiertas y Cerradas, y las Cerradas
  figuran marcadas en la lista.
- Q: Al elegir "Marcar como pagado" en una sugerencia, ¿se puede cambiar el importe o la fecha
  antes de confirmar? → A: No; es un diálogo de confirmación con el importe de la sugerencia y la
  fecha de hoy fijos. Cualquier otro caso se registra con el formulario manual, que empieza vacío.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los saldos de la Cuenta (Priority: P1)

Un miembro abre la Cuenta y ve cuánto le corresponde a cada participante: quién debe y a quién le
deben, en la moneda de la Cuenta.

**Why this priority**: es el valor central del producto ("ver su saldo en segundos"); sin saldos,
los gastos cargados no responden la pregunta "¿quién le debe a quién?".

**Independent Test**: en una Cuenta con Ana, Leandro y Javier, Ana paga 90,00 compartido por los
tres; la vista de saldos muestra Ana +60,00, Leandro −30,00 y Javier −30,00, y la suma es cero.

**Acceptance Scenarios**:

1. **Given** una Cuenta con gastos, **When** un miembro abre la pestaña "Saldos", **Then** ve a cada
   participante activo con su saldo: positivo si le deben, negativo si debe, cero si está al día.
2. **Given** cualquier Cuenta, **When** se calculan los saldos, **Then** la suma de todos es
   exactamente cero.
3. **Given** un gasto pendiente de asignación (sin pagador o sin participantes), **When** se
   calculan los saldos, **Then** no se tiene en cuenta, y la vista indica cuántos gastos pendientes
   hay y lleva a completarlos.
4. **Given** el participante del usuario, **When** ve los saldos, **Then** su fila se destaca y se
   lee en lenguaje claro ("Te deben 60,00" o "Debés 30,00").
5. **Given** una Cuenta sin gastos ni reembolsos, **When** se abren los saldos, **Then** todos
   están en cero y se indica que no hay deudas.

---

### User Story 2 - Reembolsos sugeridos y "Marcar como pagado" (Priority: P1)

La Cuenta propone quién tiene que pagarle a quién y cuánto para quedar todos en cero. Cuando una
transferencia se hizo, un miembro la marca como pagada y los saldos se actualizan.

**Why this priority**: saldar las deudas es el objetivo final del grupo; con P1 la Cuenta ya
resuelve el ciclo completo: cargar, ver y saldar.

**Independent Test**: con los saldos del ejemplo anterior, se sugieren dos transferencias (Leandro
→ Ana 30,00 y Javier → Ana 30,00); al marcar la primera como pagada, Leandro queda en cero, Ana en
+30,00 y solo queda una sugerencia.

**Acceptance Scenarios**:

1. **Given** saldos distintos de cero, **When** se ven las sugerencias, **Then** cada una indica
   quién paga, a quién y cuánto, y aplicarlas todas deja a todos en cero.
2. **Given** N participantes con saldo distinto de cero, **When** se calculan las sugerencias,
   **Then** son como máximo N−1.
3. **Given** los mismos saldos, **When** se calculan las sugerencias varias veces, **Then** el
   resultado es siempre el mismo.
4. **Given** una sugerencia, **When** un miembro elige "Marcar como pagado" y confirma, **Then**
   queda registrado un reembolso por ese importe entre esos participantes, con fecha de hoy, y los
   saldos y las sugerencias se recalculan.
5. **Given** que todos los saldos están en cero, **When** se ven las sugerencias, **Then** se
   indica que no hay nada pendiente.

---

### User Story 3 - Registrar un reembolso manual (Priority: P2)

Un miembro registra un pago entre dos participantes que no coincide con una sugerencia (por
ejemplo, un pago parcial o uno anterior a cargar los gastos).

**Why this priority**: los grupos reales no siempre siguen las sugerencias; sin esto, algunos pagos
no tendrían dónde registrarse. La Cuenta ya es útil con las sugerencias.

**Independent Test**: Javier le paga 10,00 a Ana; se registra a mano y Javier queda en −20,00 y Ana
en +50,00.

**Acceptance Scenarios**:

1. **Given** una Cuenta abierta, **When** un miembro registra un reembolso con quién paga, quién
   recibe, importe y fecha, **Then** se guarda y los saldos se actualizan.
2. **Given** el formulario, **When** se elige el mismo participante como quien paga y quien recibe,
   o un importe que no es mayor a cero o tiene más decimales que la moneda, **Then** se rechaza con
   un mensaje claro.
3. **Given** un reembolso mayor a lo que se debía, **When** se guarda, **Then** se acepta y los
   saldos reflejan que ahora la deuda es en el otro sentido.
4. **Given** los reembolsos de la Cuenta, **When** un miembro abre la lista, **Then** ve cada uno
   con fecha, quién pagó, quién recibió e importe, del más reciente al más antiguo.

---

### User Story 4 - Eliminar un reembolso (Priority: P2)

Un miembro elimina un reembolso cargado por error; los saldos vuelven a como estaban.

**Why this priority**: corregir errores es frecuente, pero la Cuenta ya funciona sin esto.

**Independent Test**: se marca como pagada una sugerencia por error, se elimina tras confirmar y la
sugerencia vuelve a aparecer.

**Acceptance Scenarios**:

1. **Given** un reembolso, **When** un miembro elige eliminarlo, **Then** se pide confirmación con
   "Continuar" y "Cancelar"; con "Continuar" deja de figurar y de contar en los saldos, sin borrar
   sus datos.
2. **Given** un reembolso ya eliminado por otro miembro, **When** se intenta eliminar, **Then** se
   avisa que ya no existe.
3. **Given** una Cuenta Cerrada, **When** un miembro ve los reembolsos, **Then** no puede registrar
   ni eliminar ninguno, pero sigue viendo saldos, sugerencias y reembolsos.

---

### User Story 5 - Resumen de saldos en el panel principal (Priority: P3)

En el panel principal, el usuario ve de un vistazo su saldo en cada una de sus Cuentas.

**Why this priority**: es cómodo, pero la información ya está dentro de cada Cuenta.

**Independent Test**: un usuario con dos Cuentas en ARS y una en USD ve su saldo en cada una y los
totales "Te deben" y "Debés" separados por moneda.

**Acceptance Scenarios**:

1. **Given** las Cuentas del usuario, **When** abre el panel principal, **Then** ve cada Cuenta con
   su saldo en ella, con la moneda de la Cuenta, y puede abrirla.
2. **Given** Cuentas en monedas distintas, **When** se muestra el resumen, **Then** los totales se
   agrupan por moneda y nunca se suman importes de monedas distintas.
3. **Given** una Cuenta Cerrada, **When** se muestra en el resumen, **Then** figura marcada como
   Cerrada con su saldo final, y ese saldo cuenta en los totales "Te deben" y "Debés".

---

### Edge Cases

- **Participante quitado**: sus gastos ya se ajustaron en la feature 003; sus reembolsos (pagados o
  recibidos) siguen en la lista marcados como de un participante quitado, pero no cuentan en los
  saldos ni en las sugerencias. La suma de saldos sigue siendo cero. Un reembolso así se puede
  eliminar igual que cualquier otro; eliminarlo no cambia los saldos.
- **Participante desvinculado** (su usuario salió de la Cuenta): sigue con su saldo, aparece en las
  sugerencias y se pueden registrar reembolsos con él.
- **Centavos**: los saldos usan la misma regla de reparto de centavos que el detalle de cada gasto;
  la suma da exactamente cero.
- **Moneda sin decimales** (JPY, CLP): saldos, sugerencias y reembolsos en unidades enteras.
- **Gasto completado**: cuando un miembro asigna pagador y participantes a un gasto pendiente, pasa
  a contar en los saldos.
- **Gasto eliminado**: deja de contar en los saldos.
- **Sugerencia desactualizada**: si otro miembro cambió gastos o reembolsos desde que se abrió la
  vista, "Marcar como pagado" registra el importe que el miembro vio y confirmó; al recargar, los
  saldos y sugerencias reflejan el estado actual.
- **Doble toque o reintento**: marcar como pagado o registrar un reembolso no lo crea dos veces por
  un reintento tras perder la conexión.
- **Cuenta Cerrada después de abrir la vista**: al registrar o eliminar, se rechaza con un mensaje
  claro.
- **Cuenta dada de baja**: deja de figurar en el resumen del panel junto con todo su contenido.
- **Participante con saldo cero**: no aparece en las sugerencias.
- **Importe muy grande**: mismo máximo que los gastos.

## Requirements *(mandatory)*

### Functional Requirements

**Saldos**

- **FR-000**: La Cuenta MUST tener dos pestañas: "Gastos" (la lista de la feature 003) y "Saldos".
  La pestaña "Saldos" MUST mostrar, en este orden, los saldos, los reembolsos sugeridos y la lista
  de reembolsos, igual en Web y Mobile.
- **FR-001**: El saldo de cada participante activo MUST ser: lo que pagó en gastos − su parte en los
  gastos + lo que pagó en reembolsos − lo que recibió en reembolsos.
- **FR-002**: La suma de todos los saldos de una Cuenta MUST ser exactamente cero.
- **FR-003**: Las partes de cada gasto MUST calcularse con la misma regla de división y de reparto
  de centavos que la feature 003.
- **FR-004**: Los gastos pendientes de asignación (sin pagador o sin participantes) y los eliminados
  MUST NOT contar en los saldos ni en las sugerencias.
- **FR-005**: Los reembolsos eliminados y los de un participante quitado (como pagador o como
  receptor) MUST NOT contar en los saldos ni en las sugerencias.
- **FR-006**: La vista de saldos MUST indicar cuántos gastos pendientes de asignación hay y permitir
  ir a completarlos.
- **FR-007**: El saldo del participante del usuario MUST destacarse y expresarse en lenguaje claro
  (le deben, debe o está al día).
- **FR-008**: Todos los importes MUST calcularse y mostrarse con valores exactos, en la moneda de la
  Cuenta y formateados según el idioma del usuario.

**Reembolsos sugeridos**

- **FR-009**: La vista MUST proponer transferencias que, aplicadas todas, dejen todos los saldos en
  cero.
- **FR-010**: Las sugerencias MUST ser como máximo N−1, siendo N la cantidad de participantes con
  saldo distinto de cero, y MUST buscar pocas transferencias, sin exigir el mínimo matemático
  absoluto (ver Assumptions).
- **FR-011**: Para los mismos saldos, las sugerencias MUST ser siempre las mismas.
- **FR-012**: Cada sugerencia MUST ofrecer "Marcar como pagado", que abre un diálogo de
  confirmación con quién paga, a quién, el importe y la fecha de hoy, sin campos editables; al
  confirmar registra un reembolso con esos datos. Un pago por otro importe o con otra fecha se
  registra con el formulario manual (FR-013), que empieza vacío.

**Reembolsos**

- **FR-013**: Cualquier miembro MUST poder registrar un reembolso con: quién paga, quién recibe
  (participantes activos y distintos entre sí), importe (mayor a cero, con como máximo los decimales
  de la moneda y el mismo máximo que los gastos) y fecha (por defecto, hoy; un día, como los gastos).
- **FR-014**: Un reembolso MUST poder ser mayor a la deuda entre esos participantes.
- **FR-015**: La Cuenta MUST mostrar la lista de reembolsos activos, del más reciente al más
  antiguo, con fecha, quién pagó, quién recibió e importe; los de participantes quitados MUST
  figurar marcados como tales.
- **FR-016**: Cualquier miembro MUST poder eliminar un reembolso tras confirmar en un diálogo con
  "Continuar" y "Cancelar". La baja MUST ser lógica.
- **FR-017**: Los reembolsos MUST NOT poder editarse; un reembolso equivocado se elimina y se carga
  de nuevo.
- **FR-018**: Registrar un reembolso MUST NOT crearlo dos veces por un reintento.
- **FR-019**: En una Cuenta Cerrada MUST NOT poder registrarse ni eliminarse reembolsos, y la
  interfaz MUST NOT ofrecer esas acciones; saldos, sugerencias y reembolsos siguen visibles.

**Permisos y auditoría**

- **FR-020**: Los permisos MUST validarse en el servidor: quien no es miembro MUST NOT poder ver
  saldos ni reembolsos, ni registrarlos o eliminarlos, y la Cuenta MUST comportarse para él como
  inexistente.
- **FR-021**: Cada alta y baja de un reembolso MUST quedar en el registro de auditoría con la Cuenta,
  el reembolso, la acción, el usuario, los datos y la fecha y hora, guardado junto con el cambio.
- **FR-022**: Un reembolso MUST NOT poder registrarse con un participante quitado ni con uno que
  pertenezca a otra Cuenta.

**Panel principal**

- **FR-023**: El panel principal MUST mostrar, para cada Cuenta del usuario, su saldo en ella, con
  la moneda de la Cuenta, y llevar a la Cuenta.
- **FR-024**: El panel MUST mostrar los totales "te deben" y "debés" agrupados por moneda, y MUST
  NOT sumar importes de monedas distintas. Los totales MUST incluir las Cuentas abiertas y las
  Cerradas.

**Actualización e idioma**

- **FR-025**: Saldos, sugerencias y reembolsos MUST mostrarse vigentes al abrir la vista, al volver
  a ella y cuando el miembro pide actualizar; MUST NOT actualizarse solos.
- **FR-026**: Todos los textos de esta feature MUST estar disponibles en español e inglés.

**Fuera de alcance de esta feature**

- Pagos reales o integración con bancos o billeteras: los reembolsos solo registran que un pago se
  hizo por fuera de la plataforma.
- Recordatorios o notificaciones de deudas.
- Editar un reembolso o recuperar uno eliminado.
- Conversión entre monedas o saldos en otra moneda que la de la Cuenta.
- Historial de cambios visible de los reembolsos (la auditoría se registra, pero no hay pantalla).
- Exportación de datos (queda para una feature propia).

### Key Entities *(include if feature involves data)*

- **Settlement (Reembolso)**: un pago registrado entre dos participantes de una Cuenta. Atributos:
  quién pagó, quién recibió, importe (en la moneda de la Cuenta), fecha, si está eliminado, quién lo
  registró y fechas de alta y baja.
- **Balance (Saldo)**: lo que corresponde a cada participante; se deriva de los gastos y los
  reembolsos que cuentan, no se carga a mano.
- **Suggested Transfer (Reembolso sugerido)**: quién le paga a quién y cuánto; se deriva de los
  saldos.
- **Expense (Gasto)**, **Participant (Participante)**, **Account (Cuenta)** y **Audit Log Entry
  (Registro de auditoría)**: definidos en las features 002 y 003.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las Cuentas, la suma de los saldos es exactamente cero.
- **SC-002**: En el 100% de los casos, aplicar todas las sugerencias deja todos los saldos en cero
  con no más de N−1 transferencias.
- **SC-003**: Un miembro ve su saldo en una Cuenta en menos de 5 segundos desde que la abre.
- **SC-004**: Un miembro marca una sugerencia como pagada en menos de 10 segundos.
- **SC-005**: Una Cuenta con 500 gastos y 100 reembolsos muestra sus saldos y sugerencias en menos
  de 2 segundos.
- **SC-006**: El 0% de los intentos de registrar o eliminar reembolsos en una Cuenta Cerrada, o por
  parte de quien no es miembro, tienen éxito, aunque se intenten por fuera de la interfaz.
- **SC-007**: El 100% de las altas y bajas de reembolsos quedan en la auditoría con quién, qué y
  cuándo.

## Assumptions

- "Miembro" tiene el mismo significado que en las features 002 y 003.
- El orden de los participantes para el reparto de centavos es el de la feature 003.
- Las sugerencias se calculan con un método que garantiza como máximo N−1 transferencias y busca
  pocas; no se exige el mínimo matemático en todos los casos, porque calcularlo puede ser muy
  costoso, y la constitución fija N−1 como requisito.
- Un participante sin usuario vinculado puede pagar y recibir reembolsos: el registro lo hace
  cualquier miembro en su nombre.
- El importe máximo de un reembolso es el mismo que el de un gasto (999.999.999 en la unidad
  principal de la moneda).
- Los saldos y las sugerencias no se guardan: se calculan cada vez a partir de los gastos y
  reembolsos que cuentan.
- Esta feature depende de las features 001 (usuario e idioma), 002 (Cuentas, participantes,
  membresía y cierre) y 003 (gastos, división y auditoría).
