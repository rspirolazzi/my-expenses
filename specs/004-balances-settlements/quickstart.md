# Quickstart: validar Saldos y Reembolsos

Esta guía sirve para comprobar la feature de punta a punta una vez implementada.

Requiere el entorno de la feature 003 funcionando ([quickstart 003](../003-expense-management/quickstart.md)).
Los endpoints están en [contracts/api.md](contracts/api.md) y los datos en [data-model.md](data-model.md).

## Preparación

1. Levantar los servicios con `docker compose up -d --build`. Al arrancar, el backend crea los
   índices de `settlements`.
2. Regenerar los tipos en los clientes. Cada comando va desde la raíz del repositorio:

   ```bash
   cd web && npm run gen:api
   ```

   ```bash
   cd mobile && npm run gen:api
   ```

   No hay dependencias nuevas, así que no hace falta recompilar el development build.
3. Tener dos usuarios, A y B, que sean miembros de la Cuenta "Vacaciones" (ARS). La Cuenta tiene
   tres participantes: A, "Leandro" (vinculado a B) y "Javier" (sin usuario).
4. Tener una segunda Cuenta en USD y una tercera en JPY.

## Tests automáticos

| Proyecto | Comando | Qué cubre |
|---|---|---|
| Backend | `uv run pytest` (en `backend/`) | **Unit:** `compute_balances` (centavos no divisibles, un participante, pagador que no participa, gasto pendiente sin pagador o sin participantes, gastos eliminados, reembolso mayor que la deuda, participante quitado con reembolsos, participante desvinculado, suma cero con datos aleatorios); `suggest_transfers` (≤ N−1, determinismo, pares exactos, saldos en cero, monedas sin decimales). **Contract:** cada endpoint. **Integration:** permisos de miembro y de ajeno, Cuenta Cerrada (también la carrera con el cierre), participante quitado (también la carrera con la remoción), idempotencia, doble baja, auditoría, `myBalance` en `GET /accounts`. **Perf:** saldos con 500 gastos y 100 reembolsos; listado de Cuentas con 20 Cuentas |
| Web | `npm test` (en `web/`) | `totalsByCurrency`, pestañas, vista de saldos (fila propia destacada, aviso de pendientes, sin deudas), diálogo de "Marcar como pagado", formulario manual, eliminar con confirmación, resumen del panel |
| Mobile | `npm test` (en `mobile/`) | Las mismas piezas, más `RefreshControl` y la recarga al volver a la pantalla |

## Escenarios manuales

1. **Saldos (US1)**: A paga 90,00 entre los tres.
   - Esperado en la pestaña "Saldos": A +60,00 ("Te deben 60,00", destacado), Leandro −30,00 y
     Javier −30,00.
2. **Pendientes**: cargar un gasto y quitar a todos sus participantes, quitando un participante de
   prueba.
   - Esperado: no cambian los saldos y aparece el aviso "1 gasto pendiente". El aviso lleva a la
     pestaña "Gastos", donde el gasto figura marcado como pendiente.
3. **Sugerencias (US2)**:
   - Esperado: dos sugerencias, Leandro → A 30,00 y Javier → A 30,00. Recargar varias veces da
     siempre las mismas.
   - "Marcar como pagado" en la primera: el diálogo muestra los datos fijos. Al confirmar, Leandro
     queda en 0,00 y queda una sola sugerencia.
4. **Manual (US3)**: registrar Javier → A 10,00.
   - Esperado: Javier −20,00 y A +50,00.
   - Probar mismo participante en las dos puntas, 0, 10,555 y un importe mayor que la deuda: los
     tres primeros se rechazan y el último se acepta.
5. **Eliminar (US4)**: eliminar el reembolso de Leandro y confirmar con "Continuar".
   - Esperado: la sugerencia vuelve a aparecer.
   - Con B, en otra sesión, intentar eliminarlo otra vez: aviso de que ya no existe.
6. **Participante quitado**: registrar Javier → A 5,00 y después quitar a Javier.
   - Esperado: el reembolso sigue en la lista marcado como de un participante quitado, no cuenta, y
     la suma de saldos sigue en cero.
7. **Cuenta Cerrada**: cerrar la Cuenta.
   - Esperado: sin botones para registrar ni eliminar; saldos, sugerencias y lista visibles.
   - Un `POST` directo a la API responde `409 account_closed`.
8. **Panel (US5)**: con saldos en la Cuenta ARS, en la USD y en otra Cuenta ARS ya Cerrada.
   - Esperado: cada Cuenta muestra su saldo con su moneda, la Cerrada aparece marcada, y "Te deben"
     y "Debés" se separan por moneda e incluyen la Cuenta Cerrada.
9. **Ajeno**: con un tercer usuario que no es miembro, pedir `GET .../balances`.
   - Esperado: `404`.
10. **Mobile**: repetir los pasos 1, 3, 4, 5 y 8 en la App.
    - Esperado: el mismo comportamiento y pull-to-refresh en la pestaña "Saldos".
11. **Idiomas**: cambiar a inglés y revisar los textos y el formato de los importes.
