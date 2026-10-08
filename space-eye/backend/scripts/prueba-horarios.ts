// backend/scripts/prueba-horarios.ts
//
// Comprueba las cuentas de horario de las fotos programadas, que son la parte
// facil de equivocar: el servidor corre en UTC y las franjas se escriben en hora
// de Mexico, asi que un error de conversion manda las fotos a la madrugada sin
// que nadie lo note hasta ver la galeria.
//
//   npm run prueba:horarios
//
// No toca la base de datos ni la red: son cuentas puras.
import { proximaVentanaAleatoria, proximaHoraFija, instante } from '../src/utils/horarios';

const TZ = 'America/Mexico_City';
const enMx = (d: Date | null) => (d ? d.toLocaleString('es-MX', { timeZone: TZ, hour12: false }) : 'null');
const horaMx = (d: Date) => Number(d.toLocaleString('en-US', { timeZone: TZ, hour12: false, hour: '2-digit' })) % 24;

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

const ventanas = [{ ini: '08:00', fin: '10:00' }, { ini: '13:00', fin: '15:00' }, { ini: '18:00', fin: '20:00' }];

console.log('\n1) Hora de pared -> instante absoluto');
const ocho = instante(2026, 8, 4, 8, 0, TZ);
afirmar(ocho.getUTCHours() === 14, 'las 08:00 de Mexico son las 14:00 UTC', `-> ${ocho.toISOString()}`);

console.log('\n2) La foto cae dentro de la franja, y no siempre al mismo minuto');
const madrugada = new Date(Date.UTC(2026, 7, 4, 12, 0)); // 06:00 en Mexico
const minutos = new Set<number>();
let dentro = true;
for (let i = 0; i < 300; i++) {
  const p = proximaVentanaAleatoria(ventanas, TZ, madrugada);
  if (!p) { dentro = false; break; }
  if (horaMx(p) < 8 || horaMx(p) >= 10) { dentro = false; console.log(`     se salio: ${enMx(p)}`); break; }
  minutos.add(p.getTime());
}
afirmar(dentro, 'las 300 veces cayo dentro de la franja 8-10');
afirmar(minutos.size > 50, 'y sortea minutos distintos', `${minutos.size} minutos diferentes de 300`);

console.log('\n3) Tras disparar no repite franja');
const enPlenaFranja = new Date(Date.UTC(2026, 7, 4, 14, 37)); // 08:37 en Mexico
let salto = true;
for (let i = 0; i < 100; i++) {
  const sig = proximaVentanaAleatoria(ventanas, TZ, enPlenaFranja, true)!;
  if (horaMx(sig) < 13 || horaMx(sig) >= 15) { salto = false; console.log(`     repitio: ${enMx(sig)}`); break; }
}
afirmar(salto, 'siempre salta a la franja de la tarde (13-15)');

console.log('\n4) Pasada la ultima franja, la primera de manana');
const noche = new Date(Date.UTC(2026, 7, 5, 3, 0)); // 21:00 en Mexico
const manana = proximaVentanaAleatoria(ventanas, TZ, noche)!;
afirmar(horaMx(manana) >= 8 && horaMx(manana) < 10, 'es la franja 8-10', enMx(manana));
afirmar(manana.getTime() > noche.getTime(), 'y esta en el futuro');

console.log('\n5) Franja que cruza la medianoche (22:00 a 02:00)');
const nocturna = [{ ini: '22:00', fin: '02:00' }];
const pasadaMedianoche = new Date(Date.UTC(2026, 7, 5, 5, 30)); // 23:30 en Mexico
const pn = proximaVentanaAleatoria(nocturna, TZ, pasadaMedianoche)!;
afirmar(horaMx(pn) >= 22 || horaMx(pn) < 2, 'cae dentro de la franja nocturna', enMx(pn));
afirmar(pn.getTime() > pasadaMedianoche.getTime(), 'y en el futuro');

console.log('\n6) Horas fijas tambien respetan la zona');
const fija = proximaHoraFija(['08:00', '14:00'], TZ, madrugada)!;
afirmar(fija.getUTCHours() === 14, 'las 08:00 de Mexico, no las 08:00 UTC', `${fija.toISOString()} = ${enMx(fija)}`);

console.log('\n7) Entradas invalidas no truenan');
afirmar(proximaVentanaAleatoria([], TZ) === null, 'lista vacia -> null');
afirmar(proximaVentanaAleatoria([{ ini: '99:99', fin: '10:00' }], TZ) === null, 'hora imposible -> null');
afirmar(proximaHoraFija([], TZ) === null, 'sin horas -> null');

console.log(fallos === 0 ? '\nTODO BIEN\n' : `\n${fallos} FALLAS\n`);
process.exit(fallos === 0 ? 0 : 1);
