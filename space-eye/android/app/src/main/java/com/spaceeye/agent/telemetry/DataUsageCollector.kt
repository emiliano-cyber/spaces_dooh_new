// DataUsageCollector.kt — Consumo de datos de la PROPIA app (chip Telcel / WiFi).
//
// Usa NetworkStatsManager consultando SOLO el UID propio, lo cual NO requiere el
// permiso especial PACKAGE_USAGE_STATS (ese solo haria falta para el consumo del
// dispositivo completo / de otras apps). Separa movil vs WiFi y calcula
// hoy / semana / mes / total-desde-instalacion por rango de fechas.
//
// En estos equipos dedicados la app es practicamente el unico consumidor, asi que
// su consumo movil ~ el gasto real del chip. Todo es lectura local: sin red, costo
// despreciable, sin impacto en el rendimiento.
package com.spaceeye.agent.telemetry

import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.net.ConnectivityManager
import android.os.Process
import java.util.Calendar

data class DataUsage(
    val mobileToday: Long?, val mobileWeek: Long?, val mobileMonth: Long?, val mobileTotal: Long?,
    val wifiToday: Long?, val wifiWeek: Long?, val wifiMonth: Long?, val wifiTotal: Long?
)

class DataUsageCollector(private val ctx: Context) {

    private val uid = Process.myUid()
    private val prefs = ctx.getSharedPreferences("space_eye_data_usage", Context.MODE_PRIVATE)

    // Epoch (ms) de la primera ejecucion = "desde la instalacion".
    private fun installEpoch(): Long {
        var v = prefs.getLong("install_epoch", 0L)
        if (v == 0L) {
            v = System.currentTimeMillis()
            prefs.edit().putLong("install_epoch", v).apply()
        }
        return v
    }

    fun collect(): DataUsage {
        val nsm = try {
            ctx.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
        } catch (_: Exception) { null } ?: return DataUsage(null, null, null, null, null, null, null, null)

        val now = System.currentTimeMillis()
        val day = startOfDay()
        val week = startOfWeek()
        val month = startOfMonth()
        val install = installEpoch()

        val M = ConnectivityManager.TYPE_MOBILE
        val W = ConnectivityManager.TYPE_WIFI
        return DataUsage(
            mobileToday = bytes(nsm, M, day, now),
            mobileWeek = bytes(nsm, M, week, now),
            mobileMonth = bytes(nsm, M, month, now),
            mobileTotal = bytes(nsm, M, install, now),
            wifiToday = bytes(nsm, W, day, now),
            wifiWeek = bytes(nsm, W, week, now),
            wifiMonth = bytes(nsm, W, month, now),
            wifiTotal = bytes(nsm, W, install, now),
        )
    }

    // Suma rx+tx del UID propio para el tipo de red y rango dados. null si falla
    // (algunos equipos/versiones restringen la consulta movil): la UI mostrara n/d.
    private fun bytes(nsm: NetworkStatsManager, networkType: Int, start: Long, end: Long): Long? {
        return try {
            // subscriberId = null: obsoleto/ignorado desde API 29; para el UID propio
            // no hace falta y evita depender de getSubscriberId (restringido).
            val stats = nsm.queryDetailsForUid(networkType, null, start, end, uid)
            var total = 0L
            val b = NetworkStats.Bucket()
            while (stats.hasNextBucket()) {
                stats.getNextBucket(b)
                total += b.rxBytes + b.txBytes
            }
            stats.close()
            total
        } catch (_: Exception) {
            null
        }
    }

    private fun midnight(cal: Calendar): Long {
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun startOfDay(): Long = midnight(Calendar.getInstance())

    private fun startOfWeek(): Long {
        val c = Calendar.getInstance()
        c.firstDayOfWeek = Calendar.MONDAY
        c.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        return midnight(c)
    }

    private fun startOfMonth(): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.DAY_OF_MONTH, 1)
        return midnight(c)
    }
}
