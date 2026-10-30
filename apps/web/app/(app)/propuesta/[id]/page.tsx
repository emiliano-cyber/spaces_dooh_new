import { notFound } from 'next/navigation'
import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { obtenerPropuestaPublica } from '@/lib/server/propuestas-repo'
import { formatFecha, formatFechaHora, formatMonto } from '@/lib/data/derive'
import { ubicacion } from '@/lib/ubicacion'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from '@/lib/rejilla'
import {
  BarraDocumentoPropuesta,
  LigaConQr,
  MapaDocumento,
} from '@/components/demo/propuestas/DocumentoPropuestaCliente'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  Documento imprimible de la PROPUESTA (PROP-COMPLETA, decisión del dueño del
//  29/10): el «Generar PDF» de la ficha, que hasta hoy no hacía nada.
//
//  · Vive FUERA de (shell), igual que el del contrato: sin sidebar ni topbar,
//    para que «Imprimir → Guardar como PDF» dé un documento limpio sin ninguna
//    librería de PDF en el servidor.
//  · Es lo que se le ENTREGA al cliente, así que se arma con su vista
//    (`obtenerPropuestaPublica`): sin tarifas internas, sin quién ajustó qué, y
//    sin el cupón mientras esté PENDIENTE (COD-03). Por dentro el total puede
//    contar ese cupón; aquí no, porque aquí no se ha aprobado.
//  · Lleva lo que eligió el dueño: sitios y precios, fotos y mapa, la liga con
//    su QR, y las condiciones de esta propuesta.
// ============================================================================

const fotoUsable = (f: unknown): f is string =>
  typeof f === 'string' && (f.startsWith('data:image/') || f.startsWith('https://'))

export default async function DocumentoPropuestaPage({ params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) {
    return <div className="mx-auto max-w-2xl p-10 text-[14px] text-ink">No tienes permiso para ver esta propuesta.</div>
  }
  // El token por el id y CON el tenant de la sesión (R2): un id de otra
  // organización no encuentra fila, y entonces es un 404 como cualquier otro.
  const fila = await q1<{ token_publico: string | null }>(
    'select token_publico from propuestas where id = $1 and tenant_id = $2',
    [params.id, await tenantActual()],
  )
  if (!fila?.token_publico) notFound()
  const p = await obtenerPropuestaPublica(fila.token_publico, { conFotos: true })
  if (!p) notFound()

  const ivaPct = p.base ? Math.round((p.iva / p.base) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)
  const desde = p.items.map((i) => String(i.fechaInicio).slice(0, 10)).sort()[0]
  const hasta = p.items.map((i) => String(i.fechaFin).slice(0, 10)).sort().at(-1)
  const aceptable = p.estatus === 'ENVIADA' && !p.aceptadoEn && !p.vencida
  const puntos = p.items.flatMap((it, i) =>
    it.lat != null && it.lng != null && !(it.lat === 0 && it.lng === 0)
      ? [{ id: `p-${i}`, lat: it.lat, lng: it.lng, tono: it.tipoMedio === 'PANTALLA_DIGITAL' ? 'azul' : 'verde', label: `${i + 1}. ${it.sitioNombre}` } as const]
      : [],
  )

  return (
    <div className="doc-wrap">
      <BarraDocumentoPropuesta volverA={`/propuestas/${params.id}`} />

      <article className="doc-hoja doc-comercial">
        <header className="doc-cabecera">
          <div className="doc-cabecera-org">
            {p.orgLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.orgLogoUrl} alt="" className="doc-logo" />
            )}
            <span className="doc-strong">{p.orgNombre ?? ''}</span>
          </div>
          <div className="doc-cabecera-folio">
            <div className="doc-chico">PROPUESTA COMERCIAL</div>
            <div className="doc-strong">{p.folio}{p.version > 1 ? ` · v${p.version}` : ''}</div>
          </div>
        </header>

        <h1 className="doc-titulo">{p.nombre}</h1>

        <dl className="doc-datos">
          <div><dt>Para</dt><dd>{p.clienteNombre ?? '—'}{p.agenciaNombre ? ` · vía ${p.agenciaNombre}` : ''}</dd></div>
          <div><dt>Periodo</dt><dd>{desde && hasta ? `${formatFecha(desde)} – ${formatFecha(hasta)}` : '—'}</dd></div>
          <div>
            <dt>Vigencia</dt>
            <dd>
              {p.aceptadoEn
                ? `Aceptada el ${formatFechaHora(p.aceptadoEn)}`
                : p.vigenteHasta
                  ? `${p.vencida ? 'Venció el' : 'Válida hasta el'} ${formatFecha(p.vigenteHasta)}`
                  : p.estatus === 'BORRADOR'
                    ? 'Se fija al enviarla'
                    : '—'}
            </dd>
          </div>
        </dl>

        <h2 className="doc-h2">PANTALLAS</h2>
        <table className="doc-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th />
              <th>Pantalla y ubicación</th>
              <th className="doc-der">Importe</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((it, i) => {
              const zona = ubicacion([it.alcaldia, it.ciudad, it.estado], ' · ')
              const foto = (it as { foto?: unknown }).foto
              return (
                <tr key={i}>
                  <td className="doc-num">{i + 1}</td>
                  <td className="doc-foto-celda">
                    {fotoUsable(foto) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt="" className="doc-foto" />
                    ) : (
                      <div className="doc-foto doc-foto-vacia">Sin foto</div>
                    )}
                  </td>
                  <td>
                    <div className="doc-strong">{it.sitioNombre}</div>
                    {it.direccion && <div className="doc-chico">{it.direccion}</div>}
                    {zona && <div className="doc-chico">{zona}</div>}
                    <div className="doc-chico">
                      {formatFecha(String(it.fechaInicio).slice(0, 10))} – {formatFecha(String(it.fechaFin).slice(0, 10))}
                      {it.franjaId ? ` · ${it.franjaNombre ?? 'Franja'}${it.franjaHorario ? ` ${it.franjaHorario}` : ''}` : ''}
                    </div>
                  </td>
                  <td className="doc-der doc-num">{formatMonto(it.precio)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* REJILLA-01 · el mismo aviso que la liga: es el documento que firma. */}
        {p.items.some((it) => it.franjaId) && <p className="doc-p doc-chico">{AVISO_FRANJA_NO_VIAJA_AL_CMS}</p>}

        {puntos.length > 0 && (
          <>
            <h2 className="doc-h2">UBICACIÓN</h2>
            <MapaDocumento puntos={puntos} />
            {puntos.length < p.items.length && (
              <p className="doc-p doc-chico">
                {p.items.length - puntos.length} pantalla(s) sin coordenadas; su dirección está en la tabla.
              </p>
            )}
          </>
        )}

        {/* La MISMA escalera que la liga (`/p/[id]`), renglón por renglón: el
            cliente no puede leer dos cuentas distintas de la misma propuesta. */}
        <h2 className="doc-h2">IMPORTE</h2>
        <dl className="doc-escalera">
          <Fila label="Bruto (tarifa de lista)" valor={formatMonto(p.bruto)} />
          {p.paquete && (
            <Fila label={`Paquete "${p.paquete.nombre}" — precio del conjunto`} valor={formatMonto(p.paquete.precio)} />
          )}
          {(p.descuentoVolumenMonto ?? 0) > 0 && (
            <Fila
              label={`Descuento por volumen (${Math.round((p.descuentoVolumenPct ?? 0) * 10) / 10}%)`}
              valor={`− ${formatMonto(p.descuentoVolumenMonto ?? 0)}`}
            />
          )}
          {p.descuentoMonto > 0 && (
            <Fila label={`Descuento (${p.descuentoPct}%)`} valor={`− ${formatMonto(p.descuentoMonto)}`} />
          )}
          {(p.codigoDescuentoMonto ?? 0) > 0 && (
            <Fila
              label={`Código ${p.codigoTexto ?? ''} (${p.codigoDescuentoPct ?? 0}%)`}
              valor={`− ${formatMonto(p.codigoDescuentoMonto ?? 0)}`}
            />
          )}
          <Fila label={`Comisión de agencia (${comisionPct}%)`} valor={`− ${formatMonto(p.base - p.neto)}`} />
          <Fila label="Neto" valor={formatMonto(p.neto)} />
          <Fila label={`IVA ${ivaPct}%`} valor={formatMonto(p.iva)} />
          <Fila label="Total" valor={formatMonto(p.total)} fuerte />
        </dl>

        {p.condiciones && (
          <section className="doc-bloque">
            <h2 className="doc-h2">TÉRMINOS Y CONDICIONES</h2>
            <p className="doc-p doc-condiciones">{p.condiciones}</p>
          </section>
        )}

        <section className="doc-bloque">
          <LigaConQr token={fila.token_publico} aceptable={aceptable} />
        </section>

        {/* Aceptación: la registrada, o el espacio para firmarla en papel. */}
        <div className="doc-firmas">
          <div className="doc-firma">
            {p.aceptadoEn ? (
              <div className="doc-sello">
                <p className="doc-sello-titulo">ACEPTADA EN LÍNEA</p>
                <p className="doc-sello-nombre">{p.aceptadoPor ?? ''}</p>
                <p className="doc-sello-fecha">{formatFechaHora(p.aceptadoEn)}</p>
              </div>
            ) : (
              <div className="doc-linea" />
            )}
            <p className="doc-firma-rol">ACEPTA EL CLIENTE</p>
            <p className="doc-firma-nombre">Nombre, firma y fecha</p>
          </div>
        </div>
      </article>
    </div>
  )
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={fuerte ? 'doc-escalera-fila doc-escalera-total' : 'doc-escalera-fila'}>
      <dt>{label}</dt>
      <dd className="doc-num">{valor}</dd>
    </div>
  )
}
