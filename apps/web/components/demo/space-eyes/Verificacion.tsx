'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, ImageOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ErrorSE, fotoSE, seApi } from '@/lib/data/space-eyes-se'
import { fechaHora } from './piezas'

// ============================================================================
//  Space Eyes — verificación.
//
//  Port de verification.html/verification.js de Space Eye: la comparación de
//  cada foto contra la creatividad de su campaña (SSIM, pHash, OCR) y el
//  veredicto del worker. Solo lectura.
//
//  Space Eye pagina con `page` y `limit` pero no devuelve el total, así que el
//  control es «anterior / siguiente»: si una página llega llena, puede haber otra.
// ============================================================================

const POR_PAGINA = 50

type Resultado = '' | 'true' | 'false'

type Verificacion = {
  id: number
  device_name: string | null
  thumbnail_path: string | null
  storage_path: string | null
  ssim_score: number | string | null
  phash_distance: number | string | null
  ocr_match: boolean | number | null
  is_correct: boolean | number | null
  confidence: number | string | null
  processed_at: string | null
}

// MySQL puede mandar los DECIMAL como texto.
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function Verificacion() {
  const [filas, setFilas] = useState<Verificacion[] | null>(null)
  const [resultado, setResultado] = useState<Resultado>('')
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      let q = `verifications?limit=${POR_PAGINA}&page=${pagina}`
      if (resultado !== '') q += `&is_correct=${resultado}`
      const d = await seApi<{ verifications: Verificacion[] }>(q)
      setFilas(d.verifications ?? [])
    } catch (e) {
      setError(e instanceof ErrorSE || e instanceof Error ? e.message : 'No se pudo consultar Space Eyes')
    }
    setCargando(false)
  }, [pagina, resultado])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const lista = filas ?? []
  const hayMas = lista.length === POR_PAGINA

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Verificación</h1>
          <p className="text-[13px] text-muted">Comparación de cada foto contra la creatividad de su campaña.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
          {(
            [
              ['', 'Todos los resultados'],
              ['true', 'Correctos'],
              ['false', 'Incorrectos'],
            ] as [Resultado, string][]
          ).map(([clave, texto]) => (
            <button
              key={clave || 'todos'}
              type="button"
              onClick={() => {
                setResultado(clave)
                setPagina(1)
              }}
              className={cn(
                'rounded px-3 py-1.5 transition-colors duration-150',
                resultado === clave ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudieron cargar las verificaciones</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : cargando && !filas ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : lista.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-3 py-10 text-center text-[13px] text-muted">
          Sin resultados de verificación
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="border-b border-border bg-surface-2 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Foto</th>
                <th className="px-4 py-2.5 font-medium">Equipo</th>
                <th className="px-4 py-2.5 font-medium">SSIM</th>
                <th className="px-4 py-2.5 font-medium">pHash</th>
                <th className="px-4 py-2.5 font-medium">Coincidencia OCR</th>
                <th className="px-4 py-2.5 font-medium">Resultado</th>
                <th className="px-4 py-2.5 font-medium">Confianza</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const miniatura = fotoSE(v.thumbnail_path || v.storage_path)
                const completa = fotoSE(v.storage_path || v.thumbnail_path)
                const ssim = num(v.ssim_score)
                const phash = num(v.phash_distance)
                const conf = num(v.confidence)
                const correcto = !!v.is_correct
                return (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {miniatura ? (
                        <a
                          href={completa ?? miniatura}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-12 w-12 overflow-hidden rounded bg-surface-2"
                          title="Ver la foto completa"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={miniatura}
                            alt={`Foto de ${v.device_name ?? 'equipo'}`}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded bg-surface-2 text-muted">
                          <ImageOff className="h-4 w-4" strokeWidth={1.5} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink">{v.device_name ?? '—'}</td>
                    <td className="demo-num px-4 py-2.5 text-ink">{ssim !== null && ssim !== 0 ? ssim.toFixed(3) : '—'}</td>
                    <td className="demo-num px-4 py-2.5 text-ink">{phash ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={v.ocr_match ? 'text-success' : 'text-error'}>{v.ocr_match ? 'Sí' : 'No'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                          correcto
                            ? 'border-[#1da85040] bg-success-soft text-[#146c39]'
                            : 'border-[#dc262640] bg-error-soft text-[#b91c1c]',
                        )}
                      >
                        {correcto ? 'Correcto' : 'Incorrecto'}
                      </span>
                    </td>
                    <td className="demo-num px-4 py-2.5 text-ink">{conf !== null ? `${(conf * 100).toFixed(0)}%` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fechaHora(v.processed_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && (pagina > 1 || hayMas) && (
        <div className="flex items-center justify-end gap-2 text-[12px] text-muted">
          <span>Página {pagina}</span>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Página anterior"
            disabled={pagina <= 1 || cargando}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Página siguiente"
            disabled={!hayMas || cargando}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
