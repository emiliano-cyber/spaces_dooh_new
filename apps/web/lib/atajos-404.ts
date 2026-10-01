import { NAV, type NavItem } from '@/components/demo/shell/nav'

// ============================================================================
//  Atajos de la pantalla 404.
// ----------------------------------------------------------------------------
//  La 404 vive FUERA del grupo (app), así que no tiene sidebar: sin estos
//  atajos, el único salto posible es «Volver al inicio» y desde ahí a buscar el
//  módulo a mano.
//
//  Las etiquetas y las rutas NO se escriben aquí: se sacan de `NAV`, el mismo
//  arreglo que pinta el menú y que usa `AuthGate` para autorizar. Es la regla
//  que ya sigue el shell —«ocultar el ítem y bloquear la ruta nunca se
//  desincronizan»— y aquí compra lo mismo: si mañana /inventario cambia de ruta
//  o de nombre, esta pantalla se entera sola. Una segunda lista con los mismos
//  textos diverge; ésta no puede.
//
//  Vive en `lib/` y no junto a la página porque las pruebas de este repo son
//  solo `.ts` (un `.tsx` pediría jsdom, que no está instalado — ver
//  `vitest.config.ts`). Sacando la lista a un dato puro, la parte que se puede
//  romper en silencio queda cubierta y el `.tsx` solo pinta.
//
//  Doce y no diecinueve: la rejilla es una salida de emergencia, no una copia
//  del menú. La regla es DOS POR FASE (ver `GRUPOS` en `nav.ts`), salvo las dos
//  fases que tienen una sola entrada en todo el menú —inicio y Space Eyes—, que
//  aportan la suya.
//
//  Antes eran nueve con otra regla («una por fase, y dos en las de más
//  tráfico»). Cambió al agregar la fase de Space Eyes: con seis fases, nueve
//  obligaba a elegir a dedo qué tres fases llevaban la segunda, y doce cabe
//  exacto en la rejilla de tres columnas sin dejar la última fila coja.
//
//  Las dos cuentas las vigila `atajos-404.test.ts` —un atajo por fase, y el
//  total múltiplo de tres—, así que agregar un grupo al menú sin pasar por aquí
//  pone la prueba en rojo. Es justo lo que pasó.
// ============================================================================

export const CLAVES_ATAJOS_404 = [
  'dashboard',      // inicio      (fase de una sola entrada)
  'inventario',     // patrimonio
  'network',        // patrimonio
  'space-eyes',     // ojos        (fase de una sola entrada)
  'clientes',       // vender
  'propuestas',     // vender
  'campanas',       // entregar
  'operaciones',    // entregar
  'finanzas',       // cobrar
  'comisiones',     // cobrar
  'actividad',      // sistema
  'administracion', // sistema
] as const

// Se FILTRA en vez de reventar si una clave dejara de existir. Esta lista
// alimenta la pantalla de error: si lanzara, el fallo se comería justo la
// página que se muestra cuando algo ya salió mal, y en vez de un 404 legible
// saldría un 500. Quien avisa del desajuste es la prueba de al lado, que corre
// en CI — ahí el rojo no le cuesta nada a nadie.
export const ATAJOS_404: NavItem[] = CLAVES_ATAJOS_404.map((clave) =>
  NAV.find((n) => n.key === clave),
).filter((n): n is NavItem => n !== undefined)
