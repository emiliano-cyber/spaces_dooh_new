package com.spaceeye.agent

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import com.spaceeye.agent.network.RemoteLog
import com.spaceeye.agent.service.RestartReceiver
import com.spaceeye.agent.service.WatchdogWorker
import kotlin.system.exitProcess

/**
 * Application con estrategias de auto-recuperacion para operacion desatendida:
 *  - Manejador global de excepciones: ante un crash, agenda un reinicio del
 *    servicio (via AlarmManager) antes de morir el proceso.
 *  - Watchdog periodico (WorkManager) que reactiva el servicio si se cayo.
 *
 * Ver docs/ANDROID_RESILIENCE.md para limitaciones del SO.
 */
class SpaceEyeApp : Application() {

    companion object {
        private const val TAG = "SpaceEyeApp"
        private const val RESTART_REQ = 7001
        private const val HEARTBEAT_REQ = 7002
        // Latido cada ~4 min: mucho mas rapido que el watchdog de WorkManager (15 min).
        private const val HEARTBEAT_INTERVAL = 4 * 60 * 1000L

        /** Agenda un reinicio del servicio ~2s en el futuro (sobrevive al proceso). */
        fun scheduleRestart(ctx: Context, delayMs: Long = 2000L) {
            val intent = Intent(ctx, RestartReceiver::class.java).apply {
                action = RestartReceiver.ACTION_RESTART
            }
            val pi = PendingIntent.getBroadcast(
                ctx, RESTART_REQ, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.set(AlarmManager.RTC, System.currentTimeMillis() + delayMs, pi)
        }

        /**
         * Programa el siguiente "latido": una alarma que dispara el RestartReceiver,
         * el cual reactiva el servicio (si murio) y vuelve a programar el latido.
         * `setAndAllowWhileIdle` funciona incluso en Doze. AlarmManager recrea el
         * proceso para ejecutar el receiver aunque la app este cerrada.
         */
        fun scheduleHeartbeat(ctx: Context) {
            val intent = Intent(ctx, RestartReceiver::class.java).apply {
                action = RestartReceiver.ACTION_HEARTBEAT
            }
            val pi = PendingIntent.getBroadcast(
                ctx, HEARTBEAT_REQ, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val at = System.currentTimeMillis() + HEARTBEAT_INTERVAL
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            } catch (e: Exception) {
                am.set(AlarmManager.RTC_WAKEUP, at, pi)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()

        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "Uncaught exception — programando reinicio", throwable)
            // Reporta el crash al backend antes de morir (sincrono, best-effort).
            try {
                RemoteLog.logCrashBlocking(
                    this, "crash",
                    "App crash: ${throwable.javaClass.simpleName}: ${throwable.message}"
                )
            } catch (_: Exception) {}
            try {
                scheduleRestart(this)
            } catch (e: Exception) {
                Log.e(TAG, "No se pudo agendar reinicio: ${e.message}")
            }
            // Dejar que el handler por defecto registre el crash y luego salir.
            previous?.uncaughtException(thread, throwable)
            android.os.Process.killProcess(android.os.Process.myPid())
            exitProcess(2)
        }

        // Watchdog periodico (WorkManager, 15 min) + latido rapido (~4 min).
        WatchdogWorker.schedule(this)
        scheduleHeartbeat(this)
    }
}
