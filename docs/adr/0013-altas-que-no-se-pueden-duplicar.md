# ADR 0013 · Altas que no se pueden duplicar

- **Fecha:** 2026-08-10
- **Estado:** aceptado
- **Contexto:** A5 de la auditoría / INC-07 del plan de incidencias

## El problema, con la evidencia delante

La auditoría lo tituló «doble submit en formularios». Al ir a los datos, lo que
hay en producción es **un** duplicado, y no fue un doble submit:

```
Creó propietario | ADMINISTRADORA DE GASOLINERAS INTERLOMAS | Jochelo | 19:55:06
Creó propietario | ADMINISTRADORA DE GASOLINERAS INTERLOMAS | Jochelo | 19:56:17
```

**Setenta y un segundos.** Una persona dio de alta al propietario, no lo vio en
la lista y lo volvió a dar de alta un minuto después.

Y la otra mitad del diagnóstico tampoco se sostenía: los **doce** formularios de
alta ya deshabilitaban su botón al enviar (`guardando`, `enviando`, `ocupado`).
No había que extender ningún patrón de UI: ya estaba.

## Lo que sí faltaba

Dos cosas distintas, que se confundían en una:

1. **Una rendija en la guarda de UI.** `setGuardando(true)` no deshabilita el
   botón en ese instante, sino en el render siguiente, y el manejador del
   segundo clic todavía lee el valor viejo. Un doble clic rápido de verdad se
   cuela. Es estrecha —un frame— pero existe.

2. **Nada en el servidor.** Y ésa es la que cubre lo que una guarda de navegador
   no puede cubrir jamás: dos pestañas, dos dispositivos, un reintento de red, o
   una persona repitiendo un minuto después.

## Decisión

### 1 · El botón se ocupa del clic en vuelo

`Button` detecta que su `onClick` devolvió una promesa y se bloquea hasta que se
resuelva, con una guarda por **cierre** (`lib/clic-unico.ts`) y no por estado:
un cierre cambia en el mismo instante, y por eso el segundo clic se lo encuentra
puesto.

Va en el componente y **no toca los doce formularios**: su `useState` sigue
sirviendo para pintar «Guardando…», que es lo suyo. Y `Button` no pinta spinner
propio, para no duplicar el indicador que ya tienen.

### 2 · RFC único por organización — regla dura, en la base

Índice único parcial `arrendadores_tenant_rfc_uq` sobre
`(tenant_id, upper(btrim(rfc)))`, solo cuando hay RFC.

Un RFC identifica a un contribuyente: dos arrendadores con el mismo RFC en una
organización son el mismo, **siempre**. Al ser un índice, cubre también la
carrera. Normalizado, porque el RFC se teclea y se pega. Parcial, porque el RFC
es opcional (ADR 0001) y exigirlo frenaría altas legítimas.

### 3 · Nombre repetido — se avisa, no se prohíbe

Aquí nos apartamos de lo que pedía el plan, que era un índice único también
sobre el nombre normalizado.

**Dos propietarios distintos pueden llamarse igual.** Son personas, no solo
empresas. Un índice único no tiene escapatoria: el segundo «Juan Pérez» —otro
señor, otro predio— sería imposible de dar de alta y no habría manera de
continuar.

Así que el servidor responde **409 con el arrendador que ya existe**, y el alta
puede repetirse enviando `confirmaNombreRepetido: true`. En la pantalla, el
botón pasa a «Crear de todos modos». Omitir el campo **nunca** salta el aviso.

Es el mismo criterio que este repositorio ya aplica en otros sitios: *no
bloquear el caso legítimo, hacerlo trazable.*

## Consecuencias

- El único incidente real que hay registrado queda cubierto por (3), no por (1).
- La carrera —que nadie ha observado todavía— queda cubierta por (2).
- El 409 lleva `motivo` (`'rfc' | 'nombre'`) y `existente`, para que la pantalla
  pueda **llevar** al registro que ya está en vez de decir «ya existe» y dejar
  al usuario buscándolo a mano.
- Lo que **no** se hizo: extender esto a clientes, propuestas, OT y demás. En
  producción no hay ni un duplicado en ninguna de esas tablas, y una regla de
  unicidad puesta por si acaso es una que bloquea altas legítimas antes de haber
  evitado ninguna mala. Cuando aparezca la evidencia, el patrón está aquí.

## El patrón, para el próximo endpoint de creación

1. **¿Hay una clave natural que sea única sin excepción posible?** (un RFC, un
   folio, un id externo) → índice único parcial por `tenant_id`, normalizando lo
   que se teclee. Captura el 23505 y devuelve 409 **nombrando** al que ya lo
   tiene.
2. **¿Es solo un parecido sospechoso?** (un nombre) → comprobación en el
   servidor y 409 con salida explícita, nunca un índice.
3. **La guarda de UI no cuenta como protección.** Es comodidad. La protección es
   la base.

## Relacionadas

ADR 0001 (contratos que nacen incompletos) · `db/migrations/20260810_arrendadores_rfc_unico.sql`
· `apps/web/lib/clic-unico.ts` · `apps/web/lib/test/arrendador-duplicado.e2e.test.ts`
