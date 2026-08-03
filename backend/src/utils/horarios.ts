// backend/src/utils/horarios.ts
//
// Cuentas de horario para las fotos programadas.
//
// El backend corre en UTC dentro del contenedor, pero las franjas las escribe
// una persona en hora de Mexico. Sin convertir, "entre 8 y 10 de la manana"
// disparaba entre las 2 y las 4 de la madrugada. Por eso todo lo que sale de
// aqui se calcula contra la zona horaria del schedule (`timezone`), no la del
// servidor, y se devuelve como instante absoluto (Date) listo para guardar.

import { parseExpression } from 'cron-parser';

export type Ventana = { ini: string; fin: string };

/** Hora de pared (anio/mes/dia/hora/min) que marca el reloj de `tz` en ese instante. */
function partes(fecha: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(fecha)) p[parte.type] = parte.value;
  return {
    anio: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    // Intl puede devolver "24" por la medianoche segun el motor.
    hora: Number(p.hour) % 24, min: Number(p.minute), seg: Number(p.second),
  };
}

/** Cuanto le adelanta `tz` a UTC en ese instante, en milisegundos. */
function desfase(fecha: Date, tz: string): number {
  const q = partes(fecha, tz);
  const comoSiFueraUtc = Date.UTC(q.anio, q.mes - 1, q.dia, q.hora, q.min, q.seg);
  return comoSiFueraUtc - (fecha.getTime() - (fecha.getTime() % 1000));
}

/** El instante absoluto en que el reloj de `tz` marca esa fecha y hora. */
export function instante(anio: number, mes: number, dia: number, hora: number, min: number, tz: string): Date {
  const tentativa = Date.UTC(anio, mes - 1, dia, hora, min, 0);
  // El desfase se mide en el instante tentativo y se vuelve a medir en el
  // resultado: si la tentativa cayo del otro lado de un cambio de horario, la
  // segunda medicion es la buena. (Mexico ya no mueve el reloj, pero el sistema
  // acepta cualquier zona.)
  const primera = desfase(new Date(tentativa), tz);
  const segunda = desfase(new Date(tentativa - primera), tz);
  return new Date(tentativa - segunda);
}

function hhmm(txt: string): { h: number; m: number } | null {
  const cd = /^(\d{1,2}):(\d{2})$/.exec((txt || '').trim());
  if (!cd) return null;
  const h = Number(cd[1]), m = Number(cd[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function ventanasValidas(ventanas: unknown): ventanas is Ventana[] {
  return Array.isArray(ventanas) && ventanas.length > 0 &&
    ventanas.every((v: any) => v && hhmm(v.ini) !== null && hhmm(v.fin) !== null);
}

type Instancia = { arranque: Date; cierre: Date };

/**
 * Las franjas convertidas a instantes concretos, del dia anterior al pasado
 * manana. Se incluye el dia anterior porque una franja puede cruzar la
 * medianoche ("22:00" a "02:00") y a la 1 de la manana la vigente es la de ayer.
 */
function instancias(ventanas: Ventana[], tz: string, alrededorDe: Date): Instancia[] {
  const hoy = partes(alrededorDe, tz);
  const lista: Instancia[] = [];

  for (let salto = -1; salto <= 2; salto++) {
    // Date.UTC normaliza el desbordamiento de dia (31 + 1 -> dia 1 del mes que sigue).
    const d = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + salto));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();

    for (const v of ventanas) {
      const ini = hhmm(v.ini), fin = hhmm(v.fin);
      if (!ini || !fin) continue;
      const arranque = instante(y, m, dd, ini.h, ini.m, tz);
      let cierre = instante(y, m, dd, fin.h, fin.m, tz);
      if (cierre.getTime() <= arranque.getTime()) {
        // Cruza la medianoche: cierra al dia siguiente.
        const sig = new Date(Date.UTC(y, m - 1, dd + 1));
        cierre = instante(sig.getUTCFullYear(), sig.getUTCMonth() + 1, sig.getUTCDate(), fin.h, fin.m, tz);
      }
      lista.push({ arranque, cierre });
    }
  }

  return lista.sort((a, b) => a.arranque.getTime() - b.arranque.getTime());
}

/**
 * Un minuto al azar dentro de la proxima franja.
 *
 * `saltarLaActual` es lo que evita que una franja dispare dos veces: cuando el
 * worker acaba de tomar la foto de las 8-10, no debe sortear otro minuto de esa
 * misma franja (saldrian varias fotos en la manana y ninguna en la tarde), sino
 * irse a la siguiente.
 */
export function proximaVentanaAleatoria(
  ventanas: Ventana[],
  tz: string,
  desde: Date = new Date(),
  saltarLaActual = false,
): Date | null {
  if (!ventanasValidas(ventanas)) return null;

  const lista = instancias(ventanas, tz, desde);
  let piso = desde.getTime() + 60_000; // nunca en el minuto que corre

  if (saltarLaActual) {
    for (const i of lista) {
      if (i.arranque.getTime() <= desde.getTime() && desde.getTime() < i.cierre.getTime()) {
        piso = Math.max(piso, i.cierre.getTime() + 60_000);
      }
    }
  }

  // La lista viene ordenada por hora de arranque, asi que la primera franja con
  // minutos disponibles es la mas proxima. La hora de cierre NO cuenta como
  // minuto elegible: "de 8 a 10" es 08:00..09:59, o dos franjas pegadas (8-10 y
  // 10-12) se pisarian en el borde.
  for (const i of lista) {
    const inicio = Math.max(i.arranque.getTime(), piso);
    const minutos = Math.floor((i.cierre.getTime() - inicio) / 60_000);
    if (minutos < 1) continue; // franja ya pasada, o sin hueco util
    const elegido = inicio + Math.floor(Math.random() * minutos) * 60_000;
    return new Date(Math.floor(elegido / 60_000) * 60_000);
  }

  return null;
}

/**
 * La proxima de una lista de horas fijas ("08:00","14:30"), en la zona del
 * schedule. Antes se calculaba con la hora del servidor: en UTC, "08:00"
 * disparaba a las 2 de la madrugada hora de Mexico.
 */
export function proximaHoraFija(horas: string[], tz: string, desde: Date = new Date()): Date | null {
  const validas = (horas || []).map(hhmm).filter((x): x is { h: number; m: number } => x !== null);
  if (validas.length === 0) return null;

  const hoy = partes(desde, tz);
  const piso = desde.getTime() + 60_000;
  const candidatos: number[] = [];

  for (let salto = 0; salto <= 1; salto++) {
    const d = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + salto));
    for (const h of validas) {
      const t = instante(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h.h, h.m, tz).getTime();
      if (t >= piso) candidatos.push(t);
    }
  }

  if (candidatos.length === 0) return null;
  return new Date(Math.min(...candidatos));
}

/** Los campos JSON llegan como texto o ya parseados segun el driver. */
function comoJson(valor: any): any {
  if (valor == null) return null;
  if (typeof valor !== 'string') return valor;
  try { return JSON.parse(valor); } catch { return null; }
}

/**
 * Cuando toca la proxima foto de un schedule. Lo usan el worker (para
 * reprogramar tras disparar) y el controlador (al crear o editar).
 *
 * `yaDisparo` distingue esos dos momentos, y solo importa para las franjas: si
 * acaba de dispararse la de 8-10, la siguiente tiene que ser la franja que sigue
 * y no otro minuto de la misma, o saldrian varias fotos en la manana y ninguna
 * en la tarde.
 *
 * Devuelve null cuando el schedule no tiene con que calcular (por ejemplo,
 * franjas vacias): el worker solo mira los que tienen next_fire_at, asi que un
 * null lo deja dormido en vez de dispararlo cada minuto.
 */
export function proximoDisparo(schedule: any, yaDisparo: boolean): Date | null {
  const tz = schedule.timezone || 'America/Mexico_City';

  switch (schedule.frequency_type) {
    case 'interval':
      return schedule.interval_minutes
        ? new Date(Date.now() + schedule.interval_minutes * 60000)
        : null;

    case 'cron':
      if (!schedule.cron_expression) return null;
      try {
        return parseExpression(schedule.cron_expression, { tz }).next().toDate();
      } catch {
        return null; // expresion invalida: no se dispara, en vez de tumbar el worker
      }

    case 'specific_times':
      return proximaHoraFija(comoJson(schedule.specific_times) || [], tz);

    case 'random_windows':
      return proximaVentanaAleatoria(comoJson(schedule.windows) || [], tz, new Date(), yaDisparo);

    default:
      return null;
  }
}
