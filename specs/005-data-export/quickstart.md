# Quickstart: validar Exportar datos

Esta guía sirve para comprobar la feature de punta a punta una vez implementada.

Requiere el entorno de la feature 004 funcionando ([quickstart 004](../004-balances-settlements/quickstart.md)).
Los endpoints están en [contracts/api.md](contracts/api.md) y el contenido de los archivos en
[data-model.md](data-model.md).

## Preparación

1. Levantar los servicios con `docker compose up -d --build`. No hay índices ni colecciones nuevas.
2. Regenerar los tipos en los clientes. Cada comando va desde la raíz del repositorio:

   ```bash
   cd web && npm run gen:api
   ```

   ```bash
   cd mobile && npm run gen:api
   ```

3. Mobile suma `expo-sharing` y declara `expo-file-system`, que son módulos nativos. Recompilar el
   development build:

   ```bash
   cd mobile && npx expo run:android
   ```

4. Tener la Cuenta "Vacaciones" (ARS) del ejemplo de la feature 004, con A, "Leandro" (vinculado a
   B) y "Javier" (sin usuario): A paga 90,00 entre los tres y Leandro le reembolsa 30,00. Saldos
   esperados: A +30,00, Leandro 0,00 y Javier −30,00.
5. Tener además una Cuenta en USD Cerrada y una en JPY, y un usuario C que no es miembro de
   "Vacaciones".

## Tests automáticos

| Proyecto | Comando | Qué cubre |
|---|---|---|
| Backend | `uv run pytest` (en `backend/`) | **Unit:** `build_account_export` (partes que suman el importe con centavos no divisibles, saldos que suman cero e iguales a `GET .../balances`, moneda sin decimales, gasto pendiente, reembolso excluido por participante quitado, participante desvinculado, Cuenta vacía); `render_csv_zip` (BOM, separadores, comillas, saltos de línea, emojis, inyección de fórmulas solo en texto libre, encabezados en es y en, siete archivos y carpeta por Cuenta); `render_json` (claves estables, importes como texto); slug y nombre de archivo. **Contract:** los dos endpoints, headers y `422`. **Integration:** miembro, ajeno (`404` sin auditoría), Cuenta Cerrada, Cuentas abandonadas y dadas de baja fuera de "todos mis datos", usuario sin Cuentas, auditoría de cada exportación, ningún email ajeno ni id de usuario en los archivos. **Perf:** una Cuenta con 500 gastos y 100 reembolsos; 20 Cuentas de 500 gastos |
| Web | `npm test` (en `web/`) | `ExportButton` (menú de formatos, progreso, botón desactivado durante la descarga, error con reintento), los dos Route Handlers (sin sesión, error del backend, headers reenviados) y la sección del Perfil |
| Mobile | `npm test` (en `mobile/`) | `ExportButton` con `requestFile`, `expo-file-system` y `expo-sharing` simulados: progreso, doble toque, error con reintento, hoja de compartir cerrada sin elegir |

## Escenarios manuales

1. **JSON de una Cuenta (US1)**: en "Vacaciones", tocar "Exportar" y elegir "JSON".
   - Esperado: se descarga `mis-gastos_vacaciones_<fecha>.json` en dos clics. Tiene el gasto de
     90.00 con tres partes de 30.00, el reembolso de Leandro a A y los saldos `30.00`, `0.00` y
     `-30.00`, que suman cero. No hay emails ni el código de invitación.
2. **CSV de una Cuenta (US1)**: elegir "CSV (planilla)".
   - Esperado: un ZIP con `cuenta.csv`, `participantes.csv`, `gastos.csv`, `partes.csv`,
     `reembolsos.csv`, `saldos.csv` y `sugerencias.csv`. Abrir `gastos.csv` en una planilla: los
     acentos se ven bien y el importe es 90.00. Si la planilla está en español y muestra 9000,
     usar "Importar CSV" con punto decimal (supuesto de la spec).
3. **Caracteres especiales**: cargar un gasto con concepto `=SUMA(1;2)`, otro con
   `Cena, "postre"` y un salto de línea en la descripción, y otro con un emoji. Exportar en CSV.
   - Esperado: la planilla muestra el texto `=SUMA(1;2)` sin calcularlo; las comas, comillas,
     saltos de línea y emojis se ven bien.
4. **Pendientes y excluidos**: quitar un participante que tenga un reembolso y deje un gasto sin
   pagador. Exportar.
   - Esperado: el reembolso sale con "Excluido: Sí" y el gasto con "Pendiente: Sí", igual que en la
     aplicación; el participante sale con "Quitado: Sí".
5. **Cuenta Cerrada**: exportar la Cuenta en USD.
   - Esperado: funciona igual y `cuenta.csv` dice "Cerrada: Sí".
6. **Inglés**: cambiar el idioma del Perfil a English y exportar en CSV.
   - Esperado: archivos `account.csv`, `expenses.csv`, ...; encabezados y "Yes"/"No" en inglés;
     importes y fechas iguales que en español. El archivo se llama `my-expenses_...`.
7. **Moneda sin decimales**: exportar la Cuenta en JPY.
   - Esperado: importes sin decimales (`1500`).
8. **Ajeno**: con el usuario C, pedir `GET /api/v1/accounts/<id de Vacaciones>/export?format=json`
   con su token, desde la documentación de la API (`/api/v1/docs`).
   - Esperado: `404 not_found` y ninguna entrada de auditoría nueva.
9. **Todos mis datos (US2)**: con A, ir al Perfil y elegir "Exportar mis datos" en JSON y en CSV.
   - Esperado: el perfil con el email de A y las tres Cuentas, cada importe con su moneda. En el
     ZIP, `perfil.csv` y una carpeta por Cuenta. Si A abandona una Cuenta o el dueño la da de baja,
     ya no aparece. Un usuario sin Cuentas recibe solo su perfil.
10. **Mobile**: repetir los escenarios 1, 2 y 9 en la App.
    - Esperado: se abre la hoja de compartir del sistema con el archivo; guardarlo o enviarlo por
      otra App funciona. Cerrar la hoja sin elegir no muestra error.
11. **Progreso y errores**: con el backend detenido (`docker stop myexpenses-backend`), exportar.
    - Esperado: el botón muestra el progreso y no responde a un segundo toque; después aparece un
      error claro con "Reintentar". Al volver a levantar el backend, reintentar funciona.
12. **Auditoría**: consultar `audit_logs` en MongoDB.
    - Esperado: una entrada `account.exported` o `user.data_exported` por cada exportación exitosa,
      con el formato y sin datos exportados.

## Tiempos

| Caso | Objetivo |
|---|---|
| Una Cuenta con 500 gastos y 100 reembolsos | < 5 s hasta tener el archivo (SC-003); la API, p95 < 1 s |
| 20 Cuentas de 500 gastos | < 15 s (SC-004); la API, p95 < 3 s |
