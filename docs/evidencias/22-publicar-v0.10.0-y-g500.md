# Publicar v0.10.0 y llevarla a g500 — guía para correr a mano

> Preparada el 2026-10-07. La corre **una persona**: Claude no hace `ssh`, `gh`
> ni `git push`. Cada paso dice dónde se pega (PowerShell en tu máquina, o
> bash en la consola web de DigitalOcean) y qué tiene que salir.
> Procedimiento base: `21-publicar-y-mover-g500-20260930.md` §A (la §B, mover
> g500 a otro droplet, **ya no aplica**: se quedó en el suyo con PostgreSQL 16).

## 0 · Qué lleva esta versión

- **Lo que ve el cliente:** las 16 notas de `apps/web/novedades.json` (entrada
  `v0.10.0`): finanzas y propuestas por periodo, estado de cuenta, invitación
  de usuarios, cambios de contrato antes de firmar, calculadora como la HTML,
  slots libres, descuento 0.00, tope de descuento, y seis correcciones.
- **Cuatro migraciones de esquema nuevas**, todas **aditivas** (no borran ni
  cambian columnas existentes) y aprobadas por el dueño. **Ojo con la cuenta:**
  son 4 si g500 ya está en `v0.9.2`; si sigue en `v0.9.1` le llegan **7**,
  porque se suman las tres de `v0.9.2` (`20261005_notas_de_version`,
  `20261006_precio_ajustado_por_gerente`, `20261007_calculadora_spots`).
  Medido en el ensayo local (§10):

  | Migración | Qué hace en g500 |
  |---|---|
  | `20261008_cobranza_abonos.sql` | Tabla `cobranza_abonos` y **rescate**: un abono «histórico» por cada cobranza ya pagada, fechado con la bitácora. Lo cobrado antes de hoy se verá como **aproximado** |
  | `20261009_propuestas_fechas_estatus.sql` | Columnas `aprobada_en` / `rechazada_en`; las aprobadas de antes toman la fecha en que se congeló su precio |
  | `20261010_contrato_cambios.sql` | Tabla del historial de cambios de contrato |
  | `20261011_contrato_cambios_solo_insercion.sql` | Quita `update`/`delete` al rol de la app sobre ese historial |

- **Variables de entorno nuevas: ninguna.** El enlace de invitación usa
  `APP_URL`, que g500 ya tiene (y si faltara, el dominio de la petición).
- `update.sh` y `respaldo.sh` **no cambiaron** desde el 01/10: no hay que
  volver a copiarlos al servidor.
- La migración de **datos** pendiente (`20260731_calendario_meses_cortos.sql`)
  **no** corre: `update.sh` no pasa `--con-datos`, a propósito.

## 1 · Antes de empezar

- [ ] No es viernes por la tarde ni víspera de festivo, y tienes **una hora**
      libre después de instalar en g500 para vigilarla.
- [ ] Sabes en qué versión está g500 hoy: Administración → Actualizaciones.
      El 02/10 se esperaba que tomara `v0.9.2` y no hay registro de que lo
      hiciera. Si sigue en `v0.9.1`, esta versión le trae también lo de `v0.9.2`
      (meses de calendario, calculadora de spots, roadblock).
- [ ] La fecha de `novedades.json` es `2026-10-07`. Si etiquetas otro día,
      cámbiala en un commit **antes** de la etiqueta.

## 2 · Publicar (PowerShell, una línea a la vez)

```
cd C:\Users\Server\spaces_doohmain_nueva
git status
git log --oneline -1
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow ci.yml --limit 1
```

`git status` limpio y `ci.yml` **verde en ese mismo commit**. Entonces:

```
git tag v0.10.0
git push emiliano v0.10.0
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow release.yml --limit 1
```

`release.yml` revisa primero las notas, corre **toda** la suite con Postgres y,
solo si pasa, publica la imagen como `v0.10.0` y `beta`. No toca `estable`.
Tardó ~8 min en `v0.7.0`; hoy hay más e2e. **Si sale rojo no se publicó nada:**
no sigas, avísame con el enlace del run.

## 3 · El PADRE (consola web de DO del PADRE, bash)

La consola **se come el primer carácter** de cada pegado: por eso el `echo ok;`.

```bash
echo ok; cd /var/www/Spaces && git pull && git log --oneline -1
U=$(grep '^DATABASE_URL=' /etc/space-os/demo-instancia.env | cut -d= -f2- | sed 's#/spaces_demo#/spaces_prod#')
DATABASE_URL="$U" node scripts/migrar.mjs --pendientes; echo "codigo=$?"
DATABASE_URL="$U" node scripts/migrar.mjs; echo "codigo=$?"
npm install && git checkout -- package-lock.json && npm run build && echo BUILD_OK
chown -R padre:padre apps/web/.next
systemctl daemon-reload
systemctl restart spaces-web
```

- `--pendientes` tiene que listar **al menos** las 4 de §0 (más las de
  `v0.9.2` si el PADRE no las tenía) y la de datos como omitida.
- **Migrar antes del build y del reinicio.** Si el build no dice `BUILD_OK`,
  no reinicies: el PADRE sigue sirviendo lo de antes.
- Las dos líneas de `install … update.sh / respaldo.sh` de la guía del 30/09
  **no hacen falta esta vez** (no cambiaron).

## 4 · DEMO toma `beta` y se prueba (en el PADRE)

```bash
echo ok; SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh --dry-run
SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/update.sh
tail -n 40 /var/log/space-os/update.log
```

El `--dry-run` lista las migraciones pendientes y **no** sale con código 3 ni 4; la
corrida real termina con la salud en verde. Luego entra a DEMO y recorre:

1. **Finanzas** → arriba, el selector de periodo: «Este mes» y «Mes pasado»
   muestran facturado, cobrado y por cobrar. Descarga un estado de cuenta en CSV.
2. **Cobranza** → registra un pago con fecha de ayer; aparece en el mes correcto.
3. **Propuestas** → el resumen por periodo; la ganancia solo la ve Dueño/Admin/Director.
4. **Arrendadores** → abre un contrato → «Cambios al contrato» → «Editar
   términos», elige «El arrendador», cambia la renta y guarda. Sale en el historial.
5. **Administración** → crea un usuario con «Enviar invitación»: aparece el enlace.
6. **Disponibilidad** → las digitales dicen «N libres».
7. Entra con un usuario nuevo: sale una vez el diálogo de **novedades de v0.10.0**.

## 5 · Promover a `estable` (PowerShell)

```
gh workflow run promover.yml --repo emiliano-cyber/spaces_dooh_new -f version=v0.10.0 -f motivo="DEMO probada el 07/10"
gh run list --repo emiliano-cyber/spaces_dooh_new --workflow promover.yml --limit 1
```

Comprueba que el digest de `v0.10.0` es el de `beta` y que DEMO responde, y
reetiqueta sin reconstruir. **Guarda el resumen del run**: trae el mandato
`crane copy` para devolver `estable` al digest anterior (§8).

## 6 · g500 instala (panel de g500)

g500 está en modo **aprobación** y su cron de las 04:17 está comentado: **nada
se instala solo**. En ≤ 15 min tras promover, el `--comprobar` de g500 ve la
versión nueva.

1. Entra a **g500.space-os.io** como Dueño → Administración → Actualizaciones.
   Debe ofrecer `v0.10.0` con sus notas y **4 migraciones** (**7** si venía
   de `v0.9.1`; cualquier otro número, para y avísame).
2. **Apruébala.** El siguiente `--comprobar` (≤ 15 min) la instala.
3. `update.sh` **saca un respaldo** de la base antes de migrar
   (`/var/lib/space-os/respaldos/spaces_AAAAMMDD_HHMMSS.dump`, y una copia al
   bucket `space-os-respaldos`). Si el respaldo sale vacío, aborta sin tocar nada.

Si quieres verlo pasar en vivo, en la consola web de **g500**:

```bash
echo ok; tail -f /var/log/space-os/update.log
```

## 7 · Comprobar g500 (consola web de g500, bash)

```bash
echo ok; sudo -u postgres psql -d spaces -c "select version_instalada, digest_instalado is not null as tiene_digest from actualizaciones_instancia;"
ls -la /var/lib/space-os/respaldos/ | tail -3
```

`version_instalada` = `v0.10.0`, y el `.dump` de hoy con tamaño mayor que cero.

**Los datos que movió la migración de cobranza** (tiene que salir **0** en la
primera fila):

```bash
sudo -u postgres psql -d spaces -c "select count(*) as cobranzas_que_no_cuadran from cobranzas c where c.monto_pagado <> coalesce((select sum(x.monto) from cobranza_abonos x where x.cobranza_id = c.id), 0);"
sudo -u postgres psql -d spaces -c "select count(*) filter (where fecha is null) as historicos_sin_fecha, count(*) as historicos from cobranza_abonos where origen = 'historico';"
sudo -u postgres psql -d spaces -c "select has_table_privilege('spaces_app','contrato_cambios','UPDATE') as app_puede_editar_historial;"
```

La última tiene que decir **`f`**.

Y en la pantalla de g500, con datos de verdad: login · Finanzas por periodo
(lo cobrado antes de hoy dice «aproximado») · Propuestas por periodo · abrir un
contrato y ver «Cambios al contrato» (**no** edites uno real para probar: usa
uno de prueba o solo mira).

## 8 · Cuándo y cómo volver atrás

**Se vigila 1 hora** tras la instalación. Decide el dueño.

| Señal | Qué hacer |
|---|---|
| `update.sh` sale con **4** | Ya volvió solo a la versión anterior y la base a su respaldo. Mira el log y avísame |
| Sale con **2** | La migración falló a medias; el tráfico **no** se conmutó (sigue la versión anterior). No reintentes: avísame con el log |
| Sale con **3** | No se aplicó nada; sigue la versión anterior. Avísame |
| Sale con **5** o **7** | **Urgente**: la instancia puede estar caída. El log trae el mandato de rescate (`docker rename space-os-anterior space-os && docker start space-os`) |
| Sale con **6** | El servicio volvió pero la base no quedó como antes: no toques nada y avísame |
| Instaló bien, pero **el login falla** o **no carga** el inicio, Finanzas o Propuestas (error o pantalla en blanco al recargar) | Vuelta atrás manual (abajo) |
| La consulta de cobranzas **no da 0** | No es para volver atrás: el dinero sigue bien en `monto_pagado`. Avísame con el número |
| Un detalle visual o una cifra rara en un resumen | **Corregir hacia adelante** (`v0.10.1`), no volver atrás |

**Vuelta atrás manual — lo que hay y lo que no.** Tras una instalación exitosa,
`update.sh` borra el contenedor anterior; **no existe un runbook ensayado** para
bajar una instancia de versión. Lo documentado es devolver `estable` al digest
anterior con el `crane copy` que imprime el resumen de `promover.yml`, y
restaurar a mano el `.dump` de §6.3. Como las cuatro migraciones solo
**agregan**, el código anterior funciona con el esquema nuevo; el riesgo de
volver atrás sin restaurar la base es que los pagos registrados mientras tanto
no tendrían abono con fecha. **Medido en el ensayo (§10):** un pago hecho con
`v0.9.1` sobre la base migrada deja la cobranza sin cuadrar (176 000 pagado
contra 175 000 en abonos), y volver a subir a `v0.10.0` **no lo arregla solo**:
el rescate de la migración ya corrió. Así que, si se vuelve atrás sin restaurar
y se registran pagos, **antes de reintentar `v0.10.0` hay que conciliar esas
cobranzas**. **Si llegas aquí, para y avísame antes de ejecutar nada**: lo
armamos sobre el caso concreto.

## 9 · Al terminar

- [ ] Anota en la bitácora: versión, hora de instalación en g500, quién aprobó.
- [ ] Si algo de esta guía no coincidió con lo que viste, dímelo: se corrige
      aquí mismo para la próxima.

## 10 · Ensayo local del 07/10 (lo que ya se probó antes de tocar g500)

Se reprodujo en esta máquina el camino de g500, con una base desechable
(`spaces_ensayog500_test`, PostgreSQL 16 en el 5433) y sin contenedores:

1. **La base en `v0.9.1`**: `schema.sql` + 102 migraciones con el runner de
   esa etiqueta, semilla de la demo, y **historia hecha con la app `v0.9.1`
   compilada** (no por SQL): dos abonos a una cobranza, una liquidación, cuatro
   propuestas (2 aprobadas, 1 rechazada, 1 borrador). Así la bitácora tiene los
   textos reales que lee el rescate.
2. **Respaldo** con `pg_dump -Fc` (299 KB), como el paso 3 de `update.sh`.
3. **`migrar.mjs` de esta rama, sin `--con-datos`**: `--pendientes` listó **7**
   de esquema + la de datos omitida; la corrida aplicó las 7 (código 0); la
   segunda, **0 aplicadas** (idempotente).
4. **Las comprobaciones de §7**: cobranzas que no cuadran **0**; 8 abonos
   históricos, **uno por cobranza** aunque hubo dos abonos; los dos pagados con
   la app tomaron la **fecha de su bitácora** y los 6 de la semilla (sin
   rastro) quedaron sin fecha, como aproximados; las 2 aprobadas tienen
   `aprobada_en`; `spaces_app` sobre `contrato_cambios`:
   `SELECT=t INSERT=t UPDATE=f DELETE=f TRUNCATE=f`. Ningún monto, propuesta ni
   contrato cambió: la foto de antes y la de después solo difieren en las tablas
   nuevas.
5. **`v0.10.0` sobre la base migrada**, por HTTP: los cinco periodos de
   Finanzas en 200 (lo histórico sale marcado `aproximado`); un abono con fecha
   de ayer se suma al histórico y la cobranza sigue cuadrando; resumen de
   propuestas con ganancia para el Dueño y **sin ella** para el Vendedor;
   editar la renta de un contrato existente deja historial con la parte y quién
   la capturó; un `update` directo de `spaces_app` sobre el historial lo
   **rechaza Postgres (42501)**; alta con invitación devuelve el enlace sin
   mandar correo; novedades de `v0.10.0`; las cinco pantallas de §4 en 200.
6. **Vuelta atrás sin restaurar** (`v0.9.1` sobre la base migrada): entra,
   lee el estado completo, registra un pago y edita un contrato. Sirve, con la
   salvedad de la deriva de cobranza que describe §8.
7. **Vuelta atrás restaurando**: `pg_restore` del respaldo en una base nueva
   dio una foto **idéntica** a la de antes de migrar (102 migraciones, sin las
   tablas nuevas, mismos montos), `spaces_app` conserva sus permisos, y volver
   a migrar encima aplica las 7 sin error.

**Lo que este ensayo NO cubre:** `update.sh` en sí (necesita Docker; su
respaldo, huella y conmutación no se ejercitaron aquí), el volumen y las
rarezas de los datos reales de g500, y el comportamiento en PostgreSQL 16 con
el locale de su droplet. Eso es lo que miran §6 y §7 en vivo.
