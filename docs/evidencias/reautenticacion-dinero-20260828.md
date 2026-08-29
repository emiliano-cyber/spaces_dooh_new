# El candado de los cambios sensibles, cerrado — 2026-08-28

**Máquina:** `137.184.107.53` (`space-os.io`) · **Lo corrió:** Emiliano
**Tarjeta:** `C:\Users\Server\Downloads\padre-reautenticacion-28-agosto.txt`
**PR:** #13 (migración y pruebas) · #14 (rollback completado)

> [!success] Qué cambia para quien usa la aplicación
> Facturar una campaña, marcar pagada una cobranza o pagar una renta **piden la
> contraseña**. Hasta hoy no pedían nada.

---

## 1 · Qué estaba abierto, y por qué no era un descuido

`exigirCambioSensible()` hace **dos** cosas: comprueba el permiso del rol y luego
llama a `exigirDesbloqueo()` (`lib/server/cambios.ts:199-210`). Pero esa segunda
mira `tenants.exigir_reautenticacion`, que nacía en **`default false`**.

**El interruptor es opt-in a propósito** (ADR 0009): el Dueño decide si quiere la
fricción. Lo que nadie había mirado es que **nada lo encendía nunca** — ni las
semillas, ni el aprovisionamiento — así que las **ocho** rutas que llaman a ese
guard no pedían nada, y tres mueven dinero:

```
app/api/campanas/[id]/facturar/route.ts:15
app/api/cobranzas/[id]/pagar/route.ts:15
app/api/pagos-renta/[id]/pagar/route.ts:14
```

**El permiso del rol seguía aplicando**: no es que pudiera facturar cualquiera.
Lo que faltaba era comprobar que quien está al teclado es esa persona, y no
alguien que encontró una sesión abierta.

## 2 · La decisión, y por qué tuvo dos mitades

Se eligió **encender el interruptor** en vez de hacer las tres rutas
incondicionales por código. Pero encenderlo hoy no habría durado: **una instancia
nueva nace de `schema.sql` + migraciones**, así que hereda el DEFAULT y no los
datos de nadie. El primer owner habría arrancado con el candado abierto.

| | Qué | Dónde |
|---|---|---|
| **Siempre** | El `DEFAULT` de la columna pasa a `true` | `db/migrations/20260828_reautenticacion_por_defecto.sql` |
| **Hoy** | Encenderlo en las organizaciones que ya existen | `docs/datos/20260828_reautenticacion_encendida.sql` |

**Sigue siendo un interruptor.** Lo que cambia es la **polaridad**: se apaga a
propósito en vez de encenderse a propósito. Un candado que hay que acordarse de
cerrar está abierto la mayor parte del tiempo.

Y la fricción es menor de lo que suena: el desbloqueo dura
**`DESBLOQUEO_MINUTOS = 15`** (`cambios.ts:49`), así que facturar diez campañas
seguidas lo pide **una** vez.

## 3 · Las e2e encontraron el alcance real

Al poner el default en `true`, **veintiuna pruebas** de facturación y cobranza se
pusieron rojas con `403 {"requiereDesbloqueo":true}`.

**No era un defecto de la migración: era la migración funcionando**, y la medida
exacta de a cuántos caminos llegaba. Esas veintiuna son los que hasta ese día
movían dinero sin comprobar quién estaba al teclado.

Se arreglan **desbloqueando una vez en el `beforeAll`**, que es lo que hace una
persona real. Dos detalles que costaron entenderse:

- **En `plazos-cobranza` hay que desbloquear las DOS sesiones.** El desbloqueo
  vive en `sesiones.desbloqueo_expira_en` (`cambios.ts:65-68`), **no en la
  organización**, y el segundo cliente factura en el caso de aislamiento.
- **Nunca por caso.** `cambios/desbloquear/route.ts:20` limita a 5 por usuario e
  IP cada 5 minutos: pedirlo antes de cada prueba agota el cubo y tumba la suite
  con 429. Es la trampa que ya documentaba `borrado-cliente.e2e.test.ts:78-82`.

## 4 · Lo aplicado, con sus salidas

```
$ migrar.mjs   (spaces_prod y spaces_demo)
== 20260828_reautenticacion_por_defecto.sql
1 aplicadas, 1 de datos pendientes.        # x2

$ select count(*) from schema_migrations   ->  74  y  74

$ select pg_get_expr(...) ... 'exigir_reautenticacion'
true
```

**La captura previa**, que es lo que completó el rollback:

```
spaces_prod  ->  rgb    f
spaces_demo  ->  demo   f
```

**Una organización por base, no cinco.** El traspaso hablaba de «los cinco
tenants de producción»: **vivían en el droplet viejo**, que el ADR 0023 sacó del
modelo. En el PADRE hay una y una.

**Pasada en seco antes de aplicar**, con `commit` cambiado por `rollback`:

```
BEGIN · UPDATE 1 · organizaciones_con_candado = 1 · ROLLBACK
```

Y la comprobación de después seguía en `f` — **el seco no cambió nada**, que es
lo que había que demostrar. Aplicado de verdad: las dos bases en `t`.

## 5 · La comprobación que no hace ninguna prueba

Tres casos en el navegador, y el tercero es el que decide:

| | Qué | Resultado |
|---|---|---|
| a | Facturar / marcar pagada una cobranza | **Pide la contraseña** ✅ |
| b | Repetir seguido | **No la vuelve a pedir** ✅ |
| c | **Editar un cliente y guardar** | **No pide nada** ✅ |

**(a) y (b) confirman que el candado se cerró. (c) confirma que no se cerró de
más.** Sin ese tercero, un exceso de fricción se habría descubierto en producción
con alguien tratando de trabajar.

---

## 6 · Dos trampas de esta sesión

### ① El primer rojo era mío, y tardó veinte minutos en decirlo

Las e2e fallaron **las 29 en falso** antes de tocar nada real: worktree recién
creado, **sin `npm run build`**. Es la trampa que `CLAUDE.md` documenta desde el
13/08 — y que se había actualizado **esa misma mañana**.

> **El rojo no decía nada del código: decía que faltaba el build.** Distinguir
> ese rojo del siguiente —que sí era real— fue todo el trabajo.

### ② El README de `docs/datos/` pide algo que aquí no se podía cumplir

Exige «todo por id explícito, nunca por patrón». El `update` **no puede**: tiene
que alcanzar también a las organizaciones creadas entre escribirlo y aplicarlo,
y una lista de ids las dejaría fuera. Queda escrito en su cabecera **en vez de
saltárselo en silencio**, con el argumento de por qué el riesgo no aplica: el
peor caso es cerrar un candado de más, y se abre con una línea.

**El rollback sí va por id**, porque para entonces ya se habían leído.

---

## 7 · Cómo apagarlo, si estorba

Por organización, sin deshacer nada:

```sql
update tenants set exigir_reautenticacion = false where slug = '<slug>';
```

Para deshacerlo todo, el rollback completo está en
`docs/datos/20260828_reautenticacion_encendida_rollback.sql`. Y el DEFAULT, que
sí es esquema:

```sql
alter table tenants alter column exigir_reautenticacion set default false;
```
