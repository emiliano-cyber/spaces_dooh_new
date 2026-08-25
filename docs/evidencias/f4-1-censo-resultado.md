# F4.1 · Censo del droplet `209.97.146.136` — **CERRADA**

**Fecha del censo:** 2026-08-25 · **Ejecutado por:** Emiliano, sobre la máquina
**Estado anterior:** 🛑 declarada **IMPOSIBLE** el 24/08 por pérdida de acceso
**Estado ahora:** ✅ **CERRADA**. Todo solo lectura, sin cambiar nada en la máquina

> [!danger] El acceso nunca se perdió
> El 2026-08-24 se concluyó que no había forma de entrar a esta máquina, y sobre
> esa conclusión se construyeron: la **3ª enmienda a P1** (el droplet queda
> abandonado), el **ADR 0015** (DEMO vive dentro del PADRE), y las declaraciones
> de **IMPOSIBLE** de `F4.1` y `F7.1`.
>
> **La premisa era falsa.** El 25/08 se entró sin dificultad y se completó el
> censo entero. Las cuatro cosas de arriba hay que revisarlas.

---

## 1 · Identidad de la máquina — la trampa ⑥, primero

```
hostname; curl -s ifconfig.me
PIXELED-ubuntu-s-2vcpu-4gb-nyc3
209.97.146.136
```

Es la máquina correcta, y **claramente distinta del PADRE**
(`ubuntu-s-2vcpu-4gb-amd-nyc1`, `137.184.107.53`). El 24/08 se censó entera la
máquina equivocada; esta vez se comprobó antes de nada.

## 2 · Lo que pide el criterio de aceptación

El plan (`:1254-1257`) exige un documento con cinco datos. Los cinco:

| Dato | Valor medido |
|---|---|
| **Commit desplegado** | `504b4fc` · 2026-08-11 · *«fix(contrato): el domicilio del arrendador…»* |
| **Rama** | `main` |
| **Dominios servidos** | `demo.space-os.io` + un `server_name _;` de reserva |
| **Certificado** | `demo.space-os.io`, vence **2026-10-26**, válido 61 días |
| **`APP_URL`** | `https://demo.space-os.io` |
| **`COOKIE_SECURE`** | `1` |

### ✅ La condición de parada del plan NO se dispara

*«Si el commit desplegado no está en `main`, se para y se avisa»* — precedente
`2f28be0`. **`504b4fc` sí está en `main`**, verificado con
`git branch -a --contains`. `main` va solo **3 commits** por delante.

Para dimensionarlo: la rama `feat/servidor-padre-instancias` va **209 commits**
por delante de lo que corre en esa máquina.

## 3 · Las organizaciones que viven ahí

```
rgb|2026-07-02 11:38:09
telcel|2026-07-02 17:35:49
g500|2026-07-03 09:06:16
eyro|2026-07-08 13:06:35
demo-owner|2026-07-27 17:37:26
```

**Cinco, todas de julio.** Son las que el proyecto viene nombrando. La decisión
**«Todo es demo»** ya las cubre: los datos de los tres entornos son de prueba y
se recrean sin preguntar — con su advertencia escrita, que *deja de valer el día
que entre el primer cliente de pago*.

> **`demo-owner` no choca con `demo`**, así que el criterio 2 de F4.5 —las dos
> bases sin ningún slug en común— se puede cumplir con cualquiera de las salidas
> del §5.

## 4 · Estado real, no aparente

| Comprobación | Resultado |
|---|---|
| Proceso | `online`, **13 días** de uptime, 35 reinicios, **0 inestables** |
| Usuario del proceso | **`emiliano`** — no root, al contrario que el PADRE |
| Migraciones en disco | **66**, exactamente las de `main` |
| `POST /api/auth/login/` con correo inexistente | **401** |

**Ese 401 es el dato que no se puede fingir.** Significa que la aplicación
consultó su base de verdad. Se incluyó a propósito, y no lo pedía el plan: el
PADRE pareció vivo cuatro días con la base caída porque nadie hacía una petición
que la tocara. **Esta máquina funciona de verdad.**

### La bandera del autoregistro fecha la máquina

```
NEXT_PUBLIC_AUTOREGISTRO=0
NEXT_PUBLIC_RECUPERAR_PASSWORD=0
NODE_ENV=production
```

Es **`NEXT_PUBLIC_AUTOREGISTRO`**, la variante vieja que se hornea en el build.
**F2.6 la sustituyó** por `AUTOREGISTRO` sin prefijo, decidida al arrancar.
Coherente con `504b4fc`, anterior a esa tarea. Y explica limpiamente el `503` de
**F0.1**: el registro está cerrado desde el build.

---

## 5 · Lo que este censo obliga a reabrir

**`F7.1` recupera su objeto.** Era otro censo de esta misma máquina, declarado
imposible por arrastre. Vuelve a ser trabajo.

**Y el ADR 0015 descansa sobre una premisa falsa.** Descarta reutilizar esta
máquina como DEMO con una sola frase: *«Ya no es una alternativa: no hay
acceso.»* Sí lo hay.

Las dos salidas, con lo medido en la mano:

| | **A · DEMO se queda aquí** | **B · DEMO dentro del PADRE (ADR 0015)** |
|---|---|---|
| Certificado | ✅ existe, válido, **y renovable** mientras el DNS apunte aquí | Hay que emitirlo por DNS-01, con token de Cloudflare |
| Dominio | ✅ ya resuelve | Hay que moverlo |
| Autoregistro | ✅ cerrado | Hay que configurarlo |
| Proceso sin root | ✅ corre como `emiliano` | Hay que crear el usuario `demo` |
| `APP_URL` | ✅ correcto | Hay que escribirlo |
| **Riesgo de la Fase 4** | **se CIERRA**: demo separada del plano de control | se **transforma** en «demo pública = plano de control» |
| Qué falta | recrear la base | token, certificado, nginx, DNS, usuario, `.env`, proceso, alta, semilla |
| Coste | **$0 adicional** — el droplet ya existe y ya se paga | $0, pero se puede apagar el viejo y ahorrar ≈$12/mes |

> **El argumento que sostenía el ADR 0015 se cae solo.** Ese ADR dice que un
> droplet aparte para DEMO *«es la única opción que mantiene el riesgo cerrado de
> verdad»*, y lo descarta **por coste**. Aquí el coste ya está pagado: la máquina
> existe, está encendida y funciona. La opción que cierra el riesgo **vuelve a
> estar sobre la mesa, y gratis**.

### Lo que hay que mirar antes de elegir A

- Corre código del **11/08**, 209 commits por detrás. Para una demo es aceptable,
  pero **actualizarla hoy solo se puede con `deploy.yml`** —el despliegue por
  SSH— que es justo lo que **F3.6** quiere retirar. No es bloqueante; es una
  contradicción que hay que decidir a conciencia.
- Recrear su base **borra los cinco tenants**. Ya decidido aceptable por «Todo es
  demo», y conviene reconfirmarlo ahora que hay nombres concretos delante.

### Y una consecuencia del calendario que antes no existía

El certificado vence el **2026-10-26**. Con acceso, `certbot renew` funciona
mientras `demo.space-os.io` siga apuntando aquí. **Elegir B mata esa renovación**
—al mover el DNS, HTTP-01 deja de validar— y entonces el 26/10 vuelve a ser una
fecha real. Elegir A la disuelve.
