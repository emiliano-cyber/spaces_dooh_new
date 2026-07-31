import { notFound } from 'next/navigation'
import { exigir, tienePermiso } from '@/lib/server/auth'
import { expedienteContrato } from '@/lib/server/contrato-expediente'
import { FALTA } from '@/lib/contrato-documento'
import { BarraDocumento } from '@/components/demo/arrendadores/BarraDocumento'
import { PanelFirmas } from '@/components/demo/arrendadores/PanelFirmas'
import { ConstanciaFirmas, type FirmaConstancia } from '@/components/demo/arrendadores/ConstanciaFirmas'
import { cn } from '@/lib/cn'
import { firmasDeContrato } from '@/lib/server/firmas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Documento imprimible del contrato de arrendamiento. Vive FUERA de (shell) a
// propósito: sin sidebar ni topbar, para que "Imprimir → Guardar como PDF" del
// navegador produzca un documento limpio sin depender de ninguna librería de
// PDF en el servidor.

// El documento nombra los roles en prosa («EL ARRENDADOR»); las firmas usan el
// enum. Se emparejan aquí para no acoplar el redactor puro al modelo de firmas.
function firmaDe(firmas: FirmaConstancia[], rol: string): FirmaConstancia | undefined {
  const parte = rol.includes('ARRENDATARIO') ? 'ARRENDATARIO' : 'ARRENDADOR'
  return firmas.find((f) => f.parte === parte)
}

function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  })
}

// Resalta los huecos para que salten a la vista al revisar antes de firmar.
function Texto({ children }: { children: string }) {
  if (!children.includes(FALTA)) return <>{children}</>
  return (
    <>
      {children.split(FALTA).map((trozo, i, arr) => (
        <span key={i}>
          {trozo}
          {i < arr.length - 1 && (
            <span className="doc-falta" title="Dato pendiente de capturar">
              {FALTA}
            </span>
          )}
        </span>
      ))}
    </>
  )
}

export default async function ContratoDocumentoPage({ params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-[14px] text-ink">
        No tienes permiso para ver este contrato.
      </div>
    )
  }
  // La fecha de firma se resuelve aquí (no dentro del redactor, que es puro) y
  // se pasa como dato, para que el documento sea reproducible en un test.
  const hoy = new Date().toISOString().slice(0, 10)
  const doc = await expedienteContrato(params.id, hoy)
  if (!doc) notFound()
  // El enlace del arrendador solo para quien puede comprometer a la empresa:
  // con ese token se firma desde la ruta pública, sin sesión. Ver la misma
  // regla en GET /api/contratos/[id]/firma. Esta página es la OTRA superficie
  // que lo pintaba —`PanelFirmas` ofrece el botón de copiar el enlace— y llega
  // aquí con permiso de solo `ver`.
  const incluirToken = await tienePermiso(g.usuario.rol, 'arrendadores', 'crear')
  const estadoFirmas = await firmasDeContrato(params.id, { incluirToken })

  return (
    <div className="doc-wrap">
      <BarraDocumento faltantes={doc.faltantes} />

      <article className="doc-hoja">
        <h1 className="doc-titulo">{doc.titulo}</h1>

        <p className="doc-p doc-preambulo">
          <Texto>{doc.preambulo}</Texto>
        </p>

        <h2 className="doc-h2">DECLARACIONES</h2>
        {doc.declaraciones.map((d) => (
          <section key={d.encabezado} className="doc-bloque">
            <p className="doc-p doc-strong">{d.encabezado}</p>
            {d.incisos.map((inc, i) => (
              <p key={i} className="doc-p doc-inciso">
                <Texto>{inc}</Texto>
              </p>
            ))}
          </section>
        ))}

        <h2 className="doc-h2">CLÁUSULAS</h2>
        {doc.clausulas.map((c) => (
          <section key={c.ordinal} className="doc-bloque">
            <p className="doc-p doc-strong">
              {c.ordinal}. {c.titulo}.
            </p>
            {c.parrafos.map((p, i) => (
              <p key={i} className="doc-p">
                <Texto>{p}</Texto>
              </p>
            ))}
          </section>
        ))}

        <p className="doc-p doc-cierre">
          <Texto>{doc.lugarYFecha}</Texto>
        </p>

        {/* Bloque de firmas. Quien firmó electrónicamente muestra su sello en vez
            de una línea en blanco: imprimir una raya vacía debajo de una firma
            que ya existe invita a firmar dos veces el mismo documento. */}
        <div className="doc-firmas">
          {doc.firmas.map((f) => {
            const firma = firmaDe(estadoFirmas.firmas, f.rol)
            const electronica = firma?.estatus === 'FIRMADA'
            return (
              <div key={f.rol} className="doc-firma">
                {electronica ? (
                  <div className={cn('doc-sello', firma!.invalidada && 'doc-sello-mal')}>
                    <p className="doc-sello-titulo">
                      {firma!.invalidada ? 'FIRMA INVALIDADA' : 'FIRMADO ELECTRÓNICAMENTE'}
                    </p>
                    <p className="doc-sello-nombre">{firma!.nombreFirmante}</p>
                    <p className="doc-sello-fecha">{fechaHora(firma!.firmadoEn)}</p>
                  </div>
                ) : (
                  <div className="doc-linea" />
                )}
                <p className="doc-firma-rol">{f.rol}</p>
                {f.nombre.split('\n').map((linea, i) => (
                  <p key={i} className="doc-firma-nombre">
                    <Texto>{linea}</Texto>
                  </p>
                ))}
              </div>
            )
          })}
        </div>

        {/* Constancia: ESTO SÍ SE IMPRIME. Es lo que hace del PDF un documento
            probatorio y no solo una copia bonita del texto. */}
        <ConstanciaFirmas estado={estadoFirmas} />

        <PanelFirmas
          contratoId={params.id}
          inicial={estadoFirmas}
          hayFaltantes={doc.faltantes.length > 0}
        />

        <p className="doc-aviso">
          Documento generado automáticamente por SPACE OS a partir del expediente del contrato.
          Es un BORRADOR basado en cláusulas de uso común; debe ser revisado y validado por un
          abogado antes de su firma.
        </p>
      </article>
    </div>
  )
}
