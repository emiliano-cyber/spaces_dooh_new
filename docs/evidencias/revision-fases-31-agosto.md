---
Para: quien decida el siguiente paso del plan de instancias
De: la revisión del 2026-08-31, tarde
Método: auditar cada tarea que queda contra el REPOSITORIO, no contra el plan
Sustituye, en los recuentos: la tabla de fases de `docs/Traspaso_20260828.md`
---

# Revisión de lo que queda — 2026-08-31

**Por qué se hizo.** Al intentar escribir la tarjeta de F3.5 apareció que no se
puede ejecutar. Como ese mismo día F5.3 y F5.4 ya habían resultado estar hechas,
se auditaron **las seis tareas restantes** contra el repositorio.

**El resultado en una frase:** el plan v3 es del **13 de agosto** y describe una
arquitectura que cambió el **27 y el 28**. Tres de las seis tareas tienen su ficha
desalineada con la realidad, y el cuello de botella no es el que se creía.

---

## 1 · El cuello de botella real, y es uno solo

**DEMO no es una instancia.**

| | Hoy | Lo que el modelo necesita |
|---|---|---|
| Cómo corre | `next start` desde el repo clonado, con systemd, compartiendo el `.next` del PADRE — `infra/systemd/spaces-demo.service:77` | Un contenedor desde la imagen del registry |
| Nombre público | Ninguno desde el [ADR 0024](../adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md) | Uno propio, con `https` |

De ahí salen **dos tareas que parecían independientes**:

- **F2.4** exige `DEMO_URL` con `https` (`promover.yml:127-129`) → necesita que DEMO
  tenga nombre.
- **F3.5** manda correr `update.sh` en DEMO, y `update.sh` actualiza **contenedores**
  (`infra/scripts/update.sh:1266` hace `docker pull`, `:62` `docker stop` +
  `docker run`) → necesita que DEMO corra desde la imagen.

**Son la misma tarea.** Lo que se venía tratando como «la decisión de DEMO» **no es
una decisión de negocio**: es un trabajo de servidor, y hasta hoy estaba disfrazado
de pregunta abierta.

---

## 2 · F3.5 no se puede ejecutar como está escrita

Tres contradicciones, todas medidas:

1. **`update.sh` y DEMO son dos mundos.** Ver arriba. No hay contenedor que parar ni
   imagen que jalar.
2. **Su comando de verificación apunta a la máquina equivocada**:
   `https://demo.space-os.io/spaces-dooh/login/`. Ese nombre resuelve al **droplet
   viejo**, que el ADR 0023 sacó del modelo y el 0024 manda eliminar. Mediría código
   del 11 de agosto.
3. **Su dependencia declarada es F4.5**, cuyos criterios son «`demo.space-os.io`
   resuelve al droplet nuevo» y comparar tenants contra `spaces_prod` en el droplet
   viejo. Los dos describen un mundo que ya no existe. F4.5 figura cerrada, pero lo
   que certificó se disolvió con los ADR 0023 y 0024.

---

## 3 · F3.6 dejó de ser «riesgo alto» — ahora es lo contrario

Su ficha justifica la espera así: *«alto si se hace antes de tiempo: mientras el
droplet actual siga siendo la producción de los tenants reales, `deploy.yml` es el
único mecanismo que hay»*. **Ese supuesto murió con el ADR 0023**: los datos de ese
droplet eran de prueba y sale del modelo.

Y hay algo peor que la inutilidad:

```
deploy.yml:87   PM2_APP=spaces-web
deploy.yml:171  como_app "pm2 reload $PM2_APP"
```

**El PADRE ya no usa pm2 para el 3000: lo sirve systemd desde el 28/08.** Si alguien
dispara ese workflow, pm2 se pelea por el puerto contra systemd — es la trampa nº6
del traspaso del 28. Su disparador es `workflow_dispatch`, así que no se activa solo,
pero **cuanto antes salga, mejor**.

> [!warning] F3.6 tiene un coste que su ficha no menciona
> **Seis comentarios en tres archivos de prueba** citan `deploy.yml:141-148` como
> **la razón** de que las migraciones tengan que ser idempotentes:
> `migraciones.e2e.test.ts:20,155,365`, `permisos-semilla.e2e.test.ts:244` y
> `reaplicacion.e2e.test.ts:15,54`.
>
> Es literalmente la «media docena de comentarios» que
> [[06-Operacion/convenciones]] prohíbe borrar al refactorizar. Retirar el archivo
> **exige reapuntarlos** al runner de `update.sh`, que hoy cumple ese papel. Si no,
> se pierde el porqué y vuelve el error que lo motivó.

---

## 4 · F5.5 · lo que sí está y lo que le falta

**Su contenido está completo.** El commit `ec25eb4` —trasplantado sobre `main` en
esta rama— borra los cuatro scripts y reescribe `infra/scripts/README.md`: 5
archivos, −338 líneas, exactamente su alcance.

**Su paso 1 pasa**: `rg` sobre `.github/` no encuentra ninguno de los cuatro
scripts. La ficha avisaba «si aparece en un workflow, parar y avisar» — no aparece.
Solo los citan `HANDOFF.md`, `MANUAL.md` y `README.md`, que `CLAUDE.md` §5 ya marca
como desactualizados.

**Su paso 4 ya estaba hecho**: el epílogo de `setup-droplet.sh` se corrigió el
2026-08-24 (defecto ④), y `apps/web/lib/aprovisionamiento-epilogo.test.ts` se pone
rojo si el texto viejo vuelve.

**Lo que le falta, y es la dependencia real con F3.6.** Su comando de verificación
incluye `.github/`:

```
rg -n 'public\."Tenant"|prisma migrate|Marketplace' infra/ .github/

infra/                          ->  LIMPIO, ni un resultado
.github/workflows/deploy.yml:8  ->  "# 1. RUTA MUERTA. Apuntaba a /var/www/Marketplace/..."
```

**El propio comentario de `deploy.yml` mantiene el criterio en rojo.** Ese es el
mecanismo de la dependencia F5.5 → F3.6, y **no** el que se supuso al principio de
esta revisión (que algún workflow llamara a los scripts: no lo hace ninguno).

Consecuencia práctica: **F5.5 se puede fusionar hoy** —su trabajo está hecho y su
efecto es correcto— pero **no se declara verificada hasta que F3.6 retire
`deploy.yml`**. Queda escrito así en vez de inventarle un criterio nuevo.

---

## 5 · F5.7 no está bloqueada por negocio

Su ficha dice *«Bloqueada por §8.2 (fecha objetivo de PIXELED) y §8.3 (en qué cuenta
nace)»*. **Las dos decisiones están cerradas** en
[[07-Agentes/ejecucion-plan-v3]]:

- **P2**, cerrada el 20/08: *no hay migración; los datos de PIXELED son de prueba, la
  instancia nace nueva y la información se recarga.*
- **P3**, cerrada el 20/08: *todas las instancias de owner nacen en la cuenta de
  DigitalOcean de la casa.*

Ya solo depende de **F5.6**.

---

## 6 · El orden real de lo que queda

| # | Qué | Estado |
|---|---|---|
| 1 | **F5.5** · fuera los cuatro scripts | **Fusionable hoy.** Verificación completa tras el 5 |
| 2 | **DEMO pasa a ser una instancia** — contenedor desde `beta`, su `app.env` y su `instancia.env`, y un nombre público nuevo | **La única tarea de fondo que queda.** No está en el plan: es lo que F3.5 y F2.4 dan por hecho |
| 3 | **F3.5** · ensayo del ciclo en DEMO, incluido el release roto a propósito | Sale sola en cuanto exista el 2 |
| 4 | **F2.4** · promover a `estable` — cierra la Fase 2 | Ídem |
| 5 | **F3.6** · fuera `deploy.yml` **+ reapuntar los seis comentarios** | Puede ir antes que el 3; su riesgo se invirtió |
| 6 | **F5.6** · ensayo en droplet desechable | Necesita `estable`, o sea el 4 |
| 7 | **F5.7** · primer owner | Solo espera al 6 |

**Dos de las seis se despachan sin tocar un servidor**: F5.5 y la parte de código de
F3.6. El resto cuelga de un solo trabajo, el 2.

---

## 7 · Lo que esta revisión NO verificó

Todo lo de arriba sale del **repositorio y de la bóveda**. **No se entró al PADRE.**

La afirmación «DEMO corre desde el repo y no desde una imagen» se apoya en
`infra/systemd/spaces-demo.service:77` y en el traspaso del 28/08 — **evidencia de
código, no una comprobación en vivo**. Si el servidor no está como dice el repo, el
punto 2 cambia y con él el orden entero. La comprobación es una línea:

```bash
# La corre una persona, en el PADRE:
systemctl cat spaces-demo | grep ExecStart ; docker ps --format '{{.Names}} {{.Image}}'
```
