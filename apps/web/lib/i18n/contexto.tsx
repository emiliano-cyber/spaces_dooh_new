'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cadenaCookieIdioma, IDIOMA_POR_OMISION, type Idioma } from './idiomas'
import { traducir, type ClaveTexto } from './diccionario'
import { formatearDinero, formatearDineroRedondo, formatearFecha, formatearNumero } from './dinero'

// ============================================================================
//  lib/i18n/contexto.tsx — EL IDIOMA, REPARTIDO POR EL ARBOL SIN PARPADEO.
// ----------------------------------------------------------------------------
//  El idioma lo resuelve el SERVIDOR (`servidor.ts`) y entra aqui como una
//  propiedad ya decidida. Ese es el mecanismo antiparpadeo entero:
//
//    · el HTML que sale del servidor YA esta en el idioma correcto;
//    · la hidratacion encuentra el mismo texto que el servidor pinto, asi que
//      no hay un segundo render que lo cambie;
//    · y no se mira `navigator.language` en ninguna parte.
//
//  La alternativa —decidir en el cliente— pinta espanol, hidrata, y salta a
//  ingles. Se ve el salto, y en una demostracion se ve fatal.
//
//  ─── DONDE SE GUARDA LA ELECCION MANUAL, Y QUIEN MANDA ─────────────────────
//
//  En la cookie `spaces_idioma`, un ano, `SameSite=Lax`, y NO `httpOnly`:
//  es una preferencia de presentacion, no una credencial, y la escribe el
//  navegador. La precedencia esta en `idiomas.ts` y es
//  `cookie > Accept-Language > espanol`.
//
//  OJO CON LO QUE ESTO IMPLICA Y NO SE HA DECIDIDO: una cookie es POR
//  NAVEGADOR, no por persona. Quien elija ingles en su portatil seguira viendo
//  espanol en su telefono. Esta en las PREGUNTAS PARA EL DUENO, porque hacerlo
//  por persona significa una columna nueva en `usuarios` y ninguna migracion
//  aterriza sin que el la apruebe.
//
//  ─── POR QUE `router.refresh()` Y NO UNA RECARGA ───────────────────────────
//
//  Al cambiar de idioma hay que volver a pedirle al servidor el arbol, porque
//  es el quien lee la cookie. `router.refresh()` reejecuta los Server
//  Components conservando el estado del cliente; `location.reload()` haria lo
//  mismo con un parpadeo blanco y perdiendo lo que hubiera escrito en un
//  formulario.
//
//  Y ademas se actualiza el estado local ANTES de pedir el refresco, para que
//  el cambio se vea al instante y no dependa del viaje al servidor. Las dos
//  vias convergen al mismo valor —la cookie—, asi que no pueden discrepar.
// ============================================================================

export interface ContextoIdioma {
  idioma: Idioma
  /** El texto de una clave, ya en el idioma vigente. */
  t: (clave: ClaveTexto, valores?: Record<string, string | number>) => string
  /** Un importe. La moneda NO es parametro: ver `dinero.ts`. */
  dinero: (monto: number) => string
  dineroRedondo: (monto: number) => string
  numero: (n: number, opciones?: Intl.NumberFormatOptions) => string
  fecha: (f: Date | string | number, opciones?: Intl.DateTimeFormatOptions) => string
  cambiarIdioma: (nuevo: Idioma) => void
}

// El valor por omision existe para que un componente montado fuera del
// proveedor —una prueba, un Storybook— siga pintando en espanol en vez de
// reventar. `cambiarIdioma` no hace nada ahi, que es lo honesto.
const Contexto = createContext<ContextoIdioma | null>(null)

// `children` va OPCIONAL, y no es descuido: con `createElement(Comp, props,
// hijo)` —la forma que exige `next lint`, porque pasar `children` dentro de las
// propiedades dispara `react/no-children-prop`— TypeScript comprueba el objeto
// de propiedades SIN los hijos. Declararlo obligatorio hace que `tsc` rechace
// justo la llamada correcta.
export function ProveedorIdioma({
  idioma: idiomaDelServidor,
  children,
}: {
  idioma: Idioma
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [idioma, setIdioma] = useState<Idioma>(idiomaDelServidor)

  // El servidor manda: si vuelve con otro idioma (tras un refresco, o al
  // navegar), el estado local se alinea. Sin esto, un cambio hecho en otra
  // pestana dejaria esta pestana desincronizada hasta recargar.
  useEffect(() => {
    setIdioma(idiomaDelServidor)
  }, [idiomaDelServidor])

  const cambiarIdioma = useCallback(
    (nuevo: Idioma) => {
      // La CADENA la arma `cadenaCookieIdioma` (`idiomas.ts`) y no esta funcion.
      // El motivo es que se pueda probar: escribir en `document.cookie` es un
      // efecto que sin DOM no se observa, y el mutante que borraba esta linea
      // sobrevivio a la primera medicion justamente por eso. La cadena si es un
      // dato, y `idiomas.test.ts` la comprueba.
      const seguro = typeof window !== 'undefined' && window.location.protocol === 'https:'
      document.cookie = cadenaCookieIdioma(nuevo, seguro)
      setIdioma(nuevo)
      router.refresh()
    },
    [router],
  )

  const valor = useMemo<ContextoIdioma>(
    () => ({
      idioma,
      t: (clave, valores) => traducir(idioma, clave, valores),
      dinero: (monto) => formatearDinero(monto, idioma),
      dineroRedondo: (monto) => formatearDineroRedondo(monto, idioma),
      numero: (n, opciones) => formatearNumero(n, idioma, opciones),
      fecha: (f, opciones) => formatearFecha(f, idioma, opciones),
      cambiarIdioma,
    }),
    [idioma, cambiarIdioma],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/**
 * El idioma vigente y sus ayudantes.
 *
 * Fuera del proveedor devuelve el espanol en vez de lanzar: un componente
 * suelto en una prueba tiene que poder rendirse, y pintar espanol es el
 * comportamiento de siempre.
 */
export function useIdioma(): ContextoIdioma {
  const ctx = useContext(Contexto)
  if (ctx) return ctx
  const idioma = IDIOMA_POR_OMISION
  return {
    idioma,
    t: (clave, valores) => traducir(idioma, clave, valores),
    dinero: (monto) => formatearDinero(monto, idioma),
    dineroRedondo: (monto) => formatearDineroRedondo(monto, idioma),
    numero: (n, opciones) => formatearNumero(n, idioma, opciones),
    fecha: (f, opciones) => formatearFecha(f, idioma, opciones),
    cambiarIdioma: () => {},
  }
}

/** Atajo para el caso comun: solo el traductor. */
export function useTexto(): ContextoIdioma['t'] {
  return useIdioma().t
}
