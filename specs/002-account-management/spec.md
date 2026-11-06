# Feature Specification: Cuentas, Participantes de Texto Libre e Invitaciones

**Feature Branch**: N/A (se crea al implementar)

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Feature 02: Account Management, Free-text Participants and
Invitations": crear Cuentas para agrupar gastos compartidos, con participantes en texto libre,
invitaciones que vinculan a usuarios registrados con esos participantes, permisos de edición, baja
lógica por el Owner, salida de miembros y cierre de solo lectura.

**Ajustes respecto del input** (para cumplir la constitución v4.4.0 y la feature 001):

- El stack técnico y el esquema de base de datos se quitaron de la spec; se definen en el plan.
- La moneda de la Cuenta no se puede cambiar después de crearla (Principio III: la moneda se define
  al crear la Cuenta y todos sus gastos y reembolsos se registran en ella).
- La moneda viene precargada con la moneda por defecto del usuario (FR-020 de la feature 001).
- Quitar un participante no borra nada: los efectos sobre gastos y reembolsos (pagador vacío,
  redistribución de su parte, reembolsos excluidos de saldos) los define la constitución y se
  implementan en las features de Gastos y de Saldos. En esta feature todavía no hay gastos.
- Toda alta, modificación, baja, cierre, salida y vinculación queda en el log de auditoría
  (Principio IV), y la baja y el cierre piden confirmación explícita.

- La foto de la Cuenta se reemplaza por un ícono elegido de un conjunto fijo (no hay subida de
  imágenes), alineado con la enmienda v4.4.0 de la constitución.

## Clarifications

### Session 2026-11-06

- Q: ¿La foto de la Cuenta se sube como imagen o se elige de un conjunto de íconos? → A: No hay
  fotos: la Cuenta tiene un ícono elegido de un conjunto fijo.
- Q: ¿El Owner puede reabrir una Cuenta Cerrada? → A: No; cerrar es definitivo.
- Q: ¿Se puede revocar el enlace de invitación, y quién? → A: Sí, solo el Owner, generando uno
  nuevo; el anterior deja de funcionar.
- Q: ¿El Owner puede dar de baja una Cuenta ya Cerrada? → A: Sí; la baja no modifica sus datos,
  solo la oculta para todos.
- Q: ¿Qué puede hacer el Owner si quiere dejar la Cuenta? → A: No puede salir, pero puede darla de
  baja, lo que la quita junto con todos sus gastos para todos los miembros. Antes se le pide
  confirmación en un diálogo con "Continuar" y "Cancelar".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una Cuenta con participantes (Priority: P1)

Una persona crea una Cuenta (por ejemplo, "Vacaciones a Brasil 2026") con su moneda y la lista de
personas que comparten los gastos, escritas como nombres libres. Quien la crea queda como Owner y
como participante.

**Why this priority**: sin Cuentas no hay dónde cargar gastos; es la base de todo el producto.

**Independent Test**: crear una Cuenta con nombre, moneda y tres nombres de participantes, y verla
en "Mis Cuentas" con esos datos, en Web y en Mobile.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** crea una Cuenta con nombre, moneda y una lista de
   nombres, **Then** la Cuenta queda creada, el usuario es su Owner y la ve en "Mis Cuentas".
2. **Given** el formulario de nueva Cuenta, **When** se abre, **Then** la moneda viene precargada con
   la moneda por defecto del usuario y puede cambiarse antes de crearla.
3. **Given** el formulario de nueva Cuenta, **When** se abre, **Then** el creador ya figura como
   participante con su nombre visible, que puede editar antes de crear la Cuenta.
4. **Given** una lista de participantes con dos nombres iguales (sin distinguir mayúsculas ni
   espacios de los extremos), **When** intenta crear la Cuenta, **Then** se le pide corregirlos.
5. **Given** una Cuenta creada, **When** se la consulta más tarde, **Then** su moneda es la elegida
   al crearla y no se ofrece cambiarla.

---

### User Story 2 - Invitar y vincularse a un participante (Priority: P1)

Un miembro comparte un enlace de invitación. La persona invitada entra (o se registra), elige cuál
de los participantes es ella, o se agrega como participante nuevo, y desde ese momento la Cuenta
aparece en su panel.

**Why this priority**: sin invitaciones la Cuenta es de una sola persona; compartirla es el valor
central del producto.

**Independent Test**: compartir el enlace de una Cuenta, abrirlo con otro usuario, vincularse a
"Leandro" y comprobar que la Cuenta aparece en el panel del invitado y que el resto del grupo sigue
viendo "Leandro".

**Acceptance Scenarios**:

1. **Given** una Cuenta, **When** un miembro pide compartirla, **Then** obtiene un enlace y un código
   de invitación que puede copiar o enviar por cualquier medio.
2. **Given** una persona sin sesión, **When** abre el enlace, **Then** se le pide iniciar sesión o
   registrarse y, al terminar, vuelve a la invitación.
3. **Given** un usuario autenticado que abre la invitación, **When** la ve, **Then** ve el nombre de
   la Cuenta, su moneda y los participantes que todavía no están vinculados a ningún usuario.
4. **Given** la invitación abierta, **When** elige un participante libre (por ejemplo, "Leandro"),
   **Then** queda vinculado a ese participante, se vuelve miembro y la Cuenta aparece en su panel.
5. **Given** la invitación abierta, **When** su nombre no está en la lista, **Then** puede agregarse
   como participante nuevo con un nombre que no repita uno existente, y queda vinculado a él.
6. **Given** un miembro vinculado, **When** los demás ven la Cuenta, **Then** lo siguen viendo con el
   nombre del participante, no con el nombre de su perfil.
7. **Given** un usuario que ya es miembro de la Cuenta, **When** vuelve a abrir la invitación,
   **Then** se le informa que ya es miembro y se lo lleva a la Cuenta, sin vincularlo dos veces.
8. **Given** el Owner, **When** genera un enlace nuevo tras confirmar, **Then** el enlace anterior
   deja de funcionar y los miembros ven el nuevo; los miembros que no son Owner no tienen esa
   opción.

---

### User Story 3 - Editar la Cuenta y sus participantes (Priority: P2)

Cualquier miembro cambia el nombre, la descripción o el ícono de la Cuenta, y agrega, renombra o
quita participantes.

**Why this priority**: los grupos cambian y los nombres se corrigen, pero la Cuenta es usable sin
editarla.

**Independent Test**: con un miembro que no es Owner, cambiar el nombre de la Cuenta, agregar un
participante y quitar otro, y ver los cambios desde la sesión del Owner.

**Acceptance Scenarios**:

1. **Given** un miembro de una Cuenta abierta, **When** cambia su nombre, descripción o ícono,
   **Then** el cambio se guarda y lo ven todos los miembros.
2. **Given** un miembro de una Cuenta abierta, **When** agrega un participante con un nombre nuevo,
   **Then** aparece en la lista sin vinculación a ningún usuario.
3. **Given** un participante, **When** un miembro lo renombra, **Then** el nuevo nombre se ve en toda
   la Cuenta, siempre que no repita otro existente.
4. **Given** un participante, **When** un miembro lo quita tras confirmar, **Then** deja de figurar
   en la lista; si estaba vinculado a un usuario, ese usuario deja de ser miembro y la Cuenta sale de
   su panel.
5. **Given** cualquier cambio de esta historia, **When** se consulta la auditoría, **Then** figura
   quién lo hizo, qué cambió (valor anterior y nuevo) y cuándo.

---

### User Story 4 - Salir de una Cuenta (Priority: P2)

Un miembro que no es Owner abandona la Cuenta. Deja de verla, pero su participante y sus datos
siguen en la Cuenta para el resto del grupo.

**Why this priority**: necesario para que nadie quede atado a una Cuenta que ya no le interesa,
sin romper los saldos del grupo.

**Independent Test**: un miembro invitado sale de la Cuenta; desaparece de su panel, el Owner la
sigue viendo y el participante sigue en la lista, ahora sin vinculación.

**Acceptance Scenarios**:

1. **Given** un miembro que no es Owner, **When** elige "Salir" y confirma, **Then** la Cuenta deja de
   figurar en su panel y ya no puede verla.
2. **Given** un miembro que salió, **When** los demás ven la Cuenta, **Then** su participante sigue
   con el mismo nombre, desvinculado de su usuario.
3. **Given** un participante desvinculado por una salida, **When** alguien abre la invitación,
   **Then** puede vincularse a ese participante, incluida la misma persona que salió.
4. **Given** el Owner, **When** ve la Cuenta, **Then** no tiene la opción de salir; si quiere
   dejarla, la opción es darla de baja (User Story 5).

---

### User Story 5 - Cerrar o dar de baja una Cuenta (Priority: P3)

El Owner cierra una Cuenta terminada para dejarla como historial de solo lectura, o la da de baja
para que desaparezca, junto con sus gastos, del panel de todos.

**Why this priority**: importante para el ciclo de vida, pero se usa al final, cuando la Cuenta ya
cumplió su propósito.

**Independent Test**: el Owner cierra una Cuenta y ningún miembro puede editarla; luego da de baja
otra Cuenta y desaparece para todos.

**Acceptance Scenarios**:

1. **Given** el Owner de una Cuenta abierta, **When** la cierra tras confirmar en un diálogo que
   avisa que el cierre es definitivo, **Then** la Cuenta queda Cerrada, con cualquier saldo, y se
   marca como tal en el panel de todos los miembros.
2. **Given** una Cuenta Cerrada, **When** cualquier miembro intenta editar sus datos o sus
   participantes, **Then** no puede: la Cuenta es estrictamente de solo lectura.
3. **Given** una Cuenta Cerrada, **When** alguien abre su invitación, **Then** no puede unirse.
4. **Given** una Cuenta Cerrada, **When** el Owner la ve, **Then** no tiene opción para reabrirla.
5. **Given** el Owner, **When** elige dar de baja la Cuenta, **Then** ve un diálogo que explica que
   la Cuenta y todos sus gastos dejarán de estar disponibles para todos los miembros, con las
   opciones "Continuar" y "Cancelar".
6. **Given** ese diálogo, **When** el Owner elige "Continuar", **Then** la Cuenta y sus gastos dejan
   de figurar para todos y la invitación deja de funcionar; los datos se conservan como baja lógica.
   Si elige "Cancelar", no cambia nada.
7. **Given** un miembro que no es Owner, **When** ve la Cuenta, **Then** no tiene opciones para
   cerrarla ni darla de baja, y si lo intentara, el sistema lo rechaza.

---

### Edge Cases

- Un usuario intenta vincularse a un participante que otro usuario tomó un instante antes: se le
  informa que ya no está disponible y se le muestra la lista actualizada.
- Un usuario ya vinculado a un participante intenta vincularse a otro de la misma Cuenta: no se
  permite; cada usuario es como mucho un participante por Cuenta.
- Se quita el participante vinculado al Owner: no se permite; el Owner siempre es miembro de su
  Cuenta.
- Se intenta dejar la Cuenta sin participantes: no se permite; siempre queda al menos el del Owner.
- Alguien abre un enlace de invitación inválido, revocado o de una Cuenta dada de baja: ve un mensaje
  genérico de invitación no válida, sin datos de ninguna Cuenta.
- Alguien que no es miembro intenta ver o editar una Cuenta por su identificador: el sistema responde
  como si no existiera, sin revelar sus datos.
- Un usuario con email todavía no verificado abre una invitación: no puede aceptarla hasta verificar
  (FR-003 de la feature 001).
- Dos miembros editan la misma Cuenta a la vez: se conservan ambos cambios si tocan datos distintos;
  si tocan el mismo dato, queda el último y ambos quedan auditados.
- Nombres de participante con espacios de más o distinta capitalización ("leandro " y "Leandro") se
  consideran el mismo nombre.

## Requirements *(mandatory)*

### Functional Requirements

**Alta y consulta**

- **FR-001**: Cualquier usuario autenticado MUST poder crear una Cuenta, en Web y en Mobile.
- **FR-002**: Una Cuenta MUST tener nombre (obligatorio, 1 a 80 caracteres), moneda ISO 4217
  (obligatoria) y al menos un participante; MAY tener descripción (hasta 500 caracteres). Cada
  Cuenta MUST tener un ícono elegido de un conjunto fijo, con uno por defecto si no se elige. No se
  suben imágenes.
- **FR-003**: Al crear una Cuenta, la moneda MUST venir precargada con la moneda por defecto del
  usuario; una vez creada, la moneda MUST NOT poder cambiarse.
- **FR-004**: El creador MUST quedar como Owner y como participante vinculado a su usuario, con su
  nombre visible como valor inicial editable.
- **FR-005**: Los nombres de participante MUST ser únicos dentro de la Cuenta, sin distinguir
  mayúsculas ni espacios de los extremos, y tener entre 1 y 40 caracteres.
- **FR-006**: Cada usuario MUST ver en "Mis Cuentas" las Cuentas de las que es miembro (abiertas y
  cerradas), y MUST NOT ver las que abandonó, de las que fue quitado o que fueron dadas de baja.
- **FR-007**: Solo los miembros MUST poder ver una Cuenta; para cualquier otro usuario, la Cuenta
  MUST comportarse como inexistente.

**Invitaciones y vinculación**

- **FR-008**: Cada Cuenta MUST tener un enlace de invitación con un código único y difícil de
  adivinar, que cualquier miembro puede ver y compartir. Solo el Owner MUST poder generar un enlace
  nuevo, tras confirmar; al hacerlo, el anterior MUST dejar de funcionar.
- **FR-009**: Al abrir la invitación sin sesión, la persona MUST poder iniciar sesión o registrarse
  y volver a la invitación al terminar.
- **FR-010**: La invitación MUST mostrar a un usuario autenticado el nombre de la Cuenta, su moneda y
  los participantes no vinculados, y MUST permitirle vincularse a uno de ellos o agregarse como
  participante nuevo con un nombre válido según FR-005.
- **FR-011**: Un usuario MUST estar vinculado como mucho a un participante por Cuenta, y un
  participante MUST estar vinculado como mucho a un usuario.
- **FR-012**: Para los demás miembros, un participante vinculado MUST seguir mostrándose con su
  nombre de participante.
- **FR-013**: Una invitación de una Cuenta Cerrada o dada de baja MUST NOT permitir unirse, y
  cualquier invitación no válida MUST mostrar el mismo mensaje genérico.

**Edición y participantes**

- **FR-014**: Cualquier miembro MUST poder editar nombre, descripción e ícono de una Cuenta abierta, y
  agregar, renombrar o quitar participantes.
- **FR-015**: Quitar un participante MUST requerir confirmación y MUST NOT borrar datos: si estaba
  vinculado, su usuario deja de ser miembro. Los efectos sobre gastos y reembolsos MUST seguir las
  reglas de remoción de la constitución cuando existan gastos.
- **FR-016**: El participante del Owner MUST NOT poder quitarse, y la Cuenta MUST conservar siempre
  al menos un participante.

**Salida, cierre y baja**

- **FR-017**: Un miembro que no es Owner MUST poder salir de la Cuenta tras confirmar, con cualquier
  saldo; su participante MUST quedar en la Cuenta con el mismo nombre, desvinculado de su usuario.
- **FR-018**: Solo el Owner MUST poder cerrar la Cuenta, con cualquier saldo y tras confirmar. Una
  Cuenta Cerrada MUST ser estrictamente de solo lectura para todos sus miembros, y el cierre MUST
  ser definitivo: nadie puede reabrirla.
- **FR-019**: Solo el Owner MUST poder dar de baja la Cuenta, esté abierta o Cerrada, tras
  confirmar en un diálogo con las opciones "Continuar" y "Cancelar". La baja MUST ser lógica: la
  Cuenta y todos sus gastos dejan de figurar para todos los miembros y su invitación deja de
  funcionar, pero los datos se conservan.
- **FR-019a**: El Owner MUST NOT poder salir de su Cuenta; para dejarla, la opción es la baja.
- **FR-020**: Los permisos de Owner y de miembro MUST validarse en el servidor, no solo en la
  interfaz.

**Auditoría e idioma**

- **FR-021**: Cada alta, modificación, cambio de participantes, vinculación, salida, regeneración
  del enlace, cierre y baja
  MUST quedar en el log de auditoría con quién, qué cambió (valor anterior y nuevo) y cuándo.
- **FR-022**: Todos los textos de esta feature MUST estar disponibles en español e inglés.

**Fuera de alcance de esta feature**

- Gastos, saldos, reembolsos y sus efectos (features siguientes).
- Transferir el rol de Owner a otro miembro.
- Envío de invitaciones por email, SMS o WhatsApp desde la plataforma (el miembro comparte el enlace
  por el medio que quiera).
- Exportación de datos de la Cuenta.

### Key Entities *(include if feature involves data)*

- **Account (Cuenta)**: agrupa gastos compartidos. Atributos: nombre, descripción, ícono, moneda (fija
  desde el alta), Owner, participantes, invitación, si está cerrada, si está dada de baja, fechas de
  alta y de última modificación.
- **Participant (Participante)**: persona dentro de una Cuenta, identificada por un nombre de texto
  libre único en esa Cuenta. Puede estar vinculada a un usuario (entonces ese usuario es miembro) o
  no. Tiene fecha de alta.
- **Member (Miembro)**: usuario vinculado a un participante de la Cuenta. El Owner es siempre miembro.
- **Invitation (Invitación)**: enlace con un código único por Cuenta que permite a un usuario
  vincularse a un participante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona crea una Cuenta con tres participantes en menos de 1 minuto.
- **SC-002**: Una persona invitada, ya registrada, se une a una Cuenta desde el enlace en menos de
  30 segundos.
- **SC-003**: El 100% de las acciones de miembro y de Owner (editar, salir, regenerar el enlace,
  cerrar, dar de baja)
  respetan los permisos aunque se intenten por fuera de la interfaz.
- **SC-004**: El 0% de los usuarios que no son miembros pueden ver datos de una Cuenta.
- **SC-005**: El 100% de los cambios sobre una Cuenta quedan en la auditoría.
- **SC-006**: Ningún participante queda vinculado a dos usuarios, ni ningún usuario a dos
  participantes de la misma Cuenta.
- **SC-007**: Los cambios que hace un miembro los ven los demás la próxima vez que abren la Cuenta.

## Assumptions

- "Miembro" es cualquier usuario vinculado a un participante de la Cuenta; el Owner también lo es.
- El código de invitación no vence por tiempo; deja de servir si el Owner genera uno nuevo o si la
  Cuenta se cierra o se da de baja.
- El conjunto de íconos es fijo y se define en el diseño; incluye las categorías de la constitución
  (Casa, Auto, Hotel, Playa, Comida, Dinero) y un ícono por defecto.
- Un usuario puede volver a unirse por la invitación después de salir, si la Cuenta sigue abierta.
- Las Cuentas cerradas siguen visibles en "Mis Cuentas", marcadas como cerradas.
- La moneda de la Cuenta se elige entre los mismos códigos ISO 4217 que la moneda por defecto del
  perfil.
- Esta feature depende de la feature 001 (usuario autenticado, nombre visible y moneda por defecto).
