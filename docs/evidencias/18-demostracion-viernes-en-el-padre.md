# La demostración del viernes se hace en el PADRE, con `rgb` — decidido el 2026-09-23

> Decisión del dueño, tomada la noche del 23/09. Sustituye a todo lo que este
> repositorio daba por supuesto sobre dónde se presenta.

## Qué se enseña y dónde

| | |
|---|---|
| Máquina | **el PADRE** — su propia aplicación, puerto 3000 |
| Organización | **`rgb`** (RGB Catorce) |
| Base | `spaces` |
| Qué se enseña | el **panel de flota** y otras situaciones |
| Por qué ahí | **es la que tiene Google configurado** |

**Esto descarta las dos alternativas que se barajaron:** ni el portátil con
`spaces_ver2`, ni DEMO. Y con ello **el caso de rentabilidad del guion del Summit
no entra en esta demostración**: vive en `spaces_ver2`, en el portátil, y llevarlo
a otra base es trabajo aparte que aquí no hace falta.

## El hecho que lo ordena todo, y que se entendió mal durante horas

**El PADRE NO corre desde una imagen.** `infra/systemd/spaces-web.service:83`:

```
ExecStart=/usr/local/bin/node /var/www/Spaces/node_modules/next/dist/bin/next start -p 3000
WorkingDirectory=/var/www/Spaces/apps/web
```

Arranca **desde el checkout del repositorio**, no desde el registro de imágenes.
Consecuencia, y es la que importa:

> **Actualizar el PADRE no necesita publicar una versión ni promover nada.**
> Es `git pull` + `npm run build` + `systemctl restart spaces-web`.

**Por eso el rediseño de bordes SÍ puede llegar al viernes.** Durante un rato se
razonó por el camino de las instancias —imagen, registro, promoción— y se
concluyó que no llegaba. El PADRE no usa ese camino: llega con tres comandos.

## La secuencia, en este orden y sin saltarse ninguno

### 0 · Empujar desde el portátil

Al escribir esto, `main` local va **12 commits por delante del remoto**: el
rediseño de botones, el guard de `@pg-min` y el expediente de g500. Sin empujar,
el `git pull` del PADRE no trae nada.

### 1 · Desactivar la mina del checksum — ANTES de migrar

Anotar `-- @pg-min: 15` en `20260918_entidad_tenant_compuesto.sql` —una migración
**ya aplicada**— le cambió el checksum. Toda base que la tenga registrada saldrá
con **código 3 y no aplicará nada**.

Y **`update.sh` no tiene ninguna ruta para resolverlo**: medido, cero
coincidencias de `forzar-checksum` en el archivo; el código 3 es abortar
(`update.sh:2423`). Hay que darla a mano, una vez por base:

```bash
cd /var/www/Spaces
git pull
node scripts/migrar.mjs --forzar-checksum=20260918_entidad_tenant_compuesto.sql
```

Con el `DATABASE_URL` de la base del PADRE delante, que sale de
`/etc/space-os/padre.env`.

> **Por qué aquí la bandera es la correcta**, al revés que en el caso del árbol
> en CRLF donde grababa una mentira: el archivo se reescribió a conciencia, el
> cambio es **una línea de comentario** sin una sola sentencia SQL tocada, y la
> base ya tiene aplicado exactamente lo que el archivo describe.

**`spaces_demo` necesita la misma orden.** g500 **no**: allí la migración abortó
sin llegar a registrarse.

### 2 · Aplicar lo que falta

```bash
node scripts/migrar.mjs
```

Trae `20260923_tickets.sql`, que es lo que hace que la pantalla de Soporte
funcione en el PADRE.

### 3 · Reconstruir y reiniciar — y el orden NO es negociable

```bash
cd /var/www/Spaces/apps/web
npm run build
systemctl restart spaces-web
```

**Build primero, reinicio después.** `CLAUDE.md` lo documenta en dos recuadros de
peligro, los dos aprendidos a base de perder tiempo:

- Reconstruir `.next` con un `next start` **ya corriendo** deja la página **en
  blanco sin un solo error** — ni 500, ni red, ni nada en el log. Se parece
  exactamente a un defecto de código y no lo es.
- Y **no siempre**: a veces **sirve código viejo con la pantalla viéndose
  perfecta**. El 18/09 el proceso llevaba seis horas sirviendo el build de la
  mañana y todo se veía bien. **«Se ve bien» NO prueba que sirva el build de
  disco.**

Al reiniciar, si hace falta matar algo, **se mata al dueño del puerto**, no al
envoltorio de `npx`.

### 4 · Mirar las pantallas

Deja de ser deuda y pasa a ser la preparación. Es además la primera vez que
alguien verá el rediseño de bordes: **aparece un contorno de 1px donde nunca
hubo nada**, en unos 90 archivos, incluidos `Modal`, `Sheet`, `Card`, `Sidebar`
y `Topbar`, que salen en todas las pantallas.

Si algo se ve mal, revertir es de un commit: `git revert afee2cf` quita solo el
CSS y deja el lenguaje de botones cableado y sin efecto visible.

## Lo que este objetivo DESBLOQUEA

**El bloqueo de g500 por PostgreSQL 14 deja de afectar al viernes.** Sigue siendo
real y sigue esperando decisión —está en
`docs/evidencias/16-g500-postgres-14-20260923.md`— pero ya no está en el camino
crítico de la demostración. Tampoco hace falta promover nada a `estable`.

**Flota ya funciona**: `/flota/` y `/flota/tickets/` se sirven desde el PADRE, y
el panel se reinició la noche del 23/09 para que tomara las rutas nuevas.

## Lo que queda sin verificar al escribir esto

- **Nadie ha abierto todavía ninguna de las tres pantallas nuevas** con un
  navegador: actualizaciones, tickets del cliente y `/flota/tickets/`.
- **No se ha medido qué hay dentro de la base `spaces` del PADRE** para el tenant
  `rgb`: cuántos sitios, campañas o contratos tiene, ni si alcanzan para el
  recorrido que se quiera enseñar.
- **No se ha comprobado que el login con Google del PADRE funcione hoy**, solo
  que está configurado — que es el motivo por el que se eligió esa máquina.
- El guion del Summit (`docs/Guion_Summit_20261014.md`) **sigue describiendo el
  montaje del portátil** y no se ha reescrito para nada de esto.
