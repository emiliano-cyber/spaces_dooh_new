import fs from 'fs'; import pg from 'pg'
const env = fs.readFileSync('.env','utf8')
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1]||'').trim().replace(/^["']|["']$/g,'').replace(/\?.*$/,'')
const isLocal = /@localhost|@127\.0\.0\.1/.test(url)
const pool = new pg.Pool({ connectionString: url, ssl: isLocal?undefined:{rejectUnauthorized:false} })
const s='tenant_h3dm'
const q=async(t)=>(await pool.query(`select count(*)::int c from "${s}"."${t}"`)).rows[0].c
console.log('Data demo en tenant_h3dm (H3DM Media / slug market):')
console.log('  Sitios     :', await q('Sitio'))
console.log('  Campañas   :', await q('Campana'))
console.log('  Clientes   :', await q('Cliente'))
console.log('  Arrendadores:', await q('Arrendador'))
console.log('  Órdenes(OT):', await q('OrdenTrabajo'))
const camp=(await pool.query(`select folio, nombre, estatus from "${s}"."Campana" order by "creadoEn" limit 6`)).rows
console.log('\nEjemplos de campañas:'); camp.forEach(c=>console.log(`  ${c.folio} · ${c.nombre} · ${c.estatus}`))
await pool.end()
