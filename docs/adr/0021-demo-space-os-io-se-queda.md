# ADR 0021 — `demo.space-os.io` se queda: es la demostración de las instancias hijas

- **Fecha:** 2026-08-26
- **Estado:** **Sustituida por [ADR 0024](0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md)** (2026-08-27)
- **Decide:** Emiliano
- **Sustituye a:** [ADR 0020](0020-no-hay-demo-publica.md)
- **Relacionadas:** [ADR 0015](0015-demo-dentro-del-padre.md) ·
  [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  `docs/evidencias/fase-3-y-4.md`

---

## Contexto

El [ADR 0020](0020-no-hay-demo-publica.md), escrito **el día anterior**, decidió
que no habría demostración pública en un dominio propio: `demo.space-os.io`
quedaba abandonado y **su registro A se retiraba**. De ahí salió una tarjeta
humana —«borrar el registro A en Cloudflare»— que se repitió en nueve
documentos.

**Esa lectura era mía, no de quien decide.** El razonamiento de 0020 partía de
que `demo.space-os.io` había nacido para imitar instancias hijas que todavía no
existían, y concluía que al llegar las de verdad el nombre sobraba. La
conclusión correcta es la contraria: **cuando existan las instancias hijas, ese
nombre es exactamente donde se enseñan.**

## Decisión

**`demo.space-os.io` no se retira. Es el nombre público de la demostración de
las instancias hijas.**

1. **Su registro A no se borra.** La tarjeta humana que pedía borrarlo **queda
   cancelada**, y con ella la sección «Lo que esto deja suelto» del ADR 0020.
2. El nombre **se conserva** para enseñar el producto funcionando como lo verá
   un owner: una instancia hija, no el PADRE.
3. El proceso del `3001` dentro del PADRE sigue siendo el banco de pruebas
   interno ([ADR 0019](0019-demo-arranca-con-systemd.md)). Eso no cambia.

## Lo que esta decisión NO dice

> Se escribe aparte a propósito. Tres de las cuatro decisiones anteriores sobre
> DEMO se revirtieron en cuatro días, y buena parte del coste vino de **rellenar
> los huecos por deducción** en vez de dejarlos marcados.

**Qué máquina sirve `demo.space-os.io` a partir de ahora no está decidido.** Hoy
apunta a `209.97.146.136`, el droplet de julio. Las opciones abiertas son
dejarlo ahí hasta que exista la primera instancia hija, o moverlo a esa
instancia cuando nazca. **No se elige aquí.**

De eso cuelgan, sin resolver: si se le emite certificado y con qué método, y
qué pasa con el certificado actual de esa máquina, que **vence el 2026-10-26**.

## Consecuencia que queda registrada, y no se vuelve a plantear

Mientras `demo.space-os.io` siga apuntando a `209.97.146.136`, esa máquina
**sigue sirviendo un sitio público** con cinco organizaciones dentro —`rgb`,
`telcel`, `g500`, `eyro`, `demo-owner`—, que es la situación que el criterio 3
de `F4.5` describía como riesgo.

**Con este ADR eso deja de ser una tarea pendiente y pasa a ser una condición
aceptada.** Queda escrito una vez, aquí, para que el estado del proyecto no
mienta — no como recordatorio ni como objeción.

## Efecto sobre `F4.5`

| # | Criterio | Antes (ADR 0020) | Ahora |
|---|---|---|---|
| 1 | DEMO resuelve a su droplet | 🚫 sin objeto | ✅ **se cumple** — resuelve a `209.97.146.136` |
| 2 | Las dos bases no comparten slug | ✅ | ✅ sin cambio |
| 3 | El viejo ya no sirve ese nombre | ⏳ al borrar el registro A | 🚫 **retirado** — el nombre se conserva a propósito |
| 4 | DEMO suscrita al canal `beta` | 🔶 TH-P4 | 🔶 sin cambio |

**`F4.3`** (dominio y certificado de DEMO) sale de «sin objeto» y vuelve a
**pendiente**, condicionada a la decisión que este ADR deja abierta.

## Cuándo revisar

~~Cuando nazca la primera instancia hija: ahí se decide si `demo.space-os.io`~~
~~se mueve a ella, y con eso se cierra lo que aquí queda abierto.~~

> **Revisado el 2026-08-27, un día después:
> [ADR 0024](0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md).**
> Los dos huecos que este ADR dejaba abiertos —qué máquina sirve el nombre y qué
> pasa con su certificado— quedan cerrados allí: **el nombre es solo la
> demostración original y se eliminará**. No se mueve, no se le emite
> certificado, y su vencimiento del 2026-10-26 pasa a ser caducidad natural en
> vez de plazo.
