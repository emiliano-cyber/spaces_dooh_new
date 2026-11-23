import { redirect } from 'next/navigation'

// Esta pantalla es ahora una pestaña de «Ajustes». La dirección se conserva
// -redirigiendo- porque hay enlaces a ella desde la ficha del equipo y desde
// fuera: una dirección que deja de funcionar no avisa, solo da un 404.
export default function Redirigir() {
  redirect('/space-eyes/ajustes?t=texto')
}
