// ============================================================================
//  Visor WHEP de la vista en vivo de Space Eye (solo navegador).
// ----------------------------------------------------------------------------
//  Es el WhepStreamClient de Space Eye (frontend/src/js/whep.js) pasado a TS y
//  hablando por la puerta de SPACE OS (seApi) en vez de con el token de Space
//  Eye. El equipo publica su video UNA vez en el servidor de medios y de ahí lo
//  toma cada navegador por WebRTC (WHEP, solo recibir): varias personas pueden
//  mirar sin que al equipo le cueste un byte de más.
//
//  Cada instancia es una pestaña para el servidor (`visor`): el STOP_STREAM de
//  una solo la quita a ella, y la transmisión se corta cuando se va la última.
//
//  Lo que NO hace: el punto a punto de los teléfonos sin servidor de medios. Esa
//  señalización va por el socket de Space Eye, al que el navegador de SPACE OS
//  no llega.
// ============================================================================

import { seApi, ErrorSE } from '@/lib/data/space-eyes-se'

// El equipo tarda en abrir la cámara; hasta que publica, el servidor de medios
// contesta 404. Se le pregunta al backend (stream-status) en vez de tocarle la
// puerta al servidor de video.
const ESPERA_MAX_MS = 40_000
const REINTENTO_RAPIDO_MS = 400
const RAPIDO_HASTA_MS = 12_000
const REINTENTO_MS = 1_500

const PUERTA = '/spaces-dooh/api/space-eyes/se'

function nuevoVisor(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class VisorWhep {
  readonly visor = nuevoVisor()
  /** La vista ya estaba abierta por otra persona y nos unimos a ella. */
  compartida = false
  compartidaCon: string | null = null

  private pc: RTCPeerConnection | null = null
  private recurso: string | null = null
  private whepUrl = ''
  private clave: string | null = null
  private detenido = false
  private pidioInicio = false

  constructor(
    private readonly deviceId: number,
    private readonly video: HTMLVideoElement,
    /** Fallas que llegan DESPUÉS de conectar (se cayó el ICE). */
    private readonly alPerderse: (motivo: string) => void,
  ) {}

  /**
   * Pide la transmisión, espera a que el equipo publique y conecta el video.
   * Lanza ErrorSE si Space Eye la rechaza (409 vista_ocupada, 503 sin servidor
   * de medios…) y Error con un motivo legible si el equipo no llega a publicar.
   */
  async iniciar(): Promise<void> {
    this.pidioInicio = true
    const res = await seApi<{ stream?: { modo: string; whep: string }; compartida?: boolean; con?: string }>(
      `devices/${this.deviceId}/command`,
      {
        method: 'POST',
        body: { command_type: 'START_STREAM', payload: { session_id: Date.now().toString(), visor: this.visor } },
      },
    )
    if (!res?.stream?.whep) throw new Error('Space Eye no entregó la dirección de la transmisión')
    this.whepUrl = res.stream.whep
    this.clave = (res.stream.whep.match(/\/([0-9a-f]{8,})\/whep$/) || [])[1] || null
    this.compartida = res.compartida === true
    this.compartidaCon = res.con ?? null

    if (this.clave && !(await this.esperarAlEquipo())) {
      if (this.detenido) return
      throw new Error('El equipo no comenzó a transmitir. Puede estar sin señal o con la cámara ocupada.')
    }
    if (this.detenido) return
    try {
      await this.conectar()
    } catch (e) {
      throw new Error(`No se pudo conectar el video (${e instanceof Error ? e.message : 'error'}).`)
    }
  }

  private async esperarAlEquipo(): Promise<boolean> {
    const arranque = Date.now()
    while (Date.now() - arranque < ESPERA_MAX_MS && !this.detenido) {
      try {
        const r = await seApi<{ listo?: boolean }>(`devices/${this.deviceId}/stream-status?key=${this.clave}`)
        if (r?.listo) return true
      } catch (e) {
        // Un Space Eye viejo no conoce la ruta: se conecta a ciegas.
        if (e instanceof ErrorSE && e.status === 404) return true
      }
      await dormir(Date.now() - arranque < RAPIDO_HASTA_MS ? REINTENTO_RAPIDO_MS : REINTENTO_MS)
    }
    return false
  }

  private async conectar(): Promise<void> {
    const pc = new RTCPeerConnection()
    this.pc = pc
    // Solo recibimos: el panel nunca manda video ni audio.
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.ontrack = (evt) => {
      const stream = evt.streams?.[0] ?? new MediaStream([evt.track])
      this.video.srcObject = stream
      this.video.muted = true
      this.video.playsInline = true
      this.video.play().catch(() => {})
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && !this.detenido) {
        this.alPerderse('Se perdió la conexión de video con el servidor.')
      }
    }

    const oferta = await pc.createOffer()
    await pc.setLocalDescription(oferta)
    // Sin trickle: una sola oferta completa, lo más compatible.
    await this.esperarIce(pc)

    const resp = await fetch(this.whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription?.sdp ?? '',
    })
    if (!resp.ok) {
      pc.close()
      this.pc = null
      throw new Error(`HTTP ${resp.status}`)
    }
    const location = resp.headers.get('location')
    this.recurso = location ? new URL(location, this.whepUrl).toString() : null
    const respuesta = await resp.text()
    if (this.detenido) return
    await pc.setRemoteDescription({ type: 'answer', sdp: respuesta })
  }

  private esperarIce(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve()
      const listo = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', listo)
          resolve()
        }
      }
      pc.addEventListener('icegatheringstatechange', listo)
      setTimeout(resolve, 3000)
    })
  }

  /** Bytes de video recibidos hasta ahora (0 = conectado pero sin imagen). */
  async bytesRecibidos(): Promise<number | null> {
    if (!this.pc) return null
    try {
      const stats = await this.pc.getStats()
      let bytes = 0
      stats.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') bytes = r.bytesReceived || 0
      })
      return bytes
    } catch {
      return null
    }
  }

  /** `forzar`: cortar aunque haya otros mirando (cambio de lente: otra cámara física). */
  async detener(forzar = false): Promise<void> {
    const debiaAvisar = !this.detenido && this.pidioInicio
    this.detenido = true
    if (debiaAvisar) {
      try {
        await seApi(`devices/${this.deviceId}/command`, {
          method: 'POST',
          body: { command_type: 'STOP_STREAM', payload: { visor: this.visor, ...(forzar ? { forzar: true } : {}) } },
        })
      } catch {
        /* el corte a los 3 minutos del servidor lo cubre */
      }
    }
    this.cerrarLocal()
  }

  /** STOP que sobrevive al cierre de la pestaña, para que el equipo no gaste datos solo. */
  detenerAlSalir(): void {
    if (this.detenido) return
    const debiaAvisar = this.pidioInicio
    this.detenido = true
    if (debiaAvisar) {
      try {
        void fetch(`${PUERTA}/devices/${this.deviceId}/command/`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command_type: 'STOP_STREAM', payload: { visor: this.visor } }),
        }).catch(() => {})
      } catch {
        /* la pestaña ya se está cerrando */
      }
    }
    this.cerrarLocal(true)
  }

  private cerrarLocal(alSalir = false): void {
    if (this.recurso) {
      const r = this.recurso
      this.recurso = null
      try {
        void fetch(r, { method: 'DELETE', keepalive: alSalir }).catch(() => {})
      } catch {
        /* ignore */
      }
    }
    try {
      this.pc?.close()
    } catch {
      /* ignore */
    }
    this.pc = null
    if (this.video) this.video.srcObject = null
  }
}
