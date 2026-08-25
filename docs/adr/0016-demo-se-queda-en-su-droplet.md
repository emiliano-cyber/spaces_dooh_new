# ADR 0016 — DEMO se queda en su propio droplet

- **Fecha:** 2026-08-25
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Sustituye a:** [ADR 0015](0015-demo-dentro-del-padre.md), que ponía DEMO
  dentro del PADRE. **Revive la 2ª enmienda de P1** (2026-08-21)
- **Relacionadas:** `docs/evidencias/f4-1-censo-resultado.md` (la medición que lo
  motiva) · `docs/Plan_Instancias_Soberanas_v3.md` (Fase 4) ·
  `vault/01-Arquitectura/modelo-instancias-soberanas.md`

---

## Contexto

El **2026-08-24** se concluyó que se había perdido el acceso al droplet
`209.97.146.136` —el que sirve `demo.space-os.io`—. Sobre esa conclusión se
levantaron cuatro cosas: la **3ª enmienda a P1** (el droplet queda abandonado),
el **ADR 0015** (DEMO vive dentro del PADRE), y las declaraciones de **IMPOSIBLE**
de `F4.1` y `F7.1`.

**El 2026-08-25 se entró a esa máquina sin dificultad.** La premisa era falsa.

El censo de `F4.1` —completo, solo lectura, en
`docs/evidencias/f4-1-censo-resultado.md`— midió que la máquina no solo es
accesible, sino que **está entera y funcionando**:

| | |
|---|---|
| Proceso | `online`, 13 días de uptime, **corriendo como `emiliano`, no root** |
| Base de datos | Responde: `POST /api/auth/login/` da **401**, no 500 |
| Dominio | `demo.space-os.io` resuelve aquí y nginx lo sirve |
| Certificado | Válido hasta el **2026-10-26**, y **renovable** con acceso |
| Autoregistro | **Cerrado** (`NEXT_PUBLIC_AUTOREGISTRO=0`) |
| `APP_URL` | `https://demo.space-os.io` |
| Código | `504b4fc` (11/08), **en `main`**, 66 migraciones |

## Decisión

**DEMO se queda donde siempre estuvo: en `209.97.146.136`, sirviendo
`demo.space-os.io`.** El PADRE vuelve a ser **solo** plano de control, en
`space-os.io`.

Lo único que le falta a esa máquina para ser DEMO según el plan es **recrear su
base**, de modo que no contenga ninguna organización de producción.

## Por qué se revierte el ADR 0015

**Porque su propio texto ya decía cuál era la mejor opción, y la descartó por un
coste que resulta que ya estaba pagado.** El ADR 0015, en sus alternativas
descartadas:

> *«Droplet nuevo para DEMO (≈12 USD/mes) — es la única opción que mantiene el
> riesgo cerrado de verdad. Descartada por coste.»*

No hace falta un droplet nuevo. **Hay uno, encendido, pagado y funcionando.**
La opción que cierra el riesgo estaba disponible todo el tiempo.

Y el ADR 0015 aceptaba explícitamente un precio que ahora no hay por qué pagar:

> *«La Fase 4 no cierra su riesgo: lo transforma. Deja de ser «demo pública =
> producción» y pasa a ser **demo pública = plano de control**.»*

Con esta decisión, **el riesgo de la Fase 4 se cierra de verdad**: la
demostración pública y el plano de control son máquinas distintas, con bases
distintas, dominios distintos y usuarios distintos — y **no comparten kernel,
disco ni red**, que era lo único que el ADR 0015 no podía separar.

## Consecuencias

### Lo que se gana

- **El riesgo de la Fase 4 se cierra**, no se transforma. Quien comprometa la
  demo **no** está dentro de la máquina que guarda el super admin de la flota.
- **Casi todo está hecho ya.** Certificado, dominio, registro cerrado, `APP_URL`
  y proceso sin root: los cinco, medidos y correctos.
- **Desaparece la dependencia de renovación permanente.** El ADR 0015 obligaba a
  emitir por DNS-01 con un token de Cloudflare que, si caducaba, hacía morir el
  sitio en silencio 90 días después. Aquí el certificado renueva por HTTP-01,
  como lleva haciendo desde julio.
- **El PADRE ya no necesita ese token**: su ápice `space-os.io` **ya resuelve** a
  él, así que su propio certificado puede emitirse por HTTP-01.
- **La fecha del 2026-10-26 se disuelve.** Era la caducidad del certificado que
  «no se renovaría solo». Con acceso, se renueva.

### Lo que cuesta

1. **Se mantienen dos droplets**, ≈12 USD/mes más que apagar el viejo. Es el
   precio explícito de tener la demo fuera del plano de control, y se paga a
   sabiendas.
2. **Recrear la base borra los cinco tenants** —`rgb`, `telcel`, `g500`, `eyro`,
   `demo-owner`—. Cubierto por la decisión «Todo es demo»: son datos de prueba y
   se recrean. ⚠️ **Esa decisión deja de valer el día que entre el primer cliente
   de pago.**
3. **Esa máquina corre código del 11/08**, 209 commits por detrás de la rama de
   instancias. Para una demostración es aceptable, pero **actualizarla hoy solo
   se puede con `deploy.yml`** —el despliegue por SSH— que es justo lo que
   **F3.6** quiere retirar. **Contradicción declarada, no resuelta**: F3.6 no
   puede ejecutarse mientras esa sea la única vía de actualizar DEMO.
4. **`F3.5` sigue bloqueada por el registry.** Ensayar `update.sh` contra DEMO
   necesita el canal `beta`, exista DEMO donde exista.

### Lo que queda sin uso, y se retira o se deja declarado

| Artefacto | Qué pasa |
|---|---|
| `ecosystem.demo.config.js` | Nació para el ADR 0015. **Sin uso.** Se conserva: sirve de plantilla para la Fase 5 |
| El vhost `demo.space-os.io` dentro de `infra/nginx/space-os.io.conf` | **Sin uso** en el PADRE. Hay que quitarlo o dejarlo apuntando a un puerto muerto |
| La base `spaces_demo` creada en el PADRE el 24/08 | **Sin uso.** Vacía y migrada; se puede tirar |
| El token de Cloudflare y el camino DNS-01 | **Dejan de ser necesarios.** Se conserva la documentación por si algún día hace falta |

## Alternativas descartadas

**Mantener el ADR 0015** — meter DEMO en el PADRE. Descartada porque acepta un
riesgo que ya no hay por qué aceptar, y porque exige nueve pasos de trabajo donde
la otra pide uno.

**Apagar el droplet viejo y ahorrar los ≈12 USD/mes** — es la opción barata, y
vuelve a poner la demo dentro del plano de control. Mismo problema que el ADR
0015, sin sus atenuantes.

## Cuándo revisar esta decisión

- **Cuando entre el primer owner de pago**, que es cuando deja de valer «Todo es
  demo» y recrear bases deja de ser gratis.
- **Cuando exista el canal `beta`** (TH-P4): entonces DEMO se actualiza jalando,
  se puede retirar `deploy.yml`, y la contradicción del punto 3 se cierra sola.
