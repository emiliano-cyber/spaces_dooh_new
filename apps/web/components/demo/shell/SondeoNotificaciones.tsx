'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { refrescarEstado } from '@/lib/data/estado-api'

// ============================================================================
//  Notificaciones en vivo mientras la pestaña está abierta: llegan solas, sin
//  recargar, y aparecen como aviso emergente además de sumar en la campanita.
//
//  Se hace por SONDEO y no por conexión permanente (WebSocket/SSE) a propósito:
//  estas notificaciones son eventos de negocio —una publicación aprobada, una
//  OT vencida, un recordatorio de cobro—, no un chat. Unos segundos de demora no
//  cambian nada, y una conexión permanente por usuario obligaría a mantenerla
//  viva, reconectarla y perderla en cada reinicio del servidor. Si algún día se
//  necesita instantáneo de verdad, el sitio donde cambiarlo es este archivo.
//
//  Tres cosas que evitan que moleste:
//   · Se PARA cuando la pestaña no está visible. Sin esto, veinte pestañas
//     olvidadas seguirían consultando al servidor toda la noche.
//   · Al volver a la pestaña consulta de inmediato, sin esperar al siguiente
//     ciclo, que es lo que se espera al regresar.
//   · La petición va marcada como de fondo (`sondeo=1`) para no encender la
//     barra de carga: el usuario no está esperando esta respuesta.
// ============================================================================

const CADA_MS = 15_000

// El nivel de la notificación decide el estilo del aviso.
const MOSTRAR: Record<string, (m: string, o?: object) => void> = {
  ok: toast.success,
  warn: toast.warning,
  info: toast.info,
}

export function SondeoNotificaciones() {
  const router = useRouter()
  // Marca de la última notificación vista. Arranca en "ahora": lo anterior ya
  // vino en la carga inicial y avisar de todo el histórico al abrir sería ruido.
  const desde = useRef<string>(new Date().toISOString())
  const enCurso = useRef(false)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function consultar() {
      if (!vivo || enCurso.current || document.visibilityState !== 'visible') return
      enCurso.current = true
      try {
        const r = await fetch(
          `/spaces-dooh/api/notificaciones/nuevas/?sondeo=1&desde=${encodeURIComponent(desde.current)}`,
          { cache: 'no-store' },
        )
        if (!r.ok) return // sesión caída o error puntual: se reintenta al siguiente ciclo
        const d = (await r.json()) as { notificaciones?: any[] }
        const nuevas = d.notificaciones ?? []
        if (!nuevas.length) return

        // Avanza la marca ANTES de avisar: si algo falla al pintar el aviso, no
        // se repite la misma notificación en cada ciclo.
        desde.current = nuevas[nuevas.length - 1].creadoEn ?? desde.current

        for (const n of nuevas) {
          const mostrar = MOSTRAR[n.nivel as string] ?? toast
          mostrar(n.titulo, {
            description: n.detalle ?? undefined,
            // Solo hay acción si la notificación apunta a algún sitio.
            action: n.link
              ? { label: 'Ver', onClick: () => router.push(n.link) }
              : undefined,
          })
        }
        // Trae la lista completa para que la campanita y su contador cuadren.
        // Solo cuando REALMENTE hay novedades: el estado pesa megas y hacerlo en
        // cada ciclo sería insostenible.
        await refrescarEstado()
      } catch {
        /* sin red o pestaña cerrándose: se reintenta solo */
      } finally {
        enCurso.current = false
      }
    }

    // Al volver a la pestaña, consultar ya: esperar 15 s al regresar se nota.
    const alVolver = () => { if (document.visibilityState === 'visible') void consultar() }
    document.addEventListener('visibilitychange', alVolver)
    timer = setInterval(() => void consultar(), CADA_MS)

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alVolver)
      if (timer) clearInterval(timer)
    }
  }, [router])

  return null
}
