'use client'

import { Captacion } from '@/components/demo/captacion/Captacion'
import { useTexto } from '@/lib/i18n/contexto'

// CAP-01 · la bitácora de captación: cómo va cada cliente, arrendador, predio o
// pantalla que se está intentando traer. El vendedor ve lo suyo; quien tiene
// `captacion.aprobar` ve a todo el equipo y decide.
//
// Encabezado con el patrón del Dashboard desde el 26/10 (título y una línea,
// sin icono). Antes usaba `text-neutral-500`, un gris suelto fuera de los
// tokens del proyecto.
export default function CaptacionPage() {
  const t = useTexto()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-ink">{t('clientes.captacion.titulo')}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t('clientes.captacion.subtitulo')}
        </p>
      </div>
      {/* Sin tarjeta envolvente desde el 20/10: la tabla de prospectos es ahora
          su propia tarjeta plegable dentro de `Captacion`, y una tarjeta dentro
          de otra se leía como dos marcos. Pestañas y «Nuevo prospecto» quedan
          a la vista, como en las demás pantallas. */}
      <Captacion />
    </div>
  )
}
