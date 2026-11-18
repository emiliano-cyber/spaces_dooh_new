import { apiLogout } from '@/lib/auth-real'

// ─── CERRAR SESION Y SALIR, CON CARGA COMPLETA (B64, 2026-11-04) ────────────
//
//  El Topbar salia con `router.push('/login')`. Desde IDIOMA-USUARIO el idioma
//  de la pantalla puede ser el de la CUENTA, y quien lo pinta es el layout
//  raiz, que una navegacion suave NO vuelve a pintar: la pantalla de entrar se
//  quedaba en el idioma de la persona que acababa de salir hasta recargar. En
//  un equipo compartido, la siguiente veia «Accedi» sin haberlo pedido.
//
//  El logout ya borra la cookie de la cuenta; una carga completa hace que el
//  servidor resuelva el idioma otra vez sin ella (cookie del navegador >
//  Accept-Language > espanol). Es lo mismo que hace el login al ENTRAR con una
//  cuenta en otro idioma (`app/(app)/login/page.tsx`, `cambiaIdiomaAlEntrar`).
//
//  Y de paso deja limpio todo el estado del cliente de la sesion anterior.

/** URL del NAVEGADOR (con basePath y barra final), no una ruta del router. */
export const RUTA_LOGIN = '/spaces-dooh/login/'

export async function cerrarSesionYSalir(
  dep: { cerrar?: () => Promise<void>; ir?: (url: string) => void } = {},
): Promise<void> {
  try {
    await (dep.cerrar ?? apiLogout)()
  } catch {
    // Sin red o con el servidor caido se sale igual: quedarse dentro con la
    // sesion a medias es peor, y la pantalla de entrar ya dira si hay red.
  }
  const ir = dep.ir ?? ((url: string) => window.location.assign(url))
  ir(RUTA_LOGIN)
}
