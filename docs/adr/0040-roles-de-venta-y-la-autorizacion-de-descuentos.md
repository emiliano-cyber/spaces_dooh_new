# ADR 0040 · Los roles de venta y la autorización de descuentos

**Fecha:** 2026-09-29
**Estado:** en diseño · **nada construido** · la migración espera aprobación
**Decide:** Jochelo, el 2026-09-29
**Se apoya en:** ADR 0039 (la cadena de precio) y el tope de descuento del 28/09

---

## Lo que se pidió

Tres roles nuevos —**director comercial**, **gerente de ventas** y **vendedor**—
con estas reglas:

- Generar **descuentos**, **códigos promocionales** y **crear paquetes** va **con
  autorización del director comercial**.
- El **gerente de ventas** crea **paquetes cerrados sin autorización**.
- El **vendedor** genera cotizaciones, ofrece **descuentos aprobados** y aplica
  **códigos promocionales** a las propuestas.

Más dos cosas aparte: una **calculadora de precio de spot** (la lógica llega
después) y una **bitácora del vendedor** para prospectos, citas y seguimiento.

---

## Lo medido antes de diseñar

| Qué | Cómo está hoy | Qué implica |
|---|---|---|
| Los roles | **Enum de Postgres** `rol_demo` (`db/schema.sql:31`) | Añadir tres es **una migración**. Y un valor de enum **no se puede quitar** después |
| Los permisos | **Tabla** `rol_permisos` (rol, módulo, acción). DUENO 24 filas, COMERCIAL 5 | Definir qué puede cada rol es **datos**, no código. Esto abarata mucho la parte de roles |
| Autorizar a alguien | **NO EXISTE** | Hoy hay dos frenos: la contraseña (`exigirCambioSensible`) y el tope de descuento. **Ninguno es «pedirle permiso a otra persona»** |

> **La consecuencia que manda sobre todo lo demás:** «con autorización del
> director comercial» **no es un ajuste de permisos, es un subsistema nuevo**.
> Decidido por el dueño el 29/09: es **solicitud y aprobación** de verdad, no un
> techo ni una contraseña en el momento.

---

## El reparto entre los cuatro roles

| | **Director comercial** | **Gerente de ventas** | **Vendedor** |
|---|---|---|---|
| Cotizar (propuestas) | sí | sí | **sí** |
| Descuento **dentro de su techo** | sí | sí | **sí** |
| Descuento **por encima de su techo** | — (él es quien aprueba) | **pide autorización** | **pide autorización** |
| Aplicar un **código existente** | sí | sí | **sí** |
| **Crear** códigos promocionales | sí | **pide autorización** | no |
| **Crear** paquetes cerrados | sí | **sí, SIN autorización** | no |
| **Crear** escalas de volumen | sí | **pide autorización** | no |
| **Aprobar** solicitudes | **sí** | no | no |
| Fijar los techos de cada rol | sí | no | no |

**El gerente crea paquetes sin pedir permiso y códigos pidiéndolo, y eso no es
una incoherencia:** un paquete es un precio cerrado para una venta concreta, y un
código es una promesa **con nombre** que se le entrega a un cliente y se puede
canjear N veces. El segundo se le escapa de las manos a quien lo crea; el primero
no.

---

## Los tres caminos del descuento del vendedor

El dueño los quiere **los tres**, y conviven sin pisarse porque responden a
preguntas distintas:

1. **Dentro de su techo.** Un porcentaje máximo por rol. Es el tope del 28/09,
   hecho **por rol** en vez de por organización.
2. **De una lista preaprobada.** Un catálogo de descuentos —5 %, 10 %, 15 %— que
   el director define. El vendedor elige de ahí sin teclear a mano.
3. **Códigos existentes.** No los crea: los aplica.

**Cómo conviven, y hay que decidirlo antes de escribir:** un descuento de la
lista **¿cuenta contra su techo?** Si no cuenta, la lista es una puerta para
saltárselo. → **Pregunta 1**.

---

## El flujo de autorización

Es lo único de este ADR que es un subsistema, y lo que lo hace difícil no es el
estado «pendiente»: son las cinco preguntas de abajo.

```
  el vendedor pide 30 %          su techo es 20 %
            │
            ▼
   ┌──────────────────┐   el director la ve en su bandeja
   │   PENDIENTE      │──────────────────────────────────┐
   └──────────────────┘                                  │
            │                                            ▼
            │                                  ┌───────────────────┐
            │                                  │ APROBADA (con %)  │
            │                                  │  o RECHAZADA      │
            ▼                                  └───────────────────┘
   LA PROPUESTA NO SE PUEDE ENVIAR NI APROBAR MIENTRAS TANTO
```

### Las cinco decisiones duras

**1 · ¿Qué queda bloqueado mientras espera?**
Propuesto: **la propuesta no se puede enviar al cliente ni aprobar** con una
solicitud pendiente. Si se pudiera enviar, el cliente recibiría un precio que
nadie autorizó — y retirarlo después es peor que hacerle esperar.

**2 · ¿Quién aprueba si el director no está?**
Propuesto: **el Dueño siempre puede**. Sin eso, un director de vacaciones para la
venta de toda la empresa. Y queda registrado **quién** aprobó, no solo que se
aprobó.

**3 · ¿La aprobación caduca?**
Propuesto: **muere si la propuesta cambia**. El producto ya sube la `version` de
una propuesta al renegociarla; una aprobación atada a la versión anterior deja de
valer sola. Un 40 % aprobado para una venta de tres pantallas no puede sobrevivir
a que esa venta pase a ser de doce.

**4 · ¿El director puede aprobar MENOS de lo pedido?**
Propuesto: **sí**. «Pediste 30, te doy 25» es la conversación real, y obligar a
rechazar y volver a pedir la convierte en dos.

**5 · ¿Qué se congela?**
Quién pidió, cuánto pidió, quién aprobó, cuánto concedió y cuándo — **dentro del
`snapshot_economico`**, como todo lo demás del ADR 0039. Si esto no se congela,
seis meses después nadie sabe quién autorizó ese margen.

---

## Lo que NO cabe antes del 14 de octubre

Quedan **15 días**. Con el calendario delante:

| Qué | Tamaño | ¿Antes del 14/10? |
|---|---|---|
| **Los tres roles + su matriz de permisos** | 2–3 días | **SÍ** — y es lo que se ve |
| Techos de descuento **por rol** | 1–2 días | **Sí, si hay hueco** |
| La lista de descuentos preaprobados | 1–2 días | No |
| **El flujo de solicitud y aprobación** | **2–3 semanas** | **NO. Y prometerlo sería mentir** |
| La calculadora de precio de spot | ? | **Bloqueada: falta la lógica** |
| La bitácora del vendedor | 1–2 semanas | **No** — decidido: después del Summit |

**Lo honesto para el 14/10** es enseñar **los roles y qué puede cada uno**, con
los techos funcionando. Eso ya cuenta una historia completa —«cada quien vende
hasta donde puede»— sin prometer un flujo de aprobación que no estará.

---

## Lo que hay que decidir antes de escribir código

1. **¿Un descuento de la lista preaprobada cuenta contra el techo del vendedor?**
   Si no cuenta, la lista es la puerta para saltarse el techo.
2. **¿Qué pasa con el rol `COMERCIAL` que ya existe?** Con estos tres, se solapa.
   Y ojo: **un valor de enum de Postgres no se puede quitar**, así que si se
   retira, se retira *de uso*, no del esquema. ¿Se conserva, se reparte su gente
   entre los tres nuevos, o se deja como está para quien no quiera el detalle?
3. **¿El director comercial ve el margen?** Aprobar un descuento sin ver cuánto
   margen deja es firmar a ciegas. Si debe verlo, la bandeja necesita el dato del
   reporte de rentabilidad, y eso la encarece.
4. **¿El gerente de ventas aprueba algo?** Hoy no aprueba nada, solo pide. En
   muchos equipos el gerente autoriza hasta cierto punto y escala al director por
   encima. **Dos niveles cuestan poco más que uno si se diseñan juntos, y mucho
   más si se añaden después.**
5. **La calculadora: ¿qué calcula?** Sin la lógica no se puede ni dimensionar.

---

## Lo que NO se ha verificado

- **Cuántos usuarios hay hoy de cada rol**, ni si alguien está usando `COMERCIAL`
  para hacer de vendedor. Se mide en cada instancia, y no se ha mirado.
- **Si `rol_demo` se usa en algún sitio que asuma exactamente seis valores** —un
  `switch` sin `default`, un mapa de etiquetas—. Añadir tres valores a un enum es
  barato en la base y puede no serlo en el código.
- **Nada de esto se ha construido.** No hay migración escrita ni código. El ADR
  es el diseño, y la migración espera aprobación explícita.
