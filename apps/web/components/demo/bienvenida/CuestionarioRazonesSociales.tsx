'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/demo/ui/Button'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { PreguntaSiNo } from './PreguntaSiNo'
import {
  camposDelPaso3,
  planDelCuestionario,
  resumenParaBitacora,
  LIMITE_RAZON_SOCIAL,
  type RolCatalogo,
  type EntidadConRoles,
} from '@/lib/cuestionario-entidades'

const API = '/spaces-dooh/api'

// ============================================================================
//  El cuestionario de las razones sociales del owner, en pantalla.
// ----------------------------------------------------------------------------
//  Las tres preguntas son las del dueño (17/09), en su orden y con su
//  intención. Lo que esta pantalla NO hace es decidir: la traducción de las
//  respuestas al conjunto de entidades y roles vive en
//  `lib/cuestionario-entidades.ts`, y aquí se LLAMA.
//
//  No es una preferencia de estilo. `vitest.config.ts` no monta jsdom a
//  propósito, así que una decisión de negocio escrita en un `.tsx` no la prueba
//  nadie: en este repositorio ya costó caro, y al sacarla a un módulo propio
//  aparecieron nueve casos en rojo. Por eso las mismas funciones que valida el
//  servidor son las que dibujan los campos y avisan antes de enviar — una sola
//  fuente, y el aviso de la pantalla nunca puede contradecir al 400 del
//  servidor.
// ============================================================================

export function CuestionarioRazonesSociales({
  roles,
  alTerminar,
  alSaltar,
}: {
  roles: RolCatalogo[]
  alTerminar: (entidades: EntidadConRoles[]) => void
  alSaltar: () => void
}) {
  // `null` = sin contestar, que no es «no». Ver `PreguntaSiNo`.
  const [varias, setVarias] = useState<boolean | null>(null)
  const [juntas, setJuntas] = useState<boolean | null>(null)
  const [unica, setUnica] = useState('')
  // Por CAMPO del formulario, no por rol: un campo fusionado (operación y
  // ventas juntas) contesta dos roles con un solo texto, y guardarlo por rol
  // obligaría a mantener dos valores sincronizados a mano.
  const [porCampo, setPorCampo] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  const campos = useMemo(
    () => camposDelPaso3({ variasRazonesSociales: varias, operacionYVentasJuntas: juntas }, roles),
    [varias, juntas, roles],
  )

  // El paso 3 no se pinta hasta que las respuestas que lo SIMPLIFICAN están
  // dadas: pedirlo antes sería pedir cinco campos a quien va a necesitar uno.
  const paso3Listo = varias === false || (varias === true && juntas !== null)

  const respuestas = useMemo(() => {
    const razonSocialPorRol: Record<string, string> = {}
    for (const campo of campos) {
      const valor = porCampo[campo.clave] ?? ''
      for (const rol of campo.roles) razonSocialPorRol[rol] = valor
    }
    return {
      variasRazonesSociales: varias,
      operacionYVentasJuntas: juntas,
      // Cuando hay una sola razón social se manda el campo único y NO el mapa:
      // el mapa repetiría el mismo nombre cinco veces y el servidor lo leería
      // como cinco respuestas que hay que comprobar entre sí.
      razonSocialUnica: varias === false ? unica : undefined,
      razonSocialPorRol: varias === false ? undefined : razonSocialPorRol,
    }
  }, [campos, porCampo, varias, juntas, unica])

  // La MISMA función que valida el servidor, para avisar antes de enviar. No
  // sustituye a la del servidor: la duplica a propósito en el único sentido que
  // no puede divergir, porque es literalmente el mismo código.
  const plan = useMemo(
    () => (paso3Listo ? planDelCuestionario(respuestas, roles.map((r) => r.rol)) : null),
    [paso3Listo, respuestas, roles],
  )

  // Un cuestionario a medio llenar no es un error que enseñar en rojo: es un
  // formulario a medias. El aviso se guarda para cuando ya hay algo escrito.
  const algoEscrito = varias === false ? unica.trim() !== '' : Object.values(porCampo).some((v) => v.trim() !== '')
  const aviso = plan && !plan.ok && algoEscrito ? plan.error : null

  async function enviar() {
    if (!plan || !plan.ok) {
      toast.error(plan && !plan.ok ? plan.error : 'Contesta las preguntas antes de continuar.')
      return
    }
    setEnviando(true)
    try {
      const r = await fetch(`${API}/bienvenida/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(respuestas),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error ?? 'No se pudo guardar el cuestionario')
      toast.success(`Listo: ${resumenParaBitacora(plan.entidades)}`)
      alTerminar(d.entidades ?? [])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6 pt-4">
          <PreguntaSiNo
            numero={1}
            pregunta="¿Tu empresa tiene varias razones sociales?"
            ayuda="Casi todas las empresas de medios reparten su operación entre varias. Si tienes una sola, con esto te ahorras el resto."
            valor={varias}
            onCambio={(v) => {
              setVarias(v)
              // Con una sola razón social, la 2 no tiene objeto: operación y
              // ventas están forzosamente en la misma. Se deja sin contestar en
              // vez de darla por «sí» para que el servidor vea lo mismo que la
              // pantalla.
              if (!v) setJuntas(null)
            }}
            deshabilitado={enviando}
          />

          {varias === true && (
            <PreguntaSiNo
              numero={2}
              pregunta="¿La operación está en la misma razón social que comercializa o factura las ventas?"
              ayuda="Suelen coincidir, y por eso se pregunta: si es tu caso, el paso siguiente te pide un dato menos."
              valor={juntas}
              onCambio={setJuntas}
              deshabilitado={enviando}
            />
          )}
        </CardContent>
      </Card>

      {paso3Listo && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div>
              <h2 className="text-sm font-medium text-ink">
                <span className="mr-2 text-muted">3.</span>
                {varias === false
                  ? 'Indica tu razón social'
                  : 'Indica las razones sociales para cada rol dentro de tu empresa'}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                {varias === false
                  ? 'Se le asignarán todos los roles. Después puedes separarlos en Razones sociales.'
                  : 'Una misma razón social puede llevar varios roles: escribe el mismo nombre y se agrupan en una sola. Lo que no sepas todavía, déjalo en blanco.'}
              </p>
            </div>

            {varias === false ? (
              <label className="block">
                <span className="mb-1 block text-[13px] text-muted">Razón social</span>
                <input
                  value={unica}
                  onChange={(e) => setUnica(e.target.value)}
                  maxLength={LIMITE_RAZON_SOCIAL}
                  autoFocus
                  disabled={enviando}
                  placeholder="Espacios del Centro SA de CV"
                  className="h-10 w-full rounded border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
            ) : (
              <div className="space-y-3">
                {campos.map((campo) => (
                  <label key={campo.clave} className="block">
                    <span className="mb-1 block text-[13px] text-muted">{campo.etiqueta}</span>
                    <input
                      value={porCampo[campo.clave] ?? ''}
                      onChange={(e) =>
                        setPorCampo((p) => ({ ...p, [campo.clave]: e.target.value }))
                      }
                      maxLength={LIMITE_RAZON_SOCIAL}
                      disabled={enviando}
                      placeholder="Razón social"
                      className="h-10 w-full rounded border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                  </label>
                ))}
              </div>
            )}

            {/* Lo que se va a crear, antes de crearlo. Sale de la misma función
                que lo va a crear, así que no puede prometer otra cosa. */}
            {plan?.ok && (
              <div className="rounded border border-border bg-surface-2 p-3 text-[13px] text-ink">
                <p className="font-medium">Se crearán {plan.entidades.length === 1 ? '1 razón social' : `${plan.entidades.length} razones sociales`}:</p>
                <ul className="mt-2 space-y-1">
                  {plan.entidades.map((e) => (
                    <li key={e.razonSocial}>
                      <span className="font-medium">{e.razonSocial}</span>
                      <span className="text-muted"> — {e.roles.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aviso && (
              <p role="alert" className="rounded border border-error bg-error-soft p-3 text-[13px] text-ink">
                {aviso}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={enviar} disabled={enviando || !plan?.ok}>
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </Button>
        {/* Nadie queda encerrado: se puede saltar y el cuestionario sigue
            accesible desde Razones sociales. Un paso obligatorio aquí dejaría al
            Dueño fuera de su propia aplicación por un dato que quizá tiene que
            preguntarle a su contador. */}
        <Button variant="ghost" onClick={alSaltar} disabled={enviando}>
          Lo hago más tarde
        </Button>
      </div>
    </div>
  )
}
