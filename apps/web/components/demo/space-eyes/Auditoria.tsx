'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Loader2, Lock, LockOpen } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/cn'
import {
  auditoriaApi,
  auditoriaCampanaApi,
  type AuditoriaCampana as AuditoriaCampanaDatos,
  type AuditoriaEquipo,
  type CreativoAuditado,
} from '@/lib/data/space-eyes-api'
import { textoDeError } from '@/lib/data/space-eyes-se'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatNumero } from '@/lib/formato-numero'

// Los mismos que `Graficas`: recharts pinta en SVG y no entiende las clases de
// Tailwind, asi que el color entra como variable CSS y sigue al tema.
const COLOR = { borde: 'var(--border)', texto: 'var(--muted)', acento: 'var(--accent)', hover: 'var(--surface-2)' }

// ============================================================================
//  La BITÁCORA de una pantalla: qué salió, cuándo y cuánto (Space Eye 036).
// ----------------------------------------------------------------------------
//  Esta pantalla responde una pregunta distinta de «Detecciones». Allí se ve
//  QUÉ anuncios pasaron, con su foto, que es el comprobante. Aquí se ve CUÁNTO
//  y A QUÉ HORA, que es lo que se factura y lo que alguien puede discutir.
//
//  LO QUE NO SE PUEDE DECIR AQUÍ, Y POR QUÉ ESTÁ ESCRITO EN LA PANTALLA
//  -------------------------------------------------------------------
//  Una cámara mide por muestreo: sabe en cuántas de SUS MIRADAS estaba el
//  anuncio, no cuántas veces lo sacó el reproductor. «312 reproducciones» es
//  un número que se cae en cuanto el anunciante pregunta cómo se midió; «312
//  de 1 840 miradas, de 6:00 a 23:00» se sostiene. Por eso cada cifra sale con
//  su denominador al lado y la pantalla lo dice con todas sus letras arriba,
//  no en una nota al pie que nadie lee.
//
//  Y por eso también se enseña con qué VARA se midió. Un teléfono solo puede
//  decir en qué recorridos salió el anuncio -su APK ya está en la calle y no
//  se puede cambiar-; una Raspberry cuenta cada mirada. Mezclar las dos sin
//  avisar sería el error que invalida el reporte entero.
// ============================================================================

const PERIODOS = [
  { dias: 7, clave: 'spaceeyes.auditoria.periodo.7' },
  { dias: 30, clave: 'spaceeyes.auditoria.periodo.30' },
  { dias: 90, clave: 'spaceeyes.auditoria.periodo.90' },
] as const

function desdeHace(dias: number): string {
  return new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10)
}

/** «2026-11-24» en el idioma de quien lo lee, sin inventarse una zona horaria. */
function dia(iso: string, idioma: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  // `new Date(a, m-1, d)` y no `new Date(iso)`: el segundo lo lee como UTC y en
  // México pinta el día anterior. La bitacora de un día no puede salir con la
  // fecha de otro.
  return new Date(a, m - 1, d).toLocaleDateString(idioma, { day: 'numeric', month: 'short' })
}

/** «18:03:00» -> «18:03». Los segundos no los lee nadie en un reporte. */
function reloj(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

export function Auditoria({ id }: { id: number }) {
  const { t, idioma } = useIdioma()
  const [dias, setDias] = useState<number>(30)
  const [datos, setDatos] = useState<AuditoriaEquipo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    auditoriaApi(id, desdeHace(dias))
      .then((d) => vivo && setDatos(d))
      .catch((e: unknown) => vivo && setError(textoDeError(e, idioma) ?? String(e)))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [id, dias, idioma])

  // formatNumero(n, decimales, idioma): sin el 0, el idioma se leeria como
  // decimales y los miles saldrian sin coma.
  const n = (x: number) => formatNumero(x, 0, idioma)

  return (
    <div className="flex flex-col gap-4">
      {/* ── El periodo ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            type="button"
            onClick={() => setDias(p.dias)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
              dias === p.dias
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface text-muted hover:text-fg',
            )}
          >
            {t(p.clave)}
          </button>
        ))}
        {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-error bg-error-soft p-3 text-[12px] text-error">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{t('spaceeyes.auditoria.error', { error })}</span>
        </div>
      )}

      {datos && !datos.dias_medidos && !cargando && (
        <div className="rounded-md border border-border bg-surface p-4 text-[12px]">
          <div className="text-fg">{t('spaceeyes.auditoria.vacio')}</div>
          <div className="mt-1 text-muted">{t('spaceeyes.auditoria.vacio.ayuda')}</div>
        </div>
      )}

      {datos && datos.dias_medidos > 0 && (
        <>
          {/* ── La cabecera: el total y, pegada, la vara con que se midió ── */}
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {/* Sin miradas, el titular son los RECORRIDOS. Escribir «0
                  miradas» encima de una lista con meses de historia no es
                  prudencia: es una cifra falsa. */}
              <span className="text-[20px] font-semibold tabular-nums text-fg">
                {datos.vistazos > 0
                  ? t('spaceeyes.auditoria.miradas', { n: n(datos.vistazos) })
                  : t('spaceeyes.auditoria.recorridos', { n: n(datos.vueltas) })}
              </span>
              <span className="text-[12px] text-muted">
                {t('spaceeyes.auditoria.en-dias', { n: n(datos.dias_medidos) })}
              </span>
            </div>

            {/* La misma advertencia, con la palabra que esta en pantalla:
                hablar de «miradas» encima de una lista de recorridos deja la
                frase coja justo donde tiene que sostenerse. */}
            <p className="mt-1.5 max-w-prose text-[12px] leading-snug text-muted">
              {t(datos.vistazos > 0
                ? 'spaceeyes.auditoria.que-es'
                : 'spaceeyes.auditoria.que-es.vuelta')}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Sello
                tono={datos.medida === 'vistazo' ? 'ok' : 'aviso'}
                icono={<Clock className="h-3 w-3" />}
                texto={t(
                  datos.medida === 'vistazo'
                    ? 'spaceeyes.auditoria.medida.vistazo'
                    : 'spaceeyes.auditoria.medida.vuelta',
                )}
                ayuda={t(
                  datos.medida === 'vistazo'
                    ? 'spaceeyes.auditoria.medida.vistazo.ayuda'
                    : 'spaceeyes.auditoria.medida.vuelta.ayuda',
                )}
              />
              {datos.zona === 'servidor' && (
                <Sello
                  tono="aviso"
                  texto={t('spaceeyes.auditoria.zona.servidor')}
                  ayuda={t('spaceeyes.auditoria.zona.servidor.ayuda')}
                />
              )}
              <Sello
                tono={datos.dias_cerrados === datos.dias_medidos ? 'ok' : 'neutro'}
                icono={
                  datos.dias_cerrados === datos.dias_medidos ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <LockOpen className="h-3 w-3" />
                  )
                }
                texto={t('spaceeyes.auditoria.cerrados', {
                  n: n(datos.dias_cerrados),
                  total: n(datos.dias_medidos),
                })}
                ayuda={t('spaceeyes.auditoria.cerrados.ayuda')}
              />
              {datos.perdidos > 0 && (
                <Sello
                  tono="aviso"
                  icono={<AlertTriangle className="h-3 w-3" />}
                  texto={t('spaceeyes.auditoria.perdidos', { n: n(datos.perdidos) })}
                  ayuda={t('spaceeyes.auditoria.perdidos.ayuda')}
                />
              )}
            </div>
          </div>

          {/* ── Anuncio por anuncio ── */}
          <Seccion titulo={t('spaceeyes.auditoria.creativos.titulo')}>
            <div className="flex flex-col gap-px bg-border">
              {datos.creativos.map((c) => (
                <FilaCreativo
                  key={c.phash}
                  c={c}
                  vistazos={datos.vistazos}
                  horasVistazos={datos.horas_vistazos}
                />
              ))}
            </div>
          </Seccion>

          {/* ── Día por día ── */}
          <Seccion titulo={t('spaceeyes.auditoria.dias.titulo')}>
            <div className="flex flex-col gap-px bg-border">
              {datos.dias.map((d) => (
                <div
                  key={d.dia}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-3 py-2 text-[12px]"
                >
                  <span className="w-16 shrink-0 font-medium text-fg">{dia(d.dia, idioma)}</span>
                  <span className="tabular-nums text-fg">
                    {d.vistazos > 0
                      ? t('spaceeyes.auditoria.miradas', { n: n(d.vistazos) })
                      : t('spaceeyes.auditoria.recorridos', { n: n(d.vueltas) })}
                  </span>
                  {d.primera && d.ultima && (
                    <span className="tabular-nums text-muted">
                      {t('spaceeyes.auditoria.dia.ventana', {
                        desde: reloj(d.primera),
                        hasta: reloj(d.ultima),
                      })}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    {d.perdidos > 0 && (
                      <span className="text-warning">
                        {t('spaceeyes.auditoria.perdidos', { n: n(d.perdidos) })}
                      </span>
                    )}
                    {d.medida === 'vuelta' && (
                      <span className="text-muted">{t('spaceeyes.auditoria.medida.vuelta')}</span>
                    )}
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        d.cerrado ? 'text-success' : 'text-muted',
                      )}
                      title={t('spaceeyes.auditoria.cerrados.ayuda')}
                    >
                      {d.cerrado ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                      {t(
                        d.cerrado
                          ? 'spaceeyes.auditoria.dia.cerrado'
                          : 'spaceeyes.auditoria.dia.abierto',
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Seccion>
        </>
      )}
    </div>
  )
}

// ─── Un anuncio: cuánto salió, y a qué horas ────────────────────────────────

function FilaCreativo({
  c,
  vistazos,
  horasVistazos,
}: {
  c: CreativoAuditado
  vistazos: number
  horasVistazos: Record<string, number>
}) {
  const { t, idioma } = useIdioma()
  const [abierto, setAbierto] = useState(false)
  const n = (x: number) => formatNumero(x, 0, idioma)

  // Las 24 horas, siempre las 24: un hueco a las 3 de la madrugada es un dato
  // («no salió») y con solo las horas que tienen pasadas se leería como si el
  // día fuera más corto.
  const horas = useMemo(() => {
    const por = new Map(c.horas.map((h) => [h.hora, h.pasadas]))
    return Array.from({ length: 24 }, (_, h) => ({
      hora: h,
      pasadas: por.get(h) ?? 0,
      miradas: Number(horasVistazos[String(h)] ?? 0),
    }))
  }, [c.horas, horasVistazos])

  const hayHoras = c.horas.length > 0
  const nombre = c.nombre || c.campana_anunciante || c.campana_nombre
  // QUÉ NÚMERO SE ENSEÑA, Y POR QUÉ LOS DOS CUANDO ESTÁ MEZCLADO.
  //
  //   · medido mirada a mirada todos los días -> `pasadas`, que es la cuenta
  //     de verdad, con su denominador al lado;
  //   · medido por recorrido todos los días -> `apariciones`, que es lo único
  //     que ese equipo puede decir;
  //   · MEZCLADO -> los dos. Enseñar solo `apariciones` escondía el número
  //     grande (un anuncio con 31 pasadas se leía como «en 8 de 10
  //     recorridos»), y enseñar solo `pasadas` haría creer que cubre todo el
  //     periodo cuando solo cubre los días de la vara buena. Los dos juntos,
  //     con el aviso al lado, es lo único que no miente en ninguna dirección.
  const porVistazo = c.medida === 'vistazo' || c.mezclada

  return (
    <div className="bg-surface">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={!hayHoras}
        title={hayHoras ? undefined : t('spaceeyes.auditoria.horas.ninguna')}
        className={cn(
          'flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-[12px]',
          hayHoras && 'hover:bg-surface-2',
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium text-fg">
          {nombre || t('spaceeyes.creativo.nombre.marcador')}
        </span>

        {porVistazo && (
          <>
            <span className="shrink-0 tabular-nums font-semibold text-fg">
              {t('spaceeyes.auditoria.pasadas', { n: n(c.pasadas) })}
            </span>
            {!c.mezclada && (
              <span className="shrink-0 tabular-nums text-muted">
                {t('spaceeyes.auditoria.de-miradas', { n: n(c.pasadas), total: n(vistazos) })}
              </span>
            )}
          </>
        )}
        {(!porVistazo || c.mezclada) && (
          <span className="shrink-0 tabular-nums text-muted">
            {t('spaceeyes.auditoria.apariciones', {
              n: n(c.apariciones),
              total: n(c.revisiones),
            })}
          </span>
        )}

        {c.mezclada && (
          <span
            className="shrink-0 rounded bg-warning-soft px-1.5 py-0.5 text-[11px] text-warning"
            title={t('spaceeyes.auditoria.mezclada.ayuda')}
          >
            {t('spaceeyes.auditoria.mezclada')}
          </span>
        )}
      </button>

      {abierto && hayHoras && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
            {t('spaceeyes.auditoria.horas.titulo')}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horas} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borde} vertical={false} />
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: COLOR.texto }}
                  stroke={COLOR.borde}
                  interval={2}
                  tickFormatter={(h: number) => String(h)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: COLOR.texto }}
                  stroke={COLOR.borde}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: COLOR.hover }}
                  formatter={(v: number, _k, p: any) => [
                    t('spaceeyes.auditoria.de-miradas', {
                      n: n(v),
                      total: n(p?.payload?.miradas ?? 0),
                    }),
                    '',
                  ]}
                  labelFormatter={(h: number) => t('spaceeyes.auditoria.hora', { hora: String(h) })}
                />
                <Bar dataKey="pasadas" fill={COLOR.acento} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">{titulo}</div>
      <div className="overflow-hidden rounded-md border border-border">{children}</div>
    </div>
  )
}

function Sello({
  texto,
  ayuda,
  icono,
  tono,
}: {
  texto: string
  ayuda?: string
  icono?: React.ReactNode
  tono: 'ok' | 'aviso' | 'neutro'
}) {
  return (
    <span
      title={ayuda}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]',
        tono === 'ok' && 'bg-success-soft text-success',
        tono === 'aviso' && 'bg-warning-soft text-warning',
        tono === 'neutro' && 'bg-surface-2 text-muted',
      )}
    >
      {icono}
      {texto}
    </span>
  )
}

// ============================================================================
//  La misma bitácora, cruzando las pantallas de UNA campaña.
// ----------------------------------------------------------------------------
//  Es el reporte que se le manda al anunciante, y por eso incluye las pantallas
//  donde su anuncio salió por programática sin que nadie lo hubiera relacionado
//  con la campaña a mano: el arte casó con el suyo (Space Eye 035) y eso es lo
//  que de verdad se vio.
// ============================================================================

export function AuditoriaCampana({ id, dias = 30 }: { id: number; dias?: number }) {
  const { t, idioma } = useIdioma()
  const [datos, setDatos] = useState<AuditoriaCampanaDatos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    auditoriaCampanaApi(id, desdeHace(dias))
      .then((d) => vivo && setDatos(d))
      .catch((e: unknown) => vivo && setError(textoDeError(e, idioma) ?? String(e)))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [id, dias, idioma])

  const n = (x: number) => formatNumero(x, 0, idioma)

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-3 text-[12px] text-error">
        {t('spaceeyes.auditoria.error', { error })}
      </div>
    )
  }
  if (!datos || !datos.pantallas) {
    return <div className="p-3 text-[12px] text-muted">{t('spaceeyes.auditoria.campana.ninguna')}</div>
  }

  const horas = Array.from({ length: 24 }, (_, h) => ({
    hora: h,
    pasadas: datos.por_hora.find((x) => x.hora === h)?.pasadas ?? 0,
  }))
  const hayHoras = datos.por_hora.length > 0

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* Medida por recorrido -o sin bitácora todavía- la campaña no tiene
            pasadas que enseñar: tiene apariciones, y van con su denominador. */}
        {datos.vistazos > 0 ? (
          <>
            <span className="text-[16px] font-semibold tabular-nums text-fg">
              {t('spaceeyes.auditoria.pasadas', { n: n(datos.pasadas) })}
            </span>
            <span className="text-[12px] text-muted">
              {t('spaceeyes.auditoria.de-miradas', {
                n: n(datos.pasadas),
                total: n(datos.vistazos),
              })}
            </span>
          </>
        ) : (
          <span className="text-[16px] font-semibold tabular-nums text-fg">
            {t('spaceeyes.auditoria.apariciones', {
              n: n(datos.apariciones),
              total: n(datos.revisiones),
            })}
          </span>
        )}
        <span className="text-[12px] text-muted">
          ·{' '}
          {datos.pantallas === 1
            ? t('spaceeyes.auditoria.campana.pantalla')
            : t('spaceeyes.auditoria.campana.pantallas', { n: n(datos.pantallas) })}
        </span>
      </div>

      <p className="max-w-prose text-[12px] leading-snug text-muted">
        {t(datos.vistazos > 0
          ? 'spaceeyes.auditoria.que-es'
          : 'spaceeyes.auditoria.que-es.vuelta')}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Sello
          tono={datos.medida === 'vistazo' ? 'ok' : 'aviso'}
          icono={<Clock className="h-3 w-3" />}
          texto={t(
            datos.medida === 'vistazo'
              ? 'spaceeyes.auditoria.medida.vistazo'
              : 'spaceeyes.auditoria.medida.vuelta',
          )}
          ayuda={t(
            datos.medida === 'vistazo'
              ? 'spaceeyes.auditoria.medida.vistazo.ayuda'
              : 'spaceeyes.auditoria.medida.vuelta.ayuda',
          )}
        />
        <Sello
          tono={datos.dias_cerrados === datos.dias_medidos ? 'ok' : 'neutro'}
          texto={t('spaceeyes.auditoria.cerrados', {
            n: n(datos.dias_cerrados),
            total: n(datos.dias_medidos),
          })}
          ayuda={t('spaceeyes.auditoria.cerrados.ayuda')}
        />
        {datos.perdidos > 0 && (
          <Sello
            tono="aviso"
            icono={<AlertTriangle className="h-3 w-3" />}
            texto={t('spaceeyes.auditoria.perdidos', { n: n(datos.perdidos) })}
            ayuda={t('spaceeyes.auditoria.perdidos.ayuda')}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="flex flex-col gap-px bg-border">
          {datos.equipos.map((e) => (
            <div
              key={e.device_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-3 py-2 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate text-fg">{e.equipo}</span>
              {e.medida === 'vistazo' ? (
                <span className="shrink-0 tabular-nums font-medium text-fg">
                  {t('spaceeyes.auditoria.pasadas', { n: n(e.pasadas) })}
                </span>
              ) : (
                <span className="shrink-0 tabular-nums text-muted">
                  {t('spaceeyes.auditoria.apariciones', {
                    n: n(e.apariciones),
                    total: n(e.revisiones),
                  })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {hayHoras && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">
            {t('spaceeyes.auditoria.horas.titulo')}
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horas} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borde} vertical={false} />
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: COLOR.texto }}
                  stroke={COLOR.borde}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: COLOR.texto }}
                  stroke={COLOR.borde}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: COLOR.hover }}
                  formatter={(v: number) => [t('spaceeyes.auditoria.pasadas', { n: n(v) }), '']}
                  labelFormatter={(h: number) => t('spaceeyes.auditoria.hora', { hora: String(h) })}
                />
                <Bar dataKey="pasadas" fill={COLOR.acento} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
