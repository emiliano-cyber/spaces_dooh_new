---
name: medir-no-copiar-recuentos
description: En Space OS todo recuento se mide con el comando puesto al lado; los conteos de pruebas por grep son estáticos y hay que decirlo
metadata:
  type: feedback
---

**Todo recuento que entre en un entregable se vuelve a medir, y se dice con qué comando
se midió. Si no se pudo medir, se dice eso en vez de dar la cifra del documento.**

**Why:** el usuario ha visto a `CLAUDE.md` y al MOC arrastrar cifras falsas varias veces
—seis a la vez durante dieciocho días— y en este repositorio una afirmación sin medición
se copia a tres documentos más antes de que alguien la compruebe. El caso caro del
2026-09-02: un commit afirmó «v0.1.0 promovida a estable», nadie lo midió, y tres
documentos lo repitieron durante un día sobre algo que no había ocurrido.

**How to apply:**
- Antes de escribir un número, córrelo: `find … | wc -l`, `grep -c`, `ls | wc -l`.
- **Los conteos de pruebas por `grep` son ESTÁTICOS y hay que marcarlo.** Un `it.each`
  cuenta uno con grep y varios en el runner, así que el número real es *igual o mayor*.
  En reconocimiento no se corre `npm test`, así que se entrega el estático **con la
  advertencia y con el comando** para medirlo de verdad.
- Cuando dos documentos del repo dan cifras distintas, **dilo explícitamente señalando
  los dos**, no elijas el que parezca más nuevo.
- Un cierre se declara con la salida del run delante, no con la tarea escrita.

Relacionadas: [[trampas-verificacion-boveda]] · [[feedback-inventario-solo-lectura]]
