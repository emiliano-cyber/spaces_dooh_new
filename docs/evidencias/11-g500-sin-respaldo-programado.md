# g500 no tiene respaldo programado — medido el 2026-09-22

> Hallazgo encontrado al ir a instalar el ADR 0037 en g500. **No lo causó ese
> trabajo**: es anterior, y se descubrió porque hubo que mirar la máquina.
> Todo lo de aquí es salida literal, no deducción.

## El titular

**El respaldo fuera del droplet de la única instancia con datos reales de
cliente tiene cinco días, y solo se refresca cuando se despliega una versión.**

No hay ningún cron de respaldo en g500. Su único cron de SPACE OS es
`/etc/cron.d/space-os-update`, y `update.sh` **respalda solo cuando hay versión
nueva**: en las corridas `sin cambios` sale antes de llegar al paso 3.

Como `estable` no se mueve desde el 17/09, no ha habido ninguna.

## Lo que hay en el bucket, literal

```
2026-09-17 18:50   6 305 264   s3://space-os-respaldos/g500/2026-09-17-1849.dump
2026-09-17 18:50   6 305 141   s3://space-os-respaldos/g500/2026-09-17-1850.dump
```

Dos, del mismo minuto, los dos de la tarjeta `10-respaldo-remoto-de-g500.txt`
que se ejecutó **a mano** ese día. **Nada desde entonces.**

Y `grep -c 'respaldo remoto OK' /var/log/space-os/update.log` en g500 devuelve
**0**: `update.sh` no ha subido un respaldo **nunca**. Lo que hay en el bucket
no lo puso él.

## La regla real, dicha sin adornos

> g500 se respalda fuera de su droplet **únicamente cuando se despliega una
> versión nueva**. Si no sale ninguna en un mes, el respaldo tiene un mes.

Eso no es lo que nadie supondría leyendo que «la instancia se respalda antes de
migrar». Es cierto — y es insuficiente como política de respaldo, porque ata la
frecuencia de las copias al ritmo de los releases.

## El otro hallazgo, menor pero del mismo círculo

La llave de Spaces de g500 **funciona en `space-os-respaldos` y NO en
`space-os-logs`**. Medido listando los dos buckets con la misma configuración
que arma `respaldo_config_s3cmd`:

```
--- bucket de RESPALDOS (space-os-respaldos) ---
                          DIR  s3://space-os-respaldos/g500/
                          DIR  s3://space-os-respaldos/padre/
--- bucket de LOGS (space-os-logs) ---
ERROR: Access to bucket 'space-os-logs' was denied
ERROR: S3 error: 403 (AccessDenied): Access Denied.
```

Consecuencia: **el log de cada corrida se queda en el droplet**. Es exactamente
el «círculo cerrado» que describe la tarjeta del 17/09 — para enterarte de que
algo va mal hay que entrar al servidor, que es justo lo que este modelo evita.
Aquella tarjeta cerró la mitad de datos; la mitad de diagnóstico sigue abierta.

**Se arregla en el panel de DigitalOcean**, dando a esa llave acceso al bucket
`space-os-logs`. No es código.

## Dos hipótesis mías que resultaron FALSAS, y se dejan escritas

1. **«El 403 del log implica el 403 del respaldo, porque comparten función y
   llave.»** Comparten las dos cosas (`respaldo_subir_s3cmd`, llamada desde
   `respaldo.sh:247` y `update.sh:598`) — pero son **buckets distintos**, y en
   DigitalOcean el permiso se da **por bucket**. Medido: uno funciona y el otro
   no. Deducir en vez de medir habría dado la respuesta contraria.
2. **«Falta `SPACES_ENDPOINT` en la configuración.»** No falta: se **deriva** de
   `SPACES_REGION` en `respaldo.sh:96`. Lo afirmé antes de comprobarlo.

## Estado de g500 al cierre del día, para no volver a averiguarlo

| | |
|---|---|
| Montaje | **Estándar**: `/etc/cron.d/space-os-update`, sin `SPACE_OS_CONF` |
| Cron | una sola entrada, `17 4 * * *` |
| Canal | `estable` |
| Versión | `v0.5.1` (`sha256:934fd6f7…`) |
| Base | `spaces` |
| `update.sh` | el del 9 de septiembre, 117 820 bytes — **el nuevo no se ha instalado** |
| Acceso | por llave desde el portátil: `ssh -i ~/.ssh/spaces_deploy`. **El PADRE no tiene llave hacia g500** |
| Respaldo remoto | bucket OK, **sin subidas automáticas nunca** |
| Log remoto | **403**, permiso de bucket |

## Lo que falta, y lo que no me corresponde

- **Un respaldo programado, independiente de las actualizaciones.** `respaldo.sh`
  ya se puede correr suelto (`subir`, `podar`, `destino`) pero **no sabe hacer el
  dump**: solo sube uno que exista. Y `update.sh` no usa `DATABASE_URL` directa
  —deriva `PG_ENV` y `PG_BANDERAS`—, así que un guion de respaldo diario no es
  una línea de cron: es trabajo con su prueba.
- **Decidir de qué instancias.** Hoy DEMO ni siquiera tiene credenciales de
  Spaces y para DEMO da igual. Si el respaldo diario es de toda la flota o solo
  de las que tienen datos reales **es una decisión del dueño**, no una
  consecuencia técnica.
- **El permiso del bucket de logs**, que se da en el panel.

---

## Qué de todo esto queda CERRADO — 2026-09-22, misma tarde

Rama `feat/respaldo-diario`. **Lo que se cierra es el trabajo de código, no el
agujero**: el agujero se cierra cuando una persona corra la tarjeta.

### Cerrado

- **Existe el guion de respaldo diario**, independiente de las actualizaciones:
  `infra/scripts/respaldo-diario.sh`. Hace dump, poda y subida, y nada más. La
  regla «la frecuencia de tus respaldos la decide el ritmo de los releases»
  deja de ser cierta en cuanto el cron esté puesto.
- **Lo que faltaba era el dump, y ya está.** Se confirma lo que decía este
  documento: `respaldo.sh` ya sabía subir y podar, y se reusa tal cual —no se
  reescribió ni una línea de él—. Lo único nuevo es el dump y la derivación de
  `DATABASE_URL`, que vive en `infra/scripts/conexion-pg.sh`.
- **El respaldo vacío no se sube.** `pg_dump` que falla o sale de 0 bytes →
  se borra el archivo y se aborta sin tocar el bucket (código 4).
- **Una subida fallida ya no es silenciosa**: código 5, y el dump local se
  conserva. Es la diferencia deliberada con `update.sh`, que se la traga.
- **Los dos montajes están cubiertos**: `SPACE_OS_CONF` manda, así que DEMO
  (dentro del PADRE, base `spaces_demo`) no respalda la base de al lado.
- **Probado**: `bash infra/scripts/pruebas-respaldo-diario.sh` →
  **15 escenarios · 58 comprobaciones · 0 fallos**, en **15 segundos**, sin
  tocar red, base ni servidor. Cinco mutantes comprueban que muerde.
- **La decisión de «de qué instancias» ya no está abierta**: el dueño decidió el
  22/09 que es de **todas**. Este documento la daba por pendiente.

### Sigue abierto, y ninguna de las tres es código

1. **Instalarlo.** Nada de esto está en ninguna máquina. La tarjeta es
   `docs/evidencias/12-instalar-respaldo-diario.txt`, con dos bloques (g500 y
   DEMO), su comprobación y su vuelta atrás. **La corre una persona.**
2. **El 403 del bucket de logs.** Exactamente igual que antes: la llave de g500
   entra en `space-os-respaldos` y no en `space-os-logs`, así que el log del
   respaldo diario **también** se quedará en el droplet. Se arregla en el panel
   de DigitalOcean. Mientras siga así, para saber si el respaldo diario corre
   hay que entrar al servidor — el mismo círculo cerrado que este documento
   describe, ahora aplicado al guion que viene a arreglarlo.
3. **Que las instancias nuevas nazcan con él.** `provision-instancia.sh` e
   `instalar-hijo.sh` escriben `/etc/cron.d/space-os-update` y **no** el del
   respaldo. Hasta que lo hagan, cada instancia nueva nace sin respaldo diario.

### Y una cosa que este documento daba por hecha y conviene matizar

Decía que un guion de respaldo diario «no es una línea de cron: es trabajo con
su prueba». Cierto. Pero el trabajo **no** fue el dump: fue decidir de dónde
sale la derivación de `DATABASE_URL` sin tocar `update.sh`. Hoy hay **dos
copias** de esas seis funciones —la de `update.sh` y la de `conexion-pg.sh`— y
eso es deuda declarada, con un guard (escenario R7) que se pone rojo si
divergen. El final bueno es que `update.sh` sourcee `conexion-pg.sh`, y ese
cambio **exige correr `pruebas-update.sh` entero, 15 minutos**, así que lo hace
quien pueda mirar ese resultado.
