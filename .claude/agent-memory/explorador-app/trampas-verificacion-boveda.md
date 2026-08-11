---
name: trampas-verificacion-boveda
description: Dónde aparece de verdad la deriva entre la bóveda de Space OS y el código, y qué chequeos la encuentran
metadata:
  type: project
---

La bóveda de este proyecto es excelente y **caduca en días**: se escribió el 07/08 y
en cinco horas quedaron obsoletas cuatro afirmaciones.

**Why:** hay varias sesiones de agentes trabajando en paralelo sobre el mismo repo, y
la regla de «actualiza la nota en el mismo commit» se cumple para el contenido pero
no para los números.

**How to apply:** cuando verifiques la bóveda contra el código, ataca en este orden —
está ordenado por densidad de hallazgos:

1. **Números de línea de los archivos muy citados.** `lib/server/auth.ts` es el
   candidato número uno: cambió de tamaño tres veces en un día y arrastró ocho citas
   de cinco notas distintas. Ninguna cita rota da error; solo manda al sitio erróneo.
   Truco: `grep -n 'export function\|export async function'` sobre el archivo y
   comparar con las citas, en vez de leer línea a línea.
2. **`wc -l` de los archivos grandes de `lib/server/`.** Crecen rápido y esa tabla se
   usa para estimar conflictos entre agentes.
3. **Endpoints renombrados**, no añadidos. Los recuentos siguen cuadrando cuando una
   ruta se renombra (`leer-todas` → `archivar-todas`), así que contar archivos no lo ve.
   Compara la tabla de `api-endpoints.md` con `find app/api -name route.ts` nombre a nombre.
4. **Notas de módulo que describen una UI anterior.** El diario suele estar al día y
   las notas de `03-Frontend/` no. Compara el diario más reciente con `03-Frontend/`.
5. **`preguntas-abiertas.md`**: varias preguntas ya tienen respuesta en el código o en
   el diario y siguen listadas como abiertas. Contestar una es entregable valioso.

Lo que ningún script detecta: que una nota describa correctamente algo que ya se
decidió de otra forma. Para eso, `git log --since` desde la fecha `actualizado:` de
la nota + `docs/Registro_Cambios.md`.

Relacionadas: [[reconocimiento-space-os]] · [[codigo-muerto-alcanzable]]
