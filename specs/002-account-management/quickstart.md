# Quickstart: validar Cuentas, Participantes e Invitaciones

Guía para comprobar la feature de punta a punta, una vez implementada. Requiere el entorno de la
feature 001 funcionando ([quickstart 001](../001-user-auth-profile/quickstart.md)). Endpoints en
[contracts/api.md](contracts/api.md), datos en [data-model.md](data-model.md).

## Preparación

1. Levantar los servicios: `docker compose up -d --build`.
2. Regenerar los tipos del contrato en los clientes:

   ```bash
   cd web && npm run gen:api
   cd mobile && npm run gen:api
   ```

3. Tener dos usuarios de prueba, A y B (por ejemplo, uno registrado con email y otro con Google).
   Para Mobile, `adb reverse tcp:8000 tcp:8000` o `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/v1`.

## Tests automáticos

| Proyecto | Comando | Qué cubre |
|---|---|---|
| Backend | `uv run pytest` (en `backend/`) | Contract: cada endpoint del contrato. Integration: permisos Owner/miembro/ajeno, nombres duplicados, vinculación concurrente, salida, cierre, baja, regeneración y auditoría |
| Web | `npm test` (en `web/`) | Formulario de Cuenta, selector de íconos, lista de participantes, panel de invitación, diálogos de confirmación, aceptación de invitación |
| Mobile | `npm test` (en `mobile/`) | Las mismas pantallas, `usePendingInvite` y el cliente de cuentas |

## Escenarios manuales

1. **Alta (US1)**: con A, crear "Vacaciones" con los participantes "Leandro" y "Javier".
   - Esperado: la moneda viene precargada con la de A; A figura como participante con su nombre;
     la Cuenta aparece en "Mis Cuentas"; en `audit_logs` hay un `account.created`.
   - Repetir con "leandro " como segundo participante: se pide corregir el nombre duplicado.
2. **Invitación (US2)**: A copia el enlace; B (sin sesión) lo abre.
   - Esperado: B tiene que entrar; al hacerlo vuelve a la invitación, ve "Leandro" y "Javier", elige
     "Leandro" y la Cuenta aparece en su panel. A sigue viendo "Leandro", no el nombre del perfil de B.
   - Abrir el enlace otra vez con B: se informa que ya es miembro.
3. **Carrera**: con dos sesiones de B y de otro usuario C, elegir "Javier" casi al mismo tiempo.
   - Esperado: uno lo obtiene; el otro ve `participant_taken` y la lista actualizada.
4. **Edición (US3)**: con B (no Owner), cambiar el nombre y el ícono, agregar "Martina" y quitar
   "Javier".
   - Esperado: A ve los cambios; "Javier" ya no figura; cada cambio está en `audit_logs` con valores
     anteriores y nuevos. Intentar quitar el participante de A: `owner_participant`.
5. **Ajeno**: con C (no miembro), pedir `GET /api/v1/accounts/<id>`.
   - Esperado: `404`, igual que con un id inexistente.
6. **Salida (US4)**: B sale de la Cuenta.
   - Esperado: desaparece de su panel; A sigue viendo "Leandro", ahora sin vincular; B puede volver a
     unirse con el enlace. A no tiene opción de salir.
7. **Regeneración**: A genera un enlace nuevo.
   - Esperado: el enlace viejo muestra "invitación no válida"; B no ve la opción de regenerar.
8. **Cierre (US5)**: A cierra la Cuenta.
   - Esperado: diálogo que avisa que es definitivo; luego nadie puede editar, agregar participantes ni
     unirse, y no hay opción de reabrir.
9. **Baja (US5)**: con otra Cuenta abierta, A elige darla de baja.
   - Esperado: diálogo con "Continuar" y "Cancelar"; con "Cancelar" no cambia nada; con "Continuar"
     desaparece del panel de A y de B, el enlace deja de funcionar y en la base queda
     `isDeleted: true`.
10. **Mobile**: repetir 1, 2 (abriendo `chepagame://invite/<code>` o pegando el código), 6 y 9 en la
    App.

## Criterio de listo

- Pasan los tests automáticos de los tres proyectos.
- Los 10 escenarios se comportan como se espera en Web y en Mobile.
