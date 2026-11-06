# Feature Specification: Autenticación y Perfil de Usuario

**Feature Branch**: N/A (el proyecto todavía no es un repositorio git)

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Feature 01: User Authentication and Profile Management (Auth, Profile,
Preferences)": registro e inicio de sesión con Google, email y celular; perfil con nombre, apellido,
email, teléfono y preferencias (idioma, moneda por defecto, tema); unicidad de email/teléfono,
fallback de nombre y aplicación inmediata de preferencias.

**Ajustes respecto del input** (para cumplir la constitución v4.2.0):

- Se quita el acceso por celular (SMS / WhatsApp): está fuera de alcance en esta versión.
- `firstName` / `lastName` pasan a ser opcionales al registrarse, porque el input pedía a la vez que
  fueran obligatorios y que existiera un fallback cuando no se completan.
- Se unifican `primaryAuthMethod` y `authProviders` en una sola lista de métodos vinculados.
- El email pasa a ser obligatorio: sin acceso por celular, todo usuario tiene email.
- Se agrega el tema `system` a los valores Light/Dark de la constitución.
- El stack técnico y el esquema de base de datos se quitaron de la spec; se definen en el plan.

## Clarifications

### Session 2026-11-06

- Q: ¿Cuánto tiempo puede pasar sin usar la app antes de que un usuario tenga que volver a iniciar
  sesión? → A: 30 días sin uso, tanto en Web como en Mobile.
- Q: ¿Un usuario que se registró con email pero todavía no lo verificó puede entrar a la
  plataforma? → A: No; hasta verificar solo puede ingresar el código, reenviarlo o corregir el
  email.
- Q: ¿En qué idiomas tiene que estar disponible la interfaz en esta primera versión? → A: Español
  e inglés.
- Q: Cuando cambia algo sensible de la cuenta, ¿se le avisa al usuario por email? → A: Sí, al
  cambiar la contraseña, vincular Google o cambiar el email; en el cambio de email el aviso va al
  email anterior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro e inicio de sesión con email y contraseña (Priority: P1)

Una persona se registra con su email y una contraseña, confirma su email con un código que recibe
por correo y entra a la plataforma. Más tarde vuelve a entrar con el mismo email y contraseña, desde
Web o desde la App.

**Why this priority**: es el acceso base exigido por la constitución y no depende de terceros; sin
él nadie puede usar el resto de la plataforma.

**Independent Test**: registrar un email nuevo, verificarlo con el código recibido, cerrar sesión y
volver a entrar con la contraseña, en Web y en Mobile.

**Acceptance Scenarios**:

1. **Given** un email que no está registrado, **When** la persona se registra con email y una
   contraseña válida, **Then** recibe un código de verificación por email y su cuenta queda
   pendiente de verificación.
2. **Given** una cuenta pendiente de verificación, **When** ingresa el código correcto antes de que
   expire, **Then** el email queda verificado, la persona elige su moneda por defecto (sugerida
   según la región de su dispositivo) y entra a la plataforma.
3. **Given** un usuario verificado, **When** inicia sesión con email y contraseña correctos,
   **Then** entra a su Dashboard.
4. **Given** un usuario verificado, **When** ingresa una contraseña incorrecta, **Then** ve un
   mensaje genérico que no revela si el email existe.
5. **Given** un email ya registrado, **When** alguien intenta registrarse con ese email, **Then**
   no se crea otro usuario, la pantalla muestra el mismo mensaje que en un registro nuevo (sin
   revelar que el email existe), y el dueño del email recibe un correo que le ofrece iniciar sesión
   o recuperar la contraseña.

---

### User Story 2 - Inicio de sesión con Google (Priority: P1)

Una persona entra con su cuenta de Google en un solo paso. Si es su primera vez, se crea su usuario
con el email, nombre y apellido que Google comparta.

**Why this priority**: es la vía de acceso más rápida y la principal del producto.

**Independent Test**: entrar con una cuenta de Google nueva en Web y en Mobile y comprobar que se
crea el usuario con sus datos; salir y volver a entrar y comprobar que es el mismo usuario.

**Acceptance Scenarios**:

1. **Given** una cuenta de Google cuyo email no está registrado, **When** la persona elige "Entrar
   con Google" y autoriza, **Then** se crea su usuario con email verificado y el nombre y apellido
   que Google comparta, elige su moneda por defecto y entra a la plataforma.
2. **Given** un usuario creado con Google, **When** vuelve a entrar con Google, **Then** accede al
   mismo usuario, sin duplicados.
3. **Given** un email ya registrado con contraseña, **When** la persona entra con una cuenta de
   Google con ese mismo email, **Then** si Google informa el email como verificado, Google queda vinculado
   automáticamente al usuario existente y la persona entra a ese mismo usuario; si Google no lo
   informa como verificado, no se vincula y se le pide entrar con su contraseña o un código.
4. **Given** la persona cancela la autorización en Google, **When** vuelve a la plataforma,
   **Then** sigue sin sesión y ve un mensaje claro.

---

### User Story 3 - Inicio de sesión sin contraseña con código por email (Priority: P2)

Un usuario con email verificado elige entrar pidiendo un código de un solo uso que recibe por email,
en lugar de usar contraseña. Un usuario que se registró con Google también puede usarlo.

**Why this priority**: agrega comodidad y es la vía de rescate para quien no tiene contraseña; no es
imprescindible para el primer uso.

**Independent Test**: pedir un código para un email verificado, ingresarlo y entrar; comprobar que
un código vencido o ya usado no sirve.

**Acceptance Scenarios**:

1. **Given** un usuario con email verificado, **When** pide un código de acceso, **Then** recibe
   por email un código de un solo uso con vencimiento.
2. **Given** un código válido, **When** lo ingresa, **Then** entra a la plataforma y el código deja
   de ser válido.
3. **Given** un código vencido, ya usado o incorrecto, **When** lo ingresa, **Then** no entra y ve
   un mensaje que le permite pedir uno nuevo.

---

### User Story 4 - Recuperar la contraseña (Priority: P2)

Un usuario que olvidó su contraseña la restablece con un código que recibe por email.

**Why this priority**: sin recuperación, perder la contraseña deja al usuario fuera de sus cuentas
compartidas.

**Independent Test**: pedir la recuperación para un email registrado, usar el código para definir
una contraseña nueva y entrar con ella; la contraseña anterior deja de funcionar.

**Acceptance Scenarios**:

1. **Given** un email registrado, **When** el usuario pide recuperar la contraseña, **Then** recibe
   un código por email; si el email no existe, la pantalla muestra el mismo mensaje, sin revelarlo.
2. **Given** un código de recuperación válido, **When** define una contraseña nueva, **Then** la
   anterior deja de funcionar y se cierran sus otras sesiones activas.
3. **Given** un usuario registrado solo con Google, **When** usa la recuperación, **Then** puede
   definir una contraseña por primera vez y queda vinculado también el método email y contraseña.

---

### User Story 5 - Editar perfil y preferencias (Priority: P2)

Un usuario completa o cambia su nombre y apellido y ajusta sus preferencias: idioma, moneda por
defecto y tema. Los cambios de idioma y tema se ven al instante y se mantienen en Web y en Mobile.

**Why this priority**: el idioma y el nombre visible afectan toda la experiencia, pero la plataforma
es usable con los valores por defecto.

**Independent Test**: cambiar idioma y tema en Web, ver el cambio al instante, entrar desde Mobile y
comprobar que se aplican las mismas preferencias.

**Acceptance Scenarios**:

1. **Given** un usuario sin nombre ni apellido, **When** se lo muestra en la plataforma, **Then** se
   ve su email como identificador hasta que complete su perfil.
2. **Given** un usuario en su Perfil, **When** cambia el idioma o el tema, **Then** toda la interfaz
   se actualiza sin recargar ni volver a entrar.
3. **Given** un usuario que cambió sus preferencias en un dispositivo, **When** entra desde otro,
   **Then** ve las mismas preferencias.
4. **Given** un usuario que cambia su moneda por defecto, **When** crea una Cuenta nueva, **Then** la
   moneda viene precargada con su preferencia; las Cuentas existentes no cambian de moneda.
5. **Given** el tema `system`, **When** el dispositivo cambia entre claro y oscuro, **Then** la
   interfaz sigue al dispositivo.

---

### User Story 6 - Cerrar sesión (Priority: P3)

Un usuario cierra su sesión en el dispositivo que está usando.

**Why this priority**: necesario en dispositivos compartidos, pero simple y de bajo riesgo de
alcance.

**Independent Test**: cerrar sesión y comprobar que las pantallas privadas ya no son accesibles sin
volver a entrar.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión, **When** elige "Logout", **Then** su sesión en ese dispositivo
   termina y vuelve a la pantalla pública.

---

### Edge Cases

- El usuario abandona el registro en el paso de elegir moneda: al volver a entrar, se le vuelve a
  pedir antes de llegar al Dashboard.
- Google no comparte nombre o apellido: el usuario se crea igual y se aplica el fallback por email.
- Se pide un código de verificación o de acceso muchas veces seguidas: el sistema limita los
  reenvíos (como mucho 1 por minuto y 5 por hora por email).
- Se ingresan códigos incorrectos repetidamente: tras 5 intentos fallidos el código se invalida y
  hay que pedir uno nuevo.
- Muchos intentos fallidos de contraseña: tras 10 fallos en 15 minutos, el inicio de sesión con
  contraseña para ese email se bloquea temporalmente 15 minutos (el código por email sigue
  disponible).
- El usuario cambia su email: el nuevo email debe verificarse antes de reemplazar al anterior, no
  puede pertenecer a otro usuario, y el email anterior recibe un aviso del cambio.
- Un email con distinta capitalización o espacios (`Ana@Mail.com ` vs `ana@mail.com`) se considera
  el mismo email.
- La sesión vence mientras el usuario usa la App: se le pide volver a entrar sin perder lo que
  estaba viendo.
- El email de verificación no llega: el usuario puede reenviar el código o corregir el email
  mientras siga sin verificar.

## Requirements *(mandatory)*

### Functional Requirements

**Registro e inicio de sesión**

- **FR-001**: El sistema MUST permitir registrarse e iniciar sesión con email y contraseña, en Web y
  en Mobile.
- **FR-002**: El sistema MUST permitir registrarse e iniciar sesión con una cuenta de Google, en Web
  y en Mobile.
- **FR-003**: El sistema MUST verificar el email registrado con contraseña mediante un código de un
  solo uso enviado por email, válido por 15 minutos. Hasta verificarlo, el usuario MUST NOT acceder
  a ninguna otra parte de la plataforma (incluidas invitaciones a Cuentas); solo MUST poder ingresar
  el código, reenviarlo o corregir el email.
- **FR-004**: El sistema MUST considerar verificado el email de un usuario creado con Google cuando
  Google lo informa como verificado.
- **FR-005**: El sistema MUST permitir a un usuario con email verificado iniciar sesión con un
  código de un solo uso enviado por email, válido por 15 minutos.
- **FR-006**: El sistema MUST permitir recuperar o definir la contraseña mediante un código enviado
  al email verificado; al cambiarla, MUST cerrar las demás sesiones activas del usuario.
- **FR-007**: Las contraseñas MUST tener al menos 8 caracteres y MUST NOT poder ser iguales al
  email.
- **FR-008**: Los mensajes de error de inicio de sesión, registro y recuperación MUST NOT revelar si
  un email está registrado.
- **FR-009**: El sistema MUST aplicar los límites de reenvío de códigos, intentos de código y
  bloqueo temporal de contraseña descritos en Edge Cases.
- **FR-010**: Un mismo usuario MUST poder tener vinculados ambos métodos (Google y email con
  contraseña); el sistema MUST registrar qué métodos tiene vinculados.
- **FR-011**: Cuando un email ya registrado con contraseña entra con Google y Google informa ese
  email como verificado, el sistema MUST vincular Google automáticamente al usuario existente, sin
  crear otro usuario. Si Google no informa el email como verificado, MUST NOT vincularlo.
- **FR-012**: El sistema MUST permitir cerrar la sesión del dispositivo actual.
- **FR-013**: Las sesiones MUST vencer tras 30 días sin uso, en Web y en Mobile, y MUST renovarse
  sin volver a ingresar credenciales mientras el usuario siga activo.
- **FR-014**: Las acciones de seguridad (registro, verificación, inicio de sesión, recuperación y
  cambio de contraseña, cambio de email, vinculación de métodos) MUST quedar registradas en el log
  de auditoría, sin incluir contraseñas ni códigos.

**Perfil y preferencias**

- **FR-014a**: El sistema MUST enviar un aviso por email, en el idioma del usuario, cuando se
  cambia o define la contraseña, cuando se vincula Google y cuando se cambia el email. En el cambio
  de email, el aviso MUST enviarse al email anterior. Los avisos MUST NOT incluir contraseñas ni
  códigos.
- **FR-015**: Cada usuario MUST tener un email único, sin distinguir mayúsculas ni espacios al
  inicio o al final.
- **FR-016**: Nombre y apellido MUST ser opcionales al registrarse y editables desde el Perfil.
- **FR-017**: Mientras el usuario no tenga nombre ni apellido, la plataforma MUST mostrar su email
  como identificador.
- **FR-018**: El usuario MUST poder cambiar su email; el nuevo email MUST verificarse antes de
  reemplazar al anterior y MUST NOT pertenecer a otro usuario.
- **FR-019**: El usuario MUST poder elegir el idioma de la interfaz entre español (`es`) e inglés
  (`en`); el idioma por defecto MUST ser español. Toda la interfaz y los emails MUST estar
  disponibles en ambos idiomas.
- **FR-020**: El usuario MUST poder elegir su moneda por defecto entre códigos ISO 4217; esa moneda
  MUST precargarse al crear Cuentas nuevas y MUST NOT modificar Cuentas existentes.
- **FR-020a**: Al registrarse (con email o con Google), el usuario MUST elegir su moneda por
  defecto antes de entrar al Dashboard; la opción MUST venir sugerida según la región del
  dispositivo y, si la región no se puede determinar, MUST NOT venir preseleccionada.
- **FR-021**: El usuario MUST poder elegir el tema `light`, `dark` o `system`; el valor por defecto
  MUST ser `system`.
- **FR-022**: Los cambios de idioma y tema MUST aplicarse de inmediato en el dispositivo actual y
  MUST quedar guardados en el usuario, de modo que se apliquen en cualquier otro dispositivo al
  entrar.

**Fuera de alcance de esta feature**

- Registro, inicio de sesión o verificación por número de celular, SMS o WhatsApp.
- Enlaces mágicos (magic links): se usa código de un solo uso, que funciona igual en Web y Mobile.
- Baja del usuario y exportación de sus datos (se especifican en una feature propia).
- Cierre de todas las sesiones a pedido del usuario (más allá del caso de cambio de contraseña).

### Key Entities *(include if feature involves data)*

- **User**: persona registrada. Atributos: email (único, verificado o no), nombre (opcional),
  apellido (opcional), métodos de acceso vinculados (Google, email con contraseña), si tiene
  contraseña definida, preferencias, fecha de alta y de última modificación.
- **Preferences**: parte del User. Idioma, moneda por defecto (ISO 4217) y tema
  (`light` | `dark` | `system`).
- **Verification Code**: código de un solo uso asociado a un email, con propósito (verificar email,
  iniciar sesión, recuperar contraseña, cambiar email), vencimiento y cantidad de intentos.
- **Session**: acceso activo de un usuario en un dispositivo, con vencimiento y posibilidad de
  renovación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona nueva completa el registro con Google y llega a su Dashboard en menos de
  30 segundos.
- **SC-002**: Una persona nueva completa el registro con email, incluida la verificación, en menos
  de 2 minutos.
- **SC-003**: El 95% de los emails con códigos llegan en menos de 1 minuto.
- **SC-004**: Un cambio de idioma o tema se ve en toda la interfaz en menos de 1 segundo, sin
  recargar.
- **SC-005**: Las preferencias guardadas en un dispositivo se aplican en otro en el 100% de los
  inicios de sesión.
- **SC-006**: No existen dos usuarios con el mismo email (0 duplicados, incluidas variantes de
  mayúsculas).
- **SC-007**: El 90% de los usuarios que inician el registro lo completan en el primer intento.

## Assumptions

- Los códigos de un solo uso son de 6 dígitos y los emails se envían en el idioma del usuario.
- La invitación a Cuentas y la asociación con participantes de texto libre se especifican en la
  feature de Cuentas; esta feature solo provee el usuario autenticado.
- Depende del servicio de envío de emails definido en la constitución y de la configuración del
  proveedor de Google para Web y Mobile.
