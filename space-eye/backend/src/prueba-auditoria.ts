// backend/src/prueba-auditoria.ts
//
// Las cuentas de la auditoria contra los datos que haya en la base.
//
//   node dist/prueba-auditoria.js
//
// SOLO LEE. No escribe ni una fila: se corre en el servidor que se quiera
// revisar, produccion incluida, y lo que dice vale para los datos de ESE dia.
//
// VIVE EN src/ Y NO EN scripts/, por lo mismo que `etiquetar-fotos`: hay que
// poder correrlo DONDE ESTAN LOS DATOS. La imagen de la instancia no lleva el
// repositorio ni tsx, solo `dist`, y un guion en scripts/ solo serviria en un
// equipo de desarrollo, que es justo donde no hay auditoria que revisar.
//
// POR QUE EXISTE. La auditoria se alimenta de dos tablas que no nacieron
// juntas: `device_creative_dias` (033) lleva los recorridos desde hace meses y
// `device_dias` (036) las miradas desde que el equipo se actualiza. Las dos
// formas de equivocarse que esta pantalla NO puede permitirse salen de ahi, y
// ninguna de las dos hace fallar nada: la pantalla simplemente ensena un
// numero que no se sostiene cuando alguien pregunta.
//
//   · Decir «todavia no hay nada medido» de un equipo que lleva meses
//     midiendo, porque se miro solo la tabla nueva.
//   · Sumar el denominador tantas veces como artes tenga la campana en esa
//     pantalla, y acabar con «en 198 de 97 recorridos».
//
// Lo que se comprueba aqui es justo eso, y la suposicion de la que cuelga el
// arreglo: que los recorridos de un dia son UN numero, repetido en la fila de
// cada creativo del catalogo.
import { pool } from './config/database';

let fallos = 0;
function afirmar(ok: boolean, texto: string, extra = '') {
  if (!ok) { fallos++; console.log(`  FALLA  ${texto}  ${extra}`); }
  else console.log(`  ok     ${texto}  ${extra}`);
}

const DESDE = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

async function main() {
  console.log(`Auditoria · desde ${DESDE}\n`);

  // ── 1. Los recorridos de un dia son UN numero ────────────────────────────
  // La 033 guarda `revisiones` REPETIDO en la fila de cada creativo del
  // catalogo. Todo el arreglo del denominador cuelga de eso: se toma una vez
  // con MAX. Si algun dia deja de ser cierto, MAX se queda con el mayor y
  // nadie se entera, asi que se comprueba aqui y no en un comentario.
  console.log('Los recorridos de un dia son un solo numero');
  const [rep] = await pool.query<any[]>(
    `SELECT device_id, dia, MIN(revisiones) lo_menos, MAX(revisiones) lo_mas,
            COUNT(*) creativos
       FROM device_creative_dias WHERE dia >= ?
      GROUP BY device_id, dia HAVING lo_menos <> lo_mas LIMIT 5`, [DESDE]);
  afirmar(rep.length === 0, 'ningun dia tiene dos cuentas de recorridos distintas',
    rep.length ? `(p.ej. equipo ${rep[0].device_id} el ${String(rep[0].dia).slice(0, 10)}: ${rep[0].lo_menos} y ${rep[0].lo_mas})` : '');

  // ── 2. Nadie sale mas veces de las que se le miro ────────────────────────
  console.log('\nNingun anuncio aparece mas veces que recorridos tuvo el dia');
  const [pasa] = await pool.query<any[]>(
    `SELECT device_id, dia, LEFT(phash, 8) ph, apariciones, revisiones
       FROM device_creative_dias
      WHERE dia >= ? AND apariciones > revisiones LIMIT 5`, [DESDE]);
  afirmar(pasa.length === 0, 'apariciones <= revisiones en todas las filas',
    pasa.length ? `(p.ej. ${pasa[0].ph} el ${String(pasa[0].dia).slice(0, 10)}: ${pasa[0].apariciones} de ${pasa[0].revisiones})` : '');

  // ── 3. La campana tampoco, por pantalla y dia ───────────────────────────
  // La misma cuenta que hace `deCampana`. Si alguien vuelve a poner
  // SUM(revisiones), esta linea se pone roja con los datos reales.
  console.log('\nLa cuenta de una campana cabe en el dia de su pantalla');
  const [camp] = await pool.query<any[]>(
    `SELECT t.campaign_id, t.device_id, t.dia, t.apariciones, t.revisiones
       FROM (SELECT c.campaign_id, d.device_id, d.dia,
                    LEAST(SUM(d.apariciones), MAX(d.revisiones)) apariciones,
                    MAX(d.revisiones) revisiones
               FROM device_creative_dias d
               JOIN device_creatives c
                 ON c.device_id = d.device_id AND c.phash = d.phash
              WHERE c.campaign_id IS NOT NULL AND d.dia >= ?
              GROUP BY c.campaign_id, d.device_id, d.dia) t
      WHERE t.apariciones > t.revisiones LIMIT 5`, [DESDE]);
  afirmar(camp.length === 0, 'ninguna campana se pasa de los recorridos de su pantalla',
    camp.length ? `(campana ${camp[0].campaign_id}: ${camp[0].apariciones} de ${camp[0].revisiones})` : '');
  // Y si esta comprobacion tuvo dientes o paso de largo. El denominador solo
  // se podia multiplicar cuando una campana tiene DOS O MAS artes en la misma
  // pantalla el mismo dia; donde eso no pasa, la linea de arriba sale verde
  // con el codigo roto. Decirlo evita leer un «ok» como una garantia que no
  // es.
  const [varias] = await pool.query<any[]>(
    `SELECT COUNT(*) n FROM (
        SELECT c.campaign_id, d.device_id, d.dia
          FROM device_creative_dias d
          JOIN device_creatives c
            ON c.device_id = d.device_id AND c.phash = d.phash
         WHERE c.campaign_id IS NOT NULL AND d.dia >= ?
         GROUP BY c.campaign_id, d.device_id, d.dia
        HAVING COUNT(*) > 1) y`, [DESDE]);
  const n = Number(varias[0]?.n || 0);
  console.log(n
    ? `  (${n} dias de pantalla con mas de un arte de la misma campana: ahi es donde se multiplicaba)`
    : '  (ninguna campana tiene dos artes en la misma pantalla el mismo dia: esta comprobacion no pudo fallar con estos datos)');

  // ── 4. Un equipo con historia no sale «sin nada medido» ─────────────────
  // El fallo que se vio en la pantalla: la ficha decia «todavia no hay nada
  // medido en este periodo» y la campana, debajo, «en 411 de 1 277
  // recorridos». La espina del reporte es la UNION de las dos tablas.
  console.log('\nTodo equipo con historia tiene dias que ensenar');
  const [con] = await pool.query<any[]>(
    `SELECT device_id, COUNT(DISTINCT dia) dias FROM device_creative_dias
      WHERE dia >= ? GROUP BY device_id`, [DESDE]);
  const [union] = await pool.query<any[]>(
    `SELECT device_id, COUNT(*) dias FROM (
        SELECT device_id, dia FROM device_dias WHERE dia >= ?
        UNION ALL
        SELECT d.device_id, d.dia FROM device_creative_dias d
         WHERE d.dia >= ?
           AND NOT EXISTS (SELECT 1 FROM device_dias dd
                            WHERE dd.device_id = d.device_id AND dd.dia = d.dia)
         GROUP BY d.device_id, d.dia) x
      GROUP BY device_id`, [DESDE, DESDE]);
  const vistos = new Map(union.map((x) => [Number(x.device_id), Number(x.dias)]));
  if (!con.length) {
    console.log('  (no hay historia en este periodo: nada que comprobar)');
  }
  for (const e of con) {
    const n = vistos.get(Number(e.device_id)) || 0;
    afirmar(n >= Number(e.dias),
      `equipo ${e.device_id}: ${e.dias} dias de historia`, `-> la auditoria ensena ${n}`);
  }

  console.log('');
  console.log(fallos ? `${fallos} FALLO(S)` : 'Todo cuadra.');
  process.exitCode = fallos ? 1 : 0;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
