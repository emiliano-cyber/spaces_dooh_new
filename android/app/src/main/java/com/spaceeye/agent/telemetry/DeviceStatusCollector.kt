// DeviceStatusCollector.kt — Collects device telemetry
package com.spaceeye.agent.telemetry

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
    val uptimeSeconds: Long
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
        val signalDbm = try {
            tm.signalStrength?.cellSignalStrengths?.firstOrNull()?.dbm
        } catch (_: Exception) { null }

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
            uptimeSeconds = SystemClock.elapsedRealtime() / 1000
        )
    }

    private fun readCpuTemp(): Float? {
        return try {
            val paths = listOf(
                "/sys/class/thermal/thermal_zone0/temp",
                "/sys/devices/virtual/thermal/thermal_zone0/temp"
            )
            for (p in paths) {
                val f = java.io.File(p)
                if (f.exists()) {
                    return f.readText().trim().toFloat() / 1000f
                }
            }
            null
        } catch (_: Exception) { null }
    }
}
