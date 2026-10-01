---
tipo: modulo
estado: en-curso
actualizado: 2026-10-01
tags: [backend, instancias, despliegue, actualizaciones, novedades]
archivos:
  - apps/web/novedades.json
  - apps/web/lib/novedades-reglas.mjs
  - apps/web/lib/novedades.ts
  - scripts/verificar-novedades.mjs
  - .github/workflows/release.yml
---

# Notas de versión

> **Pedido del dueño, 2026-10-01.** «Por cada versión nueva, los desarrolladores
> escriben qué cambió, para que cada cliente sepa qué se hizo.» Las dos
> decisiones que tomó él:
>
> - **Quién las ve:** **todo** usuario, después de instalarse la versión, en un
>   diálogo que sale **una sola vez por versión y por usuario**. El **Dueño** y
>   el **Administrador** las ven además **antes** de instalar, en el panel de
>   Actualizaciones.
> - **Tipos de nota:** exactamente tres, `NUEVO` · `AJUSTADO` · `CORREGIDO`
>   («Nuevo», «Ajustado», «Corregido»).

Hermana de [[actualizaciones-instancia]] (ADR 0037): las notas viajan por **el
mismo buzón** —la base de la instancia— y la instancia sigue **sin hablar con el
PADRE**.

## Cómo escribe un desarrollador las notas de una release

**Se edita `apps/web/novedades.json` en el MISMO PR que el cambio.** No al
publicar, no en otro commit: el PR que añade la función es el que mejor sabe
contarla, y es el único momento en que alguien la tiene fresca.

El archivo es una lista, **de la versión más nueva a la más vieja**:

```json
[
  {
    "version": "v0.9.3",
    "fecha": "2026-10-08",
    "items": [
      { "tipo": "NUEVO",     "texto": "Lo que el cliente puede hacer que antes no podía." },
      { "tipo": "AJUSTADO",  "texto": "Lo que ya existía y ahora funciona distinto." },
      { "tipo": "CORREGIDO", "texto": "Lo que fallaba y ya no." }
    ]
  },
  { "version": "v0.9.2", "fecha": "2026-10-01", "items": [ … ] }
]
```

- **Se escribe para el cliente, no para el equipo.** En español llano, sin
  nombres de archivo ni de tabla. «Ahora puedes…», no «se añadió el endpoint…».
- Si el PR no trae nada que el cliente note, **no añade item** — pero la
  versión que se publique tendrá que traer al menos uno (ver la puerta).
- Si la entrada de la versión siguiente aún no existe, la crea el primer PR que
  la necesite, **arriba del todo**.

### Lo que hace válido el archivo

Lo decide **una sola copia** de las reglas, `apps/web/lib/novedades-reglas.mjs`
(por qué es `.mjs` y no `.ts`: su cabecera — la usan la aplicación y el script
de la release, que corre sin TypeScript). `apps/web/lib/novedades.ts` la
reexporta con tipos.

| Regla | Por qué |
|---|---|
| `version` es `vX.Y.Z` a secas | Las notas son de una versión, no de cada precandidata. `v0.9.2-rc1` **lee** las de `v0.9.2` |
| `fecha` es una fecha **real** `AAAA-MM-DD` | `2026-02-30` casa con el patrón y no es ningún día |
| Solo los tres tipos | Decisión del dueño |
| Texto no vacío | Un item vacío pinta una viñeta sin nada |
| Al menos un item por versión | Sin eso, la puerta de la release se cumpliría sin decir nada |
| **Ningún campo de más** | Un typo (`fehca`) ignorado en silencio deja la entrada sin fecha |
| Sin versiones repetidas, la más nueva primero | El orden compara **números**: `v0.10.0` va antes que `v0.9.2` |

Se juntan **todos** los errores de una vez: quien arregla el archivo en un PR
prefiere verlos juntos que descubrirlos de uno en uno.

## La puerta: no se publica una versión sin sus notas

`release.yml`, job `pruebas`, **lo primero tras tener node y antes del
`npm ci`**: `node scripts/verificar-novedades.mjs "$VERSION"`.

- Sale con **0** si el archivo entero es válido y trae la entrada del tag.
- Sale con **1** si falta la entrada, si el archivo no se lee, no es JSON o no
  es válido — y el error dice qué entrada añadir y dónde.
- Sale con **2** si la versión no es `vX.Y.Z[-sufijo]` (error de uso).

Va **antes** de la suite a propósito: es la comprobación más barata del
workflow y la que más fácil se olvida. Detrás de las e2e costaría hasta 45
minutos descubrir que faltaba un párrafo. Y valida el archivo **entero**, no solo
que exista la entrada: un archivo inválido llegaría a la imagen y la aplicación
—con las mismas reglas— lo descartaría en silencio.

Probado como **proceso** (`scripts/verificar-novedades.test.ts`), igual que el
runner de migraciones: lo que mira el `set -e` del CI es el código de salida. La
misma prueba lee `release.yml` y falla si el paso desaparece o se mueve detrás
del `npm ci`.

## Relacionadas
[[actualizaciones-instancia]] · [[02-Backend/_indice|Índice de Backend]] ·
[[entorno-y-despliegue]]
