'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import type { PuntoDeMedicion } from '@/lib/server/energia-repo'
import {
  OPCIONES_MESES,
  RUTA_RECIBOS,
  cuerpoDeAlta,
  filasDeConfirmacion,
  motivoNoConfirmable,
  resumenDeLectura,
  textoDeLoLeido,
  type FilaDeConfirmacion,
  type RespuestaRecibosUI,
} from './recibos'

// ============================================================================
//  Subir los PDF del recibo de CFE y CONFIRMAR lo que dicen.
// ----------------------------------------------------------------------------
//  LA PANTALLA TIENE UN SOLO TRABAJO Y NO ES AHORRAR TECLAS: es que quien
//  confirma pueda COMPROBAR. Por eso cada renglon lleva debajo, en texto
//  pequeño, lo que el PDF dice de verdad —numero de servicio, aparato, tarifa,
//  periodo real, la facturacion, el alumbrado y el Total impreso— y no solo las
//  cifras que se van a guardar.
//
//  El `Total del recibo` se enseña marcado como «incluye adeudos y pagos»
//  porque es el numero grande del papel, el que una persona buscaria para
//  comprobar, y **no es lo que se captura**: en 8 de los 72 recibos del cliente
//  lleva un deposito dentro, y en uno de ellos eso multiplica el costo por 4.3.
//
//  Nada se guarda al subir. El alta es renglon a renglon, por el MISMO endpoint
//  que la captura a mano — con su validacion, su indice unico y su bitacora.
//
//  ─── LOS MESES SE DECLARAN ANTES DE ELEGIR EL ARCHIVO ────────────────────
//  Requisito del dueño del 2026-09-29, y el orden importa: **primero se declara
//  lo que se espera, y despues se ve el resultado**. Al reves no vale — una
//  expectativa que se escribe despues de ver la respuesta no comprueba nada.
//  Por eso el `<input type="file">` esta DESHABILITADO hasta que hay un valor
//  elegido, y no al contrario.
//
//  Lo declarado es una expectativa: **manda el PDF**. Si no coinciden, el
//  renglon se marca con los dos numeros y se puede guardar igual.
//
//  Lo que puede equivocarse vive en `recibos.ts`, con pruebas: `vitest.config`
//  no monta jsdom y lo que se escribe aqui dentro no lo prueba nadie.
// ============================================================================

type Estado = 'quieto' | 'leyendo'

/** Sin elegir. No es 0 ni 1: es «todavia no ha declarado nada». */
const SIN_ELEGIR = ''

export function SubirRecibos({
  puntos,
  onGuardado,
}: {
  puntos: PuntoDeMedicion[]
  onGuardado: () => void
}) {
  const [estado, setEstado] = useState<Estado>('quieto')
  const [mesesEsperados, setMesesEsperados] = useState<string>(SIN_ELEGIR)
  const [respuesta, setRespuesta] = useState<RespuestaRecibosUI | null>(null)
  const [filas, setFilas] = useState<FilaDeConfirmacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardadas, setGuardadas] = useState<Record<string, 'guardando' | 'ok' | string>>({})

  const leer = useCallback(async (lista: FileList | null, meses: string) => {
    if (!lista || lista.length === 0) return
    setEstado('leyendo')
    setError(null)
    setGuardadas({})
    try {
      const cuerpo = new FormData()
      // Va PRIMERO en el formulario, que es el orden en que se decidio: lo que
      // se espera antes que lo que se sube.
      if (meses !== SIN_ELEGIR) cuerpo.append('mesesEsperados', meses)
      for (const f of Array.from(lista)) cuerpo.append('archivos', f)
      const r = await fetch(RUTA_RECIBOS, { method: 'POST', body: cuerpo })
      // Cuerpo con `catch` propio: un 500 detras de nginx devuelve HTML y
      // `r.json()` revienta, y el error saldria como un fallo de red.
      const datos = (await r.json().catch(() => null)) as
        | (RespuestaRecibosUI & { error?: string })
        | null
      if (!r.ok) {
        setRespuesta(null)
        setFilas([])
        setError(datos?.error ?? 'No se pudieron leer los archivos')
        return
      }
      setRespuesta(datos)
      setFilas(filasDeConfirmacion(datos?.propuestas ?? []))
    } catch {
      setRespuesta(null)
      setFilas([])
      setError('No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.')
    } finally {
      setEstado('quieto')
    }
  }, [])

  const guardarFila = useCallback(
    async (f: FilaDeConfirmacion) => {
      const motivo = motivoNoConfirmable(f)
      if (motivo) {
        setGuardadas((g) => ({ ...g, [f.clave]: motivo }))
        return
      }
      setGuardadas((g) => ({ ...g, [f.clave]: 'guardando' }))
      try {
        const r = await fetch('/api/energia/consumos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpoDeAlta(f)),
        })
        if (!r.ok) {
          const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null
          // El 409 del indice unico llega con su mensaje: capturar dos veces el
          // mismo recibo duplica el costo de la luz de ese mes sin dar error.
          setGuardadas((g) => ({ ...g, [f.clave]: cuerpo?.error ?? 'No se pudo guardar' }))
          return
        }
        setGuardadas((g) => ({ ...g, [f.clave]: 'ok' }))
        onGuardado()
      } catch {
        setGuardadas((g) => ({ ...g, [f.clave]: 'No se pudo contactar al servidor' }))
      }
    },
    [onGuardado],
  )

  const cambiar = (clave: string, campo: keyof FilaDeConfirmacion, valor: string) => {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)))
    setGuardadas((g) => {
      const { [clave]: _, ...resto } = g
      return resto
    })
  }

  const resumen = respuesta ? resumenDeLectura(respuesta) : null
  const entrada =
    'h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-ink outline-none focus:border-ink/40'

  return (
    <div className="space-y-3">
      {/* PRIMERO lo que se espera. El selector va ARRIBA del boton de subir y no
          al lado: el orden de la pantalla es el orden de la decision, y una
          expectativa escrita despues de ver la respuesta no comprueba nada. */}
      <div>
        <label
          className="mb-1 block text-[11px] uppercase tracking-wide text-muted"
          htmlFor="recibos-meses"
        >
          1 · ¿Cuántos meses de calendario cubre cada recibo de esta tanda?
        </label>
        <select
          id="recibos-meses"
          className="h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-ink outline-none focus:border-ink/40 lg:w-[34rem]"
          value={mesesEsperados}
          onChange={(e) => setMesesEsperados(e.target.value)}
        >
          <option value={SIN_ELEGIR}>— elige antes de subir —</option>
          {OPCIONES_MESES.map((o) => (
            <option key={o.meses} value={String(o.meses)}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Se cuentan los meses de calendario que <strong>toca</strong> el periodo, no lo que
          dura. Un recibo mensual empieza a mitad de mes, así que casi siempre toca{' '}
          <strong>dos</strong>; uno bimestral, <strong>tres</strong>. Si mezclas mensuales y
          bimestrales en la misma tanda, muchos saldrán marcados: súbelos por separado.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink',
            mesesEsperados === SIN_ELEGIR
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:border-ink/40',
          )}
        >
          {estado === 'leyendo' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          <span>
            {estado === 'leyendo' ? 'Leyendo…' : '2 · Subir PDF del recibo'}
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            // Deshabilitado hasta que hay expectativa declarada. Es el requisito
            // literal —«ANTES de subir el archivo se elija cuantos meses»— y es
            // lo unico que impide que la comprobacion se salte por inercia.
            disabled={estado === 'leyendo' || mesesEsperados === SIN_ELEGIR}
            onChange={(e) => {
              void leer(e.target.files, mesesEsperados)
              // Se limpia el input para que subir el MISMO archivo otra vez
              // vuelva a disparar el `change`. Sin esto, corregir un PDF y
              // volver a subirlo no hace nada y parece que la pantalla se colgo.
              e.target.value = ''
            }}
          />
        </label>
        <p className="text-[12px] text-muted">
          {mesesEsperados === SIN_ELEGIR
            ? 'Elige arriba cuántos meses esperas antes de subir los archivos.'
            : 'Se leen en el servidor y no se guarda nada: revisa cada renglón contra el recibo y confírmalo.'}
        </p>
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 rounded-md border border-error/30 bg-error-soft px-3 py-2 text-[12px] text-error">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {resumen ? (
        <p
          className={cn(
            'flex items-start gap-1.5 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-[12px] text-muted',
            resumen.tono === 'alerta' && 'font-medium text-warning',
            resumen.tono === 'ok' && 'text-success',
          )}
        >
          {resumen.tono === 'alerta' ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : resumen.tono === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{resumen.texto}</span>
        </p>
      ) : null}

      {/* Los archivos que NO son recibos, con su motivo. Si solo se enseñaran
          los que si, quien sube 40 no tendria forma de saber cual falta. */}
      {(respuesta?.propuestas ?? [])
        .filter((p) => !p.esRecibo)
        .map((p) => (
          <p
            key={p.archivo}
            className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-surface-2 px-3 py-2 text-[12px] text-warning"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{p.archivo}</strong> — {p.avisos.join(' ')}
            </span>
          </p>
        ))}

      {filas.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-2 py-2 text-left">Predio o pantalla</th>
                <th className="px-2 py-2 text-left">Mes</th>
                <th className="px-2 py-2 text-left">Días</th>
                <th className="px-2 py-2 text-left">kWh</th>
                <th className="px-2 py-2 text-left">Importe</th>
                <th className="px-2 py-2 text-left" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const estadoFila = guardadas[f.clave]
                const motivo = motivoNoConfirmable(f)
                return (
                  <tr key={f.clave} className="border-t border-border align-top">
                    <td className="px-2 py-2">
                      <select
                        className={entrada}
                        value={f.punto}
                        onChange={(e) => cambiar(f.clave, 'punto', e.target.value)}
                      >
                        {/* La opcion vacia existe y sale la primera cuando no se
                            emparejo: sin ella, el primer predio de la lista
                            quedaria elegido por omision y el recibo se guardaria
                            en un predio que nadie eligio. */}
                        <option value="">— elige —</option>
                        {puntos.map((p) => (
                          <option key={p.clave} value={p.clave}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] leading-snug text-muted">
                        {f.archivo} · {textoDeLoLeido(f.lectura)}
                      </p>
                      {f.lectura.avisos.map((a) => (
                        <p key={a} className="mt-1 text-[11px] leading-snug text-warning">
                          {a}
                        </p>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">{f.periodo}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted">{f.dias}</td>
                    <td className="px-2 py-2">
                      <input
                        inputMode="decimal"
                        className={entrada}
                        placeholder="escríbelo"
                        value={f.kwh}
                        onChange={(e) => cambiar(f.clave, 'kwh', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        inputMode="decimal"
                        className={entrada}
                        placeholder="escríbelo"
                        value={f.importe}
                        onChange={(e) => cambiar(f.clave, 'importe', e.target.value)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {estadoFila === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={estadoFila === 'guardando' || !!motivo}
                          onClick={() => void guardarFila(f)}
                        >
                          {estadoFila === 'guardando' ? 'Guardando…' : 'Guardar'}
                        </Button>
                      )}
                      {/* El duplicado se enseña con SUS CIFRAS, no con un aviso
                          suelto: lo que hay que comparar es si el que ya esta es
                          el mismo recibo o uno distinto. */}
                      {/* El desajuste con lo declarado se enseña CON LOS DOS
                          numeros, aqui donde se mira el renglon. No bloquea: el
                          reparto ya salio del PDF, y quien decide es quien
                          tiene el papel delante. */}
                      {f.coincideMeses === false ? (
                        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-warning">
                          Declaraste {f.mesesEsperados}{' '}
                          {f.mesesEsperados === 1 ? 'mes' : 'meses'} y este recibo cubre{' '}
                          {f.mesesDelPdf}. Se repartió según el PDF.
                        </p>
                      ) : null}
                      {f.yaCapturado ? (
                        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-warning">
                          Ya hay uno capturado en {f.yaCapturado.periodo.slice(0, 7)}:{' '}
                          {f.yaCapturado.kwh} kWh por {f.yaCapturado.importe}. Guardar otra vez
                          DUPLICA el costo de ese mes.
                        </p>
                      ) : null}
                      {motivo ? (
                        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-muted">
                          {motivo}
                        </p>
                      ) : null}
                      {estadoFila && estadoFila !== 'ok' && estadoFila !== 'guardando' ? (
                        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-error">
                          {estadoFila}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
