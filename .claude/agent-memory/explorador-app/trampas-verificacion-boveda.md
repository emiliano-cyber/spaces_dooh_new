---
name: trampas-verificacion-boveda
description: Dónde aparece de verdad la deriva entre la bóveda de Space OS y el código, y qué chequeos la encuentran
metadata:
  type: project
---

La bóveda de este proyecto es excelente y **caduca en días**. Los documentos que un
agente lee PRIMERO —`vault/00-Indice/MOC-Proyecto.md` y `CLAUDE.md`— son los que más
cifras falsas arrastran, porque nadie los revisa al cerrar una tarea concreta.

**Why:** la regla de «actualiza la nota en el mismo commit» se cumple para el contenido
pero no para los números, y las notas de índice no pertenecen a ninguna zona.

**How to apply:** ataca en este orden, por densidad de hallazgos:

1. **La tabla de identidad del MOC.** El 2026-09-15 tenía **cuatro** cifras mal a la vez
   (endpoints 90 vs 92, tablas 42 vs 40, migraciones 76 vs 80, ADR 24 vs 32), y
   `CLAUDE.md` copiaba tres de ellas más el número de notas (57 vs 69). Recontar cuesta
   cuatro comandos y es el hallazgo más barato que existe aquí.
2. **Notas de la misma carpeta que se contradicen entre sí.** `04-Datos/esquema.md` decía
   39 tablas y `04-Datos/migraciones.md:738` decía 42, el mismo día. Comparar notas
   hermanas encuentra lo que comparar contra el código no.
3. **Números de línea de los archivos muy citados.** `lib/server/auth.ts` es el candidato
   uno. Truco: `grep -n 'export '` y comparar con las citas, no leer línea a línea.
4. **`preguntas-abiertas.md`**: varias ya tienen respuesta en el código y siguen
   listadas (P8 el `AuthProvider`, P16 `.obsidian` en `.gitignore` — las dos resueltas y
   aún abiertas el 15/09). Contestar una es entregable valioso.
5. **Archivos de `infra/systemd/` y plantillas de workflow.** Describen el estado del
   servidor *cuando se escribieron*. `spaces-demo.service` sigue diciendo `next start`
   aunque DEMO se contenerizó el 02/09, y `promover.yml:125` sugiere en su mensaje de
   ayuda `demo.space-os.io`, que es **la máquina equivocada**.
6. **Endpoints renombrados**, no añadidos: los recuentos siguen cuadrando. Comparar
   nombre a nombre, no contar archivos.

**Dos falsos positivos que cuestan tiempo:** las rutas se escriben relativas al repo *o*
a `apps/web` (probar las dos bases), y `Test-Path` trata `[id]` como comodín, así que
hace falta `-LiteralPath` o fallan todas las rutas dinámicas de Next.

Lo que ningún script detecta: que una nota describa correctamente algo que **ya se
decidió de otra forma**. Para eso, el `docs/Traspaso_*.md` más reciente y
`git log --since` desde la fecha `actualizado:` de la nota.

Relacionadas: [[reconocimiento-space-os]] · [[codigo-muerto-alcanzable]] ·
[[medir-no-copiar-recuentos]]
