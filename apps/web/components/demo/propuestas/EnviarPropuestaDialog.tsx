'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { Campo } from '@/components/demo/ui/Campo'
import { enviarPropuestaApi } from '@/lib/data/estado-api'
import { esEmailValido } from '@/lib/validacion'
import { useTexto } from '@/lib/i18n/contexto'

// «Enviar» / «Reenviar» (PROP-COMPLETA, decisión del dueño del 29/10): manda la
// liga al cliente por correo, con copia a quien la envía, y deja la propuesta
// ENVIADA. El correo se propone del contacto del cliente y se puede cambiar. Si
// la instancia no tiene correo configurado, el servidor solo cambia el estatus
// y aquí se avisa de que la liga hay que mandarla a mano.
const cls =
  'w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function EnviarPropuestaDialog({
  open,
  onOpenChange,
  propuestaId,
  correoCliente,
  reenvio,
  onSinCorreo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  propuestaId: string
  correoCliente: string | null
  reenvio: boolean
  /** Sin correo configurado: la pantalla ofrece copiar la liga. */
  onSinCorreo: () => void
}) {
  const t = useTexto()
  const [para, setPara] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setPara(correoCliente ?? '')
      setMensaje('')
      setError(null)
    }
  }, [open, correoCliente])

  async function enviar() {
    const limpio = para.trim()
    if (!esEmailValido(limpio)) {
      // `validacion.email` reproduce `EMAIL_INVALIDO` letra por letra (lo
      // exige `diccionario.test.ts`), asi que en espanol no cambia nada.
      setError(t('validacion.email'))
      return
    }
    setEnviando(true)
    try {
      const r = await enviarPropuestaApi(propuestaId, { para: limpio, mensaje: mensaje.trim() || null })
      onOpenChange(false)
      if (r.correo === 'enviado') {
        toast.success(t('propuestas.enviar.hecho', { correo: limpio }))
      } else {
        toast.warning(t('propuestas.enviar.sin-correo'))
        onSinCorreo()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('propuestas.enviar.error'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={reenvio ? t('propuestas.enviar.titulo.reenviar') : t('propuestas.enviar.titulo.enviar')}
      subtitle={t('propuestas.enviar.subtitulo')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            <Send className="h-3.5 w-3.5" />{' '}
            {enviando
              ? t('propuestas.comun.enviando')
              : reenvio
                ? t('propuestas.comun.reenviar')
                : t('propuestas.comun.enviar')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label={t('propuestas.enviar.correo')}>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            className={`h-9 ${cls}`}
            placeholder={t('propuestas.enviar.correo.ejemplo')}
            value={para}
            onChange={(e) => { setPara(e.target.value); setError(null) }}
          />
        </Campo>
        <Campo label={t('propuestas.enviar.mensaje')}>
          <textarea
            rows={4}
            maxLength={2000}
            className={`py-2 ${cls}`}
            placeholder={t('propuestas.enviar.mensaje.ejemplo')}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </Campo>
        {reenvio && (
          <p className="text-[11px] text-muted">
            {t('propuestas.enviar.reenvio.aviso')}
          </p>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    </Modal>
  )
}
