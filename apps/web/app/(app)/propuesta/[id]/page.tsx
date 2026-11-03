import { notFound } from 'next/navigation'
import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { obtenerPropuestaPublica } from '@/lib/server/propuestas-repo'
import { formatFecha, formatFechaHora, formatMonto } from '@/lib/data/derive'
import { ubicacion } from '@/lib/ubicacion'
import { avisoFranja } from '@/lib/rejilla'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'
import { cifraEnEtiqueta } from '@/lib/i18n/cifra-en-etiqueta'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import { monedaDeLaInstancia } from '@/lib/server/moneda-instancia'
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
  // El idioma de un Server Component lo decide `idiomaDeLaPeticion()`, el
  // MISMO que usa el layout raiz: no hay una segunda regla. Aqui no hay
  // contexto de React del que leer `useTexto()`, asi que se traduce directo
  // con `traducir()`.
  const idioma = idiomaDeLaPeticion()
  const t = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir(idioma, clave, valores)
  // ADR 0048 · los importes van en la moneda de la INSTANCIA. Se pide aqui y
  // no se confia en el layout: Next arma layout y pagina en paralelo, y en un
  // proceso recien arrancado el layout podria no haberla fijado todavia.
  await monedaDeLaInstancia()
  const g = await exigir('comercial', 'ver')
  if (!g.ok) {
    return <div className="mx-auto max-w-2xl p-10 text-[14px] text-ink">{t('propuestas.documento.sin-permiso')}</div>
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
            <div className="doc-chico">{t('propuestas.documento.encabezado')}</div>
            <div className="doc-strong">{p.folio}{p.version > 1 ? ` · v${p.version}` : ''}</div>
          </div>
        </header>

        <h1 className="doc-titulo">{p.nombre}</h1>

        <dl className="doc-datos">
          <div><dt>{t('propuestas.documento.para')}</dt><dd>{p.clienteNombre ?? '—'}{p.agenciaNombre ? t('propuestas.comun.via', { agencia: p.agenciaNombre }) : ''}</dd></div>
          <div><dt>{t('propuestas.documento.periodo')}</dt><dd>{desde && hasta ? `${formatFecha(desde, idioma)} – ${formatFecha(hasta, idioma)}` : '—'}</dd></div>
          <div>
            <dt>{t('propuestas.documento.vigencia')}</dt>
            <dd>
              {p.aceptadoEn
                ? t('propuestas.documento.aceptada', { fecha: formatFechaHora(p.aceptadoEn, idioma) })
                : p.vigenteHasta
                  ? t(p.vencida ? 'propuestas.documento.vencio' : 'propuestas.documento.valida-hasta', {
                      fecha: formatFecha(p.vigenteHasta, idioma),
                    })
                  : p.estatus === 'BORRADOR'
                    ? t('propuestas.documento.se-fija')
                    : '—'}
            </dd>
          </div>
        </dl>

        <h2 className="doc-h2">{t('propuestas.documento.pantallas')}</h2>
        <table className="doc-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th />
              <th>{t('propuestas.documento.col.pantalla')}</th>
              <th className="doc-der">{t('propuestas.documento.col.importe')}</th>
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
                      <div className="doc-foto doc-foto-vacia">{t('propuestas.documento.sin-foto')}</div>
                    )}
                  </td>
                  <td>
                    <div className="doc-strong">{it.sitioNombre}</div>
                    {it.direccion && <div className="doc-chico">{it.direccion}</div>}
                    {zona && <div className="doc-chico">{zona}</div>}
                    <div className="doc-chico">
                      {formatFecha(String(it.fechaInicio).slice(0, 10), idioma)} – {formatFecha(String(it.fechaFin).slice(0, 10), idioma)}
                      {it.franjaId ? ` · ${it.franjaNombre ?? t('propuestas.documento.franja')}${it.franjaHorario ? ` ${it.franjaHorario}` : ''}` : ''}
                    </div>
                  </td>
                  <td className="doc-der doc-num">{formatMonto(it.precio, idioma)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* REJILLA-01 · el mismo aviso que la liga: es el documento que firma. */}
        {p.items.some((it) => it.franjaId) && <p className="doc-p doc-chico">{avisoFranja(idioma)}</p>}

        {puntos.length > 0 && (
          <>
            <h2 className="doc-h2">{t('propuestas.documento.ubicacion')}</h2>
            <MapaDocumento puntos={puntos} />
            {puntos.length < p.items.length && (
              <p className="doc-p doc-chico">
                {t('propuestas.documento.sin-coords', { n: p.items.length - puntos.length })}
              </p>
            )}
          </>
        )}

        {/* La MISMA escalera que la liga (`/p/[id]`), renglón por renglón: el
            cliente no puede leer dos cuentas distintas de la misma propuesta. */}
        <h2 className="doc-h2">{t('propuestas.documento.importe')}</h2>
        <dl className="doc-escalera">
          <Fila label={t('propuestas.comun.bruto-lista')} valor={formatMonto(p.bruto, idioma)} />
          {p.paquete && (
            <Fila label={t('propuestas.comun.paquete-conjunto', { nombre: p.paquete.nombre })} valor={formatMonto(p.paquete.precio, idioma)} />
          )}
          {(p.descuentoVolumenMonto ?? 0) > 0 && (
            <Fila
              label={t('propuestas.comun.descuento-volumen', { pct: cifraEnEtiqueta(Math.round((p.descuentoVolumenPct ?? 0) * 10) / 10, idioma) })}
              valor={`− ${formatMonto(p.descuentoVolumenMonto ?? 0, idioma)}`}
            />
          )}
          {p.descuentoMonto > 0 && (
            <Fila label={t('propuestas.documento.descuento', { pct: cifraEnEtiqueta(p.descuentoPct, idioma) })} valor={`− ${formatMonto(p.descuentoMonto, idioma)}`} />
          )}
          {(p.codigoDescuentoMonto ?? 0) > 0 && (
            <Fila
              label={t('propuestas.comun.codigo-pct', { codigo: p.codigoTexto ?? '', pct: cifraEnEtiqueta(p.codigoDescuentoPct ?? 0, idioma) })}
              valor={`− ${formatMonto(p.codigoDescuentoMonto ?? 0, idioma)}`}
            />
          )}
          <Fila label={t('propuestas.documento.comision', { pct: comisionPct })} valor={`− ${formatMonto(p.base - p.neto, idioma)}`} />
          <Fila label={t('propuestas.comun.neto')} valor={formatMonto(p.neto, idioma)} />
          <Fila label={t('propuestas.comun.iva', { pct: ivaPct })} valor={formatMonto(p.iva, idioma)} />
          <Fila label={t('propuestas.comun.total')} valor={formatMonto(p.total, idioma)} fuerte />
        </dl>

        {p.condiciones && (
          <section className="doc-bloque">
            <h2 className="doc-h2">{t('propuestas.documento.terminos')}</h2>
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
                <p className="doc-sello-titulo">{t('propuestas.documento.aceptada-en-linea')}</p>
                <p className="doc-sello-nombre">{p.aceptadoPor ?? ''}</p>
                <p className="doc-sello-fecha">{formatFechaHora(p.aceptadoEn, idioma)}</p>
              </div>
            ) : (
              <div className="doc-linea" />
            )}
            <p className="doc-firma-rol">{t('propuestas.documento.acepta-cliente')}</p>
            <p className="doc-firma-nombre">{t('propuestas.documento.firma')}</p>
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
