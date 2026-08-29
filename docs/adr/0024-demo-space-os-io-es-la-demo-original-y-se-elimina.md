# ADR 0024 — `demo.space-os.io` es la demostración original, y se eliminará

- **Fecha:** 2026-08-27
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Sustituye a:** [ADR 0021](0021-demo-space-os-io-se-queda.md)
- **Relacionadas:** [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md) ·
  `docs/Plan_Instancias_Soberanas_v3.md`

> [!important] Con este ADR el asunto queda CERRADO
> `demo.space-os.io` ha cambiado de destino **seis veces en seis días**
> (0015 → 0016 → 0017 → 0020 → 0021 → este). No se vuelve a preguntar ni se
> vuelve a deducir: lo que quede sin fecha aquí es **deliberado**, no un hueco.

---

## Contexto

El [ADR 0021](0021-demo-space-os-io-se-queda.md) conservó el nombre con un
argumento de futuro: sería **«el nombre público de la demostración de las
instancias hijas»**, el sitio donde enseñar el producto como lo verá un owner. Y
dejó explícitamente sin decidir **qué máquina lo serviría**.

Dos cosas han cambiado desde entonces:

1. **El [ADR 0022](0022-instancia-dedicada-por-owner.md) define que cada owner
   corre su propia instancia completa.** Cuando exista la primera, *ella* es la
   demostración de una instancia hija — no hay nada que un nombre prestado
   enseñe mejor que el producto real.
2. **El [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md) retira del trabajo
   la máquina que hoy lo sirve.** El nombre quedaba apuntando a un servidor que
   nadie va a actualizar, sostenido por un argumento sobre algo que aún no
   existe.

## Decisión

**`demo.space-os.io` no sirve más que para la demostración original —la anterior
al modelo de instancias— y se eliminará.**

1. **No se mueve al PADRE.** No se le emite certificado y no se le busca máquina.
2. **Sigue donde está**, servido por `209.97.146.136`, hasta que se elimine.
3. **Se eliminará eventualmente. Sin fecha, y la fecha no hace falta**: nada del
   plan depende de cuándo.
4. **La demostración de las instancias hijas será una instancia hija de verdad**,
   la primera que nazca de `F5.7`.

### Lo que esto retira

| | Estado anterior | Ahora |
|---|---|---|
| **`F4.3`** · dominio y certificado de DEMO | Pendiente, condicionada a decidir la máquina | **SIN OBJETO** |
| `docs/evidencias/cert-demo-en-el-padre.txt` | Tarjeta lista para ejecutar | **Sin objeto.** No se corre |
| Criterio ① de `F4.5` | ✅ se cumplía por resolver a la máquina vieja | Sin cambio mientras el nombre exista |

**El plan v3 pasa de 40 a 39 tareas con objeto.**

## Lo que esta decisión SÍ cierra, y antes no

> El ADR 0021 tenía una sección «lo que esta decisión NO dice» con dos huecos.
> **Los dos quedan cerrados aquí**, y por eso este documento lo sustituye en
> lugar de complementarlo.

- **Qué máquina sirve el nombre:** la vieja, hasta que desaparezca. No se mueve.
- **Su certificado, que vence el 2026-10-26:** no se renueva y no se reemite.
  **Ese vencimiento deja de ser un plazo y pasa a ser su caducidad natural.**

## Alternativas consideradas

### A · Moverlo al PADRE y darle certificado

Era el camino vivo hasta hoy: registro A a `137.184.107.53` y ampliar el
certificado de `space-os.io` con `demo` como SAN. **La tarjeta ya estaba
escrita** (`cert-demo-en-el-padre.txt`), con el hallazgo de usar la máquina
vieja como buzón ACME para no mover llaves privadas.

**Se descarta porque resuelve un problema que dejó de existir.** Ese trabajo
existía para sostener una demostración de instancias hijas; con el ADR 0022 esa
demostración es una instancia hija. Mover el nombre habría sido montar
infraestructura nueva —y una renovación que mantener— para un sitio con fecha de
retirada.

### B · Conservarlo indefinidamente, como estaba (ADR 0021)

Cero trabajo hoy. Pero deja **un nombre público de la marca apuntando a una
máquina que por el ADR 0023 nadie va a parchear**, sin que nadie sepa cuándo
deja de ser aceptable. Se descarta: es exactamente la ambigüedad que ha costado
seis ADRs.

### C · Eliminarlo hoy

Lo más limpio en superficie de ataque. **Se descarta por una razón de negocio,
no técnica:** la demostración original sigue teniendo uso mientras no exista la
primera instancia de owner. Se elimina cuando deje de tenerlo.

## Consecuencias

### Positivas

- **Una tarea menos y una tarjeta menos**, y las dos eran trabajo real:
  certificado, DNS y una renovación que mantener a perpetuidad.
- **El plan deja de tener una fecha ajena colgando.** El 2026-10-26 ya no obliga
  a nada.
- **Se cierra el punto que más ha oscilado del expediente**, con sus dos huecos
  resueltos en el mismo sitio.

### Negativas

- **Queda un nombre de la marca sirviendo desde una máquina sin mantenimiento**,
  y ahora sin plazo para dejar de hacerlo. Es el costo aceptado: ver seguridad.
- **«Eventualmente» no es una fecha.** Se asume a sabiendas — atarlo a una fecha
  inventada habría sido peor, porque llegaría y se movería.

### Implicaciones de seguridad

- **Un subdominio de la marca sirve una instalación congelada en `504b4fc`
  (11/08)**, sin ninguna de las correcciones del 27/08 —los diez hallazgos de la
  auditoría, las siete guardas de entrada, la CSP, el borrado con contraseña—.
  Esto **no lo agrava este ADR**: ya era la consecuencia del ADR 0023. Lo que
  cambia es que ahora **tampoco hay un plan para dejar de servirlo**.
- **El certificado no se renueva.** El 2026-10-26 el nombre deja de servir por
  HTTPS. **En la práctica es un apagado parcial, y llega solo.** Vale como
  límite superior de la exposición si nadie lo elimina antes.
- **Superficie que NO se agrega:** al no mover el nombre al PADRE, el plano de
  control **no queda expuesto bajo un segundo nombre** ni comparte certificado
  con un sitio de demostración. Comparado con la alternativa A, esta decisión
  reduce la superficie del PADRE.
- **Nada que rotar por esta decisión.** Los secretos de esa máquina están
  tratados en el [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md), con la
  rotación de Google aplazada a la credencial oficial.

## Cómo revertir

**Barato mientras el nombre exista:** volver a la alternativa A es emitir un
certificado y mover un registro A, y la tarjeta sigue escrita.

**Irreversible en un sentido y solo en uno:** una vez borrado el registro A y
liberado el nombre, recuperarlo depende de que nadie más lo registre. Es un
subdominio de `space-os.io`, así que ese riesgo es nuestro y no de terceros —
mientras conservemos el dominio ápice, el nombre siempre se puede volver a crear.

## Cuándo revisar

**Cuando nazca la primera instancia de owner** (`F5.7`). Ese es el momento en
que la demostración original deja de tener uso, y por tanto el momento de
eliminar el nombre. **No antes, y no hace falta antes.**
