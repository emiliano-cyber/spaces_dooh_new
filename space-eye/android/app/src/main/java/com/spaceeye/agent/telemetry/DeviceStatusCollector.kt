// DeviceStatusCollector.kt — Collects device telemetry
package com.spaceeye.agent.telemetry

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.telephony.TelephonyManager

data class DeviceStatus(
    val batteryPct: Int,
    val batteryTemp: Float?,
    val batteryCharging: Boolean,
    val signalDbm: Int?,
    val networkType: String?,
    val networkOperator: String?,
    val gpsLat: Double?,
    val gpsLng: Double?,
    val gpsAccuracyM: Float?,
    val storageFreeMb: Long,
    val ramFreeMb: Long,
    val cpuTemp: Float?,
    val uptimeSeconds: Long,
    val dataUsage: DataUsage? = null,
    // Si la app es device owner puede instalar actualizaciones SIN que nadie
    // toque el equipo. Se reporta para saber desde el dashboard cuales sitios se
    // actualizan solos y cuales necesitan una mano.
    val deviceOwner: Boolean = false,
)

class DeviceStatusCollector(private val ctx: Context) {

    @Suppress("MissingPermission")
    fun collect(): DeviceStatus {
        val battery = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))!!
        val batteryPct = (battery.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) * 100) /
            battery.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        val batteryTemp = battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10f
        val charging = battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0

        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val nc = cm.getNetworkCapabilities(cm.activeNetwork)
        val netType = when {
            nc?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "WIFI"
            nc?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "CELLULAR"
            else -> "NONE"
        }

        val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        // Senal segun el transporte activo: en WiFi el RSSI (dBm) del WifiManager,
        // en celular el dBm de la senal movil. Antes solo leia celular, por eso
        // en WiFi siempre salia vacio.
        val signalDbm: Int? = when (netType) {
            "WIFI" -> try {
                val wm = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                @Suppress("DEPRECATION")
                wm.connectionInfo?.rssi?.takeIf { it != -127 && it < 0 }
            } catch (_: Exception) { null }
            "CELLULAR" -> try {
                tm.signalStrength?.cellSignalStrengths?.firstOrNull()?.dbm
            } catch (_: Exception) { null }
            else -> null
        }

        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val loc = try {
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
        } catch (_: SecurityException) { null }

        val statFs = StatFs(Environment.getDataDirectory().path)
        val freeMb = statFs.availableBytes / 1024 / 1024
        val runtime = Runtime.getRuntime()
        val ramFree = runtime.freeMemory() / 1024 / 1024

        return DeviceStatus(
            batteryPct = batteryPct,
            batteryTemp = batteryTemp,
            batteryCharging = charging,
            signalDbm = signalDbm,
            networkType = netType,
            networkOperator = tm.networkOperatorName,
            gpsLat = loc?.latitude,
            gpsLng = loc?.longitude,
            gpsAccuracyM = loc?.accuracy,
            storageFreeMb = freeMb,
            ramFreeMb = ramFree,
            cpuTemp = readCpuTemp(),
            uptimeSeconds = SystemClock.elapsedRealtime() / 1000,
            dataUsage = try { DataUsageCollector(ctx).collect() } catch (_: Exception) { null },
            deviceOwner = com.spaceeye.agent.update.AppUpdater.esDeviceOwner(ctx)
        )
    }

    // Temp de CPU: en Android 10+ los sysfs termicos suelen estar bloqueados
    // por SELinux para apps normales, asi que esto es best-effort. Escanea las
    // thermal_zone y devuelve la primera lectura en rango plausible (10-120 C).
    // Si nada es legible, se devuelve null y la UI cae a la temp de bateria.
    private fun readCpuTemp(): Float? {
        return try {
            for (i in 0..29) {
                val f = java.io.File("/sys/class/thermal/thermal_zone$i/temp")
                if (f.exists() && f.canRead()) {
                    val raw = f.readText().trim().toFloatOrNull() ?: continue
                    // Algunos exponen milésimas (45000), otros grados (45).
                    val c = if (raw > 1000f) raw / 1000f else raw
                    if (c in 10f..120f) return c
                }
            }
            null
        } catch (_: Exception) { null }
    }
}
