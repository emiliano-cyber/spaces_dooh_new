import { agruparPorTipo, type EntradaNovedades, type TipoNovedad } from '@/lib/novedades'
import { TONO } from '@/components/demo/admin/Chip'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// ============================================================================
//  NotasDeVersion — las notas de UNA version, agrupadas por tipo.
//  Lo pintan tres sitios: el dialogo de despues de instalar, la pagina de
//  Novedades y el panel de Actualizaciones (antes de instalar). Una sola
//  forma de pintarlas, con su prueba (`NotasDeVersion.test.ts`).
//
//  Sin estado y sin 'use client': sirve igual dentro de un componente de
//  cliente y en `renderToStaticMarkup` de la prueba. Su unico hook es
//  `useIdioma()` (I18N, 2026-11-02), que fuera del proveedor cae al espanol.
//  Desde el 2026-11-05 los items tambien salen en el idioma de quien lee
//  (`textoDeItem`, con caida al espanol en las entradas sin traducir). El
//  texto va como hijo de React, nunca como HTML: lo escribio un desarrollador,
//  pero lo de `notas_disponibles` llega desde otra imagen.
// ============================================================================

export const SIN_NOTAS = 'Esta versión no trae notas'

// Chips del Dashboard con los tonos de `admin/Chip.tsx`: `bg-success/10` no
// se generaba sobre estos tokens (ver su cabecera), así que la etiqueta salía
// como texto de color sin forma. «Corregido» va en neutro y no en ámbar: en
// ámbar se leía como un aviso, y un arreglo es una buena noticia.
//
// Se pinta igual en los TRES sitios que usan este componente (Novedades,
// Actualizaciones y el diálogo de después de instalar).
const CLASE_TIPO: Record<TipoNovedad, string> = {
  NUEVO: TONO.exito,
  AJUSTADO: TONO.acento,
  CORREGIDO: 'border-border bg-surface-2 text-ink',
}

// La etiqueta de cada grupo en el idioma vigente. Su espanol es
// `ETIQUETA_TIPO` (`lib/novedades-reglas.mjs`), y `textos/admin.test.ts` lo ata.
export const CLAVE_TIPO_NOVEDAD: Record<TipoNovedad, ClaveTexto> = {
  NUEVO: 'admin.novedades.tipo.nuevo',
  AJUSTADO: 'admin.novedades.tipo.ajustado',
  CORREGIDO: 'admin.novedades.tipo.corregido',
}

export function NotasDeVersion({ notas }: { notas: EntradaNovedades | null }) {
  const { t, idioma } = useIdioma()
  if (!notas) return <p className="text-[12px] text-muted">{t('admin.novedades.sin-notas')}</p>
  return (
    <div className="space-y-3">
      {agruparPorTipo(notas.items, idioma).map((g) => (
        <div key={g.tipo} className="space-y-1">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASE_TIPO[g.tipo]}`}>
            {t(CLAVE_TIPO_NOVEDAD[g.tipo])}
          </span>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink">
            {g.textos.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
