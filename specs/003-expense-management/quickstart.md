# Quickstart: validar Gastos y Log de Auditoría

Guía para comprobar la feature de punta a punta, una vez implementada. Requiere el entorno de las
features 001 y 002 funcionando ([quickstart 002](../002-account-management/quickstart.md)). Endpoints
en [contracts/api.md](contracts/api.md), datos en [data-model.md](data-model.md).

## Preparación

1. Levantar los servicios: `docker compose up -d --build` (al iniciar, el backend crea los índices
   nuevos de `expenses` y `audit_logs`).
2. Regenerar los tipos del contrato en los clientes:

   ```bash
   cd web && npm run gen:api
   cd mobile && npm run gen:api
   ```

3. En Mobile, instalar la dependencia nueva con `npx expo install @react-native-community/datetimepicker`
   y recompilar el development build.
4. Tener dos usuarios, A y B, miembros de la Cuenta "Vacaciones" (ARS) con los participantes A,
   "Leandro" (vinculado a B) y "Javier" (libre). Para probar monedas sin decimales, una segunda
   Cuenta en JPY.

## Tests automáticos

| Proyecto | Comando | Qué cubre |
|---|---|---|
| Backend | `uv run pytest` (en `backend/`) | Unit: `split_equal` (centavos no divisibles, un participante, pagador que no participa), parseo de importes por moneda (0, 2 y 3 decimales, máximo). Contract: cada endpoint del contrato. Integration: permisos de miembro y ajeno, Cuenta Cerrada, `version` en conflicto, reintento con `clientRequestId`, remoción de participante (pagador vacío, redistribución, pendiente, transacción completa), auditoría e historial legible. Perf: listado de 500 gastos |
| Web | `npm test` (en `web/`) | `parseAmountInput`, formulario de gasto, listado agrupado por día con carga por partes, detalle con partes e historial, diálogos de eliminar y de quitar participante |
| Mobile | `npm test` (en `mobile/`) | Las mismas piezas, más `RefreshControl` y la recarga al volver a la pantalla |

## Escenarios manuales

1. **Alta (US1)**: con A, nuevo gasto "Cena", 100,00, sin tocar nada más.
   - Esperado: fecha de hoy, pagador A y los tres participantes precargados; el detalle muestra
     33,34 / 33,33 / 33,33 (el centavo va al primero según el orden de la Cuenta); en `audit_logs` hay
     un `expense.created` con `accountId`.
   - Intentar 0, -5, 10,555 y un concepto solo con espacios: se rechazan con mensajes claros.
2. **Moneda sin decimales**: en la Cuenta JPY, cargar 1000 entre tres.
   - Esperado: el campo no acepta decimales; partes 334 / 333 / 333.
3. **Listado (US2)**: cargar gastos en tres días distintos, uno con fecha futura.
   - Esperado: grupos por día del más reciente al más antiguo, el último cargado primero dentro del
     día; cada fila con ícono, concepto, pagador e importe; el total de la Cuenta arriba.
4. **Carga por partes**: con un script, crear 120 gastos en la Cuenta y bajar por el listado.
   - Esperado: aparecen de a 50; el total arriba ya refleja los 120 desde el inicio; un día repartido
     entre dos partes se ve como un solo grupo; ningún gasto se repite.
5. **Sin actualización automática**: B carga un gasto mientras A tiene la Cuenta abierta.
   - Esperado: A no lo ve hasta deslizar para actualizar (Mobile), tocar "Actualizar" (Web) o volver a
     la pantalla.
6. **Edición y conflicto (US3)**: A y B abren el mismo gasto; B cambia el importe a 120,00 y guarda;
   luego A cambia el concepto y guarda.
   - Esperado: A recibe el aviso de que el gasto cambió y ve la versión de B; no pierde el cambio de B.
7. **Eliminación (US3)**: B elimina un gasto que cargó A.
   - Esperado: diálogo con "Continuar" y "Cancelar"; con "Continuar" deja de figurar para ambos, el
     total baja y en la base queda `isDeleted: true` con un `expense.deleted`.
8. **Historial (US5)**: abrir el gasto editado en 6.
   - Esperado: alta y modificación, la más reciente primero, con el nombre de participante de quien
     las hizo, la fecha y hora, y "100,00 → 120,00".
9. **Quitar participante (US4)**: cargar un gasto pagado por "Javier" y otro compartido solo por
   "Javier"; luego quitar a "Javier".
   - Esperado: el diálogo dice cuántos gastos se verán afectados; después, el primero queda sin
     pagador y el segundo sin participantes, ambos "pendiente de asignación"; los gastos que
     compartía con otros se reparten entre los restantes; el historial muestra el ajuste como
     automático, hecho por quien quitó a "Javier".
   - Editar un gasto pendiente: obliga a elegir pagador y participantes.
10. **Cuenta Cerrada**: A cierra la Cuenta.
    - Esperado: no hay botones para cargar, editar ni eliminar; `POST`/`PUT`/`DELETE` directos a la
      API responden `409 account_closed`; el listado y el detalle se siguen viendo.
11. **Ajeno**: con un usuario C que no es miembro, pedir `GET /api/v1/accounts/<id>/expenses` y el
    detalle de un gasto.
    - Esperado: `404`, igual que con ids inexistentes.
12. **Reintento**: con las herramientas del navegador, cortar la red justo al guardar un alta y
    reintentar.
    - Esperado: un solo gasto creado.
13. **Mobile**: repetir 1, 3, 5, 6, 7 y 9 en la App.

## Criterio de listo

- Pasan los tests automáticos de los tres proyectos, incluido el de rendimiento.
- Los 13 escenarios se comportan como se espera en Web y en Mobile.
- Ningún log de la aplicación contiene títulos, importes ni nombres de participantes.
