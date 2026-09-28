import { AlertTriangle } from 'lucide-react'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from '@/lib/rejilla'

// ============================================================================
//  EL AVISO, en UN solo componente. ADR 0039: «el producto tiene que DECIRLO».
// ----------------------------------------------------------------------------
//  EL DEFECTO QUE ESTO EVITA, con nombre y con antecedente. El SDK de DOOHmain
//  acepta `--version --anunciante --campana --fecha-inicio --fecha-fin
//  --filepath --screen --list --cant-dia` (`doohmain_sdk/__main__.py:66-75`).
//  NO hay `--hora` ni `--dias`. Se vende y se cobra por franja, y la programa
//  una persona a mano en el CMS.
//
//  Una pantalla que enseña «Prime 06:00–10:00» y no lo agenda MIENTE POR
//  OMISIÓN, y el día que un spot salga a las tres de la mañana nadie sabrá si
//  falló el sistema o el operador. Es la misma familia que el `?? 0` del mapa:
//  convertir «no sé» en una afirmación concreta.
//
//  ─── POR QUÉ UN COMPONENTE Y NO UN PÁRRAFO EN CADA PANTALLA ───────────────
//  Un texto copiado en seis sitios deja cinco versiones viejas el día que
//  cambie, y la que quede mal será justo la que lea el cliente. El texto vive
//  en `lib/rejilla.ts` —que también lo congela en el snapshot— y aquí solo se
//  pinta. `rejilla-aviso.test.ts` nombra las pantallas que enseñan una franja y
//  cae si a alguna le quitan el aviso.
//
//  ─── DÓNDE VA, y son SEIS sitios a propósito ──────────────────────────────
//   1. Donde se CONFIGURAN las franjas: para que el dueño lo sepa antes de
//      montar su tabla de precios sobre algo que el sistema no agenda.
//   2. Donde se CAPTURAN las tarifas por franja, en la ficha de la pantalla.
//   3. Donde se VENDE (el cuadro de la propuesta), pegado al selector: es
//      cuando alguien lo está eligiendo, que es el momento en que sirve.
//   4. En el detalle interno de la propuesta.
//   5. **En la LIGA PÚBLICA**, que es la que ve el CLIENTE y donde la acepta.
//      Es la que más importa: enseñarle «Prime 06:00–10:00» y no decirle que la
//      programación no viaja sola sería mentirle por omisión justo al firmar.
//   6. Dentro del `snapshot_economico` congelado (`avisoFranja`), que es lo que
//      queda cuando las cinco pantallas hayan cambiado.
// ============================================================================
export function AvisoFranjaCMS({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      role="note"
      className={
        'flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 ' +
        (compacto ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs')
      }
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{AVISO_FRANJA_NO_VIAJA_AL_CMS}</span>
    </div>
  )
}
