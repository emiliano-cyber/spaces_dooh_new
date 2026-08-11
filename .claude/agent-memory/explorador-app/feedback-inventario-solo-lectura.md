---
name: feedback-inventario-solo-lectura
description: Reglas del rol de reconocimiento en este proyecto - solo lectura, evidencia por afirmación, y lo desconocido va a Huecos
metadata:
  type: feedback
---

En el rol de reconocimiento/inventario: **solo lectura sobre el repo, cero sondeos a
producción o a la base, y el único archivo que se escribe es el inventario en
`vault/00-Inventario/`.**

**Why:** el usuario opera una base de producción real (`spaces_prod`) y una base demo
en el puerto 5433 donde sube datos reales; un sondeo «inofensivo» ahí no lo es. Y en
este repo hay varias sesiones a la vez, así que escribir fuera de la carpeta asignada
pisa trabajo ajeno — ya pasó tres veces en dos días (`git add -A`, cambio de rama a
mitad de un despliegue, árbol roto por edición ajena).

**How to apply:**
- Bash limitado a `ls`, `cat`, `grep`, `find`, `git log`, `git diff`, `wc`, `tree`.
  Prohibido `psql`, `npm run`, `docker`, `ssh`.
- Cada afirmación del inventario lleva su evidencia `ruta/archivo.ts:L120` o `vault/nota.md`.
- Lo que no esté en el código o la bóveda va a «Huecos y dudas», nunca se rellena con
  lo que «suele hacerse». Incluye explícitamente lo que **no se pudo verificar por las
  restricciones** — el usuario quiere saber el límite del reconocimiento.
- El entregable más valorado es la sección DESFASADO: qué dice la bóveda, qué dice el
  código hoy, y la diferencia concreta. Las tres cosas, no un «está obsoleto».

Relacionadas: [[trampas-verificacion-boveda]]
