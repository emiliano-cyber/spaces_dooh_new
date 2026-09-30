// ============================================================================
//  lib/checklist-autoguardado.ts — la cola del autoguardado del checklist de
//  una OT (OT-CHECK-01, pedido del dueño del 2026-09-30).
// ----------------------------------------------------------------------------
//  Hasta el 30/09 el checklist vivía SOLO en un `useState` de `OTVista.tsx`: se
//  tachaba en memoria y lo único que escribía en la base era el cierre, que lo
//  pone TODO en hecho. Recargar o cerrar la pestaña a medio trabajo perdía el
//  avance sin avisar.
//
//  Ahora cada clic se manda al servidor al momento. Esta cola existe por los
//  CLICS RÁPIDOS, y sus tres reglas responden cada una a un modo de fallo:
//
//   1. **Una sola petición en vuelo.** Si cada clic lanzara la suya, la del
//      «desmarcar» podría llegar antes que la del «marcar» y el servidor se
//      quedaría con lo contrario de lo que se ve en pantalla. Sin error.
//   2. **Lo que espera se fusiona por punto.** Tres clics sobre el mismo punto
//      mientras otro se guarda son UNA petición con el último valor, no tres.
//   3. **Un fallo PARA la cola y conserva el cambio.** Seguir mandando lo de
//      detrás rompería el orden; tirar lo que falló perdería el avance, que es
//      justo lo que se vino a arreglar. Se reintenta con `reintentar()` o con
//      el siguiente clic.
//
//  Vive fuera del `.tsx` porque `vitest.config.ts` no monta jsdom: una
//  decisión escrita dentro de un componente no la prueba nadie.
// ============================================================================

export type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error'

export interface CambioPunto {
  indice: number
  /** La etiqueta del punto: el servidor la compara para no tachar otro punto
   *  si el checklist cambió desde que se abrió la pantalla. */
  label: string
  hecho: boolean
}

export interface InfoGuardado {
  estado: EstadoGuardado
  error: string | null
  pendientes: number
}

export interface ColaChecklist {
  marcar(c: CambioPunto): void
  reintentar(): void
  estado(): EstadoGuardado
  error(): string | null
  /** Cambios aún sin confirmar por el servidor (el que está en vuelo incluido). */
  pendientes(): number
  /** indice → hecho de todo lo que el servidor aún no confirmó. Lo usa la
   *  pantalla al recargar, para no repintar un punto con el valor viejo. */
  locales(): Map<number, boolean>
}

export function crearColaChecklist(opts: {
  enviar: (c: CambioPunto) => Promise<unknown>
  alCambiar?: (info: InfoGuardado) => void
}): ColaChecklist {
  // Un Map conserva el orden de inserción: es el orden de envío.
  let espera = new Map<number, CambioPunto>()
  let enVuelo: CambioPunto | null = null
  let estado: EstadoGuardado = 'inactivo'
  let error: string | null = null
  let corriendo = false

  const pendientes = () => espera.size + (enVuelo ? 1 : 0)

  function avisar() {
    opts.alCambiar?.({ estado, error, pendientes: pendientes() })
  }

  async function correr() {
    if (corriendo) return
    corriendo = true
    try {
      while (espera.size > 0) {
        const [indice, cambio] = espera.entries().next().value as [number, CambioPunto]
        espera.delete(indice)
        enVuelo = cambio
        try {
          await opts.enviar(cambio)
          enVuelo = null
        } catch (e) {
          enVuelo = null
          // Si mientras volaba el usuario volvió a tocar ESE punto, lo que
          // espera ya es más nuevo y el valor que falló sobra. Si no, vuelve
          // al PRINCIPIO de la cola: es lo más viejo, y va primero.
          if (!espera.has(indice)) espera = new Map([[indice, cambio], ...espera])
          estado = 'error'
          error = e instanceof Error && e.message ? e.message : 'No se pudo guardar'
          avisar()
          return
        }
      }
      estado = 'guardado'
      error = null
      avisar()
    } finally {
      corriendo = false
    }
  }

  function arrancar() {
    estado = 'guardando'
    error = null
    avisar()
    void correr()
  }

  return {
    marcar(c) {
      // Borrar y volver a poner lo manda al FINAL: el último clic sobre un
      // punto es también el más reciente de la cola.
      espera.delete(c.indice)
      espera.set(c.indice, { ...c })
      // Si ya está corriendo, el bucle lo recogerá; si estaba en error, este
      // clic cuenta como reintento.
      if (!corriendo) arrancar()
      else avisar()
    },
    reintentar() {
      if (corriendo || espera.size === 0) return
      arrancar()
    },
    estado: () => estado,
    error: () => error,
    pendientes,
    locales() {
      const m = new Map<number, boolean>()
      if (enVuelo) m.set(enVuelo.indice, enVuelo.hecho)
      for (const [i, c] of espera) m.set(i, c.hecho)
      return m
    },
  }
}
