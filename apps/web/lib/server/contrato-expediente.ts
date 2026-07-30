import 'server-only'
import { q1 } from './db'
import { tenantActual } from './tenant'
import { generarContrato, fechaISO, type DocumentoContrato } from '@/lib/contrato-documento'

// ============================================================================
//  lib/server/contrato-expediente.ts — Reúne todo lo que el documento del
//  contrato necesita y se lo pasa al redactor puro (lib/contrato-documento).
//
//  El anclaje del contrato decide QUÉ espacio se describe:
//    · con `predio_id` → el predio completo, que es lo que se arrendó; sus
//      pantallas son lo que se instala encima.
//    · sin `predio_id` → la pantalla suelta.
//  Es el mismo discriminador que usa el resto del módulo (ver derive.ts).
// ============================================================================

export async function expedienteContrato(
  contratoId: string,
  fechaFirma: string,
): Promise<DocumentoContrato | null> {
  const tenantId = await tenantActual()
  const r = await q1<Record<string, any>>(
    `select c.fecha_inicio, c.fecha_fin, c.monto_renta, c.periodicidad, c.moneda,
            c.deposito, c.dia_pago, c.incremento_anual_pct, c.uso_permitido,
            c.auto_renovable, c.ciudad_firma, c.predio_id,
            a.nombre  as arr_nombre,  a.rfc as arr_rfc, a.curp as arr_curp,
            a.direccion as arr_direccion, a.nacionalidad as arr_nacionalidad,
            rs.razon_social as arr_razon_social,
            t.razon_social as ata_razon_social, t.nombre as ata_nombre, t.rfc as ata_rfc,
            t.domicilio_fiscal as ata_domicilio, t.representante_legal as ata_representante,
            t.datos_constitucion as ata_constitucion,
            s.nombre as sitio_nombre, s.codigo_proveedor as sitio_codigo,
            s.tipo_medio as sitio_tipo, s.direccion as sitio_direccion,
            s.ciudad as sitio_ciudad, s.ancho as sitio_ancho, s.alto as sitio_alto,
            p.nombre as predio_nombre, p.direccion as predio_direccion
       from contratos_arrendamiento c
       left join arrendadores a on a.id = c.arrendador_id
       left join arrendador_razon_social rs on rs.id = c.razon_social_id
       left join sitios  s on s.id = c.sitio_id
       left join predios p on p.id = c.predio_id
       join tenants t on t.id = c.tenant_id
      where c.id = $1 and c.tenant_id = $2`,
    [contratoId, tenantId],
  )
  if (!r) return null

  const esDePredio = r.predio_id != null
  const num = (x: unknown) => (x == null ? null : Number(x))

  return generarContrato({
    arrendatario: {
      // `razon_social` es el nombre legal; `nombre` es el comercial y sirve de
      // respaldo para que el documento no salga con un hueco donde va la parte.
      razonSocial: r.ata_razon_social ?? r.ata_nombre ?? null,
      rfc: r.ata_rfc ?? null,
      domicilioFiscal: r.ata_domicilio ?? null,
      representanteLegal: r.ata_representante ?? null,
      datosConstitucion: r.ata_constitucion ?? null,
    },
    arrendador: {
      nombre: r.arr_nombre ?? null,
      rfc: r.arr_rfc ?? null,
      curp: r.arr_curp ?? null,
      direccion: r.arr_direccion ?? null,
      nacionalidad: r.arr_nacionalidad ?? null,
      razonSocial: r.arr_razon_social ?? null,
    },
    espacio: {
      nombre: esDePredio ? r.predio_nombre : r.sitio_nombre,
      codigo: esDePredio ? null : r.sitio_codigo,
      tipoMedio: r.sitio_tipo ?? null,
      direccion: (esDePredio ? r.predio_direccion : r.sitio_direccion) ?? r.sitio_direccion ?? null,
      ciudad: r.sitio_ciudad ?? null,
      // Las medidas describen la estructura, no el predio: en un contrato de
      // predio hay varias pantallas y ninguna medida única lo representa.
      ancho: esDePredio ? null : num(r.sitio_ancho),
      alto: esDePredio ? null : num(r.sitio_alto),
      predio: esDePredio ? null : (r.predio_nombre ?? null),
    },
    terminos: {
      fechaInicio: fechaISO(r.fecha_inicio),
      fechaFin: fechaISO(r.fecha_fin),
      montoRenta: num(r.monto_renta),
      periodicidad: r.periodicidad ?? null,
      moneda: r.moneda ?? 'MXN',
      deposito: num(r.deposito),
      diaPago: num(r.dia_pago),
      incrementoAnualPct: num(r.incremento_anual_pct),
      usoPermitido: r.uso_permitido ?? null,
      autoRenovable: !!r.auto_renovable,
      ciudadFirma: r.ciudad_firma ?? null,
    },
    fechaFirma,
  })
}
