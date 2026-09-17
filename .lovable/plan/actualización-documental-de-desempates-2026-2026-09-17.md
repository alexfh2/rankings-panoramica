# Actualización documental de desempates 2026

## Alcance
- Sustituir únicamente los cuatro textos de desempate en `src/data/competitionRules.ts` por el contenido literal facilitado.
- Crear cuatro PDF versionados con sufijo `v20260917b`, manteniendo los originales y alterando solo el apartado de desempate general.
- Actualizar únicamente las cuatro URLs de PDF para apuntar a las nuevas versiones.

## Validación
- Comparar el texto extraído de cada PDF antiguo y nuevo para confirmar que solo cambia el desempate general.
- Revisar visualmente todas las páginas de los cuatro PDF y corregir cualquier solapamiento o corte.
- Confirmar la secuencia: total → última prueba → mayor número de pruebas → anteriores → Comité.
- Ejecutar los tests existentes y comprobar build/typecheck, sin modificar archivos de ranking ni sus tests.
