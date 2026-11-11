---
tipo: contrato
estado: verificado
actualizado: 2026-11-11
tags: [frontend, inventario, instancias, instalacion, formularios]
archivos:
  - apps/web/lib/campos-pantalla.ts
  - apps/web/lib/server/campos-pantalla.ts
  - apps/web/app/api/instancia/campos-pantalla/route.ts
  - apps/web/lib/data/campos-pantalla-api.ts
  - apps/web/components/demo/inventario/NuevaPantallaForm.tsx
  - apps/web/components/demo/comercial/AltaSitioDialog.tsx
  - apps/web/components/demo/inventario/campos-ocultos-pantalla.test.ts
  - infra/scripts/entorno-instancia.sh
  - infra/scripts/provision-instancia.sh
  - infra/scripts/instalar-hijo.sh
  - infra/env/app.env.example
---

# Campos ocultos del alta de pantalla — por instancia, al instalar

> [!important] Decidido por el dueño el 2026-11-11
> Los campos al crear una pantalla «deben ser opcionales y cambiables por cada
> cliente de la app», y «opcional en el aspecto de que los quite de su propio
> menú porque no los ocupa — **solo en la instalación de la app en el
> droplet**, sin afectar a los otros en cada actualización».

No es «obligatorio sí/no»: un campo oculto **desaparece** del formulario y con
él su obligatoriedad. El **nombre** no se puede ocultar (identifica la pantalla
y el servidor lo exige).

## Cómo se elige

```
provision-instancia.sh ... --instancia acme --ocultar-campos-pantalla ubicacion,imagen,arrendador --confirmar
instalar-hijo.sh       ... --ocultar-campos-pantalla ubicacion,imagen --confirmar
```

Queda en `/etc/space-os/app.env` como `PANTALLA_CAMPOS_OCULTOS=ubicacion,imagen,arrendador`.
`validar_campos_ocultos` (`entorno-instancia.sh`) limpia espacios, mayúsculas y
repetidos, y **para el alta antes de tocar el servidor** si llega un nombre que
no existe (o `nombre`). Sin la bandera la clave queda vacía: se ve todo, como
antes.

> [!note] Por qué no lo toca una actualización, ni a las otras empresas
> Es del **entorno de cada servidor**, no de la imagen ni de la base: la imagen
> es la misma para toda la flota, no hay migración, y `update.sh` no reescribe
> `app.env`. Cambiarlo después es editar `app.env` y recrear el contenedor; no
> hay pantalla para ello, a propósito.

## Los campos

| Clave | Qué quita | Formulario |
|---|---|---|
| `arrendador` | arrendador, renta y la casilla «propia» → **toda pantalla nace propia** | los dos |
| `direccion` | dirección (en Comercial, la del predio y la comercial) | los dos |
| `exhibicion` | fija / digital | Inventario |
| `ubicacion` | latitud y longitud → nace **sin coordenadas y pendiente de verificar** | los dos |
| `tipo` | tipo de pantalla | los dos |
| `estado` | estado comercial | Inventario |
| `resolucion` | resolución | los dos |
| `caras`, `modalidades`, `slots` | caras, modalidades, slots | Inventario |
| `vision` | la pestaña Computer Vision / AdMobilize | Inventario |
| `tarifa` | tarifa publicada | los dos |
| `precio-m2` | precio por m² | Inventario |
| `imagen` | la pestaña de imagen | Inventario |
| `distrito`, `medidas`, `iluminado`, `comercializacion`, `network`, `cms` | lo suyo | Comercial |

Una pestaña (Inventario) o sección (Comercial) con todos sus campos ocultos no
se pinta.

> [!warning] Dos consecuencias que hay que saber
> - **Sin `arrendador` no hay contrato**, y por eso la pantalla nace **propia**:
>   si no, el servidor pediría un arrendador (ADR 0002) que ya no se puede
>   elegir. Una pantalla propia sí se reserva (no le aplica el ADR 0003).
> - **Sin `ubicacion` la pantalla no sale en el mapa** hasta que alguien le ponga
>   coordenadas en la ficha. Nace marcada pendiente, nunca con un punto
>   inventado.

## Cómo llega al navegador

`GET /api/instancia/campos-pantalla` (sesión + `inventario.ver`) devuelve
`{ ocultos }`, leído del entorno **en cada petición**. `useCamposOcultosPantalla()`
lo pide una vez por carga. Mientras llega, o si falla, devuelve `null` y el
formulario **enseña todo**: un fallo de red no puede dejar dar de alta sin los
campos que la empresa sí exige. Un nombre desconocido puesto a mano en
`app.env` no oculta nada y se avisa una vez en el log.

La lista vive en `lib/campos-pantalla.ts` (`CAMPOS_PANTALLA`) y en
`entorno-instancia.sh` (`CAMPOS_PANTALLA`); `lib/campos-pantalla.test.ts` lee el
script para que no se separen.

## Lo que NO cubre

- La **ficha** de una pantalla ya creada (editar) sigue enseñando todos los
  campos. Lo pedido fue el alta; si se quiere también en la ficha, es otra tarea.
- La **carga masiva** por Excel no cambia: ya trata casi todo como opcional.

## Pruebas

- `components/demo/inventario/campos-ocultos-pantalla.test.ts` — los dos
  formularios: con campos ocultos basta el nombre; el negativo sin nada oculto
  no deja crear. Mutante «ignorar la lista» → 2 de 3 fallan.
- `infra/scripts/pruebas-provision.sh` — tres escenarios CAMPOS-PANTALLA;
  mutante «sin validar» → 4 comprobaciones fallan.

Ver también [[02-Backend/inventario-y-sitios]], [[01-Arquitectura/modelo-instancias-soberanas]].
