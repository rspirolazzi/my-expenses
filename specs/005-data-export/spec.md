# Feature Specification: Exportar datos

**Feature Branch**: `005-data-export`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Feature 05: Data Export": exportar los datos en formato abierto (CSV
y JSON). Desde una Cuenta, cualquier miembro exporta sus gastos, reembolsos y saldos, también si
está Cerrada. Desde el Perfil, el usuario exporta todos sus datos: perfil, preferencias y el
contenido de todas sus Cuentas. Sin emails ni ids de otros usuarios ni secretos, importes exactos,
textos en el idioma del usuario, solo miembros, auditado, igual en Web y Mobile, textos en es/en.

**Ajustes respecto del input** (para cumplir la constitución v4.4.0 y las features 001 a 004):

- Es la forma de cumplir el Principio VI ("el usuario MUST poder exportar sus datos en formato
  abierto"). Las features 002, 003 y 004 la dejaron fuera de alcance a propósito.
- Se exporta lo que el miembro ya puede ver en la aplicación: gastos y reembolsos activos, saldos y
  sugerencias calculados al momento de exportar. Los gastos y reembolsos eliminados (baja lógica) y
  el registro de auditoría no se exportan.
- Los nombres de los participantes (también los de participantes quitados) se exportan porque ya
  son visibles para los miembros; los emails y los identificadores de otros usuarios nunca.

## Clarifications

### Session 2026-11-11

- Q: ¿Cómo se entrega la exportación en CSV, si una Cuenta tiene varias tablas? → A: Un archivo ZIP
  con un CSV por tabla; en "Exportar mis datos", una carpeta por Cuenta dentro del ZIP.
- Q: ¿Qué separadores usa el CSV para que los importes se lean bien en una planilla? → A: Siempre el
  estándar: `,` entre columnas y punto decimal (`30.00`), sin importar el idioma.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exportar una Cuenta (Priority: P1)

Un miembro abre una Cuenta y descarga sus gastos, reembolsos y saldos en CSV o en JSON para
guardarlos, analizarlos en una planilla o llevarlos a otra herramienta.

**Why this priority**: es el caso más frecuente (cerrar un viaje y guardar el registro) y por sí
solo cumple el Principio VI para el contenido compartido.

**Independent Test**: en la Cuenta del ejemplo de la feature 004 (Ana paga 90,00 entre tres y
Leandro le reembolsa 30,00), el miembro exporta en CSV y en JSON; los archivos tienen el gasto con
la parte de cada uno, el reembolso y los saldos Ana +30,00, Leandro 0,00 y Javier −30,00.

**Acceptance Scenarios**:

1. **Given** una Cuenta con gastos y reembolsos, **When** un miembro elige "Exportar" y el formato
   JSON, **Then** recibe un archivo con los datos de la Cuenta, sus gastos (con la parte de cada
   participante), sus reembolsos y los saldos actuales.
2. **Given** la misma Cuenta, **When** elige el formato CSV, **Then** recibe un archivo ZIP
   con un CSV por tabla (Cuenta, participantes, gastos, partes, reembolsos, saldos y
   sugerencias) que se abren en una planilla común
   con los acentos y los importes correctos.
3. **Given** gastos pendientes de asignación y reembolsos de un participante quitado, **When** se
   exporta, **Then** figuran marcados como tales, igual que en la aplicación.
4. **Given** una Cuenta Cerrada, **When** un miembro exporta, **Then** la exportación funciona
   igual.
5. **Given** el usuario con el idioma inglés, **When** exporta, **Then** los encabezados y los
   valores traducibles (categorías, sí/no, estados) salen en inglés; los importes y las fechas no
   dependen del idioma.
6. **Given** alguien que no es miembro, **When** intenta exportar la Cuenta, **Then** se comporta
   como si la Cuenta no existiera y no recibe datos.

---

### User Story 2 - Exportar todos mis datos (Priority: P2)

Desde el Perfil, el usuario descarga en un solo paso todos sus datos: su perfil y preferencias y el
contenido de cada Cuenta de la que es miembro.

**Why this priority**: completa la portabilidad de datos que pide la constitución, pero el valor
principal ya está en exportar cada Cuenta.

**Independent Test**: un usuario miembro de dos Cuentas (una ARS abierta y una USD Cerrada) exporta
todo en JSON y en CSV; el archivo tiene su perfil y las dos Cuentas completas, cada una en su moneda.

**Acceptance Scenarios**:

1. **Given** un usuario con Cuentas, **When** elige "Exportar mis datos" en el Perfil y un formato,
   **Then** recibe su perfil (nombre, apellido, email propio, idioma, moneda por defecto y tema) y,
   para cada Cuenta de la que es miembro, lo mismo que en la User Story 1.
2. **Given** Cuentas en monedas distintas, **When** se exporta, **Then** cada importe va con la
   moneda de su Cuenta y nunca se suman importes de monedas distintas.
3. **Given** Cuentas que el usuario abandonó o que fueron dadas de baja, **When** se exporta,
   **Then** no se incluyen.
4. **Given** un usuario sin Cuentas, **When** exporta, **Then** recibe solo su perfil.

---

### Edge Cases

- **Participante quitado**: sus reembolsos se exportan marcados como excluidos; sus gastos ya
  ajustados en la feature 003 se exportan como están (pagador vacío si lo era).
- **Participante desvinculado**: se exporta con su nombre, sin indicar a qué usuario estaba
  vinculado.
- **Centavos**: las partes exportadas suman exactamente el importe de cada gasto, con la misma regla
  de reparto que la aplicación; los saldos exportados suman exactamente cero.
- **Moneda sin decimales** (JPY, CLP): importes sin decimales.
- **Cuenta sin gastos ni reembolsos**: se exporta con las tablas vacías (con encabezados) y saldos
  en cero.
- **Textos con comas, comillas, saltos de línea o emojis** (conceptos y descripciones): se exportan
  sin romper el formato ni perder caracteres.
- **Texto que empieza con `=`, `+`, `-` o `@`** en CSV: no se interpreta como fórmula al abrirlo en
  una planilla.
- **Cambios durante la exportación**: el archivo refleja un único momento; un gasto cargado
  mientras se genera puede quedar afuera, pero nunca a medias.
- **Pérdida de conexión**: el usuario ve un error claro y puede reintentar; no queda un archivo
  incompleto presentado como válido.
- **Mobile**: el archivo se ofrece con la hoja de compartir del sistema (guardar, enviar por la app
  que elija); si el usuario la cierra sin elegir, no pasa nada.

## Requirements *(mandatory)*

### Functional Requirements

**Exportar una Cuenta**

- **FR-001**: Cualquier miembro MUST poder exportar una Cuenta, abierta o Cerrada, eligiendo el
  formato CSV o JSON.
- **FR-002**: La exportación de una Cuenta MUST incluir: nombre, descripción, moneda, si está
  Cerrada y la fecha de exportación; los participantes activos y quitados (nombre y si está
  quitado); los gastos activos (fecha, concepto, descripción, categoría, importe, moneda, pagador,
  participantes, parte de cada uno y si está pendiente de asignación); los reembolsos activos
  (fecha, quién pagó, quién recibió, importe, moneda y si está excluido por un participante
  quitado); los saldos de cada participante activo y los reembolsos sugeridos vigentes.
- **FR-003**: Los gastos y reembolsos eliminados y el registro de auditoría MUST NOT exportarse.
- **FR-004**: En CSV, los datos MUST entregarse en un único archivo ZIP con un CSV por tabla
  (Cuenta, participantes, gastos, partes de cada gasto, reembolsos, saldos y sugerencias); en la
  exportación de todos los datos, el ZIP MUST tener el perfil y una carpeta por Cuenta con esas
  tablas. En JSON, MUST entregarse un único documento con la misma información.
- **FR-005**: Los gastos y reembolsos MUST exportarse en el mismo orden que en la aplicación (del
  más reciente al más antiguo).

**Exportar todos mis datos**

- **FR-006**: El usuario MUST poder exportar desde el Perfil todos sus datos en CSV o JSON: su
  perfil (nombre, apellido, email propio, idioma, moneda por defecto y tema) y, por cada Cuenta de
  la que es miembro, lo mismo que en FR-002.
- **FR-007**: Las Cuentas abandonadas o dadas de baja MUST NOT incluirse.

**Contenido y formato**

- **FR-008**: Los importes MUST exportarse con valores exactos, como número decimal con punto y con
  exactamente los decimales de la moneda, siempre junto a la moneda de su Cuenta. Las partes de un
  gasto MUST sumar su importe y los saldos de una Cuenta MUST sumar cero.
- **FR-009**: Las fechas MUST exportarse como día calendario `AAAA-MM-DD`; la fecha y hora de
  exportación, en UTC con zona explícita.
- **FR-010**: Los encabezados y los valores traducibles (nombres de tablas y columnas, categorías,
  sí/no, estados) MUST salir en el idioma del usuario (español o inglés); los nombres de campo del
  JSON MUST ser estables y no depender del idioma.
- **FR-011**: Cada CSV MUST usar el formato estándar, igual para todos los idiomas: `,` entre
  columnas, punto decimal, la primera fila con los encabezados y los textos entre comillas cuando
  haga falta. Los archivos MUST poder abrirse o importarse en planillas comunes sin romper acentos,
  comas, comillas ni saltos de línea, y un texto que empiece con `=`, `+`, `-` o `@` MUST NOT
  ejecutarse como fórmula.
- **FR-012**: El nombre del archivo MUST identificar el contenido y la fecha (por ejemplo, el
  nombre de la Cuenta y el día de exportación).

**Privacidad, permisos y auditoría**

- **FR-013**: La exportación MUST NOT incluir emails ni identificadores de otros usuarios, ni
  contraseñas, códigos, tokens, enlaces de invitación u otros secretos.
- **FR-014**: Los permisos MUST validarse en el servidor: quien no es miembro MUST NOT poder
  exportar una Cuenta, y la Cuenta MUST comportarse para él como inexistente.
- **FR-015**: Cada exportación MUST quedar en el registro de auditoría con el usuario, el alcance
  (una Cuenta o todos los datos), el formato y la fecha y hora, sin copiar los datos exportados.
- **FR-016**: Los logs de la aplicación MUST NOT incluir el contenido exportado.

**Clientes**

- **FR-017**: Web MUST descargar el archivo; Mobile MUST ofrecerlo con la hoja de compartir del
  sistema. El comportamiento y el contenido MUST ser los mismos en ambos.
- **FR-018**: Mientras se genera, la interfaz MUST indicar que está en curso y evitar que un doble
  toque genere dos exportaciones; ante un error, MUST mostrar un mensaje claro y permitir reintentar.
- **FR-019**: Todos los textos de esta feature MUST estar disponibles en español e inglés.

**Fuera de alcance de esta feature**

- Importar datos (cargar un archivo exportado).
- Exportaciones programadas o enviadas por email.
- Formatos distintos de CSV y JSON (PDF, Excel nativo).
- Filtros por fecha, categoría o participante.
- Exportar el registro de auditoría o el historial de cambios.
- Comprobantes de gastos (no existen todavía).

### Key Entities *(include if feature involves data)*

- **Exportación de Cuenta**: la foto de una Cuenta en un momento: datos de la Cuenta,
  participantes, gastos con sus partes, reembolsos, saldos y sugerencias.
- **Exportación personal**: el perfil del usuario más una Exportación de Cuenta por cada Cuenta de
  la que es miembro.
- **Registro de exportación**: entrada de auditoría con quién exportó, qué alcance, qué formato y
  cuándo.
- **Account, Participant, Expense, Settlement, Balance, User y Audit Log Entry**: definidos en las
  features 001 a 004.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las exportaciones, las partes de cada gasto suman su importe y los
  saldos de cada Cuenta suman exactamente cero, iguales a los que muestra la aplicación.
- **SC-002**: Un miembro exporta una Cuenta en menos de 3 toques o clics desde la Cuenta.
- **SC-003**: Una Cuenta con 500 gastos y 100 reembolsos se exporta en menos de 5 segundos.
- **SC-004**: La exportación de todos los datos de un usuario con 20 Cuentas de 500 gastos se
  completa en menos de 15 segundos.
- **SC-005**: El 100% de los archivos CSV exportados se abren o se importan como CSV estándar en
  una planilla común con los acentos y los importes correctos y sin fórmulas ejecutadas.
- **SC-006**: El 0% de los intentos de exportar una Cuenta por parte de quien no es miembro tienen
  éxito, aunque se intenten por fuera de la interfaz.
- **SC-007**: El 0% de los archivos exportados contienen emails o identificadores de otros usuarios
  o secretos.
- **SC-008**: El 100% de las exportaciones quedan en la auditoría.

## Assumptions

- "Miembro" tiene el mismo significado que en las features 002 a 004.
- Los importes van con punto decimal y el CSV con `,` en ambos idiomas, para que cualquier
  herramienta los lea igual; el idioma solo afecta a encabezados y valores traducibles. En una
  planilla configurada en español puede hacer falta usar "Importar CSV" en lugar del doble clic.
- Los identificadores internos de Cuentas, gastos, reembolsos y participantes pueden figurar para
  relacionar tablas entre sí; no son datos de usuarios ni permiten acceder a nada.
- No hay un límite de exportaciones por usuario; si el uso lo exige, se agregará después.
- Esta feature depende de las features 001 (perfil e idioma), 002 (Cuentas, participantes y
  membresía), 003 (gastos y división) y 004 (saldos y reembolsos).
