import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'zlib'
import { crc32, kitRaspberry, networkConfig, nombreDeEquipo, userData } from './space-eyes-kit-pi'

// Un lector minimo del .zip: si el archivo no se puede leer asi, Windows o macOS
// tampoco lo abririan, y quien prepara la microSD se queda sin archivos.
function leerZip(z: Uint8Array): Record<string, string> {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
  const fin = z.length - 22
  expect(v.getUint32(fin, true)).toBe(0x06054b50)
  const n = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const salida: Record<string, string> = {}
  for (let i = 0; i < n; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50)
    const metodo = v.getUint16(p + 10, true)
    const crc = v.getUint32(p + 16, true)
    const tam = v.getUint32(p + 20, true)
    const largoNombre = v.getUint16(p + 28, true)
    const local = v.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(z.subarray(p + 46, p + 46 + largoNombre))
    const ini = local + 30 + v.getUint16(local + 26, true)
    let datos = z.subarray(ini, ini + tam)
    if (metodo === 8) datos = inflateRawSync(datos)
    expect(crc32(datos)).toBe(crc)
    salida[nombre] = new TextDecoder().decode(datos)
    p += 46 + largoNombre
  }
  return salida
}

describe('kit de la microSD de una Raspberry', () => {
  it('nombre del equipo en la red, a partir del nombre del sitio', () => {
    expect(nombreDeEquipo('Av. Juárez 120 · Cara A')).toBe('spaceeye-av-juarez-120-cara-a')
    expect(nombreDeEquipo('')).toBe('spaceeye')
    expect(nombreDeEquipo('x'.repeat(90)).length).toBeLessThanOrEqual(49)
  })

  it('el WiFi aguanta comillas, dos puntos y acentos en la red y la clave', () => {
    const nc = networkConfig({ red: 'Café "Norte": 2.4', clave: 'a"b:c\\d' })
    expect(nc).toContain('"Café \\"Norte\\": 2.4":')
    expect(nc).toContain('password: "a\\"b:c\\\\d"')
    expect(nc).toContain('regulatory-domain: "MX"')
    expect(nc).toContain('renderer: NetworkManager')
  })

  it('sin WiFi solo va el cable (modem LTE)', () => {
    const nc = networkConfig(null)
    expect(nc).toContain('eth0:')
    expect(nc).not.toContain('wifis')
  })

  it('user-data instala con el servidor y el codigo, sin contrasena ni SSH', () => {
    const ud = userData({ servidor: 'https://eyes.g500.mx/', codigo: 'abcd-2345', nombre: 'Tlalpan' })
    expect(ud.startsWith('#cloud-config\n')).toBe(true)
    expect(ud).toContain('hostname: spaceeye-tlalpan')
    expect(ud).toContain("curl -fsSL 'https://eyes.g500.mx/instalar-pi.sh'")
    expect(ud).toContain("--servidor 'https://eyes.g500.mx' --codigo 'ABCD2345' --usuario spaceeye")
    expect(ud).toContain('lock_passwd: true')
    expect(ud).toContain('ssh_pwauth: false')
  })

  it('un codigo con caracteres raros no puede meter comandos', () => {
    const ud = userData({ servidor: 'https://eyes.x.mx', codigo: "AB'; rm -rf /; '" })
    expect(ud).toContain("--codigo 'ABRMRF'")
    expect(ud).not.toContain('rm -rf')
  })

  it('el .zip se abre y trae los tres archivos intactos', () => {
    const d = { servidor: 'https://eyes.g500.mx', codigo: 'ABCD2345', nombre: 'Tlalpan', wifi: { red: 'Sitio', clave: 'secreta' } }
    const archivos = leerZip(kitRaspberry(d))
    expect(Object.keys(archivos).sort()).toEqual(['LEEME.txt', 'network-config', 'user-data'])
    expect(archivos['user-data']).toBe(userData(d))
    expect(archivos['network-config']).toBe(networkConfig(d.wifi))
  })

  it('crc32 da el valor conocido de "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})
