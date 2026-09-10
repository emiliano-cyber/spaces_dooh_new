# E4 · La carga en la instancia — **CERRADA**

- **Fecha:** 2026-09-09
- **Plan:** `docs/Plan_Migracion_Datos_g500.md`, última etapa
- **Ejecutado por:** Emiliano, sobre `g500.space-os.io` (`142.93.113.106`)
- **Archivo aplicado:** `carga-g500.sql`, `sha256 96349d65…`
- **Decisión que la autoriza:** [ADR 0031](../adr/0031-los-datos-de-g500-se-rescatan-del-droplet-viejo.md)

> [!success] El resultado en una línea
> Las **12 pantallas de g500 están en su propia instancia, con sus tarifas**, y
> ninguna persona ni línea de bitácora del droplet viejo viajó con ellas.

---

## Los cinco GATE

| | Comprobación | Resultado |
|---|---|---|
| 1 | `sha256` del archivo, en el equipo y **en el servidor** | `96349d65…` en los dos |
| 2 | La máquina es la de g500 | `hostname` → `g500`, IP → `142.93.113.106` |
| 3 | La organización existe y está vacía | slug `g500`, **0** pantallas |
| 4 | El respaldo previo, **en el equipo local** | 184 719 bytes, `f6d3f6e7…` idéntico |
| 5 | Se ve desde fuera | el Dueño entró con Google y vio sus datos |

> [!danger] GATE 2 atrapó exactamente lo que existía para atrapar
> Durante la operación hubo una sesión abierta en la máquina equivocada. El
> prompt decía `root@PIXELED-ubuntu-s-2vcpu-4gb-nyc3` — el **droplet viejo** — y
> se comprobó con `hostname; curl ifconfig.me` antes de escribir nada. Un `psql`
> de carga ahí habría mezclado los datos de g500 con los de las otras cuatro
> organizaciones, y de eso no hay vuelta atrás limpia.
>
> Es el mismo error del **2026-08-24**, cuando se censó entera la máquina
> equivocada y sobre esa medición se levantaron cuatro conclusiones falsas. La
> diferencia es que esta vez había un gate escrito antes del primer comando.

## Lo que quedó dentro, medido después de cargar

| | Medido | El censo decía |
|---|---|---|
| `sitios` (pantallas) | **12** | 12 |
| **`sitio_modalidades`** | **12** | 12 ← las rescatadas |
| `contratos_arrendamiento` | 13 | 13 |
| `pagos_renta` | 29 | 29 |
| `facturas` | 3 | 3 |
| `cobranzas` | 15 | 15 |
| `usuarios` | **1** | ninguno viajaba: es el Dueño que nació el 09/09 |
| `acciones` (bitácora) | **2** | ninguna viajaba: son de la propia instancia |

Y las tarifas, que es lo que hace de esto un rescate y no una copia:

```
AUTOPISTA MEX.-QRTO. #2998 ANTES SANTA MONICA - G500 | 55000.00
AV. PALO SOLO #3515 - G500                           | 85000.00
BLVD. MAGNOCENTRO INTERLOMAS - CARA A - G500         | 85000.00
```

Los **8 contadores de folio** entraron donde antes había **0 filas**, así que la
instancia no puede reemitir un folio ya usado. (Y con eso la vuelta atrás de esa
tabla es exacta: borrar las 8 devuelve el estado previo.)

## Lo que la verificación demostró **en negativo**

La transacción se niega a confirmar si alguno de estos falla, y ninguno falló:

- ni un usuario más de los que había antes — comparado contra la foto tomada al
  empezar, no contra un número fijo;
- ni una línea de bitácora más;
- las 12 modalidades cuelgan de pantallas **de esta organización**;
- los recuentos por tabla cuadran con el censo, uno por uno.

## Dos cosas que pasaron y conviene que estén escritas

**El guard de doble carga funcionó de verdad.** Al correr el archivo por segunda
vez, contestó:

```
ERROR: Esta instancia YA tiene 12 pantallas de g500. La carga ya se hizo: no se repite.
```

No fue un ensayo: la carga ya se había aplicado, y el guard evitó una segunda
pasada que habría chocado contra las claves primarias a mitad de camino.

**Y apareció un defecto que no tiene nada que ver con los datos.** Al navegar la
aplicación por primera vez con contenido dentro, las redirecciones mandaban el
navegador a `localhost:3000`. **No lo causó la carga** —solo insertó filas— sino
el middleware, que construía las redirecciones con el origen interno del
contenedor. Es **un defecto de flota**: está en el artefacto, así que lo tienen
todas las instancias. Diagnóstico y corrección en la rama
`fix/middleware-redireccion-localhost`; llega a las instancias por versión nueva,
no tocando servidores.

## Lo que queda pendiente de esta operación

1. **Retirar las dos llaves SSH** puestas a mano en el droplet viejo y en la
   instancia — tarjeta `migracion-g500-retirar-llaves.txt`.
2. **Borrar los archivos temporales** de la instancia: `/tmp/carga-g500.sql`
   lleva los datos comerciales de g500 y `/tmp/antes-carga-g500.dump` lleva su
   base entera. Va en la misma tarjeta.
3. **El respaldo de esta instancia sigue sin salir del droplet.** Faltan
   `SPACES_KEY` y `SPACES_SECRET` (deuda del 09/09). Hoy se resolvió bajando el
   dump a mano al equipo local, y eso no escala a una flota.
