import Link from 'next/link'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { ATAJOS_404 } from '@/lib/atajos-404'
import './(app)/demo.css'

// ============================================================================
//  404 — la única pantalla del producto que vive FUERA del grupo (app).
// ----------------------------------------------------------------------------
//  Por eso salía en tema oscuro y sin marca (M4 de la auditoría del
//  04/08/2026): el design system de SPACE OS está scopeado a `.demo-root`, que
//  lo pone (app)/layout.tsx, y esta ruta nunca pasa por ahí. La versión previa
//  se defendía declarando su propio <html>/<body> con una paleta oscura escrita
//  a mano — que además anidaba un segundo <html> dentro del root layout.
//
//  La solución no es repetir la paleta: es importar demo.css y ponerse la clase
//  `.demo-root`, para que un cambio de marca alcance también a esta pantalla.
//
//  El enlace de regreso usa next/link a propósito: un <a> crudo obliga a
//  escribir el basePath ('/spaces-dooh') a mano, y ese literal ya se quedó
//  rezagado una vez cuando las rutas cambiaron.
//
//  Vivir fuera de (app) tiene un segundo coste, y es el que arregla la rejilla:
//  aquí NO hay sidebar. Con un solo enlace al inicio, quien caía en un enlace
//  roto tenía que volver a la portada y buscar su módulo a mano. Los atajos
//  salen de `NAV` —el mismo arreglo que pinta el menú— así que no hay una
//  segunda lista de nombres y rutas que pueda quedarse vieja (ver
//  `lib/atajos-404.ts`).
//
//  La lista es la misma para todos los roles, a propósito: esta pantalla no
//  tiene sesión —no la envuelve `SesionProvider`— y montarla solo para decorar
//  una rejilla de emergencia no vale el coste. No abre ninguna puerta: quien
//  pique un módulo que no le toca lo rebota `AuthGate` a su propia landing,
//  igual que si tecleara la ruta.
// ============================================================================

export default function NotFound() {
  return (
    <div className="demo-root flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <SpaceOsMark className="h-10 w-10" />
      <p className="demo-num mt-6 text-[12px] font-medium uppercase tracking-widest text-muted">
        Error 404
      </p>
      <h1 className="mt-2 text-2xl text-ink">Esta página no existe</h1>
      <p className="mt-2 max-w-sm text-[13px] text-muted">
        La dirección es incorrecta o el registro que buscas ya no está disponible.
      </p>

      <nav aria-label="Ir a otra sección" className="mt-8 w-full max-w-lg">
        <p className="text-[12px] font-medium uppercase tracking-widest text-muted">
          Ir a otra sección
        </p>
        {/* `list-none` explícito: dentro de `.demo-root` los <li> conservan su
            viñeta y salían tres puntos sueltos a la izquierda de las tarjetas. */}
        <ul className="mt-3 grid list-none grid-cols-2 gap-2 sm:grid-cols-3">
          {ATAJOS_404.map((atajo) => {
            const Icono = atajo.icon
            return (
              <li key={atajo.key}>
                <Link
                  href={atajo.href}
                  className="flex h-full flex-col items-center justify-center gap-1.5 rounded border border-border bg-surface px-3 py-4 text-[13px] text-ink hover:border-border-strong hover:bg-surface-2"
                >
                  <Icono className="h-4 w-4 text-muted" aria-hidden="true" />
                  {atajo.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Link
        href="/inicio"
        className="mt-8 inline-flex h-9 items-center rounded border border-border-strong bg-surface px-4 text-[13px] font-medium text-ink hover:bg-surface-2"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
