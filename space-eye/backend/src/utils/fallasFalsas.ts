// backend/src/utils/fallasFalsas.ts
//
// Reglas PURAS (sin base de datos) con las que el servidor decide que un aviso
// de un equipo no se sostiene. Viven aparte para poder probarlas sin levantar
// nada: `npm run prueba:fallas-falsas`.

/** La zona del sitio. Es la misma con la que se escriben los horarios en el panel. */
export const ZONA_SITIO = 'America/Mexico_City';

/** Minutos desde la medianoche, en la hora del sitio. */
export function minutoDelSitio(fecha: Date, zona = ZONA_SITIO): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha);
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function minutos(h: unknown, porOmision: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h ?? ''));
  if (!m) return porOmision;
  return Math.min(1440, Number(m[1]) * 60 + Number(m[2]));
}

/** "HH:MM" para los textos. */
export function hhmm(min: number): string {
  const r = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}

// --- Avisos fuera del horario de la pantalla -----------------------------------
//
// Un equipo SOLO vigila dentro del horario de su pantalla: fuera de el no mira
// nada (Monitor.kt: `if (!geo.enHorario(LocalTime.now())) return`). Asi que un
// aviso que llega con hora de fuera del horario no puede ser de verdad: dice
// que el reloj con el que el equipo compara el horario no es el del sitio.
//
// Le pasa a AUTOPISTA MEX.-QRO. (g500). Su telefono tiene la hora puesta a mano
// con otra zona horaria: la cuenta interna va 2 h atrasada (clock_offset_s =
// 7140) pero la hora que ENSENA es casi la buena. El servidor le corrige el
// horario por esas 2 h (`horarioParaElReloj`), el telefono lo compara con la hora
// que ensena, y empieza a vigilar a las 4:00. Y el 1 de noviembre su zona cambio
// de horario de verano: desde entonces a las 5:00. A esa hora la pantalla esta
// apagada -todavia es de noche y prende como a las 7:15-, asi que cada manana
// salia una «pantalla apagada en horario» que se «recuperaba» sola: 22 en un mes.
//
// El servidor no puede saber la hora que ensena el telefono (no la manda), pero
// si sabe la hora de verdad de cada aviso (la del equipo + su desfase medido).
// Con eso basta: lo que llega fuera del horario se rechaza con un 4xx, que el
// telefono entiende como «olvidala» (FALLA_RECHAZADA) y no reintenta. Si la
// pantalla de verdad sigue apagada ya dentro del horario, la siguiente vuelta lo
// vuelve a ver y ese aviso SI entra. No se calla nada que deba sonar.

/** Tolerancia: el reloj medido se redondea al minuto y la red tarda. */
export const FUERA_HORARIO_TOLERANCIA_MIN = 5;

/**
 * Si un aviso de esta hora cae fuera del horario de la pantalla. Un horario de
 * todo el dia, o ninguno, nunca deja nada fuera. Acepta horarios que cruzan la
 * medianoche (18:00 a 02:00), igual que el equipo.
 */
export function fueraDeHorario(fecha: Date, horario: any, zona = ZONA_SITIO,
                               toleranciaMin = FUERA_HORARIO_TOLERANCIA_MIN): boolean {
  if (!horario || typeof horario !== 'object') return false;
  const ini = minutos(horario.inicio, 6 * 60);
  const fin = minutos(horario.fin, 1440);
  if (ini === fin || (ini === 0 && fin === 1440)) return false;
  const a = minutoDelSitio(fecha, zona);
  const desde = ini - toleranciaMin;
  const hasta = fin + toleranciaMin;
  if (ini < fin) {
    // Normal (06:00 a 24:00). Con la tolerancia, la ventana puede salirse del
    // dia por los dos lados: se mira contra el minuto de hoy y el de ayer/manana.
    return !(a >= desde && a < hasta) && !(a - 1440 >= desde) && !(a + 1440 < hasta);
  }
  // Cruza la medianoche: dentro si es despues del inicio o antes del fin.
  return !(a >= desde || a < hasta);
}

// --- Gabinetes que se arreglan solos -------------------------------------------
//
// Un gabinete apagado o congelado de verdad es una tarjeta, una fuente o un cable:
// no se arregla solo, espera a un tecnico. Lo que el propio equipo da por
// «recuperado» en minutos era el contenido. En MAGNOCENTRO (13 al 20 de oct de
// 2026) salieron ocho «gabinete congelado» de noche que duraron de 10 a 30 min,
// todos con el mismo anuncio fijo de «Aceptamos las siguientes formas de pago»:
// una esquina del anuncio que no cambia se ve igual que un gabinete pegado.

/** Por debajo de esto, un gabinete que volvio solo no estaba fallando. */
export const ZONA_FALSA_MIN = 60;
/** Episodios asi en la ventana antes de pedirle al equipo una confirmacion mas. */
export const ZONAS_PARA_DUDAR = 3;
export const ZONAS_DIAS = 7;
/** Hasta aqui sube la confirmacion por esta regla: mas, y un apagon real tardaria horas. */
export const CONFIRMACIONES_TOPE = 4;

export function esZona(tipo: string): boolean {
  return tipo === 'zona_apagada' || tipo === 'zona_congelada';
}

/** Si un episodio de gabinete que el equipo cerro solo fue, en realidad, contenido. */
export function zonaFueContenido(tipo: string, minutos: number): boolean {
  return esZona(tipo) && minutos >= 0 && minutos < ZONA_FALSA_MIN;
}
