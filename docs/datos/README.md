# Correcciones de DATOS en producción

Scripts de un solo uso que se ejecutaron **a mano contra `spaces_prod`**, con su
rollback al lado. No son migraciones.

**No van en `db/migrations/`** a propósito: aquéllas describen el ESQUEMA y se
aplican a cualquier entorno. Éstas tocan filas concretas de un tenant concreto,
con UUID escritos a mano; correrlas en otro entorno no haría nada útil, y
correrlas dos veces en el mismo tampoco es lo que se quiere.

Están aquí para que quede rastro de qué se cambió, cuándo y cómo deshacerlo:
un cambio de datos no aparece en `git log` de ninguna otra forma.

## Convenciones

- Un par de archivos por intervención: `<fecha>_<asunto>.sql` y su
  `<fecha>_<asunto>_rollback.sql`.
- El rollback se captura **antes** de aplicar, leyendo los valores previos
  reales — no se escribe de memoria.
- Todo por **id explícito**. Nunca `where nombre like 'TEST%'`: un patrón así
  alcanza mañana un registro nuevo del usuario.
- Antes de aplicar, pasada en seco: el mismo archivo con `commit` cambiado por
  `rollback`, comprobando que el número de filas tocadas es el previsto.

## Historial

| Fecha | Archivo | Qué hizo |
|---|---|---|
| 2026-08-04 | `20260804_a9_limpieza_datos_prueba_g500.sql` | Hallazgo **A9** de la auditoría QA: quitó los rastros de prueba visibles en la demo del tenant G500 (prefijos `TEST_`, nombres `WhatsApp Image…`) y corrigió de paso el rango de fechas invertido de la campaña que sostenía el importe negativo de **C2**. 13 filas. Rollback: `20260804_a9_rollback_g500.sql`. |
