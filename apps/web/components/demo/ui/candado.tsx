'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { CampoContrasena } from '@/components/demo/ui/CampoContrasena'
import { desbloquearApi } from '@/lib/data/cambios-api'
import { confirmarConCandado, type ResultadoCandado } from '@/lib/cambios-candado'

// ============================================================================
//  El paso de la contraseña, montado: estado + los dos envases donde cabe.
// ----------------------------------------------------------------------------
//  OJO, lo primero: esto NO protege nada. Quien decide si un cambio pasa es el
//  servidor (`lib/server/cambios.ts`, `exigirCambioSensible`). Aquí solo vive la
//  UX — o sea, que el camino EXISTA.
//
//  ─── Por qué existe, y qué problema resuelve que `cambios-candado` no ──────
//  `lib/cambios-candado.ts` ya decide el ORDEN (desbloquear y después guardar, y
//  si el desbloqueo falla, cortar). Lo que no resuelve es DÓNDE se teclea la
//  contraseña, y ahí estaba el agujero de B38: doce puntos de llamada consumen
//  rutas con candado y ninguno ofrecía un campo.
//
//  Los tres cuadros arreglados el 25/09 por la mañana eran MODALES: había un
//  sitio evidente donde meterlo. Pero «Registrar pago» de la tabla de rentas y
//  «Renovar» son BOTONES DE UN CLIC: no hay cuadro ninguno. Ésa es la decisión
//  que documenta este archivo, y es UNA sola regla:
//
//    La contraseña se pide DENTRO del cuadro donde se confirma la acción.
//    Si la acción no tiene cuadro, el 403 ABRE uno, atado a esa acción exacta.
//
//  De ahí las dos caras de la misma pieza: `PasoContrasena` es el bloque para un
//  cuadro que ya existe, y `DialogoCandado` es ese bloque metido en un cuadro
//  que aparece. Mismo campo, mismo texto, misma secuencia: quien lo ve no
//  distingue dos mecanismos, porque no los hay.
//
//  ─── Por qué NO se manda a la barra de arriba ─────────────────────────────
//  `shell/DesbloqueoCambios` desbloquea la sesión entera durante 15 minutos.
//  Mandar ahí a quien pulsó un botón es peor por tres motivos, y el tercero es
//  el que decide:
//   1 · Es un rodeo: hay que salir de la ficha, desbloquear y volver a buscar la
//       fila. Lo que ya describía el manual como «el rodeo», y lo que hacía caro
//       el defecto de la mañana.
//   2 · Nada conecta el 403 con ese botón. Quien pulsa «Renovar» y no ve nada no
//       tiene forma de saber que la solución está en la esquina opuesta.
//   3 · Abre TODO durante 15 minutos para poder hacer UNA cosa. Pedirla aquí
//       gasta el desbloqueo en la acción que se está confirmando y no en las
//       otras trece rutas protegidas. Menor privilegio, también en el tiempo.
//
//  ─── Qué NO se toca ───────────────────────────────────────────────────────
//  Ni `lib/cambios-candado.ts` ni `ui/CampoContrasena.tsx`: dan servicio a los
//  tres cuadros de `ContratoSheet` y tocarlos sería tocar lo que funciona. Este
//  archivo los USA.
// ============================================================================

/** Lo que hay que hacer, y a quién avisar de cómo salió. */
export interface AccionSensible {
  /** La llamada real al servidor. Se ejecuta DESPUÉS del desbloqueo, si hizo falta. */
  guardar: () => Promise<unknown>
  alLograr?: () => void
  /**
   * Un fallo que NO es el candado (500, red caída, regla de negocio). Solo se
   * llama cuando el paso de la contraseña no está a la vista: si lo está, el
   * error se pinta ahí y avisar dos veces sobra.
   *
   * Para un botón de un clic esto NO es opcional en la práctica: es la única
   * salida que tiene el error. Sin él vuelve el defecto de «Renovar», que
   * rechazaba la promesa y no lo recogía nadie.
   */
  alFallar?: (mensaje: string) => void
  mensajeSiFalla?: string
}

export interface Candado {
  /** El servidor YA pidió la contraseña. Mientras sea `false` no se pinta nada. */
  reautenticando: boolean
  pass: string
  setPass: (v: string) => void
  error: string | null
  enviando: boolean
  /** Intenta la acción. La primera vez sin contraseña: que sea el servidor quien diga si hace falta. */
  ejecutar: (accion: AccionSensible) => Promise<ResultadoCandado | null>
  /** Repite la acción que el servidor rechazó, ahora con la contraseña tecleada. */
  reintentar: () => Promise<ResultadoCandado | null>
  /** Cierra el paso y OLVIDA lo tecleado. */
  olvidar: () => void
}

export function useCandado(): Candado {
  const [reautenticando, setReautenticando] = useState(false)
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // La acción que el servidor rechazó, tal cual venía. Confirmar la REPITE en
  // vez de armar una nueva: en «Registrar pago» de una cobranza hay dos botones
  // —liquidar todo el saldo y abonar una parte— y confirmar el que no era
  // significaría mover otro dinero del que se pidió.
  const pendiente = useRef<AccionSensible | null>(null)

  function olvidar() {
    setPass('')
    setReautenticando(false)
    setError(null)
    pendiente.current = null
  }

  async function correr(
    accion: AccionSensible,
    reauth: boolean,
    contrasena: string,
  ): Promise<ResultadoCandado> {
    setEnviando(true)
    setError(null)
    const r = await confirmarConCandado({
      reautenticando: reauth,
      contrasena,
      desbloquear: desbloquearApi,
      guardar: accion.guardar,
      mensajeSiFalla: accion.mensajeSiFalla,
    })
    setEnviando(false)
    if (r.estado === 'hecho') {
      olvidar()
      accion.alLograr?.()
    } else if (r.estado === 'falta-contrasena') {
      setError('Escribe tu contraseña para confirmar.')
    } else if (r.estado === 'pedir-contrasena') {
      pendiente.current = accion
      setReautenticando(true)
      setError(r.error)
    } else {
      setError(r.error)
      // Sin el paso de la contraseña a la vista, `candado.error` no se pinta en
      // ningún sitio: el aviso se lo lleva quien llamó (un toast, o el hueco de
      // error de su propio cuadro).
      if (!reauth) accion.alFallar?.(r.error)
    }
    return r
  }

  return {
    reautenticando,
    pass,
    setPass,
    error,
    enviando,
    ejecutar: (accion) => correr(accion, reautenticando, pass),
    reintentar: () =>
      pendiente.current ? correr(pendiente.current, true, pass) : Promise.resolve(null),
    olvidar,
  }
}

/**
 * El bloque del paso de la contraseña, para un cuadro que YA existe.
 *
 * No pinta nada mientras el servidor no la haya pedido: el control de cambios
 * está apagado por defecto en los tenants, así que preguntar de entrada sería
 * fricción inventada — y además enseña a teclear la contraseña sin que nadie la
 * pida, que es justo lo que aprovecha un engaño.
 */
export function PasoContrasena({
  candado,
  onEnter,
}: {
  candado: Candado
  /** Enter confirma. Lo pasa el cuadro para no duplicar aquí su condición. */
  onEnter?: () => void
}) {
  if (!candado.reautenticando) return null
  return (
    <div className="space-y-2 border-t border-border pt-2">
      <p className="text-[12px] text-muted">
        Tu organización pide la contraseña para confirmar los cambios sensibles.
      </p>
      <CampoContrasena
        valor={candado.pass}
        onChange={candado.setPass}
        onEnter={() => {
          if (!candado.enviando && candado.pass && onEnter) onEnter()
        }}
        deshabilitado={candado.enviando}
      />
      {/* El error vive AQUÍ, junto al campo, y se queda mientras el paso esté
          abierto. En un toast se desvanece y con él se va la única frase que
          decía qué hacer — que es exactamente lo que pasaba en «Registrar
          pago» antes del 25/09. */}
      {candado.error && <p className="text-[12px] text-error">{candado.error}</p>}
    </div>
  )
}

/**
 * El cuadro que APARECE cuando la acción no tenía ninguno.
 *
 * Solo existe mientras el servidor pide la contraseña. Confirmar repite la
 * acción pendiente; cerrar —por la X, por Escape o por «Cancelar»— la descarta y
 * olvida lo tecleado.
 */
export function DialogoCandado({
  candado,
  titulo,
  subtitulo,
  etiquetaConfirmar = 'Confirmar',
}: {
  candado: Candado
  titulo: string
  subtitulo?: string
  etiquetaConfirmar?: string
}) {
  return (
    <Modal
      open={candado.reautenticando}
      onOpenChange={(v) => {
        if (!v) candado.olvidar()
      }}
      title={titulo}
      subtitle={subtitulo}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={candado.olvidar} disabled={candado.enviando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={candado.enviando || !candado.pass}
            onClick={() => void candado.reintentar()}
          >
            {candado.enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {etiquetaConfirmar}
          </Button>
        </div>
      }
    >
      <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
    </Modal>
  )
}
