---
tipo: modulo
estado: verificado
actualizado: 2026-08-07
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
| `/arrendadores` | Arrendadores, predios, contratos | `/api/arrendadores`, `/api/contratos` | `ContratoSheet`, `PagosRentaCard`, `CompromisoRentaCard`, `ConciliacionCard`, `PanelFirmas`, `ConstanciaFirmas`, `LicenciasCard`, `GestionRazonesSociales`, `BarraDocumento` |
| `/clientes` | Clientes | `/api/clientes` | `ClientesBadge` |
| `/propuestas`, `/propuestas/[id]` | Propuestas | `/api/propuestas` | `Stepper` |
| `/campanas`, `/campanas/[id]` | Campañas | `/api/campanas/*` | `PipelineView`, `CandadoPanel`, `ValidacionPanel`, `PlaylogsPanel`, `DatosFacturacion`, `EvidenciaGaleria`, `AgregarCreativo`, `ReadinessPanel`, `ReporteVisual` |
| `/creativos` | Creativos | `/api/creatividades` | — |
| `/operaciones`, `/operaciones/ot/[id]` | Órdenes de trabajo | `/api/ot` | `OTVista` |
| `/imprenta` | Imprenta | `/api/impresion` | — |
| `/almacen` | Activos y traslados | `/api/almacen` | — |
| `/finanzas` | Facturas y cobranza | `/api/campanas/[id]/facturar`, `/api/cobranzas/*` | — |
| `/comisiones` | Comisiones | derivado | — |
| `/administracion` | Usuarios, permisos, organizaciones | `/api/usuarios`, `/api/tenants` | `OrganizacionesPanel`, `ControlCambiosPanel`, `permisos.ts` |
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

`components/demo/shell/DesbloqueoCambios.tsx` es el modal que aparece cuando el
servidor responde `403 {requiereDesbloqueo:true}`. **No es decorativo**: es la
única salida de un cambio sensible. Ver [[autenticacion-y-sesion]].

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
