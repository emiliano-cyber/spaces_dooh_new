# ADR 0020 — No hay demostración pública: la demo es el producto con instancias hijas

- **Fecha:** 2026-08-26
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Sustituye en la práctica a:** el objeto de `F4.3` y del criterio 1 de `F4.5`
- **Relacionadas:** [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  [ADR 0019](0019-demo-arranca-con-systemd.md) ·
  `docs/evidencias/fase-3-y-4.md`

---

## Contexto

La Fase 4 del plan se diseñó alrededor de una **demostración pública en su propio
dominio**, `demo.space-os.io`, separada de producción. Ese nombre existe desde
julio y lo sirve el droplet `209.97.146.136`.

**Ese planteamiento dejó de describir el producto.** `demo.space-os.io` era la
muestra de *«cómo van a ser las instancias hijas»* cuando todavía no existía
ninguna. Hoy:

- **`space-os.io` es lo oficial**, y también donde se hacen las pruebas.
- **La demostración pasa a ser el producto real funcionando con una o más
  instancias hijas** — es decir, lo que produce la Fase 5.

Una demostración que enseña el producto **con instancias de verdad** vale más que
un sitio aparte que las imita.

## Decisión

**No hay demostración pública en un dominio propio.**

1. **`demo.space-os.io` queda abandonado.** No se le mueve el DNS al PADRE, no se
   le emite certificado, y **su registro A se retira**.
2. **El droplet `209.97.146.136` se retira del todo.** No se toca más.
3. **El proceso del `3001` se queda**, como **banco de pruebas interno**: sin
   nombre público, alcanzable solo desde la propia máquina.
4. **La demostración de cara a cliente será el producto en `space-os.io` más una
   o más instancias hijas**, cuando la Fase 5 las produzca.

## 🔴 Lo que esto deja suelto, y hay que hacer

> **Abandonar el nombre no es lo mismo que retirarlo.**
>
> Si `demo.space-os.io` sigue apuntando a `209.97.146.136`, esa máquina **sigue
> sirviendo un sitio público** con sus cinco organizaciones dentro —`rgb`,
> `telcel`, `g500`, `eyro`, `demo-owner`— hasta que su certificado venza el
> **2026-10-26**. Y ese es **exactamente el riesgo que la Fase 4 existe para
> cerrar**: «demo pública = producción».

**Acción requerida: borrar el registro A de `demo.space-os.io` en Cloudflare.**

Una acción de navegador, ningún servidor de por medio. Es lo que hace que el
criterio 3 de `F4.5` se cumpla **de verdad** y no de palabra.

La máquina no se apaga con eso —seguirá encendida y accesible por su IP— pero
**pierde su nombre público**, que es lo que el criterio pide.

## Consecuencias sobre las tareas de la Fase 4

| Tarea | Antes | Ahora |
|---|---|---|
| **F4.1** · censo | ✅ cerrada | ✅ sin cambio |
| **F4.2** · base de DEMO | ✅ cumplida | ✅ sin cambio — es la del banco de pruebas |
| **F4.3** · dominio y certificado de DEMO | ⏳ pendiente | 🚫 **SIN OBJETO** — no hay dominio que dar |
| **F4.4** · datos y bandera | ✅ cumplida | ✅ sin cambio |
| **F4.5** · smoke y cierre del riesgo | 2 de 4 | ver abajo |

### `F4.5`, criterio por criterio

| # | Criterio | Estado |
|---|---|---|
| 1 | DEMO resuelve a su droplet | 🚫 **sin objeto** — no hay nombre público |
| 2 | Las dos bases no comparten slug | ✅ `demo` vs `rgb` |
| 3 | El viejo ya no sirve ese nombre | ⏳ **al borrar el registro A** |
| 4 | DEMO suscrita al canal `beta` | 🔶 desviación declarada — TH-P4 |

**El riesgo que da nombre a la fase se cierra**, pero por un camino distinto al
que el plan imaginaba: no porque la demo se separe de producción, sino **porque
deja de haber demo pública**. Se escribe así y no se da por hecho.

## Lo que se gana, y lo que se pierde

### Se gana

- **Desaparece el punto más incómodo del ADR 0017**: aquel aceptaba «demo pública
  = plano de control» como precio. **Sin demo pública, ese precio no se paga.**
- Se retira una máquina montada a mano en julio, fuera del modelo.
- No hace falta el token de Cloudflare, ni el certificado de `demo`, ni coordinar
  dos consolas — cinco intentos fallidos el 25/08 por esa coordinación.

### Se pierde

- **No hay dónde enseñar el producto hasta que exista la primera instancia hija.**
  La demostración depende ahora de la **Fase 5**, que a su vez necesita `F5.1`,
  `F5.3` y `F5.4` — código que todavía no existe.
- El banco de pruebas del `3001` **no es sustituto**: no tiene nombre público y
  no se puede enseñar a nadie de fuera.

> **Esa dependencia es el coste real de esta decisión**, y conviene tenerla
> presente: si hace falta enseñar el producto antes de que la Fase 5 entregue,
> habrá que darle un nombre a algo. Hoy no lo hay.

## Cuándo revisar esta decisión

- **Si hace falta enseñar el producto a alguien de fuera antes de la Fase 5.**
  Entonces el banco de pruebas del `3001` necesitaría un nombre y un certificado,
  y volveríamos a algo parecido a lo que este ADR retira.
- **Cuando exista la primera instancia hija.** Ahí se confirma —o no— que sirve
  como demostración.
