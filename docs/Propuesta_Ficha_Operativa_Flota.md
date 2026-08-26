# Propuesta — la ficha operativa de cada instancia en el panel del PADRE

**Fecha:** 2026-08-26 · **Estado:** propuesta, sin implementar
**Decide:** Emiliano · **Relacionadas:** [ADR 0022](adr/0022-instancia-dedicada-por-owner.md) ·
F6.1 (`GET /api/version`) · F6.2/F6.4 (`apps/flota/`)

---

## Qué se quiere, y qué NO

**Se quiere** que el PADRE vea de un vistazo el estado operativo de cada
instancia hija: versión, canal, salud, cuándo se actualizó, cuándo respaldó, y
si su certificado está por vencer.

**No se quiere** —y esto es lo que hace que la propuesta sea aceptable— ni un
dato del negocio del owner. Ni usuarios, ni pantallas, ni campañas, ni nombres
de sus clientes. El ADR 0022 lo fijó y hay una prueba que lo protege: lee los
tenants sembrados y comprueba que **ninguno** aparece en la respuesta.

Ese límite es la parte comprobable de la palabra «soberana». Un owner puede
abrir el código y verificar que su padre no sabe cuántos clientes tiene.

---

## Lo que YA existe (medido, no supuesto)

| Dato | Dónde está hoy | Falta |
|---|---|---|
| Versión, canal, última migración, salud | `GET /api/version` (F6.1) | nada |
| Al día / rezagada / sin respuesta | `apps/flota/estado.mjs` (F6.2) | nada |
| Reporte saliente si el padre no alcanza | `update.sh` → `reporte.mjs` (F6.4) | nada |
| **Fecha de la última actualización** | `/var/lib/space-os/version-actual`, línea `fecha=` (`update.sh:1693`) | exponerla |
| **Último respaldo** | los `.dump` en `$DIR_ESTADO/respaldos/` (`update.sh:1446`) | registrarlo y exponerlo |
| **Vencimiento del certificado** | `/etc/letsencrypt/live/<dominio>/` | ver abajo |

O sea: **dos tercios ya están construidos.** Lo que falta son dos datos.

---

## El problema difícil, y por qué la solución obvia es la mala

El certificado parece lo fácil y es lo único con una trampa.

**Lo obvio:** que la aplicación lea `/etc/letsencrypt/live/<dominio>/cert.pem` y
mire la fecha. **No funciona y no debe funcionar:** ese directorio es `0700` de
`root`, y el proceso de la aplicación corre con un usuario sin privilegios. Para
que funcionara habría que darle a la aplicación acceso de lectura al almacén de
claves privadas del servidor. **Eso es un precio absurdo por una fecha.**

**La propuesta:** que el certificado **no lo pregunte nadie a la instancia**. El
panel del padre ya abre una conexión HTTPS contra cada hija para llamar a
`/api/version` — y **esa conexión ya lleva el certificado dentro**. Basta con
mirarlo:

```js
// apps/flota/estado.mjs — Node puro, sin dependencias
const socket = tls.connect({ host: dominio, port: 443, servername: dominio })
const { valid_to } = socket.getPeerCertificate()
```

**Y es mejor, no solo más barato:** mide **el certificado que ve un visitante**,
no el archivo que hay en disco. Si nginx quedó sirviendo uno viejo tras una
renovación —que es exactamente el modo de fallo que preocupa— leer el archivo
diría que todo está bien. El apretón de manos no miente.

**Cero código en la instancia.** El owner no tiene que exponer nada nuevo.

---

## Lo que sí hay que añadir en la instancia

Solo dos campos, y en la rama **con token** de `/api/version`. La respuesta
pública sigue siendo `{ ok }` y nada más.

```
{ ok, version, ultimaMigracion, base, canal, uptime,
  ultimaActualizacion,   ← nuevo
  ultimoRespaldo }       ← nuevo
```

**De dónde salen, sin permisos nuevos:** de `/var/lib/space-os/version-actual`,
que `update.sh` **ya escribe** al terminar bien. Se le añade una línea con la
marca de tiempo del respaldo, y la aplicación lee **ese único archivo** — no el
directorio de respaldos, no el de certificados.

Tres cautelas que van escritas desde el principio:

1. **Falla en blando.** Una instancia recién aprovisionada **no tiene** ese
   archivo: `update.sh` no ha corrido nunca. Los dos campos salen `null`, no un
   error. Un panel que revienta con una instancia nueva no sirve para vigilar —
   la misma razón por la que `node estado.mjs` devuelve 0 con una instancia
   caída.
2. **Solo lectura, y de un archivo concreto.** Ninguna ruta variable, ningún
   directorio. Lo que la aplicación puede leer se sabe leyendo una línea.
3. **Permisos explícitos.** `version-actual` lo escribe `root`; hay que dejarlo
   legible por el usuario de la aplicación (`install -m 644`). Si no, los campos
   salen `null` **y nadie se entera** — que es peor que un error.

---

## Lo que el panel enseñaría

```
PANEL DE FLOTA                                    2026-08-26 15:40

owner      canal     version   estado          actualizada   respaldo
---------  --------  --------  --------------  ------------  ---------
pixeled    estable   v0.4.2    al-dia          hace 2 d      hace 3 h
sankofa    estable   v0.4.1    rezagada        hace 11 d     hace 3 h
tauro      estable   —         sin-respuesta   —             —

  ⚠ sankofa   rezagada: estable va por v0.4.2 desde hace 6 dias
  ⚠ tauro     certificado vence en 12 dias
```

Lo que hace útil el panel no es la tabla: son **las dos líneas de abajo**. Una
tabla que hay que leer entera todos los días no la lee nadie. Lo que se necesita
es que **el panel diga qué mirar**, y el resto se pueda ignorar.

---

## Coste, en orden de lo que aporta

| | Qué | Dónde | Aporta |
|---|---|---|---|
| 1 | Vencimiento del certificado por TLS | `apps/flota/estado.mjs` | **Lo más útil y sin tocar la instancia.** Un certificado vencido tumba el sitio del owner en silencio |
| 2 | Los avisos («qué mirar hoy») | `apps/flota/estado.mjs` | Convierte una tabla en algo que se usa |
| 3 | `ultimaActualizacion` y `ultimoRespaldo` | `/api/version` + `update.sh` | Contesta «¿esta instancia está respaldando de verdad?» |

**El 1 y el 2 no tocan la instancia**, así que pueden hacerse y desplegarse sin
que ninguna hija se entere. El 3 sí viaja en el artefacto de la flota.

---

## Lo que esta propuesta deja fuera a propósito

- **Disco, memoria y CPU.** Suenan a panel de vigilancia y son lo primero que se
  pide, pero para actuar sobre ellos hay que entrar al servidor del owner — y
  eso es justo lo que el modelo prohíbe. Sin acción posible, es ruido.
- **Cualquier conteo del negocio.** Ver el punto de arriba.
- **Alertas por correo.** Otra decisión: a quién, cada cuánto, y qué se hace
  cuando llegan. Un aviso que nadie atiende enseña a ignorar los avisos.

---

## Lo que hay que decidir antes de construir

1. **¿Los avisos (punto 2) o solo la tabla?** Recomiendo los avisos: sin ellos
   el panel se deja de mirar en dos semanas.
2. **¿Cuántos días antes avisa el certificado?** Let's Encrypt renueva a los 30
   restantes; avisar a los 20 da margen y no es ruido.
3. **`ultimoRespaldo` obliga a tocar el artefacto de toda la flota.** ¿Entra ya,
   o se deja para cuando exista la primera instancia hija de verdad?
