'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import type { PuntoDeMedicion } from '@/lib/server/energia-repo'
import { motivoInvalidoDelRecibo, type ReciboEnFormulario } from './captura'

// ============================================================================
//  El alta de un recibo. RÁPIDA DE TECLEAR, que es el requisito de verdad.
// ----------------------------------------------------------------------------
//  Quien usa esto tiene un recibo de luz en la mano y no tiene tiempo: es una
//  sola línea de campos, en el orden en que se lee el papel —de quién es, de qué
//  mes, qué medidor, cuántos kWh, cuánto— y se guarda con Enter.
//
//  Y dos detalles que no son de estilo:
//
//   · El punto de medición y el mes NO se limpian al guardar. Capturar es un
//     lote: quien acaba de teclear el recibo de enero de un predio va a teclear
//     el de febrero, o el del segundo medidor del mismo mes. Vaciarlo todo
//     obligaría a volver a elegir el predio en cada fila.
//   · Los kWh y el importe SÍ se limpian, y ahí es al revés: dejar el importe
//     anterior en el campo es la forma más fácil de capturar dos veces la misma
//     cifra sin darse cuenta — y un importe repetido no da ningún error, da un
//     costo de luz que no es el del recibo.
//
//  Lo que puede equivocarse NO vive aquí: `motivoInvalidoDelRecibo` está en
//  `captura.ts` con sus pruebas, porque `vitest.config.ts` no monta jsdom y una
//  decisión escrita dentro de un `.tsx` no la prueba nadie.
// ============================================================================

export function FormularioRecibo({
  puntos,
  puntoInicial,
  mesInicial,
  onGuardar,
}: {
  puntos: PuntoDeMedicion[]
  puntoInicial?: string
  mesInicial: string
  onGuardar: (r: ReciboEnFormulario) => Promise<void>
}) {
  const [recibo, setRecibo] = useState<ReciboEnFormulario>({
    punto: puntoInicial ?? puntos[0]?.clave ?? '',
    periodo: mesInicial,
    medidor: '',
    kwh: '',
    importe: '',
  })
  const [error, setError] = useState<string | null>(null)
  // OBLIG-01 · lo que el servidor exige (`energia-controller.ts:170-188`): a qué
  // predio o pantalla corresponde, el mes, los kWh y el importe. El medidor no.
  const ob = useObligatorios({ ...recibo }, ['punto', 'periodo', 'kwh', 'importe'])

  const campo = (k: keyof ReciboEnFormulario) => (e: { target: { value: string } }) => {
    setRecibo((r) => ({ ...r, [k]: e.target.value }))
    setError(null)
  }

  async function guardar() {
    // Se valida con el reloj INYECTADO desde aquí y no dentro de la función
    // pura: es lo que permite probar el rechazo del recibo del futuro sin
    // falsear el reloj del proceso.
    const completos = ob.validar()
    const motivo = motivoInvalidoDelRecibo(recibo, new Date())
    if (!completos || motivo) {
      setError(motivo)
      return
    }
    try {
      await onGuardar(recibo)
      // Solo las cifras. Ver la cabecera: el predio y el mes se quedan porque
      // capturar es un lote, y el importe se va porque repetirlo no da error.
      setRecibo((r) => ({ ...r, medidor: '', kwh: '', importe: '' }))
      // Y el rojo se apaga: los kWh y el importe quedan vacíos A PROPÓSITO para
      // el siguiente recibo, no porque falten.
      ob.reiniciar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el recibo')
    }
  }

  const entrada =
    'h-9 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-ink outline-none focus:border-ink/40'

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-12">
        <Campo label="Predio o pantalla" obligatorio falta={ob.falta('punto')} className="col-span-2 lg:col-span-4">
          <select
            id="recibo-punto"
            className={entrada}
            value={recibo.punto}
            onChange={campo('punto')}
          >
            {/* Sin opción vacía por omisión: con un solo predio, la pantalla ya
                queda lista para teclear las cifras. */}
            {puntos.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.nombre}
                {p.tipo === 'predio' ? ` · ${p.pantallas} ${p.pantallas === 1 ? 'pantalla' : 'pantallas'}` : ' · pantalla suelta'}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Mes del recibo" obligatorio falta={ob.falta('periodo')} className="lg:col-span-2">
          {/* `type="month"` da `AAAA-MM`, que es exactamente lo que el
              controller normaliza al día 1. Un selector de día pediría elegir
              una fecha que la base no admite. */}
          <input id="recibo-mes" type="month" className={entrada} value={recibo.periodo} onChange={campo('periodo')} />
        </Campo>

        <Campo label="Medidor" className="lg:col-span-2">
          {/* Opcional: un predio con un solo medidor puede no tener el número
              anotado, y bloquear la captura por eso es fricción pura. Su razón
              de ser es poder capturar el SEGUNDO medidor del mismo mes. */}
          <input
            id="recibo-medidor"
            className={entrada}
            value={recibo.medidor ?? ''}
            onChange={campo('medidor')}
          />
        </Campo>

        <Campo label="kWh" obligatorio falta={ob.falta('kwh')} className="lg:col-span-2">
          <CampoCifra
            id="recibo-kwh"
            className={entrada}
            valor={recibo.kwh}
            onCambio={(crudo) => campo('kwh')({ target: { value: crudo } })}
          />
        </Campo>

        <Campo label="Importe" obligatorio falta={ob.falta('importe')} className="lg:col-span-2">
          {/* Con coma de miles al teclear. Lo que no se entiende llega como
              'NaN' y `motivoInvalidoDelRecibo` lo para («tiene que ser un
              número»), igual que paraba cualquier texto antes. */}
          <CampoCifra
            id="recibo-importe"
            className={entrada}
            valor={recibo.importe}
            onCambio={(crudo) => campo('importe')({ target: { value: crudo } })}
          />
        </Campo>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          Guardar recibo
        </Button>
        {/* El error se pinta AL LADO del botón y no arriba del formulario:
            quien captura está mirando el botón cuando lo pulsa. */}
        {error ? <span className="text-[12px] text-error">{error}</span> : null}
      </div>
    </form>
  )
}
