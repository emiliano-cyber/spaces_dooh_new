# ADR 0015 — DEMO vive dentro del PADRE

> [!danger] ⚠️ SUPERADA EL 2026-08-25 POR EL [ADR 0016](0016-demo-se-queda-en-su-droplet.md)
> **Su premisa era falsa.** Este ADR se apoya en que se había perdido el acceso
> al droplet `209.97.146.136`. El 25/08 se entró sin dificultad y se completó el
> censo de `F4.1` (`docs/evidencias/f4-1-censo-resultado.md`).
>
> Con acceso, la alternativa que este documento descarta —reutilizar esa máquina
> como DEMO— vuelve a existir. Y es la que su propio texto señala como *«la única
> opción que mantiene el riesgo cerrado de verdad»*, descartada aquí **por un
> coste que ya estaba pagado**: el droplet existe, está encendido y funciona.
>
> **El cuerpo no se reescribe.** Su razonamiento era correcto con la información
> que había el 24/08, y esa es exactamente la información que un ADR conserva.

- **Fecha:** 2026-08-24
- **Estado:** ~~Aceptada~~ → superada por el 0016 → **su decisión queda RESTABLECIDA** por el [ADR 0017](0017-todo-se-concentra-en-el-padre.md) (2026-08-25)
- **Decide:** Jochelo
- **Sustituye a:** la 2ª enmienda de P1 (2026-08-21), que ponía DEMO en el
  droplet viejo
- **Relacionadas:** [ADR 0014](0014-postgres-en-el-droplet-o-base-administrada.md) ·
  `docs/Plan_Instancias_Soberanas_v3.md` (Fase 4) ·
  `vault/01-Arquitectura/modelo-instancias-soberanas.md`

---

## Contexto

El modelo de instancias soberanas separa tres cosas: el **PADRE** (plano de
control, donde vive el super admin de la flota), **DEMO** (la demostración
pública, con datos de juguete) y una **instancia por owner**. La Fase 4 del plan
existe para una sola cosa, y su tarea de cierre lo dice literal: dejar por
escrito que *«demo pública = producción»* dejó de ser cierto.

El 2026-08-21 se decidió que el droplet viejo —el que servía `demo.space-os.io`—
se quedaría como DEMO, ahorrando los ≈12 USD/mes que el plan presupuestaba.

El **2026-08-24 se perdió el acceso a esa máquina**. Con ello:

- `F4.1` (censo de ese droplet) pasa de pendiente a **imposible**, y con ella
  `F7.1`.
- La decisión del 21/08 **no se puede ejecutar**: no hay nada que reutilizar.
- Queda una instancia del producto pública, no actualizable y no apagable. Lo
  único que se conserva sobre ella es el **control del DNS**.

Quedaban tres salidas para DEMO: contratar un droplet nuevo, meterla en el
PADRE, o aplazarla.

## Decisión

**DEMO vive dentro del PADRE**, en la misma máquina, separada por todo lo que
una sola máquina permite separar:

| | PADRE | DEMO |
|---|---|---|
| Nombre | `space-os.io` | `demo.space-os.io` |
| Puerto | `3000` | `3001` |
| Base | `spaces_prod` | `spaces_demo` |
| Usuario del sistema | root *(a corregir)* | `demo` |
| Proceso pm2 | `spaces-web` | `spaces-demo` |
| Publicación a pantallas | según su `.env` | **`DOOHMAIN_PUBLISH_ENABLED=0`** |

Y `demo.space-os.io` **se recupera**: reapuntarlo al PADRE es lo mismo que
retirárselo a la máquina perdida.

## Consecuencias

### Lo que se gana

- **Cuesta cero.** No hay droplet que contratar.
- **El criterio literal de `F4.2` sigue siendo alcanzable y verificable**:
  *«la base de DEMO no contiene ni una fila de ningún owner»* es un criterio
  sobre la **base**, no sobre la máquina. Se comprueba con un `count(*)`.
- **El criterio 3 de `F4.5` se vuelve comprobable**, y antes no lo era: con la
  máquina perdida no se podía afirmar nada sobre lo que servía. Ahora se afirma
  con un `dig` que ese nombre ya no le apunta.
- **No hay nombre nuevo que comunicar.** El público de la demo sigue entrando por
  donde entraba.

### Lo que se pierde, y es lo que hay que tener presente

> **La Fase 4 no cierra su riesgo: lo transforma.**
>
> Deja de ser «demo pública = producción» y pasa a ser **«demo pública = plano de
> control»**. El PADRE guarda el super admin de **toda la flota** y, desde la
> Fase 5, las llaves de cada droplet de cada owner. DEMO es, por definición, el
> sitio con más superficie de ataque que va a existir: público, con cuentas de
> prueba, y tocado por gente de fuera.
>
> **Nombre, puerto, base, proceso y usuario distintos no son aislamiento.**
> Comparten kernel, disco y red. Quien consiga ejecutar código en el proceso de
> DEMO está dentro de la máquina que manda sobre la flota.

Consecuencias concretas que se aceptan con ella:

1. **Una escalada en DEMO alcanza al PADRE.** Hoy el proceso del PADRE corre
   como `root` (medido el 24/08), lo que empeora el salto. DEMO nace con usuario
   propio; **corregir el del PADRE queda como tarea abierta**.
2. **Un pico de carga en la demo afecta al plano de control.** No hay límites de
   recursos entre los dos procesos.
3. **`F3.5` pierde parte de su sentido.** Ensayar `update.sh` contra una DEMO que
   vive dentro del PADRE no prueba lo mismo que contra una instancia aparte: no
   hay `docker pull`, ni conmutación de contenedor, ni reinicio de máquina.
4. **La Fase 5 hereda una pregunta.** El modelo dice «un owner, una instancia,
   una máquina». El PADRE ahora sirve dos sitios, así que la primera instancia
   real de owner será también la primera prueba de verdad del modelo.

### Cuándo revisar esta decisión

Tres disparadores escritos, para no tener que acordarse:

- **Cuando entre el primer owner de pago.** A partir de ahí, comprometer el
  PADRE es comprometer datos de un cliente real, no solo los propios.
- **Cuando la demo se abra a tráfico que no sea comercial acompañado** — una
  campaña, un enlace público, un registro abierto.
- **Cuando TH-P4 caiga y exista el canal `beta`.** Con imágenes publicadas,
  levantar un droplet aparte para DEMO deja de ser trabajo manual y pasa a ser
  un `provision-instancia.sh`, o sea que el motivo de coste pierde fuerza frente
  al de riesgo.

## Alternativas descartadas

**Droplet nuevo para DEMO (≈12 USD/mes)** — lo que decía el plan v3 en `F4.2`.
Es la única opción que mantiene el riesgo cerrado de verdad. Descartada por
coste, sabiendo lo que cuesta. **Es a lo que se vuelve** si se dispara
cualquiera de los tres avisos de arriba.

**Aplazar DEMO** — cerrar la Fase 4 sin demostración. Descartada porque deja sin
sitio dónde enseñar el producto, que es para lo que existe DEMO, y porque no
resuelve nada: el riesgo no desaparece, solo se queda sin fecha.

**Reutilizar el droplet viejo** — la decisión del 21/08. Ya no es una alternativa:
no hay acceso.
