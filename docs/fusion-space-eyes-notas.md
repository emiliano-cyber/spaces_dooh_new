# Fusionar `fix/space-eyes-fotos-rapidas` con `main` — notas medidas

> **Al día (11-nov-2026): `main` ya está fusionado DENTRO de la rama**, en
> `8441031e` (v0.12.9). Fusionar la rama en `main` ahora entra **sin conflictos**:
> lo de abajo es historia de la primera fusión (la del 9-nov, PR #109).
>
> En esa fusión se resolvió el único choque (`space-eyes-se.ts`: las funciones de
> traducción de `main` + la espera máxima de la rama) y se dejó hecho lo que
> quedaba pendiente: el aviso «el Space Eye de esta instancia todavía no los
> tiene» va con `t(...)` en los cuatro idiomas, y «gabinete apagado» pasa a
> «apagado o tapado» en el diccionario, igual que en `Monitor.kt` (los nombres
> de antes se siguen traduciendo). 440 archivos de prueba de `apps/web` en verde.

Escrito el 9-nov-2026 contra `main` en `dfa64dcf` (v0.12.7) y la rama en
`5d20c378`. La base común es `0101ee4e`, del 26 de octubre: `main` lleva 610
commits que la rama no tiene.

**29 archivos en conflicto, todos en `apps/web`. En `space-eye/` no hay
ninguno**, así que todo el servidor y los agentes entran limpios.

## Lo primero, porque ya me pasó

El atajo de resolver sustituyendo líneas **borra en silencio todo lo que es
añadido puro**: una tarjeta nueva, un panel nuevo, una función nueva no tienen
línea vieja a la que agarrarse, así que no entran, el archivo queda sin marcas
de conflicto y parece resuelto. Lo probé y perdí la tarjeta de avisos entera y
las 247 líneas del panel de imagen sin una sola señal.

Después de resolver cada archivo de Space Eyes, comprobar que su añadido sigue
ahí. La tabla de abajo dice cuál es.

## Los 16 de otros módulos: tomar `main`, menos uno

Medido, no supuesto: de las 66 sustituciones que la rama les hace, **65 ya están
en `main`**. Son la tanda de encabezados, grises y márgenes de la semana pasada.

```
captacion/page.tsx                 codigos-promocionales/page.tsx
comercial-opex/page.tsx            descuentos-por-volumen/page.tsx
disponibilidad/page.tsx            franjas-y-temporadas/page.tsx
inventario/page.tsx                paquetes/page.tsx
demo/captacion/Captacion.tsx       demo/codigos/GestionCodigos.tsx
demo/paquetes/GestionPaquetes.tsx  demo/rejilla/GestionRejilla.tsx
demo/rejilla/ProgramacionPorFranja.tsx
demo/volumen/GestionVolumen.tsx
```

**La excepción es `components/operaciones/OTVista.tsx`**: el encabezado
`text-2xl text-ink` de la rama **no** está en `main` (línea 336 sigue con
`text-lg font-semibold`). Ahí hay que reaplicarlo, en los dos sitios.

**`novedades.json`** se resuelve a mano: las dos ramas agregaron entradas y
las dos sirven. Ojo con la versión — la `v0.12.0` de la rama ya existe en `main`
desde el 21 de octubre, y `main` va por la v0.12.7.

## Los 13 de Space Eyes: `main` manda en el texto, la rama en la función

Chocan siempre por lo mismo: `main` tiene el `t('…')` y la rama tiene el cambio.
**Se queda el `t(…)` de `main` y encima va lo de la rama.** Fusionar a lo bruto
borra el portugués y el italiano.

| Archivo | Neto | Qué aporta la rama, y hay que comprobar que quede |
|---|---|---|
| `EquipoAdmin.tsx` | **+263** | El panel de imagen enseña **solo lo que ese tipo de equipo aplica de verdad** (`cap.*`), y el **brillo de noche por horario**. Comprobar: `enfoque_fijo`, `cap.noche`, `Bajar la luz de noche automáticamente`. |
| `CreativosConfig.tsx` | +32 | La ficha del creativo enseña **«Apareció» y «Ahora»** (`ultima_storage_path`). |
| `PantallaYCreativos.tsx` | +22 | Lo que falta para que el equipo vigile, dicho en su sitio. |
| `FallasFlota.tsx` | +18 | La tarjeta **`<AvisosCorreo />`**, el helper **`porQuien`** y `cerrada_por` con `'servidor'`. |
| `Programacion.tsx` | +7 | Arranque de pantalla y colores de botón. |
| `AltaDispositivo.tsx` | +5 | «Generar código» en verde, «Descargar» en neutro. |
| `VistaEnVivo.tsx` | +5 | Colores de botón. |
| `Galeria.tsx` | +4 | «Descargar álbum» y «Descargar» en neutro. |
| `CampanasEyes.tsx` | +3 | Encabezado y colores. |
| `page.tsx` (`[id]`) | 0 | Encabezado. |
| `Verificacion.tsx` | 0 | Colores. |
| `AjustarTexto.tsx` | −1 | «Tomar fotografía» en verde. |
| `Graficas.tsx` | −1 | Encabezado y arranque. |

Archivos **nuevos** de la rama, sin conflicto posible:
`components/demo/space-eyes/AvisosCorreo.tsx` y
`lib/server/space-eyes-avisos.test.ts`. El de la puerta,
`app/api/space-eyes/se/[...ruta]/route.ts`, tampoco conflictúa.

## Las traducciones

El lote está escrito y comprobado: **`docs/lote-i18n-space-eyes-avisos.ts`**, 53
claves en español, inglés, italiano y portugués, con los mismos huecos `{…}` en
los cuatro y el español literal de lo que dicen los componentes.

Va al final de cada diccionario de `apps/web/lib/i18n/textos/spaceeyes.ts`
(`ES_SPACEEYES`, `EN_SPACEEYES`, `IT_SPACEEYES`, `PT_SPACEEYES`) **después** de
fusionar, que es cuando ese archivo existe en la rama.

Al aplicarlo quedan dos cosas: pasar los literales de `AvisosCorreo.tsx` y del
bloque de noche de `EquipoAdmin.tsx` a `t('…')`, y actualizar el volcado de
`pantallas-spaceeyes.test.ts`.

El vocabulario del panel de imagen —brillo, contraste, saturación, nitidez,
exposición, los balances de blancos— **ya está en `main`**: se comprobó clave por
clave y por eso no está en el lote.

## Al desplegar

- **La migración `031_avisos_por_correo.sql` se aplica sola en las instancias**
  (`update-eyes.sh` corre `dist/migrar.js` antes de cambiar de versión). En el
  `:4000` de producción **va a mano**: ahí no corre ese guion.
- **El agente de Raspberry 0.7.11** (lleva el arreglo de la cámara y la hora del sitio) hay que
  publicarlo en `frontend/public/` del servidor. El manifiesto se copia **al
  final**, o los equipos rechazan la actualización.
- **El correo no manda nada** hasta que el dominio del remitente esté verificado
  en Resend y la llave esté puesta en el panel (Fallas → Avisos por correo).
- **Antes de soltar el portero de creativos**, medir contra el catálogo de
  producción. Cambia el comportamiento de toda la flota y, si los umbrales se
  quedaran cortos, un sitio dejaría de registrar creativos de verdad sin que
  nadie se entere. El margen está medido sobre 43 fotos de una instancia y de
  día: el creativo más flojo tiene variación 22.9 y brillo 45.2, contra umbrales
  de 14 y 40.
