---
tipo: modulo
estado: verificado
actualizado: 2026-08-27
tags: [frontend, modulos, pantallas, verde]
archivos:
  - apps/web/app/(app)/(shell)/
  - apps/web/components/demo/
  - apps/web/lib/modulos.ts
---

# Módulos internos (dentro del shell)

22 rutas bajo `app/(app)/(shell)/`. Todas exigen sesión y pasan por
[[shell-y-navegacion]].

| Ruta | Módulo | Backend | Componentes propios |
|---|---|---|---|
| `/inicio` | Tablero | `/api/estado` | `KPICard`, `charts` |
| `/actividad` | Bitácora | `acciones` | — |
| `/comercial` | Buscador de inventario | `/api/sitios` | `SiteFicha`, `ReservaDialog`, `AltaSitioDialog`, `SpaceEyeVision` |
| `/disponibilidad` | Calendario | `/api/sitios` | `CalendarioDisponibilidad` |
| `/inventario` | Alta y carga masiva | `/api/sitios`, `/api/sitios/import` | `InventarioTabla`, `ImportarInventarioDialog`, `NuevaPantallaForm`, `ContratoWizard`, `AgregarInventario`, `InfoAnadidaModal` |
| `/network` | Pantallas en red | `sitios.en_network` | — |
| `/arrendadores` | Arrendadores, predios, contratos | `/api/arrendadores`, `/api/contratos` | `ContratoSheet`, `PagosRentaCard`, `CompromisoRentaCard`, `ConciliacionCard`, `PanelFirmas`, `ConstanciaFirmas`, `LicenciasCard`, `GestionRazonesSociales`, `BarraDocumento`, `BajaPropietarioDialog` |
| `/clientes` | Clientes | `/api/clientes` | `ClientesBadge`, `BorrarClienteDialog` |
| `/propuestas`, `/propuestas/[id]` | Propuestas | `/api/propuestas` | `Stepper` |
| `/campanas`, `/campanas/[id]` | Campañas | `/api/campanas/*` | `PipelineView`, `CandadoPanel`, `ValidacionPanel`, `PlaylogsPanel`, `DatosFacturacion`, `EvidenciaGaleria`, `AgregarCreativo` |
| `/creativos` | Creativos | `/api/creatividades` | — |
| `/operaciones`, `/operaciones/ot/[id]` | Órdenes de trabajo | `/api/ot` | `OTVista` |
| `/imprenta` | Imprenta | `/api/impresion` | — |
| `/almacen` | Activos y traslados | `/api/almacen` | — |
| `/finanzas` | Facturas y cobranza | `/api/campanas/[id]/facturar`, `/api/cobranzas/*` | — |
| `/comisiones` | Comisiones | derivado | — |
| `/administracion` | Usuarios, permisos, organizaciones | `/api/usuarios`, `/api/tenants` | `OrganizacionesPanel`, `ControlCambiosPanel`, `permisos.ts` |

> [!tip] Un panel que no aplica **se explica**, no se esfuma
> `OrganizacionesPanel.tsx` mostraba nada cuando no eras el super-admin de
> plataforma, y eso se lee como avería. Desde `2326149` dice **por qué** no lo
> ves. Es el mismo patrón que la contraseña temporal: si el servidor niega algo,
> la pantalla tiene que decirlo.

Desde el 07/08 el alta de usuario y la de organización llevan casilla **«entra
con su cuenta de Google»**: no se teclea contraseña y el servidor genera una que
nadie ve. Ver [[flujo-acceso-con-google]].
| `/configuracion` | Config del negocio | `/api/config`, `/api/organizacion` | — |
| `/integraciones` | Estado de conectores | `/api/integraciones` | — |

## Componentes compartidos

`components/demo/ui/`: `Button`, `Card`, `Modal`, `Sheet`, `Tabs`,
`ConfirmDialog`, `InlinePanel`, `Paginacion`, `Breadcrumbs`, `IndicadorCarga`,
`SpaceOsMark`.

Más `StatusBadge`, `SlotsBadge`, `EmptyState`, `MapView` /
`components/maps/SitiosMap.tsx` (MapLibre + MapTiler).

> [!warning] `components/demo/ui/` es de alto contacto
> Lo importa casi todo. Un cambio de API en `Button` o `Modal` toca decenas de
> pantallas. Ver [[AGENTES]].

## Catálogo de módulos y permisos

`lib/modulos.ts` es el **catálogo explícito** del ADR 0010. `components/demo/
admin/permisos.ts` y `packages/utils/src/permissions.ts` acompañan.
`lib/rbac-coherencia.test.ts` verifica que no se desincronicen.

## `DesbloqueoCambios`

`components/demo/shell/DesbloqueoCambios.tsx` es el candado de la Topbar de los
cambios sensibles. **No es decorativo**: es la salida de un `403
{requiereDesbloqueo:true}` en las rutas `SENSIBLE`. Ver [[autenticacion-y-sesion]].

> [!warning] Ese candado NO sirve para las rutas `REAUTH`
> `DesbloqueoCambios.tsx:57` hace `if (!requiere) return null`: con el
> interruptor `exigir_reautenticacion` apagado —el valor por defecto, y el de
> los cinco tenants de producción— **no se pinta**. Pero las rutas `REAUTH`
> piden la contraseña igual, ignorando ese interruptor, así que su 403 se
> quedaría sin ninguna salida a la vista.
>
> Por eso los dos borrados de catálogo (`BorrarClienteDialog` en
> `clientes/page.tsx`, `BajaPropietarioDialog` en `arrendadores/page.tsx`) piden
> la contraseña **dentro de su propio diálogo** y reintentan ahí mismo. No es
> duplicación por descuido: es el único camino que funciona con el interruptor
> apagado. Ver [[02-Backend/api-endpoints]].

## Dónde hay lógica de negocio en el cliente

En general está bien separada: los cálculos puros viven en `apps/web/lib/*.ts`
con tests (`finanzas-calculo`, `reparto-creativos`, `renta-periodicidad`,
`predio-cercania`, `contrato-vigencia`, `recordatorios-contratos`,
`contrato-documento`).

> [!note] Esto es un acierto, no un problema
> Son funciones **puras** compartidas entre cliente y servidor, y el servidor las
> reimporta para decidir de verdad. El riesgo sería que el cliente decidiera
> solo; no es el caso en los flujos de dinero, donde el guard está en el route
> handler.

Zona **VERDE** salvo lo que toca dinero o catálogo. Ver [[zonas-de-riesgo]].

## Relacionadas
[[shell-y-navegacion]] · [[paginas-publicas]] ·
[[comercial-propuestas-campanas]] · [[finanzas-y-cobranza]] · [[MOC-Proyecto]]
