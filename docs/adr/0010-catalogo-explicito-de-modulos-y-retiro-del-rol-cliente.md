# ADR 0010: Catálogo explícito de módulos y retiro del rol CLIENTE

- **Fecha:** 2026-08-04
- **Estado:** Aceptada

> Aprobada el 2026-08-04, incluida la separación de `inventario` respecto de
> `comercial`. **Aviso operativo:** el rol COMERCIAL deja de poder dar de alta o
> editar pantallas del catálogo; conserva la lectura.
>
> **Orden de despliegue obligatorio:** primero la migración
> `db/migrations/20260804_modulo_inventario.sql` (como `postgres`), después el
> código. Al revés, las rutas de `sitios` exigen un permiso que nadie tendría y
> el alta de inventario devolvería 403 a todo el mundo.

Responde a la recomendación final de la auditoría QA del 04/08/2026:
*«la matriz de permisos no cubre todos los módulos (faltan Clientes, Propuestas,
Creativos, Disponibilidad, Campañas, Almacén, Comisiones, Integraciones y
Actividad) ni el rol "Cliente externo"; completar antes de abrir a usuarios
externos»*.

## Contexto

### Lo primero: NO hay un hueco de autorización

La auditoría infiere que faltan módulos en la matriz y de ahí sugiere que hay
áreas sin proteger. Se verificó en el código y en `spaces_prod`, y **no es así**.

`tienePermiso()` (`auth.ts:93-99`) consulta `rol_permisos` y devuelve `false` si
no encuentra fila: **es fail-closed**. Y el cruce entre lo que la API exige y lo
que la matriz concede sale completo:

| Módulo | Acciones en `rol_permisos` | Pares que usa la API |
|---|---|---|
| `comercial` | ver, crear, aprobar | 24 × crear, 2 × ver |
| `arrendadores` | ver, crear, aprobar | 21 × crear, 3 × aprobar, 2 × ver |
| `administracion` | ver, crear, aprobar | 7 × crear, 5 × ver, 1 × aprobar |
| `operaciones` | ver, crear, aprobar | 4 × crear, 3 × ver |
| `imprenta` | ver, crear, aprobar | 3 × crear, 1 × ver |
| `finanzas` | ver, crear, facturar | 2 × crear, 1 × facturar |
| `network` | ver, crear | 1 × ver |
| `dashboard` | ver | — |

**Todo par que la API exige existe en la matriz.** Solo dos rutas de las ~90 no
llevan guard, y ambas por diseño: `propuestas/publica/[id]` (liga compartible,
va por token) y `signup` (hoy cerrada con `NEXT_PUBLIC_AUTOREGISTRO=0`, A6).

### Lo que sí pasa: nueve áreas de UI van agrupadas

Los módulos «que faltan» no son módulos de permiso: son **áreas de la interfaz
que se autorizan bajo un módulo paraguas**.

| Área de UI | Se autoriza como | Tiene API propia |
|---|---|---|
| Clientes | `comercial` | sí |
| Propuestas | `comercial` | sí |
| Campañas | `comercial` | sí |
| Disponibilidad, Creativos, Comisiones, Actividad | `comercial` / lectura del estado | no, leen `/api/estado` |
| Almacén | `operaciones` | sí |
| Integraciones | `administracion` | sí |

De ahí salen dos consecuencias reales:

1. **No se puede separar lo que el negocio querría separar.** `comercial.crear`
   concede a la vez crear clientes, armar propuestas, generar campañas **y editar
   el catálogo de inventario** (`app/api/sitios`, 4 usos de `comercial.crear`).
   Un vendedor puede reestructurar el catálogo de pantallas. La renta al
   arrendador sí está separada a propósito bajo `arrendadores.crear`
   (`InventarioTabla.tsx:35-42`), lo que demuestra que la distinción ya se
   pensó — pero solo para el dinero que sale, no para el catálogo.

2. **La matriz miente por omisión.** Administración → Roles muestra 8 filas
   (`usuarios-repo.ts:158-161`) y parece completa. Quien la mira no tiene forma
   de saber que marcar `comercial` abre además Clientes, Propuestas y Campañas.

### El rol CLIENTE es una trampa

`usuarios-controller.ts:20` acepta `'CLIENTE'` como rol válido al crear un
usuario. En `rol_permisos` hay **cero filas** para ese rol, y siendo fail-closed
eso significa que un usuario CLIENTE entra y recibe 403 en **todo**, incluido
`dashboard.ver`. Se puede crear, no sirve para nada, y nada avisa.

En producción hay **0 usuarios con rol CLIENTE** (verificado en los 5 tenants).
El portal del cliente externo que sí existe —`/portal/[token]` y `/p/[id]`— es
**público por token y no requiere cuenta** (`middleware.ts:92-103`). Es decir: el
acceso externo ya está resuelto sin roles, y este rol es un resto de un diseño
que no se llegó a construir.

## Decisión

1. **Se retira `'CLIENTE'` del enum de roles** (`usuarios-controller.ts:20`). El
   acceso externo se sirve por el portal con token, que no necesita cuenta. Si
   algún día hace falta un login externo real, será su propio ADR, con su propio
   modelo de permisos — no un rol vacío heredado.

2. **El catálogo de áreas se hace explícito y visible.** Se declara en el código
   un mapa `área de UI → módulo de permiso`, y la matriz de Administración pasa a
   mostrar **las 17 áreas** con el módulo que las gobierna, en vez de 8 módulos
   sueltos. La unidad de autorización sigue siendo el módulo; lo que cambia es
   que deja de estar oculto qué abre cada casilla.

3. **Se separa `inventario` de `comercial`.** El catálogo de pantallas
   (`app/api/sitios`, alta/edición/baja/reubicación) pasa a exigir
   `inventario.crear` en vez de `comercial.crear`. Es la única división con
   justificación de segregación de funciones: vender no debería implicar poder
   reestructurar el activo que se vende. Se siembra `inventario.*` para `DUENO` y
   `inventario.ver` para `COMERCIAL`, de modo que **ningún usuario actual pierde
   capacidad de lectura** y solo se retira a COMERCIAL la escritura del catálogo.

4. **No se dividen las demás.** Clientes, Propuestas y Campañas se quedan bajo
   `comercial`: son un mismo flujo de trabajo, las hace la misma persona, y
   partirlas multiplicaría las casillas sin que nadie pueda explicar cuándo
   marcaría una y no otra.

5. **Se añade una prueba que falla si la API exige un par que la matriz no
   concede a nadie.** Es el guard que habría convertido el rol CLIENTE en un
   error de CI en vez de en un hallazgo de auditoría.

## Alternativas consideradas

### A. Un módulo de permiso por cada área de UI (17 módulos)

**Qué es:** lo que pide literalmente la auditoría.
**A favor:** granularidad máxima; la matriz refleja la navegación 1 a 1.
**Por qué se descarta:** multiplica por dos las casillas (17 × 3 acciones × 5
roles ≈ 255) para expresar distinciones que nadie ha pedido. Cuatro de esas áreas
(Disponibilidad, Creativos, Comisiones, Actividad) **ni siquiera tienen API
propia**: leen `/api/estado`, así que su «permiso» sería decorativo — ocultaría
el menú sin proteger ningún dato, que es peor que no tenerlo, porque aparenta un
control que no existe. Una matriz que nadie entiende se rellena a bulto, y eso
produce más agujeros que una matriz corta y honesta.

### B. Dejar la matriz como está y solo documentar el agrupamiento

**Qué es:** un comentario en el código y una nota en el manual.
**A favor:** cero riesgo.
**Por qué se descarta:** no arregla la trampa del rol CLIENTE, que es el único
punto con consecuencia real, ni que un vendedor pueda editar el catálogo. Y la
documentación que contradice a la pantalla pierde siempre.

### C. Sembrar permisos para CLIENTE en vez de retirar el rol

**Qué es:** dar a CLIENTE lectura de sus propias campañas.
**A favor:** habilita el «usuario externo» que la auditoría menciona.
**Por qué se descarta:** exigiría filtrar por *pertenencia al recurso* (que la
campaña sea de ese cliente), y `rol_permisos` solo modela `rol × módulo ×
acción` — **no tiene forma de expresar "solo las filas que son tuyas"**. Sembrar
permisos sin ese filtro le daría a un externo lectura de las campañas de **todos**
los clientes del tenant. Es exactamente el agujero que la auditoría teme, creado
al intentar cerrarlo. El acceso externo por token ya resuelve el caso de uso.

### D. Permisos por usuario además de por rol

**Qué es:** excepciones individuales sobre el rol.
**A favor:** flexibilidad para los casos raros.
**Por qué se descarta:** un modelo de permisos con excepciones individuales se
vuelve imposible de auditar en cuanto crece — que es justo lo que estamos
tratando de evitar. Si un usuario necesita algo distinto, es que falta un rol.

## Consecuencias

**Positivas**

- Desaparece un rol que producía usuarios rotos en silencio.
- La matriz deja de aparentar cobertura que no tiene: se ve qué abre cada
  casilla.
- Vender y reestructurar el catálogo dejan de ser el mismo permiso.
- La prueba de coherencia convierte esta clase de hallazgo en fallo de CI.
- El modelo sigue siendo `rol × módulo × acción`: legible de un vistazo.

**Negativas**

- **COMERCIAL pierde la escritura del catálogo de pantallas.** Es el objetivo,
  pero si alguien de ventas venía dando de alta inventario, deja de poder — hay
  que avisarlo antes de desplegar, no después.
- Las cuatro áreas sin API propia siguen sin permiso real. Se muestran en el
  catálogo con su módulo, pero quien lea la matriz podría creer que ocultar el
  menú protege el dato, y no es así: lo protege `/api/estado`. Se documenta en el
  propio mapa.
- Retirar un valor del enum es incompatible hacia atrás si existieran usuarios
  CLIENTE. Hoy son **cero**, así que el riesgo es nulo — pero la migración debe
  comprobarlo en vez de asumirlo.

**Implicaciones de seguridad**

- **Superficie que se quita:** el rol CLIENTE (que era una vía para crear cuentas
  en un estado no previsto) y la escritura del catálogo para el rol comercial.
- **Superficie que se agrega:** ninguna. No hay endpoints nuevos ni datos nuevos;
  `inventario` es un módulo más en una tabla que ya existe.
- **Dónde viven los secretos:** no aplica; esta decisión no toca credenciales.
  La reautenticación se trata en el [ADR 0009](0009-reautenticacion-individual-en-vez-de-contrasena-compartida.md).
- **Autenticación/autorización:** el modelo no cambia de forma, solo de
  contenido. Se conserva la propiedad importante —**fail-closed**—, y la prueba
  nueva la protege: si alguien añade una ruta con un módulo inexistente, hoy
  quedaría cerrada a todos y nadie se enteraría hasta que un usuario reportase un
  403; con la prueba, falla en CI.
- **Datos sensibles:** ninguno nuevo. El aislamiento por tenant sigue siendo RLS
  a nivel de base, independiente de esta capa.
- **Dependencias nuevas:** ninguna.
- **Superficie de auditoría:** sin cambio. Los cambios de rol ya se registran
  (`app/api/usuarios/[id]/route.ts:18-22`).

## Cómo revertir

Todo es reversible y barato:

- **El rol CLIENTE**: volver a añadir la cadena al enum. Como no hay usuarios con
  ese rol, no hay datos que reconciliar.
- **El módulo `inventario`**: una migración que devuelva las filas a
  `comercial` y un cambio de literal en `app/api/sitios`. Ambos son aditivos; los
  permisos son datos, no esquema.
- **El catálogo de áreas**: es una constante en el código y una tabla en pantalla.

Ninguna parte de esta decisión escribe datos irreversibles ni destruye
información existente. A los 6 meses, deshacerla cuesta un `insert`/`delete` en
`rol_permisos` y un despliegue.
