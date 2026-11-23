'use client'

import { useSearchParams } from 'next/navigation'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { esMando } from '@/lib/roles'
import { useIdioma } from '@/lib/i18n/contexto'
import { BrilloPorHoras } from '@/components/demo/space-eyes/BrilloPorHoras'
import { AjustarTexto } from '@/components/demo/space-eyes/AjustarTexto'
import { Programacion } from '@/components/demo/space-eyes/Programacion'
import { Verificacion } from '@/components/demo/space-eyes/Verificacion'
import { Graficas } from '@/components/demo/space-eyes/Graficas'

// ============================================================================
//  Space Eyes — «Ajustes»: lo que se configura una vez y se deja puesto.
//
//  El menú de Space Eyes llegó a nueve entradas y las nueve pesaban lo mismo.
//  Cuatro de ellas no son sitios a los que se entra a mirar —Equipos, Galería,
//  Gráficas, Campañas, Fallas sí lo son—, sino cosas que se dejan configuradas
//  y no se vuelven a tocar en meses: cuánta luz de noche, cómo se marca la
//  foto, a qué horas se dispara y contra qué se verifica. Juntas en un
//  apartado, el menú vuelve a decir de un vistazo a qué se entra.
//
//  NO SE DUPLICA NADA: cada pestaña monta el mismo componente que tenía su
//  página. Lo único nuevo es «Brillo por horas», que hasta hoy solo se podía
//  tocar equipo por equipo dentro de su ficha.
//
//  LAS DIRECCIONES VIEJAS SIGUEN SIRVIENDO. `/space-eyes/texto`,
//  `/space-eyes/programacion` y `/space-eyes/verificacion` redirigen aquí con
//  su pestaña abierta. Hay enlaces a ellas en la ficha del equipo y en correos
//  ya enviados, y una dirección que deja de funcionar es una llamada.
// ============================================================================

// `soloMando` conserva el reparto que tenía cada una cuando era su propia
// entrada del menú: la luz de noche, la marca de las fotos y las franjas las
// movía solo quien administra la instancia; Verificación la veía también
// venta, porque quien enseña una pantalla a un cliente necesita saber qué
// salió en ella. Agruparlas no es motivo para cambiar quién entra.
const PESTANAS = [
  { value: 'brillo', clave: 'spaceeyes.ajustes.tab.brillo', soloMando: true },
  { value: 'texto', clave: 'spaceeyes.ajustes.tab.texto', soloMando: true },
  { value: 'programacion', clave: 'spaceeyes.ajustes.tab.programacion', soloMando: true },
  { value: 'verificacion', clave: 'spaceeyes.verif.titulo', soloMando: false },
  { value: 'graficas', clave: 'spaceeyes.graficas.titulo', soloMando: false },
] as const

type Clave = (typeof PESTANAS)[number]['value']

export function AjustesSE() {
  const params = useSearchParams()
  const { t } = useIdioma()
  const { sesion } = useSesionCtx()
  const mando = esMando(sesion?.usuario?.rol)

  const visibles = PESTANAS.filter((p) => mando || !p.soloMando)
  const pedida = params?.get('t') ?? null
  const inicial: Clave = visibles.some((p) => p.value === pedida)
    ? (pedida as Clave)
    : (visibles[0]?.value ?? 'verificacion')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-ink">{t('spaceeyes.ajustes.titulo')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('spaceeyes.ajustes.descripcion')}</p>
      </div>

      {/* `key` fuerza el remonte cuando se llega con otra pestaña en la
          dirección: `defaultValue` solo se mira al montar, así que sin esto
          una redirección desde /texto abriría la pestaña de antes. */}
      <Tabs key={inicial} tabs={visibles.map((p) => ({ value: p.value, label: t(p.clave) }))} defaultValue={inicial}>
        {mando && (
          <TabPanel value="brillo" className="pt-4">
            <BrilloPorHoras />
          </TabPanel>
        )}
        {mando && (
          <TabPanel value="texto" className="pt-4">
            <AjustarTexto encabezado={false} />
          </TabPanel>
        )}
        {mando && (
          <TabPanel value="programacion" className="pt-4">
            <Programacion encabezado={false} />
          </TabPanel>
        )}
        <TabPanel value="verificacion" className="pt-4">
          <Verificacion encabezado={false} />
        </TabPanel>
        <TabPanel value="graficas" className="pt-4">
          <Graficas encabezado={false} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
