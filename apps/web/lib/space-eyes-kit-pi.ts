// ============================================================================
//  El archivo para la microSD de una Raspberry: se instala sola al encender.
// ----------------------------------------------------------------------------
//  Raspberry Pi OS con Debian 13 (imagen del 24-nov-2025 en adelante) configura
//  el primer arranque con cloud-init, leyendo `user-data` y `network-config` de
//  la particion de arranque de la microSD. Aqui se arman esos dos archivos:
//
//    - network-config: el cable (modem LTE) siempre, y el WiFi si se dio.
//    - user-data: nombre del equipo, un usuario `spaceeye` SIN contrasena ni
//      SSH (todo se opera desde SPACE OS), la zona horaria, y al final bajar el
//      instalador del Space Eye de la empresa y correrlo con el codigo de
//      vinculacion. Reintenta la descarga 30 min por si la red tarda.
//
//  Quien prepara la Pi graba la microSD con Raspberry Pi Imager sin personalizar
//  nada y copia estos dos archivos encima de los que trae. Nada mas.
//
//  Todo se arma en el navegador: la clave del WiFi no viaja a ningun servidor.
// ============================================================================

export interface DatosKitPi {
  /** https://eyes.<dominio> de la empresa. */
  servidor: string
  /** Codigo de vinculacion, con o sin guion. */
  codigo: string
  /** Nombre del sitio, para el nombre del equipo en la red (opcional). */
  nombre?: string
  wifi?: { red: string; clave: string } | null
}

// Una cadena entre comillas dobles de JSON es una cadena valida de YAML: asi la
// red o la clave del WiFi pueden llevar comillas, dos puntos o acentos sin
// romper el archivo.
const q = (s: string) => JSON.stringify(s)

/** "Av. Juárez 120" -> "spaceeye-av-juarez-120" (lo que acepta un hostname). */
export function nombreDeEquipo(nombre?: string): string {
  const base = String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return base ? `spaceeye-${base}` : 'spaceeye'
}

export function networkConfig(wifi?: DatosKitPi['wifi']): string {
  const lineas = [
    'network:',
    '  version: 2',
    // Raspberry Pi OS maneja la red con NetworkManager. Sin esto, netplan arma
    // la configuracion para systemd-networkd, que en la Pi no esta activo: el
    // WiFi no se conectaria nunca y la Pi no tendria como instalarse.
    '  renderer: NetworkManager',
    '  ethernets:',
    '    eth0:',
    '      dhcp4: true',
    '      optional: true',
  ]
  if (wifi && wifi.red) {
    lineas.push(
      '  wifis:',
      '    wlan0:',
      '      dhcp4: true',
      '      optional: true',
      '      regulatory-domain: "MX"',
      '      access-points:',
      `        ${q(wifi.red)}:`,
      `          password: ${q(wifi.clave)}`,
    )
  }
  return lineas.join('\n') + '\n'
}

export function userData(d: DatosKitPi): string {
  const servidor = d.servidor.replace(/\/+$/, '')
  const codigo = d.codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const instalador = `${servidor}/instalar-pi.sh`
  // Un solo comando de shell, armado con comillas simples dentro de una cadena
  // YAML entre comillas dobles. servidor y codigo ya vienen limpios (el codigo
  // solo trae letras y numeros; el servidor sale de Space Eye).
  const comando =
    `for i in $(seq 1 60); do curl -fsSL '${instalador}' -o /root/instalar-pi.sh && break; sleep 30; done; ` +
    `bash /root/instalar-pi.sh --servidor '${servidor}' --codigo '${codigo}' --usuario spaceeye ` +
    `>> /var/log/space-eye-instalacion.log 2>&1`
  return [
    '#cloud-config',
    '# Space Eye: esta Raspberry se instala sola al encender. Generado por SPACE OS.',
    `hostname: ${nombreDeEquipo(d.nombre)}`,
    'manage_etc_hosts: true',
    'timezone: America/Mexico_City',
    'users:',
    '  - name: spaceeye',
    '    gecos: Space Eye',
    '    shell: /bin/bash',
    '    groups: [video, render, gpio, i2c, spi, plugdev, netdev]',
    '    lock_passwd: true',
    'ssh_pwauth: false',
    'runcmd:',
    `  - [bash, -c, ${q(comando)}]`,
    '',
  ].join('\n')
}

// ─── Un .zip sin compresion (el formato mas simple que abre cualquier sistema) ─
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(archivos: { nombre: string; texto: string }[]): Uint8Array {
  const cod = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let desplazamiento = 0
  for (const a of archivos) {
    const nombre = cod.encode(a.nombre)
    const datos = cod.encode(a.texto)
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 0, true) // sin compresion
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    partes.push(new Uint8Array(local.buffer), nombre, datos)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, datos.length, true)
    c.setUint32(24, datos.length, true)
    c.setUint16(28, nombre.length, true)
    c.setUint32(42, desplazamiento, true)
    central.push(new Uint8Array(c.buffer), nombre)
    desplazamiento += 30 + nombre.length + datos.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, desplazamiento, true)
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of todo) {
    salida.set(p, i)
    i += p.length
  }
  return salida
}

export const LEEME = `ARCHIVOS PARA LA MICROSD DE UNA RASPBERRY (Space Eye)

1. Graba la microSD con Raspberry Pi Imager: "Raspberry Pi OS Lite (64-bit)",
   SIN personalizar nada (cuando pregunte por ajustes, elige "No").
2. Sin sacar la microSD, abrela en el explorador de archivos (se llama
   "bootfs") y copia ahi user-data y network-config: reemplaza los que trae.
3. Pon la microSD en la Raspberry, conecta la camara, el cable de red o el
   modem si se usa, y la fuente. En 5 a 15 minutos aparece en SPACE OS.

El codigo que va dentro sirve UNA sola vez y vence en 14 dias.
`

export function kitRaspberry(d: DatosKitPi): Uint8Array {
  return zip([
    { nombre: 'user-data', texto: userData(d) },
    { nombre: 'network-config', texto: networkConfig(d.wifi) },
    { nombre: 'LEEME.txt', texto: LEEME },
  ])
}
