// pi-agent/src/telemetria.js
// Arma el objeto que espera POST /api/device/status. Los nombres de los campos
// vienen del mundo Android (el backend nace de ahi) y aqui se rellenan con lo
// que si existe en Linux/Raspberry.
//
// Lo que todavia NO se reporta y llegara con el material que falta:
//   battery_pct real -> necesita el UPS con medidor I2C (hoy se manda 100).
//   signal_dbm LTE   -> hoy es la senal WiFi; con el modem sale de ModemManager.
//   gps_lat/lng      -> GNSS del modem LTE.
//   data_*           -> vnstat por interfaz.
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

function cmd(bin, args, ms = 3000) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function leerTexto(ruta) {
  try { return fs.readFileSync(ruta, 'utf8'); } catch { return null; }
}

// Modelo exacto de la placa, p.ej. "Raspberry Pi 5 Model B Rev 1.0".
function modelo() {
  const t = leerTexto('/proc/device-tree/model');
  return t ? t.replace(/\0/g, '').trim() : 'Raspberry Pi';
}

// El numero de serie de la placa es la identidad natural del equipo: sobrevive a
// reinstalaciones del sistema y no cambia si se mueve de red.
function serie() {
  const t = leerTexto('/proc/cpuinfo') || '';
  const m = t.match(/^Serial\s*:\s*([0-9a-f]+)/mi);
  return m ? m[1] : null;
}

function versionSo() {
  const t = leerTexto('/etc/os-release') || '';
  const m = t.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
  // La columna del backend tiene limite; un valor largo hace fallar el registro.
  return (m ? m[1] : `${os.type()} ${os.release()}`).slice(0, 60);
}

function temperaturaCpu() {
  const t = leerTexto('/sys/class/thermal/thermal_zone0/temp');
  if (!t) return undefined;
  const v = Number(t.trim()) / 1000;
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined;
}

function discoLibreMb(punto = '/') {
  try {
    const s = fs.statfsSync(punto);
    return Math.round((s.bavail * s.bsize) / 1048576);
  } catch {
    return undefined;
  }
}

// Interfaz por la que sale el trafico (la ruta por defecto).
function interfazSalida() {
  const t = leerTexto('/proc/net/route') || '';
  for (const linea of t.split('\n').slice(1)) {
    const c = linea.trim().split(/\s+/);
    if (c.length > 2 && c[1] === '00000000') return c[0];
  }
  return null;
}

function tipoRed(iface) {
  if (!iface) return 'DESCONECTADO';
  if (/^(wwan|ppp|usb)/.test(iface)) return 'MOBILE';
  if (/^(wl|wlan)/.test(iface)) return 'WIFI';
  if (/^(eth|en)/.test(iface)) return 'ETHERNET';
  return iface.toUpperCase();
}

// Nivel de senal WiFi en dBm, tal cual lo publica el kernel.
function senalWifi(iface) {
  const t = leerTexto('/proc/net/wireless') || '';
  for (const linea of t.split('\n')) {
    const m = linea.trim().match(/^([\w.-]+):\s+\d+\s+([-\d.]+)\s+([-\d.]+)/);
    if (m && (!iface || m[1] === iface)) {
      const dbm = parseFloat(m[3]);
      if (Number.isFinite(dbm)) return Math.round(dbm);
    }
  }
  return undefined;
}

// vcgencmd get_throttled: el bit 0 dice que AHORA falta voltaje y el bit 16 que
// falto en algun momento desde que arranco. Es la forma de cazar una fuente
// insuficiente (alimentar la Pi 5 desde el USB de una laptop, por ejemplo).
function alimentacion() {
  const s = cmd('vcgencmd', ['get_throttled']);
  if (!s) return null;
  const m = s.match(/0x([0-9a-f]+)/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return {
    crudo: s,
    subvoltaje_ahora: !!(v & 0x1),
    limitado_ahora: !!(v & 0x2),
    subvoltaje_ocurrido: !!(v & 0x10000),
    limitado_ocurrido: !!(v & 0x40000),
  };
}

function identidad() {
  const s = serie();
  return {
    // Prefijo "pi-" para distinguirlo de los telefonos y de los agentes de PC.
    device_uid: s ? `pi-${s}` : null,
    model: modelo(),
    manufacturer: 'Raspberry Pi',
    os_version: versionSo(),
  };
}

function recolectar() {
  const iface = interfazSalida();
  const tipo = tipoRed(iface);
  const ssid = tipo === 'WIFI' ? cmd('iwgetid', ['-r']) : null;

  return {
    // El backend exige battery_pct. Hasta que llegue el UPS con medidor I2C se
    // reporta "conectado a corriente", igual que hace el agente de PC.
    battery_pct: 100,
    battery_charging: true,
    network_type: tipo,
    network_operator: ssid || iface || 'sin red',
    signal_dbm: tipo === 'WIFI' ? senalWifi(iface) : undefined,
    storage_free_mb: discoLibreMb(),
    ram_free_mb: Math.round(os.freemem() / 1048576),
    cpu_temp: temperaturaCpu(),
    uptime_seconds: Math.round(os.uptime()),
  };
}

module.exports = { recolectar, identidad, alimentacion, modelo, serie, versionSo };
