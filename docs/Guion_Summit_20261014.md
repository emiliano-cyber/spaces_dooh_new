# Guion de la presentación — OOH SUMMIT, 2026-10-14

> **Estado: BORRADOR VIVO, abierto el 2026-09-18.** Solo entra aquí lo que está
> **medido**. Lo que todavía no se ha visto funcionar va en §6 marcado como
> pendiente, no en el guion. Si una cifra de este documento no se puede
> reproducir con los pasos que están escritos a su lado, es que caducó: se
> vuelve a medir, no se copia.

Poliforum Siqueiros. Quedan **26 días** al abrir este archivo.

---

## 1 · Lo que se va a contar, en una frase

Un dueño de publicidad exterior no sabe qué pantallas le ganan dinero y cuáles
se lo comen. SPACE OS se lo dice, **y dice por qué**.

El guion entero cuelga de un caso que se ve en pantalla y no hace falta
explicar dos veces:

> **Dos espectaculares casi idénticos. Las mismas campañas. El mismo ingreso.
> Y uno gana la mitad que el otro — porque hay que ir a repararlo el doble de
> veces.**

Todo lo demás de la demostración existe para llegar a esa frase y para
sostenerla con números.

---

## 2 · Antes de entrar a la sala

### Lo que tiene que estar listo

| | |
|---|---|
| Base | `spaces_ver2` en el 5433, con el guion sembrado |
| Acceso | `duena@demo.invalid` · `Demo-Verificacion-2026` |
| Dirección | `http://localhost:3399/spaces-dooh/login/` |
| Arranque | `cd apps/web && npm run build` **y después** `npx next start` |

> [!danger] El orden del arranque no es opcional
> **Build primero, servidor después.** Reconstruir `.next` con el servidor ya
> corriendo deja la página **en blanco, sin un solo error** — el navegador pide
> trozos de un build que ya no existe. Pasó el 18/09 y costó un diagnóstico
> entero. Si hay que reconstruir algo a última hora, **se reinicia el servidor**,
> y matando al dueño del puerto (`Get-NetTCPConnection -LocalPort 3399`), no a la
> ventana de `npx`.

### Ensayo completo, la víspera

No el mismo día. Al menos una pasada entera con el proyector encendido, porque
hay una cosa que **nadie ha comprobado todavía**: cómo se leen estas pantallas a
tres metros. Las tarjetas de indicador se diseñaron para eso, pero está sin
verificar (§6).

---

## 3 · El recorrido, paso a paso

### Paso 1 · Inventario — «esto es lo que tienes»

`Inventario` en el menú. **Seis pantallas** con su tipo, ubicación, tarifa,
arrendador y renta.

Es el paso corto, y sirve para dos cosas: que la sala entienda de qué se habla
cuando luego aparezcan nombres, y que se vea que el dato es **normal** — un
inventario, no una maqueta.

> **Dato para decir en voz alta:** la renta que se ve en esta tabla sale del
> contrato con el arrendador, y **es el único costo del espacio**. No hay un
> costo de compra por separado: es el mismo dinero con otro nombre.

### Paso 2 · Reportes, por pantalla — «esto es lo que te deja»

`Reportes` en el menú, dentro del bloque de Finanzas.

> [!warning] Lo primero que va a aparecer NO es lo que quieres enseñar
> El reporte **abre en el trimestre en curso**, que todavía no ha terminado. La
> renta ya corrió y las ventas aún no están dentro, así que **abre mostrando una
> pérdida**. Hay un aviso en ámbar que lo explica, y el aviso es bueno — pero la
> cifra roja entra por el ojo antes que el aviso.
>
> **Decide antes de subir al escenario cuál de las dos cosas haces:**
>
> **(a) Cambiar el rango de inmediato**, antes de que la sala lea el número.
> Pon `2025-07-01` → `2026-06-30`. Es lo más seguro.
>
> **(b) Usarlo a propósito**, que es más valiente y más vendedor: dejas que se
> vea la pérdida, señalas el aviso ámbar y dices *«esto es un trimestre a medias,
> y el sistema te avisa de que no lo compares — la mayoría de los reportes te
> habrían dejado creer que estás perdiendo dinero»*. Si eliges ésta, **ensáyala**:
> depende de que la frase salga antes que la cara de susto.

Con el rango en `2025-07-01` → `2026-06-30`, agrupado **por pantalla**:

| | Ingreso | Espacio | Operación | Luz | Margen | |
|---|---:|---:|---:|---:|---:|---:|
| **Tlalpan G500** | 576,000 | 336,000 | 115,600 | 41,819 | **82,581** | 14.3 % |
| **G500 Santa Mónica** | 576,000 | 330,000 | 49,200 | 39,894 | **156,906** | 27.2 % |
| Doble Cara DEMO Insurgentes | 360,000 | 144,000 | 49,200 | 20,332 | 146,468 | 40.7 % |
| Una Cara DEMO Insurgentes | 192,000 | 72,000 | 49,200 | 10,166 | 60,634 | 31.6 % |
| Mural DEMO Viaducto | 72,000 | 36,000 | 26,400 | 4,264 | 5,336 | 7.4 % |
| Valla DEMO Zaragoza | 72,000 | 36,000 | 26,400 | 4,264 | 5,336 | 7.4 % |
| **Total (6)** | **1,848,000** | **954,000** | **316,000** | **120,739** | **457,261** | **24.7 %** |

> **Remedido el 2026-09-18.** Las cifras anteriores no llevaban el costo de la
> luz, que ahora entra en el margen de todos los reportes. La brecha entre las
> dos comparables es **74,325**, y la operación explica **66,400 — el 89 %**. El
> espacio pone 6,000 y la luz solo 1,925: **el guion sigue en pie, y ahora con
> una fuente de costo más que lo confirma.**

**La frase de este paso, y conviene decirla tal cual:**

> «Las dos primeras son espectaculares casi iguales. Facturaron **exactamente lo
> mismo**: 576 mil cada una. Y una deja 82 mil y la otra 157 mil. **Setenta y
> cuatro mil pesos de diferencia, con el mismo ingreso.**»

Que la pregunta «¿por qué?» la haga la sala. Si no la hace, se hace desde el
escenario y se pasa al paso siguiente.

### Paso 3 · Por operación — la respuesta

Cambia **Agrupar** a `Por operación`.

| | Visitas | Horas en sitio | Costo operación | % del ingreso | Margen |
|---|---:|---:|---:|---:|---:|
| Tlalpan G500 | **30** | **109.5 h** | 115,600 | 20.1 % | 82,581 |
| G500 Santa Mónica | **20** | **50 h** | 49,200 | 8.5 % | 156,906 |

Y debajo de cada nombre, el desglose de qué tipo de trabajo fue cada visita.
**Tlalpan tiene mantenimiento correctivo, eléctrico y herrería. Santa Mónica no
tiene ninguno de los tres.**

> «Ahí está. **Treinta visitas contra veinte** — pero sobre todo, **109 horas
> contra 50**. No es que vayan más veces: es que cuando van, se quedan. Correctivo,
> eléctrico, herrería. Esa estructura está pidiendo una inversión, y hasta hoy
> nadie tenía cómo saberlo.»

Es el momento de la presentación. Si algo se ensaya dos veces, es éste.

### Paso 4 · Por trimestre — «y va a peor»

Cambia **Agrupar** a `Por trimestre`, mismo rango.

| Trimestre | Ingreso | Margen | % | Visitas |
|---|---:|---:|---:|---:|
| T3 2025 | 462,000 | 130,953 | 28.3 % | 27 |
| T4 2025 | 462,000 | 114,710 | 24.8 % | 28 |
| T1 2026 | 462,000 | 108,288 | 23.4 % | 29 |
| T2 2026 | 462,000 | **103,310** | **22.4 %** | 30 |

> «**El ingreso es plano: 462 mil los cuatro trimestres.** Y el margen cae del 28
> al 22 por ciento mientras las visitas suben de 27 a 30. No estás vendiendo peor. **Te está costando más.** Eso es lo
> que un reporte anual no te enseña nunca.»

Cualquier fila se puede desplegar para ver el detalle mes a mes. Solo si la sala
lo pide: no alarga el guion por gusto.

### Paso 5 · Por metro cuadrado — el cierre técnico

Cambia **Agrupar** a `Por metro cuadrado`.

Convención: **todas las caras**, decidida el 18/09 y ya medida.

| Pantalla | Caras | m² | Margen / m² |
|---|---:|---:|---:|
| **Doble Cara DEMO Insurgentes** | **2** | **80.00** | **1,830.85** |
| G500 Santa Mónica | 1 | 92.88 | 1,689.34 |
| **Una Cara DEMO Insurgentes** | **1** | **40.00** | **1,515.85** |
| Tlalpan G500 | 1 | 92.88 | 889.11 |

> **La pareja que hace visible la decisión:** las dos de Insurgentes miden lo
> mismo físicamente (10 × 4), y el ranking las separa **solo por las caras** —
> 80 m² contra 40. Si alguien pregunta por qué el metro cuadrado suma caras,
> ésas dos son la respuesta.

Lo que sí se puede decir con seguridad, porque no depende de la cifra:

> «Y fíjense en lo que dice arriba de la tabla: **dos pantallas quedaron fuera
> porque no tienen las medidas capturadas**. El sistema no las promedia ni las
> cuenta como cero: **dice que le faltan.** Un número que miente es peor que no
> tener el número.»

Ese detalle vende más que la tabla. Es la diferencia entre un reporte y un
reporte en el que se puede confiar.

---

## 4 · La trampa del cuestionario de bienvenida

> [!success] RESUELTO el 2026-09-18 — ya existe el guion de reinicio
> `node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad`
> cuenta lo que borraría **sin tocar nada**; con `--borrar` lo hace. Exige la URL,
> el nombre de la base repetido **y** la bandera: tres cosas a la vez. Se niega
> por nombre sobre `spaces`, `spaces_e2e` y cualquiera con `prod`.
>
> **La secuencia del ensayo:** reiniciar → enseñar el cuestionario → volver a
> sembrar con `semilla-demo.mjs`. Medido: el ciclo completo devuelve la base al
> mismo sitio, al dígito.
>
> Lo de abajo se conserva porque explica **por qué** hacía falta.

> [!danger] No se pueden enseñar las dos cosas en la misma base
> El cuestionario de razones sociales **solo aparece si la organización no tiene
> ninguna razón social registrada** — la condición es un `count(*)` sobre
> `entidades_fiscales` (`lib/server/bienvenida-repo.ts:70`). En cuanto se
> contesta, no vuelve a salir. **Es el comportamiento correcto**, y es una trampa
> para una demostración en vivo.
>
> Y **la base de demostración ya tiene 2 razones sociales dadas de alta**, así que
> **el cuestionario ya no sale ahí**. Medido el 18/09.
>
> Salidas, a elegir antes del ensayo:
>
> 1. **Dos bases**: una virgen para enseñar el cuestionario y `spaces_ver2` para
>    todo lo demás. Obliga a cerrar sesión y volver a entrar en medio de la
>    demostración — se ve, y se ve mal.
> 2. **Una base virgen y contestar el cuestionario en vivo**, y que las razones
>    sociales que se creen sean las que después se usan. Es lo más honesto y lo
>    que mejor cuenta la historia, pero deja el resto de la demostración sin los
>    cuatro trimestres sembrados.
> 3. **Un guion de reinicio** que borre las razones sociales de `spaces_ver2`
>    justo antes de empezar, dejando intacto el resto. **Es la buena**, y hay que
>    escribirla: hoy no existe.

**Acción pendiente, con dueño:** escribir ese guion de reinicio. Sin él, hay que
elegir entre enseñar el alta de razones sociales o enseñar los reportes con
historia, y esa es una elección que no debería existir.

---

## 5 · Lo que NO se enseña, y por qué

Decidirlo ahora, no en la sala.

- **No se abre el código.** Ni una vez.
- **No se enseña una pantalla que no se ensayó.** Si algo llega tarde, no entra.
- **No se promete el timbrado fiscal.** Lo que hoy emite el sistema son
  comprobantes de pago, no CFDI timbrado; el timbrado llega después por
  integración. Si alguien pregunta, ésa es la respuesta: es el plan, no un hueco.
- **No se dan fechas de lo que no está construido.**

---

## 6 · Lo que todavía no está, al 2026-09-18

Esta lista es el trabajo que queda, y se vacía o se convierte en «no se enseña».

| | Estado | Qué falta |
|---|---|---|
| ~~**m² por caras**~~ | ✅ **HECHO** | Aplicado, medido y en el paso 5 |
| ~~**Multi-entidad: pantalla y asignación**~~ | ✅ **HECHO** | En `main` con el PR #91, y sembrado en la demo |
| ~~**Consumo de luz**~~ | ✅ **HECHO** | 40 recibos sembrados, con 8 huecos a propósito |
| ~~**Guion de reinicio** del cuestionario~~ | ✅ **EXISTE** | `scripts/reiniciar-razones-sociales.mjs`, con ensayo sin `--borrar` |
| **Lectura a tres metros** | **Sin verificar** | Una pasada con el proyector, la víspera |
| **Dónde se presenta** | **Sin decidir** | ¿Portátil con la base local, o una instancia de verdad servida? No es lo mismo y cambia el ensayo |

### Y la pregunta que nadie ha hecho todavía

**¿Desde dónde se presenta?** Todo lo de este guion está medido contra un
servidor local en un portátil. Si el 14 de octubre se enseña desde una instancia
real servida por internet, hay que ensayarlo **ahí**, con su latencia y su
certificado. Es la clase de cosa que solo falla el día que importa.

---

## 7 · Cómo se reproduce cada cifra de este documento

Para que nadie tenga que creerme:

```
# 1. Levantar
cd apps/web && npm run build
DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces_ver2" npx next start -p 3399

# 2. Entrar en http://localhost:3399/spaces-dooh/login/
#    duena@demo.invalid / Demo-Verificacion-2026

# 3. Reportes → rango 2025-07-01 a 2026-06-30 → cambiar «Agrupar»
```

Y si la base se pierde, se vuelve a sembrar — el guion de los datos es
determinista y produce exactamente los mismos números:

```
node scripts/semilla-demo.mjs --org=demo-rentabilidad --trimestres=4 --verificar
```
