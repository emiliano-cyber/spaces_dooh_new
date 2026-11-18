'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Mail } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi } from '@/lib/data/space-eyes-se'
import { usePuede, useSesionCtx } from '@/components/demo/shell/SesionContext'
import { puedeEncuadrar } from '@/lib/roles'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  Space Eyes — a quién se le avisa por correo cuando una pantalla falla.
//
//  Hasta ahora una pantalla apagada se enteraba quien tuviera esta pantalla
//  abierta. De noche no la tiene nadie.
//
//  QUÉ AVISA. Solo lo grave: la pantalla entera apagada o congelada y la cámara
//  sin imagen. Un gabinete suelto no manda correo —se ve aquí abajo—, y la
//  cámara movida tampoco. «Media pantalla apagada» en una cuadrícula grande son
//  cientos de gabinetes: un correo por cada uno es un buzón que nadie vuelve a
//  abrir, y el aviso de verdad se pierde entre ellos.
//
//  QUIÉN LO CAMBIA. La lista de correos y la espera, quien opera el inventario:
//  poner su propio correo para enterarse es parte del trabajo. La CUENTA del
//  proveedor —la llave de Resend y el remitente— solo el Dueño, por el mismo
//  criterio que el encuadre: es una credencial, y si se cambia mal la flota se
//  queda sin avisos sin que nada lo diga. La puerta lo exige por su lado
//  (`app/api/space-eyes/se/[...ruta]/route.ts`): lo de aquí es para no enseñar
//  un campo que al guardar daría 403.
//
//  LA LLAVE NO VUELVE. De ella solo llegan sus últimos cuatro, los justos para
//  reconocer cuál está puesta. El campo se escribe, no se lee, y dejarlo en
//  blanco NO la borra: si fuera así, cambiar un correo de la lista apagaría los
//  avisos sin que nadie lo notara hasta la siguiente pantalla apagada.
// ============================================================================

interface Avisos {
  activo: boolean
  destinatarios: string
  agrupar_min: number
  ultimo_envio_en: string | null
  ultimo_error: string | null
  llave_pista: string
  remitente: string
  hay_llave: boolean
  cuenta_del_panel: boolean
}

export function AvisosCorreo() {
  const puedeCambiar = usePuede('inventario', 'crear')
  const { sesion } = useSesionCtx()
  const esDueno = puedeEncuadrar(sesion?.usuario?.rol)
  const { t } = useIdioma()

  const [avisos, setAvisos] = useState<Avisos | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [verCuenta, setVerCuenta] = useState(false)
  const [llaveNueva, setLlaveNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null)
  const [quitando, setQuitando] = useState(false)
  const [noContesta, setNoContesta] = useState(false)

  useEffect(() => {
    // CON ESPERA MÁXIMA, y no por prudencia: un Space Eye más viejo que esta
    // interfaz deja la petición colgada en vez de contestar que no la conoce.
    // Sin el corte, esta promesa no se resuelve NUNCA, el `catch` no corre, y
    // la tarjeta se esconde entera sin decir por qué. Pasó en g500 el 9 de
    // noviembre: la interfaz estaba puesta y traducida, el servidor de esa
    // instancia no, y la pantalla de fallas no dio ni una señal.
    seApi<Avisos>('avisos', { esperaMax: 8000 })
      .then(setAvisos)
      .catch(() => setNoContesta(true))
  }, [])

  const guardar = useCallback(
    async (extra?: Record<string, unknown>) => {
      if (!avisos) return false
      setGuardando(true)
      setMensaje(null)
      try {
        const r = await seApi<Avisos & { destinatarios: string }>('avisos', {
          method: 'PUT',
          body: {
            activo: avisos.activo,
            destinatarios: avisos.destinatarios ?? '',
            agrupar_min: Number(avisos.agrupar_min) || 15,
            ...(esDueno ? { remitente: avisos.remitente ?? '', llave: llaveNueva } : {}),
            ...(extra ?? {}),
          },
        })
        // El servidor devuelve la lista ya limpia: se refleja para que nadie
        // crea que guardó un correo mal escrito que se descartó en silencio.
        setAvisos((a) =>
          a
            ? {
                ...a,
                destinatarios: r.destinatarios,
                llave_pista: r.llave_pista,
                remitente: r.remitente,
                hay_llave: r.hay_llave,
                cuenta_del_panel: r.cuenta_del_panel,
                ultimo_error: null,
              }
            : a,
        )
        setLlaveNueva('')
        setMensaje({ tono: 'ok', texto: t('spaceeyes.avisos.guardado') })
        return true
      } catch (e) {
        const cual = e instanceof Error ? e.message : ''
        setMensaje({
          tono: 'error',
          texto: /sin_destinatarios/.test(cual)
            ? t('spaceeyes.avisos.error.sin-destinatarios')
            : /remitente_invalido/.test(cual)
              ? t('spaceeyes.avisos.error.remitente')
              : /llave_invalida/.test(cual)
                ? t('spaceeyes.avisos.error.llave')
                : t('spaceeyes.avisos.error.guardar'),
        })
        return false
      } finally {
        setGuardando(false)
      }
    },
    [avisos, esDueno, llaveNueva, t],
  )

  const probar = useCallback(async () => {
    // Se guarda primero: la prueba la manda el SERVIDOR a la lista guardada, así
    // que probar sin guardar iría a la dirección vieja y quien acaba de teclear
    // su correo no recibiría nada.
    if (!(await guardar())) return
    setGuardando(true)
    try {
      const r = await seApi<{ salida: 'enviado' | 'registrado'; para: string[] }>('avisos/prueba', {
        method: 'POST',
        body: {},
      })
      setMensaje({
        tono: 'ok',
        texto:
          r.salida === 'registrado'
            ? t('spaceeyes.avisos.prueba.registrada')
            : t('spaceeyes.avisos.prueba.enviada', { correos: r.para.join(', ') }),
      })
    } catch (e) {
      setMensaje({ tono: 'error', texto: e instanceof Error ? e.message : t('spaceeyes.avisos.prueba.error') })
    }
    setGuardando(false)
  }, [guardar, t])

  // Mientras se pregunta no se pinta nada: lo normal son 200 ms y un renglón
  // que aparece y desaparece es peor que ninguno. Si NO contesta, sí se dice,
  // porque «no está la tarjeta» y «el servidor no la tiene» se arreglan en
  // sitios distintos y desde la pantalla no había forma de distinguirlos.
  if (!avisos) {
    if (!noContesta) return null
    return (
      <section className="rounded-md border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <Mail className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
          <span className="text-[13px] text-ink">{t('spaceeyes.avisos.titulo')}</span>
          <span className="min-w-0 text-[13px] text-muted">{t('spaceeyes.avisos.sin-servidor')}</span>
        </div>
      </section>
    )
  }

  const cuantos = (avisos.destinatarios || '').split(',').filter((d) => d.trim()).length
  const resumen = !avisos.activo
    ? t('spaceeyes.avisos.apagados')
    : cuantos === 0
      ? t('spaceeyes.avisos.sin-correos')
      : t('spaceeyes.avisos.resumen', {
          quien: cuantos === 1 ? avisos.destinatarios.trim() : t('spaceeyes.avisos.correos', { n: cuantos }),
          min: avisos.agrupar_min,
        })

  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Mail className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', avisos.activo ? 'bg-success' : 'bg-border-strong')} />
        <span className="text-[13px] text-ink">{t('spaceeyes.avisos.titulo')}</span>
        <span className="min-w-0 truncate text-[13px] text-muted">· {resumen}</span>
        <Button variant="tertiary" size="sm" className="ml-auto" onClick={() => setAbierto((v) => !v)}>
          {abierto ? t('spaceeyes.avisos.cerrar') : t('spaceeyes.avisos.configurar')}
        </Button>
      </div>

      {abierto && (
        <div className="space-y-4 border-t border-border p-3">
          <p className="text-[13px] leading-relaxed text-muted">
            {t('spaceeyes.avisos.que-avisa')}
          </p>

          {!avisos.hay_llave && (
            <div className="flex items-start gap-2 rounded-md border border-[#b4530920] bg-warning-soft p-3 text-[12px]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span className="text-ink">
                {t('spaceeyes.avisos.sin-cuenta')}{' '}
                {esDueno ? t('spaceeyes.avisos.sin-cuenta.dueno') : t('spaceeyes.avisos.sin-cuenta.no-dueno')}
              </span>
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={avisos.activo}
              disabled={!puedeCambiar}
              onChange={(e) => setAvisos({ ...avisos, activo: e.target.checked })}
              className="h-4 w-4 rounded border-border-strong text-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
            {t('spaceeyes.avisos.activar')}
          </label>

          <label className="block">
            <span className="block text-[12px] text-ink">{t('spaceeyes.avisos.destinatarios')}</span>
            <textarea
              value={avisos.destinatarios}
              disabled={!puedeCambiar}
              rows={2}
              onChange={(e) => setAvisos({ ...avisos, destinatarios: e.target.value })}
              placeholder="operacion@empresa.com, guardia@empresa.com"
              className="mt-1 w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            <span className="mt-1 block text-[11px] text-muted">
              {t('spaceeyes.avisos.destinatarios.ayuda')}
            </span>
          </label>

          <label className="block">
            <span className="block text-[12px] text-ink">{t('spaceeyes.avisos.espera')}</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={240}
                value={avisos.agrupar_min}
                disabled={!puedeCambiar}
                onChange={(e) => setAvisos({ ...avisos, agrupar_min: Number(e.target.value) })}
                className="h-9 w-24 rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <span className="text-[13px] text-muted">{t('spaceeyes.avisos.espera.unidad')}</span>
            </span>
          </label>

          {puedeCambiar && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" disabled={guardando} onClick={() => void guardar()}>
                {t('spaceeyes.avisos.guardar')}
              </Button>
              <Button variant="secondary" size="sm" disabled={guardando} onClick={() => void probar()}>
                {t('spaceeyes.avisos.probar')}
              </Button>
              {mensaje && (
                <span className={cn('text-[12px]', mensaje.tono === 'ok' ? 'text-success' : 'text-error')}>
                  {mensaje.texto}
                </span>
              )}
            </div>
          )}

          {avisos.ultimo_error && <p className="text-[11px] text-error">{t('spaceeyes.avisos.ultimo-intento', { motivo: avisos.ultimo_error })}</p>}

          {/* La cuenta del proveedor. Al final y plegada: la lista de correos
              cambia seguido; esto, una vez cada varios años. */}
          {esDueno && (
            <div className="border-t border-border pt-3">
              <Button variant="tertiary" size="sm" className="!px-0" onClick={() => setVerCuenta((v) => !v)}>
                {verCuenta ? t('spaceeyes.avisos.cuenta.cerrar') : t('spaceeyes.avisos.cuenta.abrir')}
              </Button>
              <p className="mt-1 text-[11px] text-muted">
                {!avisos.hay_llave
                  ? t('spaceeyes.avisos.cuenta.ninguna')
                  : avisos.cuenta_del_panel
                    ? t('spaceeyes.avisos.cuenta.del-panel', { remitente: avisos.remitente, pista: avisos.llave_pista })
                    : t('spaceeyes.avisos.cuenta.del-entorno', { remitente: avisos.remitente })}
              </p>

              {verCuenta && (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="block text-[12px] text-ink">{t('spaceeyes.avisos.remitente')}</span>
                    <input
                      type="text"
                      value={avisos.remitente}
                      onChange={(e) => setAvisos({ ...avisos, remitente: e.target.value })}
                      placeholder="Space Eye <avisos@tuempresa.com>"
                      className="mt-1 h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <span className="mt-1 block text-[11px] text-muted">
                      {t('spaceeyes.avisos.remitente.ayuda')}
                    </span>
                  </label>

                  <label className="block">
                    <span className="block text-[12px] text-ink">{t('spaceeyes.avisos.llave')}</span>
                    <input
                      type="password"
                      value={llaveNueva}
                      onChange={(e) => setLlaveNueva(e.target.value)}
                      spellCheck={false}
                      // `off` no basta: Chrome lo ignora en los campos de
                      // contraseña y metía una contraseña guardada del sitio,
                      // que al guardar se habría grabado COMO la llave. El que
                      // respeta es `new-password`; las otras dos marcas son por
                      // 1Password y LastPass, que tienen el mismo vicio.
                      autoComplete="new-password"
                      data-1p-ignore
                      data-lpignore="true"
                      placeholder={
                        avisos.llave_pista
                          ? t('spaceeyes.avisos.llave.puesta', { pista: avisos.llave_pista })
                          : 're_...'
                      }
                      className="mt-1 h-9 w-full rounded border border-border-strong bg-surface px-3 font-mono text-[13px] text-ink outline-none placeholder:font-sans placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <span className="mt-1 block text-[11px] text-muted">
                      {t('spaceeyes.avisos.llave.ayuda')}
                    </span>
                  </label>

                  {avisos.llave_pista && (
                    <Button variant="danger" size="sm" disabled={guardando} onClick={() => setQuitando(true)}>
                      {t('spaceeyes.avisos.llave.quitar')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={quitando}
        onOpenChange={setQuitando}
        title={t('spaceeyes.avisos.llave.quitar.titulo')}
        confirmLabel={t('spaceeyes.avisos.llave.quitar.confirmar')}
        busy={guardando}
        onConfirm={() => {
          setQuitando(false)
          setLlaveNueva('')
          void guardar({ llave: '', borrar_llave: true })
        }}
      >
        <p className="text-[13px] leading-relaxed text-muted">
          {t('spaceeyes.avisos.llave.quitar.aviso')}
        </p>
      </ConfirmDialog>
    </section>
  )
}
