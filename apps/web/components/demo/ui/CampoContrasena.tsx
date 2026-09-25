'use client'

// ============================================================================
//  El campo donde se teclea la contraseña para confirmar un cambio sensible.
// ----------------------------------------------------------------------------
//  Existe porque el markup estaba copiado a mano en cada pantalla que reautentica
//  —baja de propietario, borrado de cliente, administración— y la cuarta copia
//  SE OLVIDÓ: el cuadro «Con cuál de tus razones sociales se paga» pedía la
//  contraseña y no pintaba dónde escribirla. Un campo que se escribe una vez no
//  se puede olvidar, y además se puede RENDIR en una prueba (`react-dom/server`,
//  sin DOM), que es lo que hace que ese defecto no pueda volver en silencio.
//
//  `type="password"` y `autoComplete="current-password"` no son decoración:
//  el primero impide que la clave se lea en pantalla, y el segundo le dice al
//  gestor de contraseñas que es la ACTUAL — sin él ofrece generar una nueva, que
//  es lo contrario de reautenticarse.
// ============================================================================

export function CampoContrasena({
  valor,
  onChange,
  onEnter,
  etiqueta = 'Tu contraseña',
  deshabilitado = false,
}: {
  valor: string
  onChange: (v: string) => void
  /** Enter confirma. Se pasa desde el modal para no duplicar la condición. */
  onEnter?: () => void
  etiqueta?: string
  deshabilitado?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{etiqueta}</span>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        disabled={deshabilitado}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      />
    </label>
  )
}
