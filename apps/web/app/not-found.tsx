import Link from 'next/link'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
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
// ============================================================================

export default function NotFound() {
  return (
    <div className="demo-root flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <SpaceOsMark className="h-10 w-10" />
      <p className="demo-num mt-6 text-[12px] font-medium uppercase tracking-widest text-muted">
        Error 404
      </p>
      <h1 className="mt-2 text-2xl text-ink">Esta página no existe</h1>
      <p className="mt-2 max-w-sm text-[13px] text-muted">
        La dirección es incorrecta o el registro que buscas ya no está disponible.
      </p>
      <Link
        href="/inicio"
        className="mt-6 inline-flex h-9 items-center rounded border border-border-strong bg-surface px-4 text-[13px] font-medium text-ink hover:bg-surface-2"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
